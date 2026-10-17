import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Train, Clock, ArrowRight, ArrowLeftRight, Calendar, Filter, AlertCircle, Info } from 'lucide-react';

export default function TrainResults() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const date = searchParams.get('date') || '';
  const travelClass = searchParams.get('class') || '';

  const [trains, setTrains] = useState([]);
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClassMap, setSelectedClassMap] = useState({});

  useEffect(() => {
    async function fetchResults() {
      if (!from || !to || !date) {
        setError('Missing search parameters. Please provide source, destination, and travel date.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const res = await api.trains.search({ from, to, date, travelClass });
        if (res.success) {
          setTrains(res.data || []);
          if (res.available_dates) {
            setAvailableDates(res.available_dates);
          }
        } else {
          setError(res.message || 'No trains found matching your search.');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch matching trains.');
      } finally {
        setLoading(false);
      }
    }

    fetchResults();
  }, [from, to, date, travelClass]);

  const handleSelectClass = (trainId, cls) => {
    setSelectedClassMap((prev) => ({ ...prev, [trainId]: cls }));
  };

  const handleBookNow = (train) => {
    const chosenClass = selectedClassMap[train.train_id] || travelClass || train.supported_classes?.[0]?.class_code || 'SL';
    
    // Pass selected train details to SeatSelection page
    const bookingState = {
      train_id: train.train_id,
      schedule_id: train.schedule_id,
      train_number: train.train_number,
      train_name: train.train_name,
      train_type: train.train_type,
      source_station_id: train.source_station_id,
      source_station_code: train.source_station_code || from,
      source_station_name: train.source_station_name || from,
      destination_station_id: train.destination_station_id,
      destination_station_code: train.destination_station_code || to,
      destination_station_name: train.destination_station_name || to,
      source_departure_time: train.source_departure_time,
      destination_arrival_time: train.destination_arrival_time || train.dest_arrival_time,
      journey_date: String(train.journey_date || date).split('T')[0],
      duration: train.duration,
      distance_km: train.distance_km,
      selectedClass: chosenClass,
      fare_per_passenger: train.fare_estimate?.[chosenClass] || 250,
    };

    sessionStorage.setItem('currentBooking', JSON.stringify(bookingState));
    navigate('/seat-selection', { state: bookingState });
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Top Search Summary Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="font-bold text-heading" style={{ fontSize: '1.1rem' }}>{from}</span>
            <ArrowRight size={16} className="text-muted" />
            <span className="font-bold text-heading" style={{ fontSize: '1.1rem' }}>{to}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
            <Calendar size={16} />
            <span>{date}</span>
          </div>

          {travelClass && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--muted)', fontSize: '0.875rem' }}>
              <Filter size={16} />
              <span>Class: <strong>{travelClass}</strong></span>
            </div>
          )}
        </div>

        <Link to={`/trains/search?from=${from}&to=${to}&date=${date}`} className="btn btn-secondary btn-sm">
          Modify Search
        </Link>
      </div>

      {/* Main Results Section */}
      {loading ? (
        <div className="loading-center">
          <span className="spinner spinner-lg"></span>
          <span>Searching Supabase for operational schedules and routes...</span>
        </div>
      ) : error ? (
        <div className="alert alert-error" style={{ margin: '2rem 0' }}>
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      ) : trains.length === 0 ? (
        <div className="card text-center" style={{ padding: '3rem 1.5rem' }}>
          <Train size={48} className="text-muted" style={{ margin: '0 auto 1rem', opacity: 0.5 }} />
          <h2>No Trains Found</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem', maxWidth: '500px', margin: '0.5rem auto 1.5rem' }}>
            No trains are scheduled to run between <strong>{from}</strong> and <strong>{to}</strong> on <strong>{date}</strong>.
          </p>
          <Link to="/" className="btn btn-primary">
            Search Another Route or Date
          </Link>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <p className="font-bold text-heading">
              {trains.length} Train{trains.length > 1 ? 's' : ''} Available
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {trains.map((train) => {
              const currentSelectedClass =
                selectedClassMap[train.train_id] ||
                travelClass ||
                train.supported_classes?.[0]?.class_code ||
                'SL';

              const fare = train.fare_estimate?.[currentSelectedClass] || 250;

              return (
                <div key={train.train_id} className="train-card">
                  <div className="train-card-header">
                    <div>
                      <div className="train-name">{train.train_name}</div>
                      <div className="train-number">#{train.train_number} &bull; {train.train_type || 'Express'}</div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span className="text-xs text-muted">Starting Fare</span>
                      <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--primary)' }}>
                        ₹{fare}
                      </div>
                    </div>
                  </div>

                  <div className="train-timing">
                    <div className="timing-block">
                      <div className="timing-time">{train.source_departure_time || '00:00'}</div>
                      <div className="timing-station">{train.source_station_name || from}</div>
                      <div className="timing-code">({train.source_station_code || from})</div>
                    </div>

                    <div className="train-duration">
                      <span className="duration-text">{train.duration || 'N/A'}</span>
                      <div className="duration-line" />
                      <span className="text-xs text-muted">{train.distance_km ? `${train.distance_km} km` : ''}</span>
                    </div>

                    <div className="timing-block">
                      <div className="timing-time">{train.destination_arrival_time || train.dest_arrival_time || '00:00'}</div>
                      <div className="timing-station">{train.destination_station_name || to}</div>
                      <div className="timing-code">({train.destination_station_code || to})</div>
                    </div>
                  </div>

                  {/* Class options */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '0.875rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className="text-xs text-muted font-bold">Select Class:</span>
                      {train.supported_classes && train.supported_classes.length > 0 ? (
                        train.supported_classes.map((cls) => {
                          const isSelected = currentSelectedClass === cls.class_code;
                          const classFare = train.fare_estimate?.[cls.class_code] || 250;
                          return (
                            <button
                              key={cls.class_code}
                              type="button"
                              onClick={() => handleSelectClass(train.train_id, cls.class_code)}
                              className={`class-chip ${isSelected ? 'selected' : ''}`}
                            >
                              <span>{cls.class_code}</span>
                              <span style={{ opacity: 0.7, marginLeft: '4px' }}>₹{classFare}</span>
                            </button>
                          );
                        })
                      ) : (
                        <span className="text-xs text-muted">Standard Class</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <Link
                        to={`/trains/${train.train_id}/details`}
                        className="btn btn-ghost btn-sm"
                        title="View Route & Timetable"
                      >
                        <Info size={14} />
                        <span>Route</span>
                      </Link>

                      <button
                        type="button"
                        onClick={() => handleBookNow(train)}
                        className="btn btn-primary btn-sm"
                      >
                        <span>Select Seats & Book</span>
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
