'use strict';

const { query, getClient } = require('../config/db.js');

// ── refund-policy constants ───────────────────────────────────────────────────
// Hours before journey → refund percentage of total fare
const REFUND_POLICY = [
  { minHours: 48, pct: 0.90 },   // > 48 h → 90 %
  { minHours: 24, pct: 0.75 },   // 24 – 48 h → 75 %
  { minHours: 12, pct: 0.50 },   // 12 – 24 h → 50 %
  { minHours: 0,  pct: 0.25 },   // 0 – 12 h  → 25 %
  // after journey : 0 %
];

/**
 * Calculate the refund amount based on the demo cancellation policy.
 * @param {Date|string} journeyDate  - scheduled journey date/datetime
 * @param {number}      totalAmount  - total booking amount
 * @returns {{ refundPct: number, refundAmount: number, hoursRemaining: number }}
 */
function calculateRefund(journeyDate, totalAmount) {
  const now = new Date();
  const journey = new Date(journeyDate);
  const diffMs = journey - now;
  const hoursRemaining = diffMs / (1000 * 60 * 60);

  if (hoursRemaining <= 0) {
    // In demo mode: if journey date was today/past, grant demo baseline 50% refund
    return { refundPct: 0.50, refundAmount: parseFloat((totalAmount * 0.50).toFixed(2)), hoursRemaining: 0 };
  }

  for (const tier of REFUND_POLICY) {
    if (hoursRemaining >= tier.minHours) {
      const refundAmount = parseFloat((totalAmount * tier.pct).toFixed(2));
      return { refundPct: tier.pct, refundAmount, hoursRemaining };
    }
  }

  // Fallback (should not reach here)
  return { refundPct: 0, refundAmount: 0, hoursRemaining };
}

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * POST /cancellations
 * Protected – booking owner only.
 * Body: { booking_id, reason }
 *
 * Transaction steps:
 *  1. INSERT into cancellations
 *  2. UPDATE bookings SET status='CANCELLED'
 *  3. UPDATE tickets SET ticket_status='CANCELLED'
 *  4. Release seats → UPDATE seats SET status='AVAILABLE', blocked_until=NULL
 *  5. INSERT into refunds (status='PENDING')
 *  6. UPDATE payments SET payment_status='REFUNDED' (for SUCCESS payment)
 */
async function cancelBooking(req, res) {
  const { booking_id, reason } = req.body;
  const userId = req.user.user_id;

  if (!booking_id) {
    return res.status(400).json({ success: false, message: 'booking_id is required.' });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // ── Ownership + state verification ────────────────────────────────────
    const bookingRes = await client.query(
      `SELECT b.booking_id, b.user_id, b.status, b.total_amount, b.total_amount AS amount, s.journey_date
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

    if (booking.status !== 'CONFIRMED') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a booking with status '${booking.status}'. Only CONFIRMED bookings can be cancelled.`,
      });
    }

    // ── Refund calculation ────────────────────────────────────────────────
    const { refundPct, refundAmount, hoursRemaining } = calculateRefund(
      booking.journey_date,
      parseFloat(booking.amount)
    );

    // ── Step 1: INSERT into cancellations ─────────────────────────────────
    const cancellationInsert = await client.query(
      `INSERT INTO cancellations (booking_id, cancelled_at, reason, refund_amount)
       VALUES ($1, NOW(), $2, $3)
       RETURNING *`,
      [booking_id, reason || null, refundAmount]
    );
    const cancellation = cancellationInsert.rows[0];

    // ── Step 2: UPDATE bookings ───────────────────────────────────────────
    await client.query(
      `UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = $1`,
      [booking_id]
    );

    // ── Step 3: UPDATE tickets ────────────────────────────────────────────
    await client.query(
      `UPDATE tickets SET ticket_status = 'CANCELLED' WHERE booking_id = $1`,
      [booking_id]
    );

    // ── Step 4: Release passenger seats ──────────────────────────────────
    const seatIdsRes = await client.query(
      `SELECT seat_id FROM passengers
        WHERE booking_id = $1 AND seat_id IS NOT NULL`,
      [booking_id]
    );
    const seatIds = seatIdsRes.rows.map((r) => r.seat_id);

    if (seatIds.length > 0) {
      await client.query(
        `UPDATE seats
            SET status = 'AVAILABLE', blocked_until = NULL
          WHERE seat_id = ANY($1)`,
        [seatIds]
      );
    }

    // ── Step 5: INSERT into refunds ───────────────────────────────────────
    // Link to the original SUCCESS payment if present
    const paymentRes = await client.query(
      `SELECT payment_id FROM payments
        WHERE booking_id = $1 AND payment_status = 'SUCCESS'
        ORDER BY payment_date DESC
        LIMIT 1`,
      [booking_id]
    );
    const paymentId = paymentRes.rows.length > 0 ? paymentRes.rows[0].payment_id : null;

    const refundInsert = await client.query(
      `INSERT INTO refunds (payment_id, booking_id, refund_amount, refund_status, refund_date)
       VALUES ($1, $2, $3, 'PENDING', NOW())
       RETURNING *`,
      [paymentId, booking_id, refundAmount]
    );
    const refund = refundInsert.rows[0];

    // ── Step 6: Mark payment as REFUNDED ──────────────────────────────────
    await client.query(
      `UPDATE payments
          SET payment_status = 'REFUNDED'
        WHERE booking_id = $1 AND payment_status = 'SUCCESS'`,
      [booking_id]
    );

    await client.query('COMMIT');

    const refundPayload = {
      ...refund,
      refund_percentage: `${(refundPct * 100).toFixed(0)}%`,
      hours_remaining_at_cancellation: hoursRemaining.toFixed(2),
    };

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully.',
      data: {
        booking_status: 'CANCELLED',
        cancellation,
        refund: refundPayload,
      },
      booking_status: 'CANCELLED',
      cancellation,
      refund: refundPayload,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('cancelBooking error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    client.release();
  }
}

/**
 * GET /cancellations/booking/:booking_id
 * Protected – booking owner only.
 */
async function getCancellationByBookingId(req, res) {
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

    const cancellationRes = await query(
      'SELECT * FROM cancellations WHERE booking_id = $1 ORDER BY cancelled_at DESC',
      [booking_id]
    );

    return res.status(200).json({
      success: true,
      cancellations: cancellationRes.rows,
    });
  } catch (err) {
    console.error('getCancellationByBookingId error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

module.exports = { cancelBooking, getCancellationByBookingId };
