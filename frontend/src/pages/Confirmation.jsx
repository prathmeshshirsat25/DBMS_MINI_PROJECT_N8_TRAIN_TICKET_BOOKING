import React, { useEffect, useState } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle2, Ticket, Printer, ArrowRight, Home, Calendar, MapPin, Train, Mail, Check } from 'lucide-react';

export default function Confirmation() {
  const { bookingId } = useParams();
  const location = useLocation();

  const [ticketData, setTicketData] = useState(location.state?.ticket || null);
  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!ticketData);
  const [error, setError] = useState('');
  const [resendingEmail, setResendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    async function loadConfirmation() {
      if (ticketData && booking) return;

      setLoading(true);
      try {
        const res = await api.tickets.getByBooking(bookingId);
        if (res.success && res.data) {
          setTicketData(res.data.ticket || res.data);
          setBooking(res.data.booking || res.data);
        }
      } catch (err) {
        console.warn('Could not fetch ticket details directly:', err.message);
        // Fallback: try loading booking details
        try {
          const bRes = await api.bookings.getById(bookingId);
          if (bRes.success) setBooking(bRes.data);
        } catch (e) {
          setError('Could not load confirmation details.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadConfirmation();
  }, [bookingId, ticketData, booking]);

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Confirming your reservation...</span>
      </div>
    );
  }

  const pnr = ticketData?.pnr || booking?.pnr || 'PNR' + bookingId;
  const ticketNumber = ticketData?.ticket_number || `TKT-${pnr.slice(-6)}-${bookingId}`;
  const trainName = booking?.train_name || 'Express';
  const trainNumber = booking?.train_number || '12051';
  const journeyDate = booking?.journey_date || new Date().toISOString().split('T')[0];
  const sourceStation = booking?.source_station_name || booking?.source_station || 'Source';
  const destStation = booking?.destination_station_name || booking?.destination_station || 'Destination';
  const totalAmount = booking?.total_amount || ticketData?.total_amount || 0;

  const handleResendEmail = async () => {
    try {
      setResendingEmail(true);
      const res = await api.tickets.sendEmail(bookingId);
      if (res.success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 4000);
      } else {
        alert(res.message || 'Failed to send ticket email.');
      }
    } catch (err) {
      alert('Failed to send email: ' + (err.message || 'Unknown error'));
    } finally {
      setResendingEmail(false);
    }
  };

  return (
    <div className="container" style={{ padding: '3rem 1rem', maxWidth: '720px' }}>
      <div className="card text-center" style={{ padding: '2.5rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: '#dcfce7', color: '#15803d', marginBottom: '1rem' }}>
          <CheckCircle2 size={48} />
        </div>

        <h1 style={{ fontSize: '1.75rem', color: 'var(--heading)', marginBottom: '0.25rem' }}>
          Booking Confirmed!
        </h1>
        <p className="text-muted" style={{ marginBottom: '1.25rem' }}>
          Your payment was processed successfully. Have a safe journey!
        </p>

        {/* Automatic Email Confirmation Notice */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.6rem',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-sm)',
            color: '#065f46',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            fontWeight: 500,
          }}
        >
          <Mail size={18} style={{ flexShrink: 0, color: '#059669' }} />
          <span>
            Your confirmed ticket and Electronic Reservation Slip (ERS) have been sent to your email.
          </span>
        </div>

        {/* Confirmation Key Badges */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            background: 'var(--bg)',
            padding: '1.25rem',
            borderRadius: 'var(--radius-md)',
            textAlign: 'left',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <span className="text-xs text-muted font-bold block">PNR NUMBER</span>
            <span className="font-bold text-heading" style={{ fontSize: '1.1rem', fontFamily: 'var(--font-mono)' }}>
              {pnr}
            </span>
          </div>

          <div>
            <span className="text-xs text-muted font-bold block">TICKET NUMBER</span>
            <span className="font-bold text-heading" style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)' }}>
              {ticketNumber}
            </span>
          </div>

          <div>
            <span className="text-xs text-muted font-bold block">STATUS</span>
            <span className="badge badge-success" style={{ marginTop: '0.2rem' }}>
              CONFIRMED (CNF)
            </span>
          </div>

          <div>
            <span className="text-xs text-muted font-bold block">TOTAL PAID</span>
            <span className="font-bold text-heading" style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
              ₹{totalAmount}
            </span>
          </div>
        </div>

        {/* Journey Quick Details */}
        <div
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            padding: '1rem',
            textAlign: 'left',
            marginBottom: '2rem',
            fontSize: '0.875rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Train size={18} className="text-primary" />
            <strong className="text-heading">{trainName} (#{trainNumber})</strong>
          </div>
          <div style={{ color: 'var(--text)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span>Route: <strong>{sourceStation}</strong> &rarr; <strong>{destStation}</strong></span>
            <span>Date: <strong>{journeyDate}</strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to={`/ticket/${bookingId}`} className="btn btn-primary btn-lg">
            <Ticket size={18} />
            <span>View & Print Official Ticket</span>
          </Link>

          <Link to="/my-bookings" className="btn btn-secondary btn-lg">
            <span>Go to My Bookings</span>
            <ArrowRight size={16} />
          </Link>

          <Link to="/" className="btn btn-ghost btn-lg">
            <Home size={16} />
            <span>Book Another Ticket</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
