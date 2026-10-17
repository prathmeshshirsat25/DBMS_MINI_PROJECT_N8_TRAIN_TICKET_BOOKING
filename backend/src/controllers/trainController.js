// controllers/trainController.js
// Handles train search, retrieval, routes, schedules, and available dates
// for the Railway Booking System.

const { query } = require('../config/db.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate journey duration between two route stops.
 * Accounts for day offsets (overnight / multi-day journeys).
 *
 * @param {string} depTime  - HH:MM departure time at source
 * @param {string} arrTime  - HH:MM arrival time at destination
 * @param {number} srcDayOffset - day_offset for source stop
 * @param {number} dstDayOffset - day_offset for destination stop
 * @returns {{ duration: string, duration_minutes: number }}
 */
function calculateDuration(depTime, arrTime, srcDayOffset, dstDayOffset) {
  if (!depTime || !arrTime) return { duration: 'N/A', duration_minutes: 0 };
  const [dh, dm] = depTime.split(':').map(Number);
  const [ah, am] = arrTime.split(':').map(Number);
  let totalMinutes =
    (ah * 60 + am) - (dh * 60 + dm) + ((dstDayOffset - srcDayOffset) * 24 * 60);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return { duration: `${hours}h ${mins}m`, duration_minutes: totalMinutes };
}

/**
 * Calculate fare for a given class and distance using demo fare policy.
 * Falls back to 1.00 per km for unknown class codes.
 * Minimum fare is 50.
 *
 * @param {string} classCode  - e.g. 'SL', '2A', '1A'
 * @param {number} distanceKm
 * @returns {number} fare in rupees
 */
function calculateFare(classCode, distanceKm) {
  const rates = { SL: 0.50, '2S': 0.40, CC: 1.20, '3A': 1.50, '2A': 2.00, '1A': 3.00 };
  const rate = rates[classCode] || 1.00;
  return Math.max(50, Math.round(distanceKm * rate));
}

/**
 * Resolve a station from either its code or name (case-insensitive).
 * Returns the station row or null.
 *
 * @param {string} identifier - station code or station name
 * @returns {Promise<object|null>}
 */
async function resolveStation(identifier) {
  if (!identifier) return null;
  const result = await query(
    `SELECT station_id, station_code, station_name, city, state
     FROM stations
     WHERE UPPER(station_code) = UPPER($1)
        OR UPPER(station_name) = UPPER($1)
     LIMIT 1`,
    [identifier.trim()]
  );
  return result.rows[0] || null;
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * GET /trains/search?from=&to=&date=YYYY-MM-DD&class=CLASS_CODE
 *
 * Searches for trains running between two stations on a given date.
 * Resolves from/to by station_code or station_name (case-insensitive).
 * Filters by class if provided.
 * Returns enriched train data including fare estimate.
 */
const searchTrains = async (req, res) => {
  try {
    const { from, to, date, class: classCode } = req.query;

    // ---- Validate required params ----------------------------------------
    if (!from || !to || !date) {
      return res.status(400).json({
        success: false,
        message: 'Query params "from", "to", and "date" are required.',
      });
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD.',
      });
    }

    // ---- Resolve stations -------------------------------------------------
    const [srcStation, dstStation] = await Promise.all([
      resolveStation(from),
      resolveStation(to),
    ]);

    if (!srcStation) {
      return res.status(404).json({
        success: false,
        message: `Source station not found: "${from}"`,
      });
    }
    if (!dstStation) {
      return res.status(404).json({
        success: false,
        message: `Destination station not found: "${to}"`,
      });
    }
    if (srcStation.station_id === dstStation.station_id) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination stations must be different.',
      });
    }

    // ---- Build query ------------------------------------------------------
    // Join trains ↔ two route rows (src/dst) ↔ schedules.
    // Ensure source stop_number < destination stop_number.
    // Optionally filter by class via train_classes.
    const params = [
      srcStation.station_id, // $1
      dstStation.station_id, // $2
      date,                  // $3
    ];

    let classFilter = '';
    if (classCode && classCode.trim()) {
      params.push(classCode.trim().toUpperCase());
      classFilter = `AND EXISTS (
        SELECT 1 FROM train_classes tc
        WHERE tc.train_id = t.train_id
          AND UPPER(tc.class_code) = $${params.length}
      )`;
    }

    const trainQuery = `
      SELECT
        t.train_id,
        t.train_number,
        t.train_name,
        t.train_type,
        t.total_coaches,
        src.stop_number          AS src_stop_number,
        src.departure_time       AS source_departure_time,
        src.day_offset           AS src_day_offset,
        dst.stop_number          AS dst_stop_number,
        dst.arrival_time         AS dest_arrival_time,
        dst.day_offset           AS dst_day_offset,
        (dst.distance_km - src.distance_km) AS distance_km,
        sch.schedule_id,
        sch.journey_date,
        sch.status               AS schedule_status
      FROM trains t
      JOIN routes src
        ON src.train_id = t.train_id
       AND src.station_id = $1
      JOIN routes dst
        ON dst.train_id = t.train_id
       AND dst.station_id = $2
      JOIN schedules sch
        ON sch.train_id = t.train_id
       AND sch.journey_date = $3
       AND sch.status = 'SCHEDULED'
      WHERE src.stop_number < dst.stop_number
      ${classFilter}
      ORDER BY src.departure_time
    `;

    const trainResult = await query(trainQuery, params);

    if (trainResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        count: 0,
        data: [],
        message: 'No trains found for the given criteria.',
      });
    }

    // ---- Enrich each train with classes + fare ----------------------------
    const trainIds = [...new Set(trainResult.rows.map((r) => r.train_id))];

    // Fetch all classes for matched trains in one query
    const classResult = await query(
      `SELECT train_id, class_id, class_code, class_name
       FROM train_classes
       WHERE train_id = ANY($1::int[])
       ORDER BY class_code`,
      [trainIds]
    );

    // Group classes by train_id
    const classesByTrain = {};
    for (const cls of classResult.rows) {
      if (!classesByTrain[cls.train_id]) classesByTrain[cls.train_id] = [];
      classesByTrain[cls.train_id].push({
        class_id: cls.class_id,
        class_code: cls.class_code,
        class_name: cls.class_name,
      });
    }

    // Build response rows
    const data = trainResult.rows.map((row) => {
      const { duration, duration_minutes } = calculateDuration(
        row.source_departure_time,
        row.dest_arrival_time,
        Number(row.src_day_offset),
        Number(row.dst_day_offset)
      );

      const distanceKm = Number(row.distance_km) || 0;
      const supportedClasses = classesByTrain[row.train_id] || [];

      // Calculate fare for requested class or all supported classes
      let fareEstimate = null;
      if (classCode && classCode.trim()) {
        fareEstimate = {
          [classCode.trim().toUpperCase()]: calculateFare(
            classCode.trim().toUpperCase(),
            distanceKm
          ),
        };
      } else {
        fareEstimate = {};
        for (const cls of supportedClasses) {
          fareEstimate[cls.class_code] = calculateFare(cls.class_code, distanceKm);
        }
      }

      return {
        train_id: row.train_id,
        train_number: row.train_number,
        train_name: row.train_name,
        train_type: row.train_type,
        total_coaches: row.total_coaches,
        schedule_id: row.schedule_id,
        journey_date: row.journey_date instanceof Date
          ? row.journey_date.toISOString().split('T')[0]
          : (row.journey_date ? String(row.journey_date).split('T')[0] : date),
        schedule_status: row.schedule_status,
        source_station_id: srcStation.station_id,
        source_station_name: srcStation.station_name,
        source_station_code: srcStation.station_code,
        destination_station_id: dstStation.station_id,
        destination_station_name: dstStation.station_name,
        destination_station_code: dstStation.station_code,
        source_departure_time: row.source_departure_time,
        dest_arrival_time: row.dest_arrival_time,
        destination_arrival_time: row.dest_arrival_time,
        duration,
        duration_minutes,
        distance_km: distanceKm,
        supported_classes: supportedClasses,
        fare_estimate: fareEstimate,
      };
    });

    return res.status(200).json({
      success: true,
      count: data.length,
      from: srcStation,
      to: dstStation,
      journey_date: date,
      data,
    });
  } catch (err) {
    console.error('[trainController.searchTrains]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to search trains',
      error: err.message,
    });
  }
};

