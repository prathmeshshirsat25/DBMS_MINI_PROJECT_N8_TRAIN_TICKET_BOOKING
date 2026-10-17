'use strict';

const { query, getClient } = require('../config/db.js');
const { sendTicketConfirmationEmail } = require('../services/emailService.js');

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a pseudo-unique transaction ID.
 * Format: TXN<timestamp_base36><4 random chars>
 */
function generateTransactionId() {
  return (
    'TXN' +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

/**
 * Generate a ticket number derived from the booking's PNR.
 * @param {string|null} pnr
 */
function generateTicketNumber(pnr) {
  const base = pnr ? pnr.replace(/\D/g, '').slice(-6) : '000000';
  return `TKT-${base}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * POST /payments
 * Body: { booking_id, payment_method, simulate_status? }
 * Protected: req.user.user_id
 *
 * Flow:
 *  1. Verify booking exists & belongs to the authenticated user.
 *  2. Verify booking status is PENDING.
 *  3. Check no SUCCESS payment already exists (idempotency guard).
 *  4. Open a DB transaction:
 *     a. INSERT payment row.
 *     b. If SUCCESS  → confirm booking, mark seats BOOKED, generate ticket.
 *     c. If FAILED   → payment recorded, booking stays PENDING.
 *     d. If PENDING  → payment recorded, booking stays PENDING.
 */
async function createPayment(req, res) {
  const { booking_id, payment_method, simulate_status } = req.body;
  const userId = req.user.user_id;

  // ── input validation ──────────────────────────────────────────────────────
  if (!booking_id || !payment_method) {
    return res.status(400).json({
      success: false,
      message: 'booking_id and payment_method are required.',
    });
  }

  const VALID_METHODS = ['UPI', 'CARD', 'NETBANKING', 'WALLET'];
  if (!VALID_METHODS.includes(payment_method.toUpperCase())) {
    return res.status(400).json({
      success: false,
      message: `payment_method must be one of: ${VALID_METHODS.join(', ')}.`,
    });
  }

  const VALID_STATUSES = ['SUCCESS', 'FAILED', 'PENDING'];
  const paymentStatus =
    simulate_status && VALID_STATUSES.includes(simulate_status.toUpperCase())
      ? simulate_status.toUpperCase()
      : 'SUCCESS';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // ── 1. Verify booking ownership ───────────────────────────────────────
    const bookingRes = await client.query(
      `SELECT b.booking_id, b.status, b.pnr, b.user_id, b.total_amount, b.total_amount AS amount, s.journey_date
         FROM bookings b
         LEFT JOIN schedules s ON s.schedule_id = b.schedule_id
        WHERE b.booking_id = $1`,
      [booking_id]
    );

    if (bookingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    const booking = bookingRes.rows[0];

    if (String(booking.user_id) !== String(userId)) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        message: 'Access denied. This booking does not belong to you.',
      });
    }

    // ── 2. Verify booking is PENDING ──────────────────────────────────────
    if (booking.status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Booking is already ${booking.status}. Only PENDING bookings can be paid.`,
      });
    }

    // ── 3. Idempotency: no duplicate SUCCESS payment ───────────────────────
    const existingPayment = await client.query(
      `SELECT payment_id FROM payments
        WHERE booking_id = $1 AND payment_status = 'SUCCESS'`,
      [booking_id]
    );

    if (existingPayment.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        message: 'A successful payment already exists for this booking.',
      });
    }

    // ── 4a. INSERT payment ────────────────────────────────────────────────
    const transactionId = generateTransactionId();
    const paymentInsert = await client.query(
      `INSERT INTO payments
         (booking_id, amount, payment_method, transaction_id, payment_status, payment_date)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [
        booking_id,
        booking.amount,
        payment_method.toUpperCase(),
        transactionId,
        paymentStatus,
      ]
    );
    const payment = paymentInsert.rows[0];

    let bookingStatus = booking.status; // still PENDING unless SUCCESS
    let ticket = null;

    // ── 4b. SUCCESS path ──────────────────────────────────────────────────
    if (paymentStatus === 'SUCCESS') {
      // Confirm the booking
      await client.query(
        `UPDATE bookings SET status = 'CONFIRMED' WHERE booking_id = $1`,
        [booking_id]
      );
      bookingStatus = 'CONFIRMED';

      // Mark all passenger seats as BOOKED
      await client.query(
        `UPDATE seats s
            SET status = 'BOOKED', blocked_until = NULL
           FROM passengers p
          WHERE p.booking_id = $1
            AND p.seat_id IS NOT NULL
            AND s.seat_id = p.seat_id`,
        [booking_id]
      );

      // Check if ticket already generated for this booking
      const existingTkt = await client.query(
        'SELECT * FROM tickets WHERE booking_id = $1 LIMIT 1',
        [booking_id]
      );
      if (existingTkt.rows.length > 0) {
        ticket = existingTkt.rows[0];
      } else {
        const ticketNumber = generateTicketNumber(booking.pnr);
        const ticketInsert = await client.query(
          `INSERT INTO tickets (booking_id, ticket_number, issued_at, ticket_status)
           VALUES ($1, $2, NOW(), 'VALID')
           RETURNING *`,
          [booking_id, ticketNumber]
        );
        ticket = ticketInsert.rows[0];
      }
    }

    await client.query('COMMIT');

    // Send Electronic Reservation Slip (ERS) and confirmation to passenger's email (non-blocking)
    if (paymentStatus === 'SUCCESS') {
      sendTicketConfirmationEmail(booking_id).catch((emailErr) => {
        console.warn(`[paymentController] Non-fatal email error for booking #${booking_id}:`, emailErr.message);
      });
    }

    return res.status(200).json({
      success: true,
      message: `Payment ${paymentStatus.toLowerCase()}${
        paymentStatus === 'SUCCESS' ? '. Booking confirmed and ticket issued.' : '.'
      }`,
      data: {
        payment,
        booking_status: bookingStatus,
        ticket,
      },
      payment,
      booking_status: bookingStatus,
      ticket,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPayment error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    client.release();
  }
}

/**
 * GET /payments/booking/:booking_id
 * Protected – only the booking owner may view payment details.
 */
async function getPaymentByBookingId(req, res) {
  const { booking_id } = req.params;
  const userId = req.user.user_id;

  try {
    // Ownership check
    const bookingRes = await query(
      'SELECT user_id FROM bookings WHERE booking_id = $1',
      [booking_id]
    );

    if (bookingRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (String(bookingRes.rows[0].user_id) !== String(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This booking does not belong to you.',
      });
    }

    const paymentRes = await query(
      `SELECT * FROM payments WHERE booking_id = $1 ORDER BY payment_date DESC`,
      [booking_id]
    );

    return res.status(200).json({
      success: true,
      payments: paymentRes.rows,
    });
  } catch (err) {
    console.error('getPaymentByBookingId error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { createPayment, getPaymentByBookingId };
