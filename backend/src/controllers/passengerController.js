'use strict';

const { query } = require('../config/db.js');

/**
 * GET /passengers/booking/:booking_id  (protected)
 * Returns all passengers for a given booking.
 * The requesting user must own the booking (or be an admin).
 */
const getPassengersByBooking = async (req, res) => {
  try {
    const { booking_id } = req.params;
    const user_id = req.user.user_id;
    const isAdmin = req.user.role === 'admin';

    // Verify the booking exists
    const bookingCheck = await query(
      'SELECT booking_id, user_id FROM bookings WHERE booking_id = $1',
      [booking_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Ownership check (admins bypass)
    if (!isAdmin && String(bookingCheck.rows[0].user_id) !== String(user_id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const result = await query(
      `SELECT
         p.passenger_id,
         p.booking_id,
         p.name,
         p.age,
         p.gender,
         p.seat_preference,
         p.seat_id,
         s.coach_number,
         s.seat_number,
         s.class_type
       FROM passengers p
       LEFT JOIN seats s ON p.seat_id = s.seat_id
       WHERE p.booking_id = $1
       ORDER BY p.passenger_id`,
      [booking_id]
    );

    return res.status(200).json({
      success: true,
      booking_id: Number(booking_id),
      count: result.rows.length,
      passengers: result.rows,
    });
  } catch (err) {
    console.error('getPassengersByBooking error:', err);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

module.exports = { getPassengersByBooking };
