import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Train, Calendar, ArrowLeft } from 'lucide-react';

export default function TrainSchedule() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSchedule() {
      setLoading(true);
      setError('');
      try {
        const res = await api.trains.getSchedule(id, date);
        if (res.success && res.data) {
          setData(res.data);
        } else {
          setError(res.message || 'Schedule not found');
        }
      } catch (err) {
        setError(err.message || 'Failed to load schedule');
      } finally {
        setLoading(false);
      }
    }

    loadSchedule();
  }, [id, date]);

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Loading operational schedule...</span>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '850px' }}>
      <Link to={-1} className="btn btn-ghost btn-sm" style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} />
        <span>Back</span>
      </Link>

      {error ? (
        <div className="alert alert-error">{error}</div>
      ) : data ? (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div>
                <h1>{data.train?.train_name}</h1>
                <p className="text-muted">
                  Train #{data.train?.train_number} &bull; Operational Status on {date}
                </p>
              </div>

              <div>
                <span
                  className={`badge ${
                    data.schedule?.status === 'SCHEDULED'
                      ? 'badge-success'
                      : data.schedule?.status === 'CANCELLED'
                      ? 'badge-error'
                      : 'badge-muted'
                  }`}
                  style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}
                >
                  {data.schedule?.status || 'SCHEDULED'}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <h2>Route Schedule for {date}</h2>
            {data.routes && data.routes.length > 0 ? (
              <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                      <th style={{ padding: '0.5rem' }}>Stop</th>
                      <th style={{ padding: '0.5rem' }}>Station</th>
                      <th style={{ padding: '0.5rem' }}>Arrival</th>
                      <th style={{ padding: '0.5rem' }}>Departure</th>
                      <th style={{ padding: '0.5rem' }}>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.routes.map((r) => (
                      <tr key={r.route_id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem' }}>{r.stop_number}</td>
                        <td style={{ padding: '0.5rem', fontWeight: 600 }}>{r.station_name} ({r.station_code})</td>
                        <td style={{ padding: '0.5rem' }}>{r.arrival_time?.slice(0, 5) || 'Source'}</td>
                        <td style={{ padding: '0.5rem' }}>{r.departure_time?.slice(0, 5) || 'Dest'}</td>
                        <td style={{ padding: '0.5rem' }}>{r.distance_km} km</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted" style={{ marginTop: '0.5rem' }}>No stops found.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
