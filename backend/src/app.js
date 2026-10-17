// src/app.js
// Express application setup — all routes mounted here

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route modules
const authRoutes = require('./routes/authRoutes');
const stationRoutes = require('./routes/stationRoutes');
const trainRoutes = require('./routes/trainRoutes');
const seatRoutes = require('./routes/seatRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const passengerRoutes = require('./routes/passengerRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const cancellationRoutes = require('./routes/cancellationRoutes');
const refundRoutes = require('./routes/refundRoutes');

const app = express();

// ────────────────────────────────────────────────
// Core Middleware
// ────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
];
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',').forEach((url) => {
    const trimmed = url.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) allowedOrigins.push(trimmed);
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes('*') ||
        process.env.NODE_ENV !== 'production' ||
        hostname.endsWith('.vercel.app') ||
        hostname.endsWith('.onrender.com') ||
        hostname === 'localhost'
      ) {
        return callback(null, true);
      }
    } catch (_) {}
    return callback(new Error(`CORS policy: origin ${origin} not allowed.`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false }));

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ────────────────────────────────────────────────
// Health check
// ────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  try {
    const { testConnection } = require('./config/db');
    const dbInfo = await testConnection();
    res.json({
      success: true,
      status: 'healthy',
      database: dbInfo.db,
      timestamp: dbInfo.now,
    });
  } catch (err) {
    res.status(503).json({ success: false, status: 'unhealthy', message: err.message });
  }
});

// ────────────────────────────────────────────────
// API Routes — All Groups Integrated
// ────────────────────────────────────────────────
app.use('/api/auth', authRoutes);          // G3: Authentication
app.use('/api/stations', stationRoutes);   // G1: Station lookup
app.use('/api/trains', trainRoutes);       // G1: Train search
app.use('/api/seats', seatRoutes);         // G5: Seat management
app.use('/api/bookings', bookingRoutes);   // G4: Booking management
app.use('/api/passengers', passengerRoutes); // G4: Passenger management
app.use('/api/payments', paymentRoutes);   // G2: Payment processing
app.use('/api/tickets', ticketRoutes);     // G2: Ticket management
app.use('/api/cancellations', cancellationRoutes); // G2: Cancellation
app.use('/api/refunds', refundRoutes);     // G2: Refund management

// ────────────────────────────────────────────────
// Error Handling
// ────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
