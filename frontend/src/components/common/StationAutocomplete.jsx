import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { MapPin } from 'lucide-react';

export default function StationAutocomplete({
  label,
  value,
  onChange,
  placeholder = 'Enter station name or code...',
  required = false,
  error = null,
}) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.stations.search(query);
        if (res.success && Array.isArray(res.data)) {
          setSuggestions(res.data);
          setIsOpen(true);
        }
      } catch (err) {
        console.error('Station search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (station) => {
    const displayValue = `${station.station_name} (${station.station_code})`;
    setQuery(displayValue);
    setIsOpen(false);
    if (onChange) {
      onChange(station.station_code, station);
    }
  };

  return (
    <div className="form-group autocomplete-wrapper" ref={wrapperRef}>
      {label && <label className="form-label">{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          className={`form-control ${error ? 'error' : ''}`}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (onChange) onChange(e.target.value, null);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          required={required}
        />
        {loading && (
          <span
            className="spinner"
            style={{ position: 'absolute', right: '10px', top: 'calc(50% - 10px)' }}
          />
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="autocomplete-dropdown">
          {suggestions.map((station) => (
            <div
              key={station.station_id}
              className="autocomplete-item"
              onClick={() => handleSelect(station)}
            >
              <MapPin size={16} className="text-muted" />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="autocomplete-code">{station.station_code}</span>
                  <span className="autocomplete-name">{station.station_name}</span>
                </div>
                {(station.city || station.state) && (
                  <div className="autocomplete-city">
                    {[station.city, station.state].filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="form-error">{error}</div>}
    </div>
  );
}
