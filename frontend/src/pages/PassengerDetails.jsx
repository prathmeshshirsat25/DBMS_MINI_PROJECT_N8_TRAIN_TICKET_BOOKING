import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import BookingSteps from '../components/common/BookingSteps';
import { User, ArrowRight, ArrowLeft, Trash2, Plus, AlertCircle } from 'lucide-react';

export default function PassengerDetails() {
  const navigate = useNavigate();
  const location = useLocation();

  const [bookingState, setBookingState] = useState(() => {
    if (location.state) return location.state;
    const saved = sessionStorage.getItem('currentBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const [passengers, setPassengers] = useState(() => {
    // If seats were selected, initialize 1 passenger per selected seat
    const seats = bookingState?.selectedSeats || [];
    if (seats.length > 0) {
      return seats.map((seat, index) => ({
        name: '',
        age: '',
        gender: 'MALE',
        seat_preference: 'No Preference',
        seat_id: seat.seat_id,
        seat_display: `${seat.coach_number}-${seat.seat_number}`,
      }));
    }
    return [
      {
        name: '',
        age: '',
        gender: 'MALE',
        seat_preference: 'No Preference',
        seat_id: null,
        seat_display: 'Auto-assigned',
      },
    ];
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (!bookingState) {
      navigate('/');
    }
  }, [bookingState, navigate]);

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
    setError('');
  };

  const handleAddPassenger = () => {
    if (passengers.length >= 6) {
      alert('Maximum 6 passengers allowed per booking.');
      return;
    }
    setPassengers([
      ...passengers,
      {
        name: '',
        age: '',
        gender: 'MALE',
        seat_preference: 'No Preference',
        seat_id: null,
        seat_display: 'Auto-assigned',
      },
    ]);
  };

  const handleRemovePassenger = (index) => {
    if (passengers.length <= 1) {
      alert('At least one passenger is required.');
      return;
    }
    setPassengers(passengers.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate passengers
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.name || !p.name.trim()) {
        setError(`Please enter a valid name for Passenger ${i + 1}.`);
        return;
      }
      const ageNum = parseInt(p.age, 10);
      if (isNaN(ageNum) || ageNum < 1 || ageNum > 120) {
        setError(`Please enter a valid age (1-120) for Passenger ${i + 1}.`);
        return;
      }
      if (!p.gender) {
        setError(`Please select a gender for Passenger ${i + 1}.`);
        return;
      }
    }

    const totalAmount = passengers.length * (bookingState.fare_per_passenger || 250);

    const updatedState = {
      ...bookingState,
      passengers,
      passengerCount: passengers.length,
      total_amount: totalAmount,
    };

    sessionStorage.setItem('currentBooking', JSON.stringify(updatedState));
    navigate('/booking-summary', { state: updatedState });
  };

  if (!bookingState) return null;

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '800px' }}>
      <BookingSteps currentStep={3} />

      {/* Selected Journey Header */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--primary-light)', borderColor: '#bce1ec' }}>
        <h2 style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
          {bookingState.train_name} (#{bookingState.train_number})
        </h2>
        <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
          {bookingState.source_station_name || bookingState.source_station_code || 'Departure'} &rarr;{' '}
          {bookingState.destination_station_name || bookingState.destination_station_code || 'Arrival'} &bull;{' '}
          Date: <strong>{String(bookingState.journey_date || '').split('T')[0]}</strong> &bull; Class: <strong>{bookingState.selectedClass}</strong>
        </p>
      </div>

      <div className="card">
        <h1 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>Passenger Information</h1>
        <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
          Enter government photo-ID details for all passengers travelling on this ticket.
        </p>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {passengers.map((passenger, index) => (
            <div
              key={index}
              style={{
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                marginBottom: '1rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <User size={18} className="text-primary" />
                  <span className="font-bold text-heading">Passenger {index + 1}</span>
                  {passenger.seat_display && (
                    <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>
                      Seat: {passenger.seat_display}
                    </span>
                  )}
                </div>

                {passengers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemovePassenger(index)}
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--error)' }}
                    title="Remove Passenger"
                  >
                    <Trash2 size={16} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor={`name-${index}`}>
                  Full Name (as per government ID)
                </label>
                <input
                  id={`name-${index}`}
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Kumar"
                  value={passenger.name}
                  onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" htmlFor={`age-${index}`}>
                    Age (Years)
                  </label>
                  <input
                    id={`age-${index}`}
                    type="number"
                    min="1"
                    max="120"
                    className="form-control"
                    placeholder="e.g. 28"
                    value={passenger.age}
                    onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor={`gender-${index}`}>
                    Gender
                  </label>
                  <select
                    id={`gender-${index}`}
                    className="form-control"
                    value={passenger.gender}
                    onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                    required
                  >
                    <option value="MALE">Male</option>
                    <option value="FEMALE">Female</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor={`pref-${index}`}>
                  Berth / Seat Preference
                </label>
                <select
                  id={`pref-${index}`}
                  className="form-control"
                  value={passenger.seat_preference}
                  onChange={(e) => handlePassengerChange(index, 'seat_preference', e.target.value)}
                >
                  <option value="No Preference">No Preference</option>
                  <option value="Lower Berth">Lower Berth</option>
                  <option value="Middle Berth">Middle Berth</option>
                  <option value="Upper Berth">Upper Berth</option>
                  <option value="Side Lower">Side Lower</option>
                  <option value="Side Upper">Side Upper</option>
                  <option value="Window Seat">Window Seat</option>
                  <option value="Aisle Seat">Aisle Seat</option>
                </select>
              </div>
            </div>
          ))}

          {/* Add passenger button if no fixed seats were selected */}
          {(!bookingState.selectedSeats || bookingState.selectedSeats.length === 0) && (
            <button
              type="button"
              onClick={handleAddPassenger}
              className="btn btn-secondary btn-sm"
              style={{ marginBottom: '1.5rem' }}
            >
              <Plus size={16} />
              <span>Add Another Passenger ({passengers.length}/6)</span>
            </button>
          )}

          {/* Fare Summary Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--border)',
              paddingTop: '1.5rem',
              marginTop: '1.5rem',
            }}
          >
            <div>
              <span className="text-muted text-sm">Total Fare for {passengers.length} Passenger{passengers.length > 1 ? 's' : ''}:</span>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{passengers.length * (bookingState.fare_per_passenger || 250)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Link to="/seat-selection" className="btn btn-ghost">
                <ArrowLeft size={16} />
                <span>Change Seats</span>
              </Link>

              <button type="submit" className="btn btn-primary btn-lg">
                <span>Continue to Summary</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
