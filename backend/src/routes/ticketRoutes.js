'use strict';

const express = require('express');
const router = express.Router();

const { authenticate } = require('../middleware/auth.js');
const {
  getTicketByBookingId,
  getTicketById,
  getTicketByPnr,
  emailTicket,
} = require('../controllers/ticketController.js');

// NOTE: specific sub-paths must be declared BEFORE the generic /:ticket_id
// route so Express matches them first.

// POST /tickets/email/:booking_id – send or resend ticket confirmation to user email
router.post('/email/:booking_id', authenticate, emailTicket);

// GET /tickets/pnr/:pnr  – look up ticket by PNR number
router.get('/pnr/:pnr', authenticate, getTicketByPnr);

// GET /tickets/booking/:booking_id  – comprehensive ticket for a booking
router.get('/booking/:booking_id', authenticate, getTicketByBookingId);

// GET /tickets/:ticket_id  – fetch a single ticket by its own PK
router.get('/:ticket_id', authenticate, getTicketById);

module.exports = router;
