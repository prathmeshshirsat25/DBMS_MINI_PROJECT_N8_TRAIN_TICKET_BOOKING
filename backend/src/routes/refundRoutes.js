'use strict';

const express = require('express');
const router = express.Router();

const { authenticate, requireAdmin } = require('../middleware/auth.js');
const {
  getRefundByBookingId,
  processRefund,
} = require('../controllers/refundController.js');

// GET /refunds/booking/:booking_id  – fetch refund records for a booking (owner only)
router.get('/booking/:booking_id', authenticate, getRefundByBookingId);

// PATCH /refunds/:refund_id/process  – mark a refund as PROCESSED (admin only)
router.patch('/:refund_id/process', authenticate, requireAdmin, processRefund);

module.exports = router;
