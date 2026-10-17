import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import BookingSteps from '../components/common/BookingSteps';
import { Train, User, MapPin, Calendar, Clock, CreditCard, ArrowLeft, ArrowRight, AlertCircle, ShieldCheck } from 'lucide-react';

export default function BookingSummary() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuth();

  const [bookingState, setBookingState] = useState(() => {
    if (location.state) return location.state;
    const saved = sessionStorage.getItem('currentBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingState?.passengers || bookingState.passengers.length === 0) {
      navigate('/');
    }
  }, [bookingState, navigate]);

  if (!bookingState) return null;

  const passengerCount = bookingState.passengers.length;
  const baseFarePerPassenger = bookingState.fare_per_passenger || 250;
  const subtotal = passengerCount * baseFarePerPassenger;
  const reservationFee = passengerCount * 20; // Demo standard reservation charge
  const gst = Math.round(subtotal * 0.05); // Demo 5% GST on AC/Express
  const grandTotal = subtotal + reservationFee + gst;

  const handleProceedToPayment = async () => {
    if (!isAuthenticated) {
      // Redirect to login preserving the state
      navigate('/login', {
        state: { from: { pathname: '/booking-summary' } },
      });
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create pending booking on the backend via transaction
      const payload = {
        schedule_id: bookingState.schedule_id,
        source_station_id: bookingState.source_station_id,
        destination_station_id: bookingState.destination_station_id,
        total_amount: grandTotal,
        passengers: bookingState.passengers.map((p) => ({
          name: p.name,
          age: parseInt(p.age, 10),
          gender: p.gender,
          seat_preference: p.seat_preference || 'No Preference',
          seat_id: p.seat_id || null,
        })),
      };

      const res = await api.bookings.create(payload);

      if (res.success && res.data) {
        const createdBooking = res.data;
        // Clean booking state and forward to payment page
        sessionStorage.removeItem('currentBooking');
        navigate(`/payment/${createdBooking.booking_id}`, {
          state: { booking: createdBooking },
        });
      } else {
        setError(res.message || 'Failed to create booking.');
      }
    } catch (err) {
      setError(err.message || 'Could not process booking creation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '850px' }}>
      <BookingSteps currentStep={4} />

      <h1 style={{ marginBottom: '0.5rem' }}>Review Booking Summary</h1>
      <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
        Please review your journey details and passenger roster before proceeding to payment.
      </p>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!isAuthenticated && (
        <div className="alert alert-warning" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>Login Required:</strong> You must be signed in to create and confirm this booking.
          </div>
          <Link to="/login" state={{ from: { pathname: '/booking-summary' } }} className="btn btn-primary btn-sm">
            Sign In Now
          </Link>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        {/* Journey Card */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Train size={22} className="text-primary" />
              <div>
                <span className="font-bold text-heading" style={{ fontSize: '1.1rem' }}>
                  {bookingState.train_name}
                </span>
                <span className="text-muted text-sm" style={{ marginLeft: '0.5rem' }}>
                  #{bookingState.train_number}
                </span>
              </div>
            </div>

            <span className="badge badge-info" style={{ fontSize: '0.85rem' }}>
              Class: {bookingState.selectedClass}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '0.5rem 0' }}>
            <div>
              <span className="text-xs text-muted font-bold">DEPARTURE</span>
              <div className="font-bold text-heading" style={{ fontSize: '1.25rem', marginTop: '0.1rem' }}>
                {bookingState.source_departure_time || '06:00'}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                {bookingState.source_station_name || bookingState.source_station_code || 'Departure'}
                {bookingState.source_station_code ? ` (${bookingState.source_station_code})` : ''}
              </div>
              <div className="text-xs text-muted">{String(bookingState.journey_date || '').split('T')[0]}</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <span className="text-xs text-muted">{bookingState.duration || 'Direct'}</span>
              <div style={{ width: '80px', height: '2px', background: 'var(--border)', margin: '0.25rem auto' }} />
              <span className="text-xs text-muted">{bookingState.distance_km ? `${bookingState.distance_km} km` : ''}</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="text-xs text-muted font-bold">ARRIVAL</span>
              <div className="font-bold text-heading" style={{ fontSize: '1.25rem', marginTop: '0.1rem' }}>
                {bookingState.destination_arrival_time || '12:30'}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>
                {bookingState.destination_station_name || bookingState.destination_station_code || 'Arrival'}
                {bookingState.destination_station_code ? ` (${bookingState.destination_station_code})` : ''}
              </div>
              <div className="text-xs text-muted">{String(bookingState.journey_date || '').split('T')[0]}</div>
            </div>
          </div>
        </div>

        {/* Passengers List Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            Passengers ({passengerCount})
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {bookingState.passengers.map((p, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                }}
              >
                <div>
                  <div className="font-bold text-heading">{p.name}</div>
                  <div className="text-xs text-muted">
                    Age: {p.age} &bull; Gender: {p.gender} &bull; Preference: {p.seat_preference || 'None'}
                  </div>
                </div>

                <div>
                  <span className="badge badge-success">
                    Seat: {p.seat_display || 'Allocated'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Fare Breakdown Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Fare Breakdown</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">
                Base Fare ({passengerCount} &times; ₹{baseFarePerPassenger})
              </span>
              <span>₹{subtotal}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Reservation Charge</span>
              <span>₹{reservationFee}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">GST & Service Taxes (5%)</span>
              <span>₹{gst}</span>
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-bold text-heading" style={{ fontSize: '1.1rem' }}>
                Total Amount Payable:
              </span>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{grandTotal}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
          <Link to="/passenger-details" className="btn btn-ghost">
            <ArrowLeft size={16} />
            <span>Edit Passenger Details</span>
          </Link>

          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={handleProceedToPayment}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner spinner-white"></span>
                <span>Creating Booking in Database...</span>
              </>
            ) : (
              <>
                <CreditCard size={18} />
                <span>Proceed to Payment</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
