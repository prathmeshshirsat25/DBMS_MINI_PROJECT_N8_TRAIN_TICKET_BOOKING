import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Train, Ticket, User, Search, ArrowRight, Clock, CheckCircle } from 'lucide-react';

export default function Dashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadBookings() {
      try {
        const res = await api.bookings.getMyBookings();
        if (res.success && Array.isArray(res.data)) {
          setBookings(res.data);
        }
      } catch (err) {
        console.warn('Dashboard bookings load failed:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadBookings();
  }, []);

  const confirmedCount = bookings.filter((b) => b.status === 'CONFIRMED').length;
  const pendingCount = bookings.filter((b) => b.status === 'PENDING').length;
  const cancelledCount = bookings.filter((b) => b.status === 'CANCELLED').length;

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1>Dashboard</h1>
        <p className="text-muted">Welcome back, {user?.name || user?.full_name || 'Passenger'}!</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <Ticket size={24} />
          </div>
          <div>
            <span className="text-xs text-muted font-bold">TOTAL BOOKINGS</span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem' }}>{bookings.length}</h2>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#dcfce7', color: '#15803d', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span className="text-xs text-muted font-bold">CONFIRMED</span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem', color: '#15803d' }}>{confirmedCount}</h2>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fef3c7', color: '#92400e', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <Clock size={24} />
          </div>
          <div>
            <span className="text-xs text-muted font-bold">PENDING PAYMENT</span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem', color: '#92400e' }}>{pendingCount}</h2>
          </div>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: 'var(--radius-sm)' }}>
            <Train size={24} />
          </div>
          <div>
            <span className="text-xs text-muted font-bold">CANCELLED</span>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.2rem', color: '#b91c1c' }}>{cancelledCount}</h2>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2>Recent Bookings</h2>
            <Link to="/my-bookings" className="text-sm font-bold flex items-center gap-1">
              <span>View All</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {loading ? (
            <div className="loading-center" style={{ padding: '2rem 0' }}>
              <span className="spinner"></span>
              <span>Loading your trips...</span>
            </div>
          ) : bookings.length === 0 ? (
            <div className="text-center" style={{ padding: '2rem 0' }}>
              <p className="text-muted" style={{ marginBottom: '1rem' }}>You haven't made any bookings yet.</p>
              <Link to="/" className="btn btn-primary">
                <Search size={16} />
                <span>Search Trains Now</span>
              </Link>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--muted)' }}>
                    <th style={{ padding: '0.75rem 0.5rem' }}>PNR</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Train</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Route</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Journey Date</th>
                    <th style={{ padding: '0.75rem 0.5rem' }}>Status</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.slice(0, 5).map((b) => (
                    <tr key={b.booking_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                        {b.pnr}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <div>{b.train_name}</div>
                        <small className="text-muted">{b.train_number}</small>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        {b.source_station} &rarr; {b.destination_station}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>{b.journey_date}</td>
                      <td style={{ padding: '0.75rem 0.5rem' }}>
                        <span
                          className={`badge ${
                            b.status === 'CONFIRMED'
                              ? 'badge-success'
                              : b.status === 'PENDING'
                              ? 'badge-warning'
                              : 'badge-error'
                          }`}
                        >
                          {b.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>
                        {b.status === 'CONFIRMED' && (
                          <Link to={`/ticket/${b.booking_id}`} className="btn btn-secondary btn-sm">
                            Ticket
                          </Link>
                        )}
                        {b.status === 'PENDING' && (
                          <Link to={`/payment/${b.booking_id}`} className="btn btn-primary btn-sm">
                            Pay Now
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
