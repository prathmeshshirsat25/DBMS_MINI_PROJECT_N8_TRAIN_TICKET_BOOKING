'use strict';

const express = require('express');
const router = express.Router();

const { getPassengersByBooking } = require('../controllers/passengerController.js');
const { authenticate } = require('../middleware/auth.js');

// All passenger routes require authentication
router.use(authenticate);

// GET /passengers/booking/:booking_id — list passengers for a booking (owner or admin)
router.get('/booking/:booking_id', getPassengersByBooking);

module.exports = router;
