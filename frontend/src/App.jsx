import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Common Components
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';
import Scenery from './components/common/Scenery';
import ProtectedRoute from './components/common/ProtectedRoute';

// Pages
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';

import TrainSearch from './pages/TrainSearch';
import TrainResults from './pages/TrainResults';
import TrainDetails from './pages/TrainDetails';
import TrainSchedule from './pages/TrainSchedule';

import SeatSelection from './pages/SeatSelection';
import PassengerDetails from './pages/PassengerDetails';
import BookingSummary from './pages/BookingSummary';

import Payment from './pages/Payment';
import PaymentStatus from './pages/PaymentStatus';
import Confirmation from './pages/Confirmation';
import Ticket from './pages/Ticket';
import MyBookings from './pages/MyBookings';
import Cancellation from './pages/Cancellation';
import RefundStatus from './pages/RefundStatus';

export default function App() {
  return (
    <AuthProvider>
      <Scenery />
      <Navbar />
      <main className="page-wrapper">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Train Routes */}
          <Route path="/trains" element={<Navigate to="/" replace />} />
          <Route path="/trains/search" element={<TrainSearch />} />
          <Route path="/trains/results" element={<TrainResults />} />
          <Route path="/trains/:id/details" element={<TrainDetails />} />
          <Route path="/trains/:id/schedule" element={<TrainSchedule />} />

          {/* Booking Workflow */}
          <Route path="/seat-selection" element={<SeatSelection />} />
          <Route path="/passenger-details" element={<PassengerDetails />} />
          <Route path="/booking-summary" element={<BookingSummary />} />

          {/* Protected Payment & Ticket Routes */}
          <Route
            path="/payment/:bookingId"
            element={
              <ProtectedRoute>
                <Payment />
              </ProtectedRoute>
            }
          />
          <Route path="/payment-status/:bookingId" element={<PaymentStatus />} />
          <Route
            path="/confirmation/:bookingId"
            element={
              <ProtectedRoute>
                <Confirmation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ticket/:bookingId"
            element={
              <ProtectedRoute>
                <Ticket />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my-bookings"
            element={
              <ProtectedRoute>
                <MyBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cancellation/:bookingId"
            element={
              <ProtectedRoute>
                <Cancellation />
              </ProtectedRoute>
            }
          />
          <Route
            path="/refund-status/:bookingId"
            element={
              <ProtectedRoute>
                <RefundStatus />
              </ProtectedRoute>
            }
          />

          {/* Protected User Account Routes */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* 404 Fallback */}
          <Route
            path="*"
            element={
              <div className="container text-center" style={{ padding: '4rem 1rem' }}>
                <h1 style={{ fontSize: '3rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>404</h1>
                <h2>Page Not Found</h2>
                <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>
                  The requested page does not exist or has been moved.
                </p>
                <a href="/" className="btn btn-primary">
                  Return to Home
                </a>
              </div>
            }
          />
        </Routes>
      </main>
      <Footer />
    </AuthProvider>
  );
}
