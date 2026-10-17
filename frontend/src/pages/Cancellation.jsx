import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Ban, AlertTriangle, ArrowLeft, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function Cancellation() {
  const { bookingId } = useParams();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [reason, setReason] = useState('Change of travel plan');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadBooking() {
      setLoading(true);
      setError('');
      try {
        const res = await api.bookings.getById(bookingId);
        if (res.success && res.data) {
          setBooking(res.data);
        } else {
          setError(res.message || 'Booking not found');
        }
      } catch (err) {
        setError(err.message || 'Failed to load booking details');
      } finally {
        setLoading(false);
      }
    }

    loadBooking();
  }, [bookingId]);

  const handleCancelBooking = async (e) => {
    e.preventDefault();

    const confirmed = window.confirm(
      'Are you sure you want to cancel this booking? This will release your reserved seats and initiate a refund.'
    );
    if (!confirmed) return;

    setSubmitting(true);
    setError('');

    try {
      const res = await api.cancellations.cancelBooking({
        bookingId: parseInt(bookingId, 10),
        reason,
      });

      if (res.success) {
        navigate(`/refund-status/${bookingId}`, {
          state: { cancellation: res.data?.cancellation, refund: res.data?.refund },
        });
      } else {
        setError(res.message || 'Failed to cancel booking.');
      }
    } catch (err) {
      setError(err.message || 'Error processing ticket cancellation.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Loading booking for cancellation...</span>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', maxWidth: '600px' }}>
        <div className="alert alert-error">{error}</div>
        <Link to="/my-bookings" className="btn btn-secondary">
          &larr; Back to My Bookings
        </Link>
      </div>
    );
  }

  if (booking?.status === 'CANCELLED') {
    return (
      <div className="container" style={{ padding: '2rem 1rem', maxWidth: '600px' }}>
        <div className="card text-center" style={{ padding: '2rem 1.5rem' }}>
          <Ban size={48} className="text-error" style={{ margin: '0 auto 1rem' }} />
          <h2>Booking Already Cancelled</h2>
          <p className="text-muted" style={{ margin: '0.5rem auto 1.5rem' }}>
            This reservation has already been cancelled and seats have been released.
          </p>
          <Link to={`/refund-status/${bookingId}`} className="btn btn-primary">
            View Refund Status
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '720px' }}>
      <Link to="/my-bookings" className="btn btn-ghost btn-sm" style={{ marginBottom: '1.5rem' }}>
        <ArrowLeft size={16} />
        <span>Back to My Bookings</span>
      </Link>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', color: 'var(--error)' }}>
          <Ban size={28} />
          <h1 style={{ fontSize: '1.4rem', color: 'var(--error)' }}>Cancel Railway Reservation</h1>
        </div>

        <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
          Review the cancellation charges and refund estimate before confirming your ticket cancellation.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        {/* Booking Summary */}
        <div style={{ background: 'var(--bg)', padding: '1rem 1.25rem', borderRadius: 'var(--radius-sm)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-muted">PNR Number:</span>
            <strong style={{ fontFamily: 'var(--font-mono)' }}>{booking?.pnr}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-muted">Train:</span>
            <strong>{booking?.train_name} (#{booking?.train_number})</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="text-muted">Route:</span>
            <span>{booking?.source_station_name} &rarr; {booking?.destination_station_name}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span className="text-muted">Original Fare Paid:</span>
            <strong style={{ color: 'var(--primary)', fontSize: '1.1rem' }}>₹{booking?.total_amount}</strong>
          </div>
        </div>

        {/* Refund Policy Table */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>Railway Cancellation & Refund Policy</h3>
          <ul style={{ fontSize: '0.8rem', color: 'var(--muted)', paddingLeft: '1.2rem', lineHeight: '1.6' }}>
            <li>More than 48 hours before scheduled departure: <strong>90% Refund</strong> (10% clerkage charge)</li>
            <li>Between 24 to 48 hours before departure: <strong>75% Refund</strong> (25% cancellation charge)</li>
            <li>Between 12 to 24 hours before departure: <strong>50% Refund</strong></li>
            <li>Less than 12 hours before departure: <strong>25% Refund</strong></li>
          </ul>
        </div>

        <form onSubmit={handleCancelBooking}>
          <div className="form-group">
            <label className="form-label" htmlFor="reason">
              Reason for Cancellation
            </label>
            <select
              id="reason"
              className="form-control"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            >
              <option value="Change of travel plan">Change of travel plan</option>
              <option value="Personal emergency">Personal emergency</option>
              <option value="Train timing unsuitable">Train timing unsuitable</option>
              <option value="Booked another train/flight">Booked another train/flight</option>
              <option value="Other">Other reason</option>
            </select>
          </div>

          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 'var(--radius-sm)',
              padding: '0.875rem 1rem',
              color: '#b91c1c',
              fontSize: '0.8rem',
              marginBottom: '1.5rem',
            }}
          >
            <strong>Warning:</strong> Cancellation cannot be undone. Once confirmed, your seat will immediately become available for other passengers on the network.
          </div>

          <button
            type="submit"
            className="btn btn-danger btn-full btn-lg"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <span className="spinner spinner-white"></span>
                <span>Processing Cancellation & Refund in Supabase...</span>
              </>
            ) : (
              <>
                <Ban size={18} />
                <span>Confirm & Cancel Reservation</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
