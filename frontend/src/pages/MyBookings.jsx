import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { Ticket, Train, Calendar, MapPin, ArrowRight, Ban, CreditCard, Search, RefreshCw } from 'lucide-react';

export default function MyBookings() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.bookings.getMyBookings();
      if (res.success && Array.isArray(res.data)) {
        setBookings(res.data);
      } else {
        setError(res.message || 'No bookings found.');
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve your bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>My Bookings</h1>
          <p className="text-muted text-sm">View, print and manage all your railway reservations</p>
        </div>

        <button type="button" onClick={fetchBookings} className="btn btn-ghost btn-sm">
          <RefreshCw size={14} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="loading-center">
          <span className="spinner spinner-lg"></span>
          <span>Loading your tickets and journeys...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error">{error}</div>
      ) : bookings.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem 1.5rem' }}>
          <Ticket size={48} className="text-muted" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2>No Bookings Found</h2>
          <p className="text-muted" style={{ margin: '0.5rem auto 1.5rem', maxWidth: '450px' }}>
            You haven't made any train reservations yet. Search and book your journey now.
          </p>
          <Link to="/" className="btn btn-primary">
            <Search size={16} />
            <span>Search Available Trains</span>
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {bookings.map((booking) => {
            const isConfirmed = booking.status === 'CONFIRMED';
            const isPending = booking.status === 'PENDING';
            const isCancelled = booking.status === 'CANCELLED';

            return (
              <div key={booking.booking_id} className="card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                  <div>
                    <span className="text-xs text-muted font-bold">PNR: </span>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', color: 'var(--heading)' }}>
                      {booking.pnr}
                    </strong>
                    <span className="text-xs text-muted" style={{ marginLeft: '1rem' }}>
                      Booked on: {new Date(booking.booking_date).toLocaleDateString()}
                    </span>
                  </div>

                  <div>
                    <span
                      className={`badge ${
                        isConfirmed
                          ? 'badge-success'
                          : isPending
                          ? 'badge-warning'
                          : 'badge-error'
                      }`}
                    >
                      {booking.status}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Train size={18} className="text-primary" />
                      <strong className="text-heading">{booking.train_name}</strong>
                      <span className="text-muted text-xs">#{booking.train_number}</span>
                    </div>

                    <div style={{ color: 'var(--text)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                      {booking.source_station} &rarr; {booking.destination_station}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                      <span>Journey Date: <strong>{booking.journey_date}</strong></span>
                      {booking.passenger_count && (
                        <span>Passengers: <strong>{booking.passenger_count}</strong></span>
                      )}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <span className="text-xs text-muted">Amount</span>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                      ₹{booking.total_amount}
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  {isConfirmed && (
                    <>
                      <Link to={`/ticket/${booking.booking_id}`} className="btn btn-primary btn-sm">
                        <Ticket size={14} />
                        <span>View Ticket</span>
                      </Link>

                      <Link to={`/cancellation/${booking.booking_id}`} className="btn btn-ghost btn-sm" style={{ color: 'var(--error)' }}>
                        <Ban size={14} />
                        <span>Cancel Booking</span>
                      </Link>
                    </>
                  )}

                  {isPending && (
                    <Link to={`/payment/${booking.booking_id}`} className="btn btn-primary btn-sm">
                      <CreditCard size={14} />
                      <span>Complete Payment</span>
                    </Link>
                  )}

                  {isCancelled && (
                    <Link to={`/refund-status/${booking.booking_id}`} className="btn btn-secondary btn-sm">
                      <span>View Refund Status</span>
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
