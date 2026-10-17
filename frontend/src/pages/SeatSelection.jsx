import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import BookingSteps from '../components/common/BookingSteps';
import { Train, ArrowRight, ShieldAlert, Check, RefreshCw } from 'lucide-react';

export default function SeatSelection() {
  const navigate = useNavigate();
  const location = useLocation();

  const [bookingState, setBookingState] = useState(() => {
    if (location.state) return location.state;
    const saved = sessionStorage.getItem('currentBooking');
    return saved ? JSON.parse(saved) : null;
  });

  const [seats, setSeats] = useState([]);
  const [selectedSeatIds, setSelectedSeatIds] = useState([]);
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [activeCoach, setActiveCoach] = useState('');
  const [coaches, setCoaches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [blocking, setBlocking] = useState(false);

  useEffect(() => {
    if (!bookingState?.train_id) {
      navigate('/');
      return;
    }

    async function fetchSeats() {
      setLoading(true);
      setError('');
      try {
        const res = await api.seats.getByTrain(bookingState.train_id, {
          travelClass: bookingState.selectedClass,
          scheduleId: bookingState.schedule_id,
        });

        if (res.success) {
          const rawData = res.data || res.coaches;
          let seatList = [];
          if (Array.isArray(rawData)) {
            seatList = rawData;
          } else if (rawData && typeof rawData === 'object') {
            Object.values(rawData).forEach((coachSeats) => {
              if (Array.isArray(coachSeats)) seatList.push(...coachSeats);
            });
          }

          if (seatList.length > 0) {
            setSeats(seatList);
            const uniqueCoaches = Array.from(new Set(seatList.map((s) => s.coach_number))).filter(Boolean);
            setCoaches(uniqueCoaches);
            if (uniqueCoaches.length > 0) {
              setActiveCoach((prev) => (prev && uniqueCoaches.includes(prev) ? prev : uniqueCoaches[0]));
            }
          } else {
            setError('No seat layout configured for this coach in the database.');
          }
        } else {
          setError(res.message || 'Failed to fetch seats from database.');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch seats from database.');
      } finally {
        setLoading(false);
      }
    }

    fetchSeats();
  }, [bookingState]);

  const handleSeatClick = (seat) => {
    // Only available seats can be clicked
    const isBooked = seat.status === 'BOOKED';
    const isBlocked = seat.status === 'BLOCKED';

    if (isBooked || isBlocked) return;

    const isSelected = selectedSeatIds.includes(seat.seat_id);

    if (isSelected) {
      setSelectedSeatIds((prev) => prev.filter((id) => id !== seat.seat_id));
      setSelectedSeats((prev) => prev.filter((s) => s.seat_id !== seat.seat_id));
    } else {
      if (selectedSeatIds.length >= 6) {
        alert('Maximum 6 seats can be selected per booking.');
        return;
      }
      setSelectedSeatIds((prev) => [...prev, seat.seat_id]);
      setSelectedSeats((prev) => [...prev, seat]);
    }
  };

  const handleProceed = async () => {
    if (selectedSeats.length === 0) {
      setError('Please select at least 1 seat to continue.');
      return;
    }

    setBlocking(true);
    setError('');

    try {
      // Temporarily block the selected seats on the backend (10 minutes expiry)
      await api.seats.block(selectedSeatIds, 10);

      // Save updated booking state
      const updatedState = {
        ...bookingState,
        selectedSeats,
        selectedSeatIds,
        passengerCount: selectedSeats.length,
        total_amount: selectedSeats.length * (bookingState.fare_per_passenger || 250),
      };

      sessionStorage.setItem('currentBooking', JSON.stringify(updatedState));
      navigate('/passenger-details', { state: updatedState });
    } catch (err) {
      setError(err.message || 'Could not hold selected seats. Another passenger may have reserved them. Please try again.');
    } finally {
      setBlocking(false);
    }
  };

  if (!bookingState) {
    return (
      <div className="container" style={{ padding: '2rem 1rem' }}>
        <div className="alert alert-warning">No train selected for booking.</div>
        <Link to="/" className="btn btn-primary">Search Trains</Link>
      </div>
    );
  }

  const coachSeats = seats.filter((s) => !activeCoach || s.coach_number === activeCoach);

  // Clean formatted date string
  const formattedDate = String(bookingState.journey_date || '').split('T')[0];

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <BookingSteps currentStep={2} />

      {/* Train Info Header */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--primary-light)', borderColor: '#bce1ec' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Train size={20} className="text-primary" />
              <h2 style={{ fontSize: '1.2rem', color: 'var(--primary)' }}>
                {bookingState.train_name} (#{bookingState.train_number})
              </h2>
            </div>
            <p className="text-muted text-sm" style={{ marginTop: '0.25rem' }}>
              {bookingState.source_station_name || bookingState.source_station_code || 'Source'}
              {bookingState.source_station_code ? ` (${bookingState.source_station_code})` : ''} &rarr;{' '}
              {bookingState.destination_station_name || bookingState.destination_station_code || 'Destination'}
              {bookingState.destination_station_code ? ` (${bookingState.destination_station_code})` : ''} &bull;{' '}
              Date: <strong>{formattedDate}</strong> &bull; Class: <strong>{bookingState.selectedClass}</strong>
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="text-xs text-muted">Fare per seat</span>
            <div className="font-bold text-heading" style={{ fontSize: '1.25rem' }}>
              ₹{bookingState.fare_per_passenger || 250}
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: '1.5rem' }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Coach tabs & Seat layout */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h2>Select Your Seats</h2>
            <div className="seat-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ borderColor: 'var(--border)', background: 'white' }} />
                <span>Available</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ borderColor: 'var(--primary)', background: 'var(--primary)' }} />
                <span>Selected</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ borderColor: '#fecaca', background: '#fee2e2' }} />
                <span>Booked</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ borderColor: '#fde68a', background: '#fef3c7' }} />
                <span>Blocked</span>
              </div>
            </div>
          </div>

          {/* Coach Switcher Tabs */}
          {coaches.length > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {coaches.map((coach) => (
                <button
                  key={coach}
                  type="button"
                  onClick={() => setActiveCoach(coach)}
                  className={`btn btn-sm ${activeCoach === coach ? 'btn-primary' : 'btn-ghost'}`}
                >
                  Coach {coach}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <div className="loading-center">
              <span className="spinner"></span>
              <span>Loading seats from database...</span>
            </div>
          ) : coachSeats.length === 0 ? (
            <div className="text-center" style={{ padding: '2rem' }}>
              <p className="text-muted">No seats configured for this coach in the database.</p>
            </div>
          ) : (
            <div style={{ background: 'var(--bg)', padding: '1.5rem', borderRadius: 'var(--radius-md)' }}>
              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginBottom: '1rem', fontWeight: 600 }}>
                &uarr; FRONT OF COACH {activeCoach} &uarr;
              </div>

              <div className="seat-grid" style={{ justifyContent: 'center' }}>
                {coachSeats.map((seat) => {
                  const isSelected = selectedSeatIds.includes(seat.seat_id);
                  const isBooked = seat.status === 'BOOKED';
                  const isBlocked = seat.status === 'BLOCKED';

                  let statusClass = 'available';
                  if (isSelected) statusClass = 'selected';
                  else if (isBooked) statusClass = 'booked';
                  else if (isBlocked) statusClass = 'blocked';

                  return (
                    <button
                      key={seat.seat_id}
                      type="button"
                      disabled={isBooked || isBlocked}
                      onClick={() => handleSeatClick(seat)}
                      className={`seat-btn ${statusClass}`}
                      title={`Seat ${seat.seat_number} (${seat.berth_type || 'Seat'}) - Coach ${seat.coach_number} [${seat.status}]`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 2px',
                        minWidth: '44px',
                        height: '46px',
                        lineHeight: 1.1,
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>{seat.seat_number}</span>
                      <span
                        style={{
                          fontSize: '0.6rem',
                          fontWeight: 600,
                          opacity: isSelected ? 0.95 : 0.7,
                          textTransform: 'uppercase',
                        }}
                      >
                        {seat.berth_type || 'S'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Authentic Indian Railways Berth Guide */}
              <div
                style={{
                  textAlign: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginTop: '1.25rem',
                  paddingTop: '0.75rem',
                  borderTop: '1px dashed var(--border)',
                }}
              >
                <span>
                  <strong>Berth Codes:</strong> LB = Lower Berth &bull; MB = Middle Berth &bull; UB = Upper Berth &bull; SL = Side Lower &bull; SU = Side Upper &bull; W = Window &bull; A = Aisle
                </span>
              </div>

              <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--muted)', marginTop: '1rem', fontWeight: 600 }}>
                &darr; REAR OF COACH {activeCoach} &darr;
              </div>
            </div>
          )}
        </div>

        {/* Right: Selection Summary & Continue */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Booking Summary</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Selected Seats:</span>
              <strong className="text-heading">
                {selectedSeats.length > 0
                  ? selectedSeats.map((s) => `${s.coach_number}-${s.seat_number}`).join(', ')
                  : 'None'}
              </strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Total Passengers:</span>
              <strong className="text-heading">{selectedSeats.length}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span className="text-muted">Price per seat:</span>
              <span>₹{bookingState.fare_per_passenger || 250}</span>
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-bold text-heading">Total Fare:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{selectedSeats.length * (bookingState.fare_per_passenger || 250)}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full btn-lg"
            disabled={selectedSeats.length === 0 || blocking}
            onClick={handleProceed}
            style={{ marginTop: '1.5rem' }}
          >
            {blocking ? (
              <>
                <span className="spinner spinner-white"></span>
                <span>Holding Seats...</span>
              </>
            ) : (
              <>
                <span>Enter Passenger Details</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>

          <p className="text-muted text-xs text-center" style={{ marginTop: '0.75rem' }}>
            Seats are temporarily held for 10 minutes once you proceed.
          </p>
        </div>
      </div>
    </div>
  );
}
