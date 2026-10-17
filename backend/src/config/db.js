// src/config/db.js
// Centralized PostgreSQL connection pool
// Used by all route modules throughout the application

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Execute a parameterized query
 */
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV === 'development' && duration > 200) {
    console.log(`Slow query (${duration}ms):`, text.substring(0, 80));
  }
  return result;
}

/**
 * Get a client from the pool for transactions
 */
async function getClient() {
  return pool.connect();
}

/**
 * Test database connectivity
 */
async function testConnection() {
  const result = await query('SELECT NOW() AS now, current_database() AS db');
  return result.rows[0];
}

module.exports = { query, getClient, pool, testConnection };
