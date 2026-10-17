'use strict';

const { query } = require('../config/db.js');

// Coach configurations per class
const COACH_CONFIG = {
  'SL': { coaches: ['S1', 'S2'], seatsPerCoach: 54 },
  '3A': { coaches: ['B1', 'B2'], seatsPerCoach: 54 },
  '2A': { coaches: ['A1'], seatsPerCoach: 48 },
  '1A': { coaches: ['H1'], seatsPerCoach: 24 },
  '2S': { coaches: ['D1', 'D2'], seatsPerCoach: 54 },
  'CC': { coaches: ['C1', 'C2'], seatsPerCoach: 54 },
  'EC': { coaches: ['E1'], seatsPerCoach: 30 },
};

// Realistic pre-booked seat indexes (to simulate active bookings)
const PRE_BOOKED_SEATS = new Set([3, 7, 12, 14, 19, 23, 28, 31, 35, 42, 47, 51]);

/**
 * Inserts realistic seats for a specific train and class
 */
async function ensureSeatsForTrain(trainId, classType = null) {
  try {
    const tid = parseInt(trainId, 10);
    if (!tid) return [];

    // Check if seats already exist for this train (and class if provided)
    let checkSql = 'SELECT COUNT(*) as count FROM seats WHERE train_id = $1';
    const checkParams = [tid];
    if (classType) {
      checkSql += ' AND class_type = $2';
      checkParams.push(classType);
    }
    const checkRes = await query(checkSql, checkParams);
    if (parseInt(checkRes.rows[0].count, 10) > 0) {
      return; // Already populated
    }

    // Determine which classes to populate
    let classesToPopulate = [];
    if (classType) {
      classesToPopulate = [classType];
    } else {
      const tcRes = await query('SELECT class_code FROM train_classes WHERE train_id = $1', [tid]);
      classesToPopulate = tcRes.rows.map(r => r.class_code);
      if (classesToPopulate.length === 0) {
        classesToPopulate = ['SL', '3A'];
      }
    }

    // Prepare rows for bulk insert
    const insertValues = [];
    const valPlaceholders = [];
    let pIdx = 1;

    for (const cCode of classesToPopulate) {
      const cfg = COACH_CONFIG[cCode] || { coaches: [`C1`], seatsPerCoach: 54 };
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

    // Batch insert
    const insertSql = `
      INSERT INTO seats (train_id, coach_number, seat_number, class_type, status)
      VALUES ${valPlaceholders.join(',\n')}
    `;
    await query(insertSql, insertValues);
    console.log(`Seeded ${valPlaceholders.length} seats for train ${tid} (${classesToPopulate.join(', ')})`);
  } catch (err) {
    console.error(`Error ensuring seats for train ${trainId}:`, err.message);
  }
}

async function main() {
  console.log('Testing ensureSeatsForTrain on train 1001 (Deccan Queen)...');
  await ensureSeatsForTrain(1001, '2S');
  await ensureSeatsForTrain(1001, 'CC');

  const check = await query('SELECT coach_number, class_type, count(*) FROM seats WHERE train_id = 1001 GROUP BY coach_number, class_type ORDER BY coach_number');
  console.log('Seats for train 1001:', check.rows);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { ensureSeatsForTrain, COACH_CONFIG };