/**
 * GET /trains?q=query&page=1&limit=20
 * Paginated list of trains; optionally filter by train_number or train_name.
 */
const getTrains = async (req, res) => {
  try {
    const q = req.query.q ? req.query.q.trim() : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const params = [];
    let whereClause = '';

    if (q) {
      params.push(`%${q}%`);
      whereClause = `WHERE train_number ILIKE $1 OR train_name ILIKE $1`;
    }

    // Count query
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM trains ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Data query
    params.push(limit);
    params.push(offset);
    const dataResult = await query(
      `SELECT train_id, train_number, train_name, train_type, total_coaches
       FROM trains
       ${whereClause}
       ORDER BY train_number
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      data: dataResult.rows,
    });
  } catch (err) {
    console.error('[trainController.getTrains]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trains',
      error: err.message,
    });
  }
};

/**
 * GET /trains/:id
 * Returns a single train with its supported classes.
 */
const getTrainById = async (req, res) => {
  try {
    const { id } = req.params;

    const trainResult = await query(
      `SELECT train_id, train_number, train_name, train_type, total_coaches
       FROM trains
       WHERE train_id = $1`,
      [id]
    );

    if (trainResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Train with id ${id} not found`,
      });
    }

    const classResult = await query(
      `SELECT class_id, class_code, class_name
       FROM train_classes
       WHERE train_id = $1
       ORDER BY class_code`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...trainResult.rows[0],
        classes: classResult.rows,
      },
    });
  } catch (err) {
    console.error('[trainController.getTrainById]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch train',
      error: err.message,
    });
  }
};

/**
 * GET /trains/:id/routes
 * Returns all route stops for a train with full station details, ordered by stop_number.
 */
