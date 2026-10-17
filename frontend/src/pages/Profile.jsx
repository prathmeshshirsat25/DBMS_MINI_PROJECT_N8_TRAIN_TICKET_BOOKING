import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Shield, Calendar, Save } from 'lucide-react';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const [formData, setFormData] = useState({
    name: user?.name || user?.full_name || '',
    phone: user?.phone || '',
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setMessage('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await updateProfile(formData);
      setMessage('Profile updated successfully!');
    } catch (err) {
      setError(err.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '700px' }}>
      <div className="card card-lg">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'var(--primary-light)',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={28} />
          </div>
          <div>
            <h1>User Profile</h1>
            <p className="text-muted text-sm">Manage your personal information and contact details</p>
          </div>
        </div>

        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">
              Full Name
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="name"
                type="text"
                name="name"
                className="form-control"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className="form-control"
              value={user?.email || ''}
              disabled
              title="Email address cannot be changed directly."
            />
            <small className="text-muted text-xs">Email is linked to your account and cannot be modified.</small>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              name="phone"
              className="form-control"
              value={formData.phone}
              onChange={handleChange}
            />
          </div>

          <div className="form-row" style={{ marginTop: '1.5rem', background: 'var(--bg)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
            <div>
              <span className="text-xs text-muted block font-bold">ACCOUNT ROLE</span>
              <p className="font-bold text-heading text-sm" style={{ marginTop: '0.2rem' }}>{user?.role || 'USER'}</p>
            </div>
            <div>
              <span className="text-xs text-muted block font-bold">MEMBER SINCE</span>
              <p className="font-bold text-heading text-sm" style={{ marginTop: '0.2rem' }}>
                {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Active Member'}
              </p>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: '1.5rem' }}
          >
            {loading ? (
              <>
                <span className="spinner spinner-white"></span>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save size={16} />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
