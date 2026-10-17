'use strict';

const { query, getClient } = require('../config/db.js');

// Coach configurations per class
const COACH_CONFIG = {
  SL: { coaches: ['S1', 'S2'], seatsPerCoach: 54 },
  '3A': { coaches: ['B1', 'B2'], seatsPerCoach: 54 },
  '2A': { coaches: ['A1'], seatsPerCoach: 48 },
  '1A': { coaches: ['H1'], seatsPerCoach: 24 },
  '2S': { coaches: ['D1', 'D2'], seatsPerCoach: 54 },
  CC: { coaches: ['C1', 'C2'], seatsPerCoach: 54 },
  EC: { coaches: ['E1'], seatsPerCoach: 30 },
};

// Realistic pre-booked seat indexes (to simulate authentic active railway bookings)
const PRE_BOOKED_SEATS = new Set([3, 7, 12, 14, 19, 23, 28, 31, 35, 42, 47, 51]);

/**
 * Computes authentic berth code (LB, MB, UB, SL, SU, W, M, A)
 */
function computeBerthType(classType, seatNumStr) {
  const num = parseInt(seatNumStr, 10);
  if (isNaN(num)) return '';

  const cls = String(classType || '').toUpperCase();
  if (cls === 'SL' || cls === '3A') {
    const mod = num % 8;
    if (mod === 1 || mod === 4) return 'LB';
    if (mod === 2 || mod === 5) return 'MB';
    if (mod === 3 || mod === 6) return 'UB';
    if (mod === 7) return 'SL';
    return 'SU';
  } else if (cls === '2A') {
    const mod = num % 6;
    if (mod === 1 || mod === 3) return 'LB';
    if (mod === 2 || mod === 4) return 'UB';
    if (mod === 5) return 'SL';
    return 'SU';
  } else if (cls === '1A') {
    return num % 2 === 1 ? 'LB' : 'UB';
  } else if (cls === '2S' || cls === 'CC') {
    const mod = num % 5;
    if (mod === 1 || mod === 0) return 'W';
    if (mod === 2 || mod === 4) return 'A';
    return 'M';
  } else if (cls === 'EC') {
    const mod = num % 4;
    if (mod === 1 || mod === 0) return 'W';
    return 'A';
  }
  return '';
}

/**
 * Ensures realistic coaches and seats exist in database for any train and class.
 * Automatically runs if no seats exist when requested.
 */
async function ensureSeatsForTrain(trainId, classType = null) {
  try {
    const tid = parseInt(trainId, 10);
    if (!tid) return;

    // Check if seats already exist for this train (and class if provided)
    let checkSql = 'SELECT COUNT(*) as count FROM seats WHERE train_id = $1';
    const checkParams = [tid];
    if (classType) {
      checkSql += ' AND class_type = $2';
      checkParams.push(classType);
    }
    const checkRes = await query(checkSql, checkParams);
    if (parseInt(checkRes.rows[0].count, 10) > 0) {
      return;
    }

    // Determine which classes to populate
    let classesToPopulate = [];
    if (classType) {
      classesToPopulate = [classType];
    } else {
      const tcRes = await query('SELECT class_code FROM train_classes WHERE train_id = $1', [tid]);
      classesToPopulate = tcRes.rows.map((r) => r.class_code);
      if (classesToPopulate.length === 0) {
        classesToPopulate = ['SL', '3A'];
      }
    }

    // Prepare batch insert
    const insertValues = [];
    const valPlaceholders = [];
    let pIdx = 1;

    for (const cCode of classesToPopulate) {
      const cfg = COACH_CONFIG[cCode] || { coaches: ['C1'], seatsPerCoach: 54 };
      for (const coach of cfg.coaches) {
        for (let s = 1; s <= cfg.seatsPerCoach; s++) {
          const seatNum = String(s);
          const status = PRE_BOOKED_SEATS.has(s) ? 'BOOKED' : 'AVAILABLE';
          valPlaceholders.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
          insertValues.push(tid, coach, seatNum, cCode, status);
        }
      }
    }

    if (valPlaceholders.length === 0) return;

    const insertSql = `
      INSERT INTO seats (train_id, coach_number, seat_number, class_type, status)
      VALUES ${valPlaceholders.join(',\n')}
    `;
    await query(insertSql, insertValues);
  } catch (err) {
    console.error(`ensureSeatsForTrain warning for train ${trainId}:`, err.message);
  }
}

/**
 * GET /seats/:train_id?class=CLASS&schedule_id=ID
 * Returns seats for a given train, optionally filtered by class_type and/or schedule_id.
 * Expired BLOCKED seats (blocked_until <= NOW()) are treated as AVAILABLE.
 * Results are grouped by coach_number.
 */
