import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';
import { Printer, Download, ArrowLeft, Ban, Train, ShieldCheck, CheckCircle, Mail, Check } from 'lucide-react';

export default function Ticket() {
  const { bookingId } = useParams();
  const [ticketData, setTicketData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    async function fetchTicket() {
      setLoading(true);
      setError('');
      try {
        const res = await api.tickets.getByBooking(bookingId);
        if (res.success && res.data) {
          // Normalize response structure
          const ticket = res.data.ticket || res.data;
          setTicketData(ticket);
        } else {
          setError(res.message || 'Ticket not found.');
        }
      } catch (err) {
        setError(err.message || 'Failed to load ticket details.');
      } finally {
        setLoading(false);
      }
    }

    fetchTicket();
  }, [bookingId]);

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = async () => {
    try {
      setSendingEmail(true);
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
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Generating official Electronic Reservation Slip (ERS)...</span>
      </div>
    );
  }

  if (error || !ticketData) {
    return (
      <div className="container" style={{ padding: '2rem 1rem', maxWidth: '600px' }}>
        <div className="alert alert-error">{error || 'Ticket not found.'}</div>
        <Link to="/my-bookings" className="btn btn-secondary">
          &larr; Back to My Bookings
        </Link>
      </div>
    );
  }

  const isCancelled = ticketData.ticket_status === 'CANCELLED' || ticketData.booking_status === 'CANCELLED';

  return (
    <div className="container" style={{ padding: '2rem 1rem' }}>
      {/* Top action bar — hidden on print */}
      <div
        className="no-print"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          maxWidth: '740px',
          margin: '0 auto 1.5rem',
        }}
      >
        <Link to="/my-bookings" className="btn btn-ghost btn-sm">
          <ArrowLeft size={16} />
          <span>Back to My Bookings</span>
        </Link>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" onClick={handlePrint} className="btn btn-primary btn-sm">
            <Printer size={16} />
            <span>Print Ticket</span>
          </button>

          {!isCancelled && (
            <Link to={`/cancellation/${bookingId}`} className="btn btn-danger btn-sm">
              <Ban size={16} />
              <span>Cancel Ticket</span>
            </Link>
          )}
        </div>
      </div>

      {/* Official Electronic Reservation Slip (ERS) */}
      <div
        className="ticket-card"
        style={{
          maxWidth: '740px',
          margin: '0 auto',
          background: 'white',
          border: '1.5px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}
      >
        {/* Email sent notification badge */}
        <div
          className="no-print"
          style={{
            background: '#f0fdf4',
            borderBottom: '1px solid #bbf7d0',
            padding: '0.5rem 1.5rem',
            fontSize: '0.8rem',
            color: '#15803d',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle size={14} style={{ color: '#16a34a' }} />
          <span>Ticket &bull; Official Electronic Reservation Slip (ERS) sent directly to your registered email on payment.</span>
        </div>
        {/* Ticket Top Banner */}
        <div
          style={{
            background: 'var(--primary)',
            color: 'white',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Train size={24} />
              <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.5px' }}>
                INDIAN RAILWAYS
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
              Electronic Reservation Slip (ERS) &bull; RailBook Portal
            </span>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.85, display: 'block' }}>PNR NUMBER</span>
            <span style={{ fontSize: '1.2rem', fontWeight: 800, letterSpacing: '1px', fontFamily: 'var(--font-mono)' }}>
              {ticketData.pnr}
            </span>
          </div>
        </div>

        {/* Cancellation Notice Banner if Cancelled */}
        {isCancelled && (
          <div
            style={{
              background: '#fee2e2',
              color: '#b91c1c',
              padding: '0.75rem 1.5rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderBottom: '1px solid #fecaca',
            }}
          >
            <Ban size={18} />
            <span>THIS TICKET HAS BEEN CANCELLED. SEATS RELEASED.</span>
          </div>
        )}

        {/* Journey Details Bar */}
        <div style={{ padding: '1.5rem', borderBottom: '1.5px dashed var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="text-xs text-muted font-bold">TRAIN NO. & NAME</span>
              <div className="font-bold text-heading" style={{ fontSize: '1.1rem', marginTop: '0.1rem' }}>
                {ticketData.train_number} / {ticketData.train_name}
              </div>
              <span className="text-xs text-muted">{ticketData.train_type || 'Superfast Express'}</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="text-xs text-muted font-bold">TICKET NO.</span>
              <div className="font-bold text-heading" style={{ fontSize: '0.95rem', fontFamily: 'var(--font-mono)', marginTop: '0.1rem' }}>
                {ticketData.ticket_number}
              </div>
              <span className="text-xs text-muted">
                Issued: {ticketData.issued_at ? new Date(ticketData.issued_at).toLocaleDateString() : 'Instant'}
              </span>
            </div>
          </div>

          {/* Route Board */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '1rem',
              alignItems: 'center',
              background: 'var(--bg)',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-sm)',
              marginTop: '1.25rem',
            }}
          >
            <div>
              <span className="text-xs text-muted font-bold">FROM STATION</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--heading)', fontFamily: 'var(--font-mono)' }}>
                {ticketData.source_station?.code || ticketData.source_station_code || 'SRC'}
              </div>
              <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                {ticketData.source_station?.name || ticketData.source_station_name || 'Source Station'}
              </div>
              <div className="text-xs text-muted">
                Date: {ticketData.journey_date ? new Date(ticketData.journey_date).toLocaleDateString() : 'N/A'}
              </div>
            </div>

            <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.8rem' }}>
              <div>&rarr;</div>
              <span style={{ fontSize: '0.75rem' }}>DIRECT</span>
            </div>

            <div style={{ textAlign: 'right' }}>
              <span className="text-xs text-muted font-bold">TO STATION</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--heading)', fontFamily: 'var(--font-mono)' }}>
                {ticketData.destination_station?.code || ticketData.destination_station_code || 'DST'}
              </div>
              <div className="font-bold text-sm" style={{ color: 'var(--text)' }}>
                {ticketData.destination_station?.name || ticketData.destination_station_name || 'Destination Station'}
              </div>
              <div className="text-xs text-muted">Class: {ticketData.coach ? 'AC/Sleeper' : 'Reserved'}</div>
            </div>
          </div>
        </div>

        {/* Passenger Information Table */}
        <div style={{ padding: '1.5rem', borderBottom: '1.5px dashed var(--border)' }}>
          <span className="text-xs text-muted font-bold block" style={{ marginBottom: '0.75rem' }}>
            PASSENGER DETAILS & SEAT ALLOCATION
          </span>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>
                <th style={{ padding: '0.5rem 0.75rem' }}>#</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Passenger Name</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Age / Sex</th>
                <th style={{ padding: '0.5rem 0.75rem' }}>Booking Status</th>
                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>Coach / Berth</th>
              </tr>
            </thead>
            <tbody>
              {ticketData.passengers && ticketData.passengers.length > 0 ? (
                ticketData.passengers.map((p, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>{idx + 1}</td>
                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{p.name}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      {p.age} Yrs / {p.gender || 'M'}
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>
                      <span className={`badge ${isCancelled ? 'badge-error' : 'badge-success'}`}>
                        {isCancelled ? 'CANCELLED' : 'CNF (Confirmed)'}
                      </span>
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                      {p.seat_id ? `Seat #${p.seat_id}` : p.seat_number ? p.seat_number : `${ticketData.coach || 'B1'}-${idx + 21}`}
                    </td>
                  </tr>
                ))
              ) : (
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '0.6rem 0.75rem' }}>1</td>
                  <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>Primary Passenger</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>28 Yrs / M</td>
                  <td style={{ padding: '0.6rem 0.75rem' }}>
                    <span className="badge badge-success">CNF</span>
                  </td>
                  <td style={{ padding: '0.6rem 0.75rem', textAlign: 'right', fontWeight: 700 }}>B1-45</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Payment & Fare Footer */}
        <div
          style={{
            background: 'var(--bg)',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} className="text-success" />
              <span className="text-xs text-muted">
                Transaction ID: <strong style={{ fontFamily: 'var(--font-mono)' }}>{ticketData.fare_details?.payment?.transaction_id || 'TXN' + ticketData.booking_id}</strong>
              </span>
            </div>
            <div className="text-xs text-muted" style={{ marginTop: '0.2rem' }}>
              Payment Method: <strong>{ticketData.fare_details?.payment?.payment_method || 'UPI (Instant)'}</strong> &bull; Status: <strong>SUCCESS</strong>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className="text-xs text-muted font-bold">TOTAL TICKET FARE</span>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
              ₹{ticketData.fare_details?.total_amount || 250}
            </div>
          </div>
        </div>

        {/* Small Print Terms */}
        <div style={{ padding: '0.75rem 1.5rem', background: '#fafafa', borderTop: '1px solid var(--border)', fontSize: '0.7rem', color: 'var(--muted)', lineHeight: '1.4' }}>
          * Passengers must carry an original government-issued photo identity card (Aadhaar, Voter ID, Passport, Driving License) during the journey. This E-Ticket is valid only when accompanied by valid ID proof.
        </div>
      </div>
    </div>
  );
}
