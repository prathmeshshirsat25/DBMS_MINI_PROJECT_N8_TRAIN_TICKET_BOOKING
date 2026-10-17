'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.js');
const {
  createPayment,
  getPaymentByBookingId,
} = require('../controllers/paymentController.js');

// POST /payments  – create a payment for a booking (simulates gateway)
router.post('/', authenticate, createPayment);

// GET /payments/booking/:booking_id  – fetch all payment records for a booking
router.get('/booking/:booking_id', authenticate, getPaymentByBookingId);

module.exports = router;
