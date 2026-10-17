import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Train, MapPin, Clock, ArrowLeft } from 'lucide-react';

export default function TrainDetails() {
  const { id } = useParams();
  const [train, setTrain] = useState(null);
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadTrainDetails() {
      setLoading(true);
      setError('');

      try {
        const [trainRes, routesRes] = await Promise.all([
          api.trains.getById(id),
          api.trains.getRoutes(id),
        ]);

        if (trainRes.success && trainRes.data) {
          setTrain(trainRes.data);
        } else {
          setError(trainRes.message || 'Train not found');
        }

        if (routesRes.success && Array.isArray(routesRes.data)) {
          setRoutes(routesRes.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load train details');
      } finally {
        setLoading(false);
      }
    }

    loadTrainDetails();
  }, [id]);

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Loading train timetable and route...</span>
      </div>
    );
  }

  if (error || !train) {
    return (
      <div className="container" style={{ padding: '2rem 1rem' }}>
        <div className="alert alert-error">{error || 'Train not found.'}</div>
        <Link to="/" className="btn btn-secondary">
          &larr; Back to Search
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '900px' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to={-1} className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} />
          <span>Back</span>
        </Link>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1>{train.train_name}</h1>
              <p className="text-muted" style={{ marginTop: '0.25rem' }}>
                Train #{train.train_number} &bull; {train.train_type || 'Express'} &bull; {train.total_coaches ? `${train.total_coaches} Coaches` : ''}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {train.classes && train.classes.map((c) => (
                <span key={c.class_code} className="badge badge-info">
                  {c.class_code} - {c.class_name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Train Route & Station Stops</h2>

        {routes.length === 0 ? (
          <p className="text-muted">No route stop information available for this train.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                  <th style={{ padding: '0.75rem 0.5rem' }}>#</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Station Code</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Station Name</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Arrival</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Departure</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Distance</th>
                  <th style={{ padding: '0.75rem 0.5rem' }}>Day</th>
                </tr>
              </thead>
              <tbody>
                {routes.map((stop) => (
                  <tr key={stop.route_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem 0.5rem', color: 'var(--muted)' }}>{stop.stop_number}</td>
                    <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {stop.station_code}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>
                      <span className="font-bold">{stop.station_name}</span>
                      {(stop.city || stop.state) && (
                        <div className="text-xs text-muted">
                          {[stop.city, stop.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{stop.arrival_time ? stop.arrival_time.slice(0, 5) : 'Source'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{stop.departure_time ? stop.departure_time.slice(0, 5) : 'Destination'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>{stop.distance_km ? `${stop.distance_km} km` : '0 km'}</td>
                    <td style={{ padding: '0.75rem 0.5rem' }}>Day {stop.day_offset ? stop.day_offset + 1 : 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
