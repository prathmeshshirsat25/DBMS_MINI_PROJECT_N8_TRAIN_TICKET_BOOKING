import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { api } from '../services/api';
import BookingSteps from '../components/common/BookingSteps';
import { CreditCard, Smartphone, Building, Wallet, ShieldCheck, Lock, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function Payment() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [booking, setBooking] = useState(location.state?.booking || null);
  const [loading, setLoading] = useState(!booking);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [simulateStatus, setSimulateStatus] = useState('SUCCESS'); // For testing/demonstration

  // Method specific form fields
  const [upiId, setUpiId] = useState('traveller@upi');
  const [cardDetails, setCardDetails] = useState({
    number: '4532 •••• •••• 8890',
    name: 'TEST CARDHOLDER',
    expiry: '12/28',
    cvv: '•••',
  });
  const [selectedBank, setSelectedBank] = useState('HDFC');
  const [selectedWallet, setSelectedWallet] = useState('PAYTM');

  useEffect(() => {
    async function loadBooking() {
      if (booking) return;

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
  }, [bookingId, booking]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    setError('');

    try {
      const res = await api.payments.create({
        bookingId: parseInt(bookingId, 10),
        paymentMethod,
        simulateStatus,
      });

      if (res.success) {
        if (simulateStatus === 'SUCCESS') {
          // Navigate to confirmation page
          navigate(`/confirmation/${bookingId}`, {
            state: { payment: res.data?.payment, ticket: res.data?.ticket, booking },
          });
        } else {
          // Navigate to status page with FAILED or PENDING message
          navigate(`/payment-status/${bookingId}`, {
            state: {
              status: simulateStatus,
              message: simulateStatus === 'FAILED'
                ? 'Payment transaction was declined by the issuing bank.'
                : 'Payment is pending verification with the payment provider.',
            },
          });
        }
      } else {
        setError(res.message || 'Payment processing failed.');
      }
    } catch (err) {
      setError(err.message || 'Payment processing error.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg"></span>
        <span>Loading payment checkout...</span>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="container" style={{ padding: '2rem 1rem' }}>
        <div className="alert alert-error">{error}</div>
        <Link to="/my-bookings" className="btn btn-secondary">
          Go to My Bookings
        </Link>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '850px' }}>
      <BookingSteps currentStep={5} />

      <div style={{ marginBottom: '1.5rem' }}>
        <h1>Checkout & Payment</h1>
        <p className="text-muted text-sm">
          Complete payment to confirm your booking and generate an official journey ticket.
        </p>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* College Project Disclaimer Banner */}
      <div
        style={{
          background: '#eef9ff',
          border: '1.5px dashed var(--primary)',
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <ShieldCheck size={28} className="text-primary" style={{ flexShrink: 0 }} />
        <div style={{ fontSize: '0.85rem' }}>
          <strong>Academic Demonstration Mode (Mock Payment):</strong> No actual money will be charged.
          Select your test scenario below to simulate an instant <strong>SUCCESS</strong>, <strong>FAILED</strong>, or <strong>PENDING</strong> transaction.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: Payment Methods Form */}
        <div className="card">
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Choose Payment Method</h2>

          {/* Method Tabs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`btn btn-sm ${paymentMethod === 'UPI' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flexDirection: 'column', gap: '0.25rem', padding: '0.75rem 0.25rem' }}
            >
              <Smartphone size={18} />
              <span style={{ fontSize: '0.75rem' }}>UPI</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('CARD')}
              className={`btn btn-sm ${paymentMethod === 'CARD' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flexDirection: 'column', gap: '0.25rem', padding: '0.75rem 0.25rem' }}
            >
              <CreditCard size={18} />
              <span style={{ fontSize: '0.75rem' }}>Card</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('NETBANKING')}
              className={`btn btn-sm ${paymentMethod === 'NETBANKING' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flexDirection: 'column', gap: '0.25rem', padding: '0.75rem 0.25rem' }}
            >
              <Building size={18} />
              <span style={{ fontSize: '0.75rem' }}>NetBanking</span>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('WALLET')}
              className={`btn btn-sm ${paymentMethod === 'WALLET' ? 'btn-primary' : 'btn-ghost'}`}
              style={{ flexDirection: 'column', gap: '0.25rem', padding: '0.75rem 0.25rem' }}
            >
              <Wallet size={18} />
              <span style={{ fontSize: '0.75rem' }}>Wallet</span>
            </button>
          </div>

          <form onSubmit={handlePaymentSubmit}>
            {/* UPI Option */}
            {paymentMethod === 'UPI' && (
              <div className="form-group">
                <label className="form-label" htmlFor="upiId">
                  Virtual Payment Address (UPI ID)
                </label>
                <input
                  id="upiId"
                  type="text"
                  className="form-control"
                  placeholder="e.g. mobile@upi"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  required
                />
                <small className="text-muted text-xs">Simulated UPI apps: Google Pay, PhonePe, Paytm, BHIM</small>
              </div>
            )}

            {/* Card Option */}
            {paymentMethod === 'CARD' && (
              <div>
                <div className="form-group">
                  <label className="form-label">Card Number</label>
                  <input
                    type="text"
                    className="form-control"
                    value={cardDetails.number}
                    onChange={(e) => setCardDetails({ ...cardDetails, number: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Cardholder Name</label>
                  <input
                    type="text"
                    className="form-control"
                    value={cardDetails.name}
                    onChange={(e) => setCardDetails({ ...cardDetails, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Expiry (MM/YY)</label>
                    <input
                      type="text"
                      className="form-control"
                      value={cardDetails.expiry}
                      onChange={(e) => setCardDetails({ ...cardDetails, expiry: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">CVV</label>
                    <input
                      type="password"
                      className="form-control"
                      value={cardDetails.cvv}
                      maxLength={4}
                      onChange={(e) => setCardDetails({ ...cardDetails, cvv: e.target.value })}
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* NetBanking Option */}
            {paymentMethod === 'NETBANKING' && (
              <div className="form-group">
                <label className="form-label">Select Your Bank</label>
                <select
                  className="form-control"
                  value={selectedBank}
                  onChange={(e) => setSelectedBank(e.target.value)}
                >
                  <option value="HDFC">HDFC Bank</option>
                  <option value="SBI">State Bank of India</option>
                  <option value="ICICI">ICICI Bank</option>
                  <option value="AXIS">Axis Bank</option>
                  <option value="PNB">Punjab National Bank</option>
                  <option value="BOB">Bank of Baroda</option>
                </select>
              </div>
            )}

            {/* Wallet Option */}
            {paymentMethod === 'WALLET' && (
              <div className="form-group">
                <label className="form-label">Select Digital Wallet</label>
                <select
                  className="form-control"
                  value={selectedWallet}
                  onChange={(e) => setSelectedWallet(e.target.value)}
                >
                  <option value="PAYTM">Paytm Wallet</option>
                  <option value="AMAZONPAY">Amazon Pay</option>
                  <option value="MOBIKWIK">MobiKwik</option>
                  <option value="AIRTEL">Airtel Payments Bank</option>
                </select>
              </div>
            )}

            {/* Demonstration Scenario Picker */}
            <div style={{ background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius-sm)', margin: '1.5rem 0' }}>
              <span className="text-xs text-muted font-bold block" style={{ marginBottom: '0.5rem' }}>
                DEMO TEST SCENARIO SIMULATOR:
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setSimulateStatus('SUCCESS')}
                  className={`btn btn-sm ${simulateStatus === 'SUCCESS' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ background: simulateStatus === 'SUCCESS' ? '#16A34A' : 'white', borderColor: '#16A34A', color: simulateStatus === 'SUCCESS' ? 'white' : '#16A34A' }}
                >
                  Simulate SUCCESS
                </button>
                <button
                  type="button"
                  onClick={() => setSimulateStatus('FAILED')}
                  className={`btn btn-sm ${simulateStatus === 'FAILED' ? 'btn-danger' : 'btn-ghost'}`}
                >
                  Simulate FAILED
                </button>
                <button
                  type="button"
                  onClick={() => setSimulateStatus('PENDING')}
                  className={`btn btn-sm ${simulateStatus === 'PENDING' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ background: simulateStatus === 'PENDING' ? '#D97706' : 'white', borderColor: '#D97706', color: simulateStatus === 'PENDING' ? 'white' : '#D97706' }}
                >
                  Simulate PENDING
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={processing}
            >
              {processing ? (
                <>
                  <span className="spinner spinner-white"></span>
                  <span>Processing Mock Payment in Supabase...</span>
                </>
              ) : (
                <>
                  <Lock size={16} />
                  <span>Pay ₹{booking?.total_amount} Securely</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem', marginTop: '0.85rem', fontSize: '0.825rem', color: '#15803d', fontWeight: 500 }}>
              <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
              <span>Confirmed ticket will be automatically sent to your email upon clicking Pay.</span>
            </div>
          </form>
        </div>

        {/* Right: Booking Summary Snippet */}
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>Order Details</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div>
              <span className="text-xs text-muted">PNR NUMBER</span>
              <div className="font-bold text-heading" style={{ fontFamily: 'var(--font-mono)' }}>
                {booking?.pnr}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted">TRAIN</span>
              <div className="font-bold text-heading">
                {booking?.train_name} (#{booking?.train_number})
              </div>
            </div>

            <div>
              <span className="text-xs text-muted">ROUTE</span>
              <div style={{ color: 'var(--text)' }}>
                {booking?.source_station_name || booking?.source_station} &rarr; {booking?.destination_station_name || booking?.destination_station}
              </div>
            </div>

            <div>
              <span className="text-xs text-muted">DATE</span>
              <div style={{ color: 'var(--text)' }}>{booking?.journey_date}</div>
            </div>

            <div className="divider" />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="font-bold text-heading">Total Payable:</span>
              <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>
                ₹{booking?.total_amount}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
