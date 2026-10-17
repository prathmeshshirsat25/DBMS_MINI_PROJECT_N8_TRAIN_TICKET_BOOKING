import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StationAutocomplete from '../components/common/StationAutocomplete';
import { Search, ArrowRightLeft } from 'lucide-react';

export default function TrainSearch() {
  const navigate = useNavigate();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const defaultDate = tomorrow.toISOString().split('T')[0];

  const [fromStation, setFromStation] = useState('');
  const [toStation, setToStation] = useState('');
  const [journeyDate, setJourneyDate] = useState(defaultDate);
  const [travelClass, setTravelClass] = useState('');
  const [error, setError] = useState('');

  const handleSwap = () => {
    const temp = fromStation;
    setFromStation(toStation);
    setToStation(temp);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!fromStation || !toStation) {
      setError('Both source and destination stations are required.');
      return;
    }
    if (fromStation.trim().toUpperCase() === toStation.trim().toUpperCase()) {
      setError('Source and destination stations cannot be the same.');
      return;
    }
    if (!journeyDate) {
      setError('Please choose a valid journey date.');
      return;
    }

    const params = new URLSearchParams({
      from: fromStation.trim(),
      to: toStation.trim(),
      date: journeyDate,
      ...(travelClass ? { class: travelClass } : {}),
    });

    navigate(`/trains/results?${params.toString()}`);
  };

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: '650px' }}>
      <div className="card card-lg">
        <h1 style={{ marginBottom: '0.5rem' }}>Search Trains</h1>
        <p className="text-muted text-sm" style={{ marginBottom: '1.5rem' }}>
          Find available trains between stations on your preferred travel date.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <StationAutocomplete
              label="Source Station"
              value={fromStation}
              onChange={(code) => {
                setFromStation(code);
                setError('');
              }}
              placeholder="e.g. BCT or Mumbai Central"
              required
            />
          </div>

          <div className="text-center" style={{ margin: '0.5rem 0' }}>
            <button
              type="button"
              onClick={handleSwap}
              className="btn btn-ghost btn-sm"
              title="Swap Stations"
            >
              <ArrowRightLeft size={16} />
              <span>Swap Stations</span>
            </button>
          </div>

          <div className="form-group">
            <StationAutocomplete
              label="Destination Station"
              value={toStation}
              onChange={(code) => {
                setToStation(code);
                setError('');
              }}
              placeholder="e.g. ADI or Ahmedabad Junction"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="date">Journey Date</label>
              <input
                id="date"
                type="date"
                className="form-control"
                value={journeyDate}
                onChange={(e) => setJourneyDate(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="cls">Travel Class</label>
              <select
                id="cls"
                className="form-control"
                value={travelClass}
                onChange={(e) => setTravelClass(e.target.value)}
              >
                <option value="">All Classes</option>
                <option value="SL">Sleeper (SL)</option>
                <option value="3A">AC 3 Tier (3A)</option>
                <option value="2A">AC 2 Tier (2A)</option>
                <option value="1A">AC First Class (1A)</option>
                <option value="CC">AC Chair Car (CC)</option>
                <option value="2S">Second Sitting (2S)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full btn-lg" style={{ marginTop: '1rem' }}>
            <Search size={18} />
            <span>Find Trains</span>
          </button>
        </form>
      </div>
    </div>
  );
}
