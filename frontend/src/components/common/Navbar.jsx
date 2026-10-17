import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { User, LogOut, Ticket, ChevronDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/logo.png';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="navbar-header">
      <div className="navbar-container">
        {/* Left: Brand Logo */}
        <Link to="/" className="navbar-brand" title="RailBook - Official Ticket Booking">
          <img src={logoImg} alt="RailBook Logo" className="navbar-brand-logo" />
          <span className="navbar-brand-name">RailBook</span>
        </Link>

        {/* Center: Clean Navigation Links */}
        <nav className="navbar-nav-center">
          <NavLink to="/" end className={({ isActive }) => `navbar-nav-link ${isActive ? 'active' : ''}`}>
            ABOUT
          </NavLink>
          <a href="#popular-routes" className="navbar-nav-link">
            POPULAR ROUTES
          </a>
          <a href="#why-railbook" className="navbar-nav-link">
            FEATURES
          </a>
          <a href="#partners" className="navbar-nav-link">
            PARTNERS
          </a>
        </nav>

        {/* Right: Modern Action Buttons */}
        <div className="navbar-nav-right">
          {isAuthenticated ? (
            <>
              <NavLink to="/my-bookings" className="btn-nav-outline">
                <Ticket size={15} />
                <span>MY BOOKINGS</span>
              </NavLink>

              <NavLink to="/dashboard" className="btn-nav-signin">
                <User size={15} />
                <span>{user?.name?.split(' ')[0]?.toUpperCase() || 'DASHBOARD'}</span>
              </NavLink>

              <button
                type="button"
                onClick={handleLogout}
                className="btn-nav-ghost"
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </>
          ) : (
            <>
              <Link to="/register" className="btn-nav-create">
                CREATE ACCOUNT
              </Link>

              <Link to="/login" className="btn-nav-signin">
                SIGN IN
              </Link>

              <div className="nav-country-select" title="Region: India (INR)">
                <span style={{ fontSize: '1.1rem' }}>🇮🇳</span>
                <ChevronDown size={14} style={{ opacity: 0.6 }} />
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
