'use strict';

const { query } = require('../config/db.js');
const { ensureSeatsForTrain } = require('../controllers/seatController.js');

async function seedActiveTrains() {
  console.log('Fetching active scheduled trains from Supabase...');
  try {
    // Get distinct trains that have schedules
    const trainRes = await query(`
      SELECT DISTINCT s.train_id
      FROM schedules s
      LEFT JOIN seats st ON s.train_id = st.train_id
      WHERE st.seat_id IS NULL
      LIMIT 100
    `);

    const trainIds = trainRes.rows.map((r) => r.train_id);
    console.log(`Found ${trainIds.length} trains needing seat population.`);

    let processed = 0;
    for (const tid of trainIds) {
      await ensureSeatsForTrain(tid);
      processed++;
      if (processed % 10 === 0 || processed === trainIds.length) {
        console.log(`Seeded seats for ${processed}/${trainIds.length} trains...`);
      }
    }

    const countRes = await query('SELECT COUNT(*) as count FROM seats');
    console.log(`Finished! Total seats now in database: ${countRes.rows[0].count}`);
  } catch (err) {
    console.error('Error during batch seed:', err);
  } finally {
    process.exit(0);
  }
}

seedActiveTrains();
