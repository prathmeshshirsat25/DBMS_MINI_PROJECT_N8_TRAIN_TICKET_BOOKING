import React from 'react';

export default function Footer() {
  return (
    <footer className="footer no-print">
      <div className="container">
        <p>
          &copy; {new Date().getFullYear()} RailBook &mdash; Railway Ticket Booking System. Designed for College Project Demonstration.
        </p>
        <p style={{ marginTop: '0.25rem', fontSize: '0.75rem', opacity: 0.7 }}>
          Built with React, Express, and Supabase PostgreSQL.
        </p>
      </div>
    </footer>
  );
}
