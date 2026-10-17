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
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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
