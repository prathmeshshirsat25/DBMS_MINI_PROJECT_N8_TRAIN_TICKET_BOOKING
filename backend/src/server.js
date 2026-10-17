// src/server.js
// Entry point — connects to database and starts HTTP server

require('dotenv').config();

const app = require('./app');
const { testConnection } = require('./config/db');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Verify database connectivity before accepting requests
    const dbInfo = await testConnection();
    console.log(`✓ Database connected: ${dbInfo.db} at ${dbInfo.now}`);

    app.listen(PORT, () => {
      console.log(`✓ Railway Booking System API running on http://localhost:${PORT}`);
      console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`  Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`  Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('✗ Failed to start server:', err.message);
    process.exit(1);
  }
}

startServer();
