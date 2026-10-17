'use strict';

const { query, getClient } = require('../config/db.js');

// ── controllers ───────────────────────────────────────────────────────────────

/**
 * GET /refunds/booking/:booking_id
 * Protected – booking owner only.
 * Returns all refund records associated with the booking.
 */
async function getRefundByBookingId(req, res) {
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

    const refundRes = await query(
      `SELECT r.*, p.transaction_id, p.payment_method
         FROM refunds r
         LEFT JOIN payments p ON p.payment_id = r.payment_id
        WHERE r.booking_id = $1
        ORDER BY r.refund_date DESC`,
      [booking_id]
    );

    const latestRefund = refundRes.rows[0] || null;
    return res.status(200).json({
      success: true,
      data: latestRefund,
      refund: latestRefund,
      refunds: refundRes.rows,
    });
  } catch (err) {
    console.error('getRefundByBookingId error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
}

/**
 * PATCH /refunds/:refund_id/process
 * Admin only.
 * Updates refund_status → PROCESSED and sets refund_date to now.
 *
 * Body (optional): { refund_status: 'PROCESSED' | 'FAILED' }
 * Defaults to 'PROCESSED' if body is omitted.
 */
async function processRefund(req, res) {
  const { refund_id } = req.params;
  // Allow admin to explicitly mark as FAILED if needed; defaults to PROCESSED
  const newStatus =
    req.body && req.body.refund_status === 'FAILED' ? 'FAILED' : 'PROCESSED';

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Fetch the refund
    const refundRes = await client.query(
      'SELECT * FROM refunds WHERE refund_id = $1',
      [refund_id]
    );

    if (refundRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Refund not found.' });
    }

    const refund = refundRes.rows[0];

    if (refund.refund_status !== 'PENDING') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: `Refund is already ${refund.refund_status}. Only PENDING refunds can be processed.`,
      });
    }

    // Update refund status
    const updated = await client.query(
      `UPDATE refunds
          SET refund_status = $1, refund_date = NOW()
        WHERE refund_id = $2
        RETURNING *`,
      [newStatus, refund_id]
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Refund marked as ${newStatus}.`,
      refund: updated.rows[0],
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('processRefund error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  } finally {
    client.release();
  }
}

module.exports = { getRefundByBookingId, processRefund };