const getTrainRoutes = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify train exists
    const trainCheck = await query(
      `SELECT train_id, train_number, train_name FROM trains WHERE train_id = $1`,
      [id]
    );
    if (trainCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Train with id ${id} not found`,
      });
    }

    const result = await query(
      `SELECT
         r.route_id,
         r.stop_number,
         r.arrival_time,
         r.departure_time,
         r.distance_km,
         r.day_offset,
         s.station_id,
         s.station_code,
         s.station_name,
         s.city,
         s.state
       FROM routes r
       JOIN stations s ON s.station_id = r.station_id
       WHERE r.train_id = $1
       ORDER BY r.stop_number`,
      [id]
    );

    return res.status(200).json({
      success: true,
      train: trainCheck.rows[0],
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error('[trainController.getTrainRoutes]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch train routes',
      error: err.message,
    });
  }
};

/**
 * GET /trains/:id/schedule?date=YYYY-MM-DD
 * Returns schedule information for a train on a given date (or all upcoming if no date).
 */
const getTrainSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    // Verify train exists
    const trainCheck = await query(
      `SELECT train_id, train_number, train_name FROM trains WHERE train_id = $1`,
      [id]
    );
    if (trainCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Train with id ${id} not found`,
      });
    }

    const params = [id];
    let dateFilter = '';

    if (date) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD.',
        });
      }
      params.push(date);
      dateFilter = `AND journey_date = $2`;
    } else {
      // Default: next 30 days of schedules
      params.push(30);
      dateFilter = `AND journey_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + ($2 || ' days')::INTERVAL)`;
    }

    const result = await query(
      `SELECT schedule_id, train_id, journey_date, status
       FROM schedules
       WHERE train_id = $1
       ${dateFilter}
       ORDER BY journey_date`,
      params
    );

    return res.status(200).json({
      success: true,
      train: trainCheck.rows[0],
      count: result.rows.length,
      data: result.rows,
    });
  } catch (err) {
    console.error('[trainController.getTrainSchedule]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch train schedule',
      error: err.message,
    });
  }
};

/**
 * GET /trains/available-dates?from=&to=&class=&month=YYYY-MM
 *
 * Returns all dates in the given month (or current month if omitted) on which
 * at least one SCHEDULED train runs between from and to stations.
 * Optionally filters by class.
 */
const getAvailableDates = async (req, res) => {
  try {
    const { from, to, class: classCode, month } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        message: 'Query params "from" and "to" are required.',
      });
    }

    // Validate month
    let monthStart, monthEnd;
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid month format. Use YYYY-MM.',
        });
      }
      monthStart = `${month}-01`;
      // Last day of month via date arithmetic
      const [yr, mo] = month.split('-').map(Number);
      const lastDay = new Date(yr, mo, 0).getDate();
      monthEnd = `${month}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // Current month
      const now = new Date();
      const yr = now.getFullYear();
      const mo = now.getMonth() + 1;
      const moStr = String(mo).padStart(2, '0');
      monthStart = `${yr}-${moStr}-01`;
      const lastDay = new Date(yr, mo, 0).getDate();
      monthEnd = `${yr}-${moStr}-${String(lastDay).padStart(2, '0')}`;
    }

    // Resolve stations
    const [srcStation, dstStation] = await Promise.all([
      resolveStation(from),
      resolveStation(to),
    ]);

    if (!srcStation) {
      return res.status(404).json({
        success: false,
        message: `Source station not found: "${from}"`,
      });
    }
    if (!dstStation) {
      return res.status(404).json({
        success: false,
        message: `Destination station not found: "${to}"`,
      });
    }
    if (srcStation.station_id === dstStation.station_id) {
      return res.status(400).json({
        success: false,
        message: 'Source and destination stations must be different.',
      });
    }

    const params = [
      srcStation.station_id, // $1
      dstStation.station_id, // $2
      monthStart,            // $3
      monthEnd,              // $4
    ];

    let classFilter = '';
    if (classCode && classCode.trim()) {
      params.push(classCode.trim().toUpperCase());
      classFilter = `AND EXISTS (
        SELECT 1 FROM train_classes tc
        WHERE tc.train_id = t.train_id
          AND UPPER(tc.class_code) = $${params.length}
      )`;
    }

    const result = await query(
      `SELECT DISTINCT sch.journey_date
       FROM trains t
       JOIN routes src
         ON src.train_id = t.train_id
        AND src.station_id = $1
       JOIN routes dst
         ON dst.train_id = t.train_id
        AND dst.station_id = $2
       JOIN schedules sch
         ON sch.train_id = t.train_id
        AND sch.status = 'SCHEDULED'
        AND sch.journey_date BETWEEN $3 AND $4
       WHERE src.stop_number < dst.stop_number
       ${classFilter}
       ORDER BY sch.journey_date`,
      params
    );

    return res.status(200).json({
      success: true,
      month: month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      from: srcStation,
      to: dstStation,
      count: result.rows.length,
      available_dates: result.rows.map((r) => r.journey_date),
    });
  } catch (err) {
    console.error('[trainController.getAvailableDates]', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch available dates',
      error: err.message,
    });
  }
};

module.exports = {
  searchTrains,
  getTrains,
  getTrainById,
  getTrainRoutes,
  getTrainSchedule,
  getAvailableDates,
};
