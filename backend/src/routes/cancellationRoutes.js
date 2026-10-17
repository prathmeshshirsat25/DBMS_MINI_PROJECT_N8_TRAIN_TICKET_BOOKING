'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.js');
const {
  cancelBooking,
  getCancellationByBookingId,
} = require('../controllers/cancellationController.js');

// POST /cancellations  – cancel a CONFIRMED booking
router.post('/', authenticate, cancelBooking);

// GET /cancellations/booking/:booking_id  – fetch cancellation record(s) for a booking
router.get('/booking/:booking_id', authenticate, getCancellationByBookingId);

module.exports = router;
