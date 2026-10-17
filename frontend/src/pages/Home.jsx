import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import StationAutocomplete from '../components/common/StationAutocomplete';
import {
  Search,
  Calendar,
  Filter,
  ArrowRightLeft,
  ShieldCheck,
  Clock,
  CreditCard,
  Train,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Star,
  Zap,
} from 'lucide-react';
import TrainScene from '../components/common/TrainScene';

const POPULAR_CLASSES = [
  { code: '', label: 'All Classes' },
  { code: 'SL', label: 'Sleeper (SL)' },
  { code: '3A', label: 'AC 3 Tier (3A)' },
  { code: '2A', label: 'AC 2 Tier (2A)' },
  { code: '1A', label: 'AC First Class (1A)' },
  { code: 'CC', label: 'AC Chair Car (CC)' },
  { code: '2S', label: 'Second Sitting (2S)' },
];

const POPULAR_ROUTES = [
  {
    from: 'PUNE',
    to: 'CSMT',
    trainName: 'Deccan Queen',
    trainNumber: '12124',
    duration: '3h 15m',
    startingFare: 90,
    type: 'Superfast Express',
  },
  {
    from: 'BCT',
    to: 'ADI',
    trainName: 'Vande Bharat Express',
    trainNumber: '20901',
    duration: '5h 25m',
    startingFare: 650,
    type: 'Semi High Speed',
  },
  {
    from: 'NDLS',
    to: 'HWH',
    trainName: 'Howrah Rajdhani',
    trainNumber: '12302',
    duration: '17h 05m',
    startingFare: 1450,
    type: 'Rajdhani Express',
  },
  {
    from: 'SBC',
    to: 'MAS',
    trainName: 'Chennai Shatabdi',
    trainNumber: '12028',
    duration: '4h 50m',
    startingFare: 550,
    type: 'Shatabdi Express',
  },
];

