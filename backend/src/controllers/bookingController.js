'use strict';

const { query, getClient } = require('../config/db.js');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generates a unique PNR string.
 * Format: 'PNR' + base-36 timestamp (upper) + 3 random base-36 chars (upper)
 */
function generatePNR() {
  return (
    'PNR' +
    Date.now().toString(36).toUpperCase() +
    Math.random().toString(36).slice(2, 5).toUpperCase()
  );
}

/**
 * Normalizes a gender value to the allowed enum: MALE | FEMALE | OTHER.
 */
function normalizeGender(g) {
  if (!g) return 'OTHER';
  const upper = String(g).toUpperCase();
  if (upper === 'MALE' || upper === 'M') return 'MALE';
  if (upper === 'FEMALE' || upper === 'F') return 'FEMALE';
  return 'OTHER';
}

/**
 * Fetches a complete booking record including joined schedule/train/station/user
 * data and the associated passengers list.
 */
async function fetchCompleteBooking(bookingId) {
  const result = await query(
    `SELECT b.booking_id, b.pnr, b.booking_date, b.total_amount, b.status,
            s.journey_date, s.schedule_id, s.status AS schedule_status,
            t.train_id, t.train_number, t.train_name, t.train_type,
            src.station_name AS source_station_name, src.station_code AS source_station_code,
            dst.station_name AS destination_station_name, dst.station_code AS destination_station_code,
            u.name AS user_name, u.email AS user_email
     FROM bookings b
     LEFT JOIN schedules s   ON b.schedule_id          = s.schedule_id
     LEFT JOIN trains t       ON s.train_id              = t.train_id
     LEFT JOIN stations src   ON b.source_station_id     = src.station_id
     LEFT JOIN stations dst   ON b.destination_station_id = dst.station_id
     LEFT JOIN users u        ON b.user_id               = u.user_id
     WHERE b.booking_id = $1`,
    [bookingId]
  );

  if (result.rows.length === 0) return null;

  const booking = result.rows[0];
  const passResult = await query(
    'SELECT * FROM passengers WHERE booking_id = $1 ORDER BY passenger_id',
    [bookingId]
  );

  return { ...booking, passengers: passResult.rows };
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

/**
 * POST /bookings  (protected)
 * Body: { schedule_id, source_station_id, destination_station_id, total_amount,
 *         passengers: [{ name, age, gender, seat_preference, seat_id }] }
 *
 * user_id is taken from req.user (JWT) — never trusted from the request body.
 */
const createBooking = async (req, res) => {
  const client = await getClient();
  try {
    const {
      schedule_id,
      source_station_id,
      destination_station_id,
      total_amount,
      passengers,
    } = req.body;

    const user_id = req.user.user_id;

    // Basic validation
    if (!schedule_id || !source_station_id || !destination_station_id || total_amount == null) {
      return res.status(400).json({
        success: false,
        message: 'schedule_id, source_station_id, destination_station_id, and total_amount are required',
      });
    }

    if (!Array.isArray(passengers) || passengers.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one passenger is required' });
    }

    // Generate a unique PNR
    const pnr = generatePNR();

    await client.query('BEGIN');

    // Insert booking with PENDING status
    const bookingResult = await client.query(
      `INSERT INTO bookings
         (user_id, schedule_id, source_station_id, destination_station_id, total_amount, status, pnr)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', $6)
       RETURNING booking_id`,
      [user_id, schedule_id, source_station_id, destination_station_id, total_amount, pnr]
    );

    const booking_id = bookingResult.rows[0].booking_id;

    // Insert each passenger
    for (const passenger of passengers) {
      const { name, age, gender, seat_preference, seat_id } = passenger;

      if (!name || age == null) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: 'Each passenger must have a name and age' });
      }

      await client.query(
        `INSERT INTO passengers (booking_id, name, age, gender, seat_preference, seat_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          booking_id,
          name,
          age,
          normalizeGender(gender),
          seat_preference || null,
          seat_id || null,
        ]
      );
    }

    await client.query('COMMIT');

    // Fetch and return the complete booking details
    const completeBooking = await fetchCompleteBooking(booking_id);

    return res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: completeBooking,
      booking: completeBooking,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createBooking error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

/**
 * GET /bookings/my  (protected)
 * Returns all bookings belonging to the authenticated user.
 */
const getMyBookings = async (req, res) => {
  try {
    const user_id = req.user.user_id;

    const result = await query(
      `SELECT b.booking_id, b.pnr, b.booking_date, b.total_amount, b.status,
              s.journey_date, s.schedule_id,
              t.train_number, t.train_name, t.train_type,
              src.station_name AS source_station_name, src.station_code AS source_station_code,
              dst.station_name AS destination_station_name, dst.station_code AS destination_station_code
       FROM bookings b
       LEFT JOIN schedules s   ON b.schedule_id           = s.schedule_id
       LEFT JOIN trains t       ON s.train_id               = t.train_id
       LEFT JOIN stations src   ON b.source_station_id      = src.station_id
       LEFT JOIN stations dst   ON b.destination_station_id = dst.station_id
       WHERE b.user_id = $1
       ORDER BY b.booking_date DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      data: result.rows,
      bookings: result.rows,
    });
  } catch (err) {
    console.error('getMyBookings error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * GET /bookings/:id  (protected)
 * Returns a single booking with passengers.
 * Admins can view any booking; regular users can only view their own.
 */
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;
    const isAdmin = req.user.role?.toUpperCase() === 'ADMIN';

    const completeBooking = await fetchCompleteBooking(id);

    if (!completeBooking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ownership check (admins bypass)
    if (!isAdmin) {
      const ownerCheck = await query(
        'SELECT user_id FROM bookings WHERE booking_id = $1',
        [id]
      );
      if (ownerCheck.rows.length === 0 || String(ownerCheck.rows[0].user_id) !== String(user_id)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    return res.status(200).json({ success: true, data: completeBooking, booking: completeBooking });
  } catch (err) {
    console.error('getBookingById error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/**
 * PATCH /bookings/:id/cancel  (protected)
 * Cancels a booking. Only the booking owner may cancel.
 */
const cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.user_id;

    // Verify ownership and fetch current status
    const ownerCheck = await query(
      'SELECT user_id, status FROM bookings WHERE booking_id = $1',
      [id]
    );

    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const booking = ownerCheck.rows[0];

    if (String(booking.user_id) !== String(user_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Booking is already cancelled' });
    }

    // Update to CANCELLED
    await query(
      `UPDATE bookings SET status = 'CANCELLED' WHERE booking_id = $1`,
      [id]
    );

    const updatedBooking = await fetchCompleteBooking(id);

    return res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      booking: updatedBooking,
    });
  } catch (err) {
    console.error('cancelBooking error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { createBooking, getMyBookings, getBookingById, cancelBooking };
