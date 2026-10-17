'use strict';

const express = require('express');
const router = express.Router();

const {
  getSeatsByTrain,
  blockSeats,
  releaseSeats,
  bookSeats,
} = require('../controllers/seatController.js');

// GET /seats/:train_id?class=CLASS&schedule_id=ID
router.get('/:train_id', getSeatsByTrain);

// POST /seats/block   — body: { seat_ids, minutes }
router.post('/block', blockSeats);

// POST /seats/release — body: { seat_ids }
router.post('/release', releaseSeats);

// POST /seats/book    — body: { seat_ids }  (called after payment confirmation)
router.post('/book', bookSeats);

module.exports = router;
