import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { KeyRound } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');
    setDevOtp('');

    try {
      const res = await api.auth.forgotPassword(email);
      setMessage(res.message || 'If an account exists, a password reset code has been sent.');
      if (res.data?.dev_otp) {
        setDevOtp(res.data.dev_otp);
      }
    } catch (err) {
      setError(err.message || 'Failed to request password reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logoImg} alt="RailBook" style={{ height: '42px', width: 'auto', margin: '0 auto 0.5rem', display: 'block' }} />
          <h1>Forgot Password</h1>
          <p>Enter your registered email to receive an OTP</p>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {devOtp && (
          <div className="alert alert-info">
            <strong>Development Demo OTP:</strong> <code style={{ fontSize: '1.1rem', letterSpacing: '2px' }}>{devOtp}</code>
          </div>
        )}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              placeholder="e.g. user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: '1rem' }}
          >
            {loading ? (
              <>
                <span className="spinner spinner-white"></span>
                <span>Sending OTP...</span>
              </>
            ) : (
              <>
                <KeyRound size={18} />
                <span>Send Reset Code</span>
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          {message && (
            <p style={{ marginBottom: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => navigate('/reset-password', { state: { email, otp: devOtp } })}
              >
                Proceed to Reset Password &rarr;
              </button>
            </p>
          )}
          <Link to="/login" style={{ color: 'var(--muted)' }}>
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
