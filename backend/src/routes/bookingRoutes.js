'use strict';

const express = require('express');
const router = express.Router();

const {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
} = require('../controllers/bookingController.js');

const { authenticate } = require('../middleware/auth.js');

// All booking routes require authentication
router.use(authenticate);

// POST /bookings — create a new booking
router.post('/', createBooking);

// GET /bookings/my — list all bookings for the authenticated user
// NOTE: This route must be defined BEFORE /:id to avoid "my" being treated as an id
router.get('/my', getMyBookings);

// GET /bookings/:id — get a specific booking (owner or admin)
router.get('/:id', getBookingById);

// PATCH /bookings/:id/cancel — cancel a booking (owner only)
router.patch('/:id/cancel', cancelBooking);

module.exports = router;
