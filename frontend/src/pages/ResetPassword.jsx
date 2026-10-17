import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { CheckCircle } from 'lucide-react';
import logoImg from '../assets/logo.png';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: location.state?.email || '',
    otp: location.state?.otp || '',
    new_password: '',
    confirm_password: '',
  });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.email || !formData.otp) {
      setError('Please provide your email and OTP.');
      return;
    }

    if (formData.new_password !== formData.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.new_password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await api.auth.resetPassword(formData);
      setMessage(res.message || 'Password reset successfully! You can now log in.');
      setSuccess(true);
      setTimeout(() => {
        navigate('/login');
      }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to reset password. Please check your OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logoImg} alt="RailBook" style={{ height: '42px', width: 'auto', margin: '0 auto 0.5rem', display: 'block' }} />
          <h1>Set New Password</h1>
          <p>Enter the OTP received and create a new password</p>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {success ? (
          <div className="text-center" style={{ padding: '1rem 0' }}>
            <CheckCircle size={48} className="text-success" style={{ margin: '0 auto 1rem' }} />
            <p className="text-sm text-muted">Redirecting to login in a moment...</p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: '1rem' }}>
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                name="email"
                className="form-control"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="otp">
                6-Digit OTP
              </label>
              <input
                id="otp"
                type="text"
                name="otp"
                className="form-control"
                placeholder="e.g. 123456"
                maxLength={6}
                value={formData.otp}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="new_password">
                New Password
              </label>
              <input
                id="new_password"
                type="password"
                name="new_password"
                className="form-control"
                placeholder="Min 8 characters"
                value={formData.new_password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirm_password">
                Confirm New Password
              </label>
              <input
                id="confirm_password"
                type="password"
                name="confirm_password"
                className="form-control"
                placeholder="Re-enter password"
                value={formData.confirm_password}
                onChange={handleChange}
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
                  <span>Resetting Password...</span>
                </>
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}

        <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
          <Link to="/login" style={{ color: 'var(--muted)' }}>
            &larr; Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
