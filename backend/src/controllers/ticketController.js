'use strict';

const { query } = require('../config/db.js');
const { sendTicketConfirmationEmail } = require('../services/emailService.js');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Assert that the given booking_id belongs to req.user.user_id.
 * Returns the booking row on success, or sends a 403/404 and returns null.
 */
async function assertBookingOwnership(res, bookingId, userId) {
  const bookingRes = await query(
    'SELECT user_id FROM bookings WHERE booking_id = $1',
    [bookingId]
  );
  if (bookingRes.rows.length === 0) {
    res.status(404).json({ success: false, message: 'Booking not found.' });
    return null;
  }
  if (String(bookingRes.rows[0].user_id) !== String(userId)) {
    res.status(403).json({
      success: false,
      message: 'Access denied. This booking does not belong to you.',
    });
    return null;
  }
  return bookingRes.rows[0];
}

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * GET /tickets/booking/:booking_id
 * Protected – booking owner only.
 *
 * Returns a comprehensive ticket object:
 *   ticket → booking → train → stations → passengers → payment
 */
async function getTicketByBookingId(req, res) {
  const { booking_id } = req.params;
  const userId = req.user.user_id;

  try {
    const ownership = await assertBookingOwnership(res, booking_id, userId);
    if (!ownership) return; // response already sent

    // ── ticket row ────────────────────────────────────────────────────────
    const ticketRes = await query(
      'SELECT * FROM tickets WHERE booking_id = $1',
      [booking_id]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No ticket found for this booking.',
      });
    }

    // ── full booking with train + station info ────────────────────────────
    const bookingRes = await query(
      `SELECT
         b.*,
         s.journey_date,
         t.train_number, t.train_name, t.train_type,
         src.station_name  AS source_station_name,
         src.station_code  AS source_station_code,
         src.city          AS source_city,
         dst.station_name  AS destination_station_name,
         dst.station_code  AS destination_station_code,
         dst.city          AS destination_city
       FROM bookings b
       LEFT JOIN schedules s   ON s.schedule_id = b.schedule_id
       LEFT JOIN trains    t   ON t.train_id   = s.train_id
       LEFT JOIN stations  src ON src.station_id = b.source_station_id
       LEFT JOIN stations  dst ON dst.station_id = b.destination_station_id
       WHERE b.booking_id = $1`,
      [booking_id]
    );

    // ── passengers with seat details ──────────────────────────────────────
    const passengersRes = await query(
      `SELECT
         p.*,
         s.seat_number, s.class_type, s.coach_number
       FROM passengers p
       LEFT JOIN seats s ON s.seat_id = p.seat_id
       WHERE p.booking_id = $1
       ORDER BY p.passenger_id`,
      [booking_id]
    );

    // ── latest successful payment ─────────────────────────────────────────
    const paymentRes = await query(
      `SELECT * FROM payments
        WHERE booking_id = $1
        ORDER BY payment_date DESC
        LIMIT 1`,
      [booking_id]
    );

    const b = bookingRes.rows[0] || {};
    const fullTicket = {
      ...ticketRes.rows[0],
      pnr: b.pnr,
      train_number: b.train_number,
      train_name: b.train_name,
      train_type: b.train_type,
      journey_date: b.journey_date,
      total_amount: b.total_amount,
      source_station_name: b.source_station_name,
      source_station_code: b.source_station_code,
      destination_station_name: b.destination_station_name,
      destination_station_code: b.destination_station_code,
      source_station: {
        code: b.source_station_code,
        name: b.source_station_name,
        city: b.source_city,
      },
      destination_station: {
        code: b.destination_station_code,
        name: b.destination_station_name,
        city: b.destination_city,
      },
      booking: b,
      passengers: passengersRes.rows,
      fare_details: {
        total_amount: b.total_amount,
        payment: paymentRes.rows[0] || null,
      },
      payment: paymentRes.rows[0] || null,
    };

    return res.status(200).json({
      success: true,
      data: fullTicket,
      ticket: fullTicket,
    });
  } catch (err) {
    console.error('getTicketByBookingId error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /tickets/:ticket_id
 * Protected – returns ticket details for the authenticated user's ticket.
 */
async function getTicketById(req, res) {
  const { ticket_id } = req.params;
  const userId = req.user.user_id;

  try {
    const ticketRes = await query(
      'SELECT * FROM tickets WHERE ticket_id = $1',
      [ticket_id]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const ticket = ticketRes.rows[0];

    // Ownership check via booking
    const ownership = await assertBookingOwnership(res, ticket.booking_id, userId);
    if (!ownership) return;

    return res.status(200).json({ success: true, ticket });
  } catch (err) {
    console.error('getTicketById error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * GET /tickets/pnr/:pnr
 * Protected – look up a ticket by booking PNR.
 */
async function getTicketByPnr(req, res) {
  const { pnr } = req.params;
  const userId = req.user.user_id;

  try {
    // Resolve booking by PNR first
    const bookingRes = await query(
      'SELECT booking_id, user_id FROM bookings WHERE pnr = $1',
      [pnr]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No booking found with this PNR.' });
    }

    const booking = bookingRes.rows[0];

    if (String(booking.user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This booking does not belong to you.',
      });
    }

    const ticketRes = await query(
      'SELECT * FROM tickets WHERE booking_id = $1',
      [booking.booking_id]
    );

    if (ticketRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No ticket found for this PNR.' });
    }

    return res.status(200).json({ success: true, ticket: ticketRes.rows[0] });
  } catch (err) {
    console.error('getTicketByPnr error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * POST /tickets/email/:booking_id
 * Protected – booking owner only.
 * Manually sends / resends the ticket confirmation and ERS to the user's email.
 */
async function emailTicket(req, res) {
  const { booking_id } = req.params;
  const userId = req.user.user_id;

  try {
    const ownership = await assertBookingOwnership(res, booking_id, userId);
    if (!ownership) return;

    const result = await sendTicketConfirmationEmail(booking_id);
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to send ticket email.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Ticket confirmation email sent successfully.',
      data: { messageId: result.messageId },
    });
  } catch (err) {
    console.error('emailTicket error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { getTicketByBookingId, getTicketById, getTicketByPnr, emailTicket };