export default function Home() {
  const navigate = useNavigate();

  // Default to tomorrow's date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [fromStation, setFromStation] = useState('PUNE');
  const [toStation, setToStation] = useState('CSMT');
  const [journeyDate, setJourneyDate] = useState(defaultDate);
  const [travelClass, setTravelClass] = useState('');
  const [tripType, setTripType] = useState('one-way');
  const [error, setError] = useState('');

  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  const handleSetDateOffset = (offsetDays) => {
    const target = new Date();
    target.setDate(target.getDate() + offsetDays);
    setJourneyDate(target.toISOString().split('T')[0]);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!fromStation || !toStation) {
      setError('Please select both departure and destination stations.');
      return;
    }

    if (fromStation.trim().toUpperCase() === toStation.trim().toUpperCase()) {
      setError('Departure and destination stations cannot be the same.');
      return;
    }

    if (!journeyDate) {
      setError('Please choose a valid journey date.');
      return;
    }

    setError('');
    const params = new URLSearchParams({
      from: fromStation.trim(),
      to: toStation.trim(),
      date: journeyDate,
      ...(travelClass ? { class: travelClass } : {}),
    });

    navigate(`/trains/results?${params.toString()}`);
  };

  const scrollToSearch = () => {
    const el = document.getElementById('search-engine-card');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="home-page-container">
      {/* ── 1. Hero Showcase Section ── */}
      <section className="hero-innovative">
        <div className="hero-sky-backdrop">
          <div className="hero-content-wrapper">
            <h1 className="hero-bold-headline">
              You are going to love<br />buying <em>train tickets</em>
            </h1>

            <p className="hero-subheading">
              Fast, simple and transparent train reservation across India.
            </p>

            <button
              type="button"
              onClick={scrollToSearch}
              className="hero-dark-cta-button"
            >
              BOOK A TICKET
            </button>
          </div>

          {/* Scenic Illustration Banner */}
          <div className="hero-illustration-container">
            <TrainScene />
          </div>
        </div>

        {/* Official Authorised Partners Strip */}
        <div className="partners-strip-container" id="partners">
          <div className="container">
            <div className="partners-strip-header">
              <span className="partners-label">AUTHORISED RAILWAY PORTAL</span>
            </div>

            <div className="partners-logos-grid">
              <div className="partner-logo-item">IRCTC</div>
              <div className="partner-logo-item">VANDE BHARAT</div>
              <div className="partner-logo-item">RAJDHANI EXP</div>
              <div className="partner-logo-item">SHATABDI</div>
              <div className="partner-logo-item">CENTRAL RAILWAY</div>
              <div className="partner-logo-item">WESTERN RAILWAY</div>
              <div className="partner-logo-item">NORTHERN RAILWAY</div>
              <div className="partner-logo-item">KONKAN RAILWAY</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. Interactive Booking Engine Card ── */}
      <section className="container" style={{ marginTop: '-4rem', position: 'relative', zIndex: 20 }}>
        <div id="search-engine-card" className="search-engine-card">
          {/* Trip Mode Tabs */}
          <div className="trip-tabs-header">
            <button
              type="button"
              onClick={() => setTripType('one-way')}
              className={`trip-tab-btn ${tripType === 'one-way' ? 'active' : ''}`}
            >
              One-Way Journey
            </button>
            <button
              type="button"
              onClick={() => setTripType('round-trip')}
              className={`trip-tab-btn ${tripType === 'round-trip' ? 'active' : ''}`}
            >
              Round Trip
            </button>
            <button
              type="button"
              onClick={() => navigate('/trains/search')}
              className="trip-tab-btn"
            >
              Live Schedules & Routes
            </button>
          </div>

          {error && <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>{error}</div>}

          <form onSubmit={handleSearch}>
            <div className="search-form-grid">
              {/* Departure Station */}
              <div className="form-col">
                <StationAutocomplete
                  label="From Station"
                  value={fromStation}
                  onChange={(code) => {
                    setFromStation(code);
                    setError('');
                  }}
                  placeholder="e.g. Pune (PUNE), Mumbai (CSMT)..."
                  required
                />
              </div>

              {/* Station Swap Button */}
              <div className="swap-button-col">
                <button
                  type="button"
                  onClick={handleSwap}
                  className="btn-station-swap"
                  title="Swap Departure and Destination"
                >
                  <ArrowRightLeft size={16} />
                </button>
              </div>

              {/* Destination Station */}
              <div className="form-col">
                <StationAutocomplete
                  label="To Station"
                  value={toStation}
                  onChange={(code) => {
                    setToStation(code);
                    setError('');
                  }}
                  placeholder="e.g. Mumbai (CSMT), Ahmedabad (ADI)..."
                  required
                />
              </div>

              {/* Journey Date */}
              <div className="form-col">
                <label className="form-label" htmlFor="journeyDate">
                  Departure Date
                </label>
                <input
                  id="journeyDate"
                  type="date"
                  className="form-control"
                  value={journeyDate}
                  onChange={(e) => setJourneyDate(e.target.value)}
                  required
                />
                <div className="quick-date-chips">
                  <button type="button" onClick={() => handleSetDateOffset(0)}>Today</button>
                  <button type="button" onClick={() => handleSetDateOffset(1)}>Tomorrow</button>
                  <button type="button" onClick={() => handleSetDateOffset(2)}>+2 Days</button>
                </div>
              </div>

              {/* Travel Class */}
              <div className="form-col">
                <label className="form-label" htmlFor="travelClass">
                  Class Preference
                </label>
                <select
                  id="travelClass"
                  className="form-control"
                  value={travelClass}
                  onChange={(e) => setTravelClass(e.target.value)}
                >
                  {POPULAR_CLASSES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-muted" style={{ display: 'block', marginTop: '0.25rem' }}>
                  Auto-searches best fares
                </span>
              </div>
            </div>

            {/* Submit CTA */}
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-search-primary"
              >
                <Search size={20} />
                <span>SEARCH AVAILABLE TRAINS</span>
              </button>
            </div>
          </form>

          {/* Popular Fast Select Pills */}
          <div className="popular-shortcuts-bar" id="popular-routes">
            <span className="popular-shortcuts-label">
              <Zap size={14} className="text-secondary" /> Popular Daily Commutes:
            </span>
            <div className="popular-shortcuts-list">
              {[
                { label: 'Pune ↔ Mumbai (Deccan Queen)', from: 'PUNE', to: 'CSMT', fare: '₹90' },
                { label: 'Mumbai ↔ Ahmedabad (Vande Bharat)', from: 'BCT', to: 'ADI', fare: '₹280' },
                { label: 'New Delhi ↔ Howrah (Rajdhani)', from: 'NDLS', to: 'HWH', fare: '₹950' },
                { label: 'Bengaluru ↔ Chennai (Shatabdi)', from: 'SBC', to: 'MAS', fare: '₹310' },
              ].map((rt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setFromStation(rt.from);
                    setToStation(rt.to);
                    setError('');
                  }}
                  className="popular-route-pill"
                >
                  <span>{rt.label}</span>
                  <span className="pill-fare">{rt.fare}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Trending Routes Showcase ── */}
      <section className="container" style={{ padding: '4.5rem 1rem 2rem' }}>
        <div className="section-heading-center">
          <span className="section-pill-tag">EXPLORE TOP SERVICES</span>
          <h2>Popular Express & High-Speed Routes</h2>
          <p className="text-muted">Direct reservations with live seat layout views & fast confirmations.</p>
        </div>

        <div className="popular-trains-grid">
          {POPULAR_ROUTES.map((route, idx) => (
            <div key={idx} className="popular-train-card">
              <div className="popular-card-badge">{route.type}</div>
              <div className="popular-card-header">
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '0.2rem' }}>{route.trainName}</h3>
                  <span className="text-xs text-muted">Train #{route.trainNumber}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="text-xs text-muted">Starting from</span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--primary)' }}>
                    ₹{route.startingFare}
                  </div>
                </div>
              </div>

              <div className="popular-route-path">
                <div>
                  <strong>{route.from}</strong>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Departure</span>
                </div>
                <div className="path-middle">
                  <span className="text-xs text-muted">{route.duration}</span>
                  <div className="path-line" />
                  <span className="text-xs" style={{ color: 'var(--secondary)', fontWeight: 600 }}>Daily</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong>{route.to}</strong>
                  <span className="text-xs text-muted" style={{ display: 'block' }}>Destination</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setFromStation(route.from);
                  setToStation(route.to);
                  scrollToSearch();
                }}
                className="btn-book-route"
              >
                <span>Select Date & Book</span>
                <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── 4. Value Propositions / Features ── */}
      <section className="container" id="why-railbook" style={{ padding: '3.5rem 1rem 4rem' }}>
        <div className="section-heading-center">
          <span className="section-pill-tag">WHY RAILBOOK</span>
          <h2>Designed for Seamless Railway Travel</h2>
          <p className="text-muted">Built with direct Supabase PostgreSQL integration, real coach matrices and atomic booking locks.</p>
        </div>

        <div className="feature-cards-grid">
          <div className="modern-feature-card">
            <div className="feature-icon-wrapper" style={{ background: '#dcecec', color: '#2f7f87' }}>
              <Clock size={28} />
            </div>
            <h3>Real-Time Timetables</h3>
            <p>
              Direct live route stops, arrival offsets, and distance-based fare calculations for every scheduled express train.
            </p>
            <ul className="feature-points">
              <li><CheckCircle2 size={16} className="text-secondary" /> Accurate station stop sequences</li>
              <li><CheckCircle2 size={16} className="text-secondary" /> Direct distance & duration compute</li>
            </ul>
          </div>

          <div className="modern-feature-card">
            <div className="feature-icon-wrapper" style={{ background: '#e4f0de', color: '#3b7d51' }}>
              <ShieldCheck size={28} />
            </div>
            <h3>Authentic Seat Matrix</h3>
            <p>
              Interactive coach layouts (S1, S2, B1, B2, D1, C1) with real berth designations (Lower, Upper, Window, Aisle) and 10-minute hold.
            </p>
            <ul className="feature-points">
              <li><CheckCircle2 size={16} className="text-secondary" /> Prevents double-booking race conditions</li>
              <li><CheckCircle2 size={16} className="text-secondary" /> Realistic coach occupancy states</li>
            </ul>
          </div>

          <div className="modern-feature-card">
            <div className="feature-icon-wrapper" style={{ background: '#f9e6c8', color: '#c26a1f' }}>
              <CreditCard size={28} />
            </div>
            <h3>Transparent Fast Refunds</h3>
            <p>
              Integrated mock payments with 1-click cancellation and automated graduated refund calculations based on departure schedule.
            </p>
            <ul className="feature-points">
              <li><CheckCircle2 size={16} className="text-secondary" /> Instant mock UPI, Card & Netbanking</li>
              <li><CheckCircle2 size={16} className="text-secondary" /> Automatic seat release upon cancellation</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── 5. Trust & Social Proof ── */}
      <section className="home-closing" style={{ padding: '3.5rem 1rem' }}>
        <div className="container text-center">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <Star key={s} size={20} fill="#e0a43a" color="#e0a43a" />
            ))}
            <span style={{ fontWeight: 800, fontSize: '1.1rem', marginLeft: '0.25rem' }}>4.9 / 5</span>
          </div>
          <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>
            Trusted by College Evaluators & Rail Commuters
          </h2>
          <p className="text-muted" style={{ maxWidth: '600px', margin: '0 auto 2rem' }}>
            "RailBook combines modern European design aesthetics with the robust architecture required for complex Indian Railway reservation workflows."
          </p>

          <button
            type="button"
            onClick={scrollToSearch}
            className="btn-nav-create"
            style={{ padding: '0.85rem 2.25rem', fontSize: '0.9rem' }}
          >
            START BOOKING YOUR TICKET NOW
          </button>
        </div>
      </section>
    </div>
  );
}