const getSeatsByTrain = async (req, res) => {
  try {
    const { train_id } = req.params;
    const { class: classType, schedule_id } = req.query;

    const tid = parseInt(train_id, 10);
    if (!tid) {
      return res.status(400).json({ success: false, message: 'Invalid train ID' });
    }

    const buildQuery = () => {
      const params = [tid];
      let idx = 2;
      const conditions = ['train_id = $1'];

      if (classType) {
        conditions.push(`class_type = $${idx++}`);
        params.push(classType);
      }

      if (schedule_id) {
        conditions.push(`(schedule_id = $${idx++} OR schedule_id IS NULL)`);
        params.push(schedule_id);
      }

      const whereClause = conditions.join(' AND ');

      const sql = `
        SELECT
          seat_id,
          train_id,
          coach_number,
          seat_number,
          class_type,
          schedule_id,
          blocked_until,
          CASE
            WHEN status = 'BLOCKED' AND blocked_until <= NOW() THEN 'AVAILABLE'
            ELSE status
          END AS status
        FROM seats
        WHERE ${whereClause}
        ORDER BY coach_number, CAST(NULLIF(regexp_replace(seat_number, '\\D', '', 'g'), '') AS integer)
      `;
      return { sql, params };
    };

    let { sql, params } = buildQuery();
    let result = await query(sql, params);

    // If no seats exist for this train & class, auto-generate realistic seat matrix
    if (result.rows.length === 0) {
      await ensureSeatsForTrain(tid, classType);
      const re = buildQuery();
      result = await query(re.sql, re.params);
    }

    // Group by coach_number & annotate berth_type
    const grouped = {};
    for (const seat of result.rows) {
      seat.berth_type = computeBerthType(seat.class_type, seat.seat_number);
      const coach = seat.coach_number;
      if (!grouped[coach]) grouped[coach] = [];
      grouped[coach].push(seat);
    }

    return res.status(200).json({
      success: true,
      train_id: tid,
      total_seats: result.rows.length,
      data: grouped,
      coaches: grouped,
    });
  } catch (err) {
    console.error('getSeatsByTrain error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /seats/block
 * Body: { seat_ids: [1,2,3], minutes: 10 }
 * Blocks seats that are AVAILABLE or have expired BLOCKED status.
 * Returns error if any seat is already BOOKED.
 */
const blockSeats = async (req, res) => {
  const client = await getClient();
  try {
    const { seat_ids, minutes = 10 } = req.body;

    if (!Array.isArray(seat_ids) || seat_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'seat_ids must be a non-empty array' });
    }

    if (typeof minutes !== 'number' || minutes <= 0) {
      return res.status(400).json({ success: false, message: 'minutes must be a positive number' });
    }

    await client.query('BEGIN');

    const blockedSeatIds = [];
    const alreadyBooked = [];

    for (const seat_id of seat_ids) {
      // Attempt to block: only if AVAILABLE or if BLOCKED but expired
      const updateResult = await client.query(
        `UPDATE seats
         SET status = 'BLOCKED', blocked_until = NOW() + ($1 || ' minutes')::interval
         WHERE seat_id = $2
           AND (
             status = 'AVAILABLE'
             OR (status = 'BLOCKED' AND blocked_until <= NOW())
           )
         RETURNING seat_id`,
        [minutes, seat_id]
      );

      if (updateResult.rowCount === 0) {
        const checkResult = await client.query(
          `SELECT status FROM seats WHERE seat_id = $1`,
          [seat_id]
        );
        if (checkResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ success: false, message: `Seat ${seat_id} not found` });
        }
        alreadyBooked.push(seat_id);
      } else {
        blockedSeatIds.push(seat_id);
      }
    }

    if (alreadyBooked.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'Some seats are unavailable',
        unavailable_seat_ids: alreadyBooked,
      });
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${blockedSeatIds.length} seat(s) blocked for ${minutes} minute(s)`,
      blocked_seat_ids: blockedSeatIds,
      blocked_until: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('blockSeats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

/**
 * POST /seats/release
 * Body: { seat_ids: [1,2,3] }
 * Releases BLOCKED seats back to AVAILABLE.
 */
const releaseSeats = async (req, res) => {
  try {
    const { seat_ids } = req.body;

    if (!Array.isArray(seat_ids) || seat_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'seat_ids must be a non-empty array' });
    }

    const result = await query(
      `UPDATE seats
       SET status = 'AVAILABLE', blocked_until = NULL
       WHERE seat_id = ANY($1) AND status = 'BLOCKED'
       RETURNING seat_id`,
      [seat_ids]
    );

    return res.status(200).json({
      success: true,
      message: `${result.rowCount} seat(s) released`,
      released_seat_ids: result.rows.map((r) => r.seat_id),
    });
  } catch (err) {
    console.error('releaseSeats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * POST /seats/book
 * Body: { seat_ids: [1,2,3] }
 * Confirms booking for seats that are currently BLOCKED (and not expired).
 * Called after payment confirmation.
 */
const bookSeats = async (req, res) => {
  try {
    const { seat_ids } = req.body;

    if (!Array.isArray(seat_ids) || seat_ids.length === 0) {
      return res.status(400).json({ success: false, message: 'seat_ids must be a non-empty array' });
    }

    const result = await query(
      `UPDATE seats
       SET status = 'BOOKED', blocked_until = NULL
       WHERE seat_id = ANY($1)
         AND status = 'BLOCKED'
         AND blocked_until > NOW()
       RETURNING seat_id`,
      [seat_ids]
    );

    if (result.rowCount !== seat_ids.length) {
      const bookedIds = result.rows.map((r) => r.seat_id);
      const failedIds = seat_ids.filter((id) => !bookedIds.includes(id));
      return res.status(409).json({
        success: false,
        message: 'Some seats could not be booked (not blocked or block expired)',
        failed_seat_ids: failedIds,
        booked_seat_ids: bookedIds,
      });
    }

    return res.status(200).json({
      success: true,
      message: `${result.rowCount} seat(s) successfully booked`,
      booked_seat_ids: result.rows.map((r) => r.seat_id),
    });
  } catch (err) {
    console.error('bookSeats error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = {
  getSeatsByTrain,
  blockSeats,
  releaseSeats,
  bookSeats,
  ensureSeatsForTrain,
  COACH_CONFIG,
};
