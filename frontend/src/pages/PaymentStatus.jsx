import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { XCircle, Clock, RotateCcw, Home } from 'lucide-react';

export default function PaymentStatus() {
  const { bookingId } = useParams();
  const location = useLocation();

  const status = location.state?.status || 'FAILED';
  const message = location.state?.message || 'Payment could not be completed at this time.';

  const isFailed = status === 'FAILED';

  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '600px' }}>
      <div className="card text-center" style={{ padding: '2.5rem 1.5rem' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          {isFailed ? (
            <XCircle size={64} className="text-error" style={{ margin: '0 auto' }} />
          ) : (
            <Clock size={64} style={{ color: 'var(--warning)', margin: '0 auto' }} />
          )}
        </div>

        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
          {isFailed ? 'Payment Failed' : 'Payment Pending Verification'}
        </h1>

        <p className="text-muted" style={{ marginBottom: '1.5rem', lineHeight: '1.6' }}>
          {message}
        </p>

        <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <div><strong>Booking ID:</strong> {bookingId}</div>
          <div style={{ marginTop: '0.25rem', color: 'var(--muted)' }}>
            Status: <span className={`badge ${isFailed ? 'badge-error' : 'badge-warning'}`}>{status}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          {isFailed && (
            <Link to={`/payment/${bookingId}`} className="btn btn-primary">
              <RotateCcw size={16} />
              <span>Retry Payment</span>
            </Link>
          )}

          <Link to="/" className="btn btn-secondary">
            <Home size={16} />
            <span>Return to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
