import React, { useState, useEffect } from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle2, Clock, AlertCircle, ArrowLeft, RefreshCw, Home, ShieldCheck } from 'lucide-react';

export default function RefundStatus() {
  const { bookingId } = useParams();
  const location = useLocation();

  const [refundData, setRefundData] = useState(location.state?.refund || null);
  const [cancellation, setCancellation] = useState(location.state?.cancellation || null);
  const [loading, setLoading] = useState(!refundData);
  const [error, setError] = useState('');

  const fetchRefundDetails = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.refunds.getByBooking(bookingId);
      if (res.success && res.data) {
        setRefundData(res.data.refund || res.data);
        if (res.data.cancellation) {
          setCancellation(res.data.cancellation);
        }
      } else {
        setError(res.message || 'Refund record not found.');
      }
    } catch (err) {
      setError(err.message || 'Failed to load refund status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!refundData) {
      fetchRefundDetails();
    }
  }, [bookingId]);

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Fetching refund status from database...</span>
      </div>
    );
  }

  const isProcessed = refundData?.refund_status === 'PROCESSED';
  const isPending = refundData?.refund_status === 'PENDING';
  const refundAmount = refundData?.refund_amount || cancellation?.refund_amount || 0;

  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '640px' }}>
      <Link to="/my-bookings" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} />
        <span>Back to My Bookings</span>
      </Link>

      <div className="card text-center" style={{ padding: '2.5rem 1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          {isProcessed ? (
            <CheckCircle2 size={56} className="text-success" style={{ margin: '0 auto' }} />
          ) : (
            <Clock size={56} style={{ color: 'var(--warning)', margin: '0 auto' }} />
          )}
        </div>

        <h1 style={{ fontSize: '1.6rem', marginBottom: '0.25rem' }}>
          {isProcessed ? 'Refund Processed' : 'Refund Initiated'}
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
          {isProcessed
            ? 'Your refund has been approved and credited back to your original payment method.'
            : 'Your refund request has been received and is being processed.'}
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 'var(--radius-md)',
            padding: '1.25rem',
            textAlign: 'left',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span className="text-muted">Booking Reference:</span>
            <strong>#{bookingId}</strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span className="text-muted">Refund ID:</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>
              {refundData?.refund_id ? `REF-${refundData.refund_id}` : 'PENDING'}
            </strong>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span className="text-muted">Status:</span>
            <span className={`badge ${isProcessed ? 'badge-success' : 'badge-warning'}`}>
              {refundData?.refund_status || 'PENDING'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
            <span className="text-muted">Cancellation Date:</span>
            <span>
              {refundData?.refund_date
                ? new Date(refundData.refund_date).toLocaleString()
                : new Date().toLocaleString()}
            </span>
          </div>

          <div className="divider" />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="font-bold text-heading">Refund Amount:</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--success)' }}>
              ₹{refundAmount}
            </span>
          </div>
        </div>

        {/* Demo explanation notice */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '0.875rem',
            fontSize: '0.75rem',
            color: 'var(--muted)',
            textAlign: 'left',
            marginBottom: '1.5rem',
          }}
        >
          <strong>Simulated Refund Notice:</strong> In this college project demonstration, the simulated payment refund is recorded in the PostgreSQL database table <code>refunds</code> with the calculated deduction based on the departure schedule.
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
          <button type="button" onClick={fetchRefundDetails} className="btn btn-secondary">
            <RefreshCw size={14} />
            <span>Check Status Again</span>
          </button>

          <Link to="/" className="btn btn-primary">
            <Home size={14} />
            <span>Go to Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
