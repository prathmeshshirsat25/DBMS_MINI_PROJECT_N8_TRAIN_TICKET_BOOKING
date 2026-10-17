// Centralized API client for all backend endpoints
const RAW_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  'https://dbms-mini-project-train-ticket-booking.onrender.com';
const API_BASE = RAW_BASE
  ? `${RAW_BASE.replace(/\/$/, '')}${RAW_BASE.endsWith('/api') ? '' : '/api'}`
  : '/api';

function getToken() {
  return localStorage.getItem('token');
}

async function request(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const config = {
    ...options,
    headers,
  };

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(data.message || data.error || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Auth
  auth: {
    register: (userData) => request('/auth/register', { method: 'POST', body: JSON.stringify(userData) }),
    login: (credentials) => request('/auth/login', { method: 'POST', body: JSON.stringify(credentials) }),
    me: () => request('/auth/me'),
    updateProfile: (data) => request('/auth/profile', { method: 'PUT', body: JSON.stringify(data) }),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
    verifyOtp: (payload) => request('/auth/verify-otp', { method: 'POST', body: JSON.stringify(payload) }),
    resetPassword: (payload) => request('/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
    changePassword: (payload) => request('/auth/change-password', { method: 'PUT', body: JSON.stringify(payload) }),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  // Stations
  stations: {
    search: (q) => request(`/stations?q=${encodeURIComponent(q || '')}`),
    getById: (id) => request(`/stations/${id}`),
  },

  // Trains
  trains: {
    list: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request(`/trains${q ? `?${q}` : ''}`);
    },
    search: ({ from, to, date, travelClass }) => {
      const params = new URLSearchParams({
        from: from || '',
        to: to || '',
        date: date || '',
        ...(travelClass ? { class: travelClass } : {}),
      });
      return request(`/trains/search?${params.toString()}`);
    },
    getById: (id) => request(`/trains/${id}`),
    getRoutes: (id) => request(`/trains/${id}/routes`),
    getSchedule: (id, date) => request(`/trains/${id}/schedule?date=${encodeURIComponent(date)}`),
    getAvailableDates: ({ from, to, travelClass, month }) => {
      const params = new URLSearchParams({
        from: from || '',
        to: to || '',
        ...(travelClass ? { class: travelClass } : {}),
        ...(month ? { month } : {}),
      });
      return request(`/trains/available-dates?${params.toString()}`);
    },
  },

  // Seats
  seats: {
    getByTrain: (trainId, { travelClass, scheduleId } = {}) => {
      const params = new URLSearchParams({
        ...(travelClass ? { class: travelClass } : {}),
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
      });
      return request(`/seats/${trainId}${params.toString() ? `?${params.toString()}` : ''}`);
    },
    block: (seatIds, minutes = 10) => request('/seats/block', {
      method: 'POST',
      body: JSON.stringify({ seat_ids: seatIds, minutes }),
    }),
    release: (seatIds) => request('/seats/release', {
      method: 'POST',
      body: JSON.stringify({ seat_ids: seatIds }),
    }),
    book: (seatIds) => request('/seats/book', {
      method: 'POST',
      body: JSON.stringify({ seat_ids: seatIds }),
    }),
  },

  // Bookings
  bookings: {
    create: (bookingData) => request('/bookings', { method: 'POST', body: JSON.stringify(bookingData) }),
    getMyBookings: () => request('/bookings/my'),
    getById: (id) => request(`/bookings/${id}`),
    cancel: (id) => request(`/bookings/${id}/cancel`, { method: 'PATCH' }),
  },

  // Passengers
  passengers: {
    getByBooking: (bookingId) => request(`/passengers/booking/${bookingId}`),
  },

  // Payments
  payments: {
    create: ({ bookingId, paymentMethod, simulateStatus }) => request('/payments', {
      method: 'POST',
      body: JSON.stringify({
        booking_id: bookingId,
        payment_method: paymentMethod,
        simulate_status: simulateStatus || 'SUCCESS',
      }),
    }),
    getByBooking: (bookingId) => request(`/payments/booking/${bookingId}`),
  },

  // Tickets
  tickets: {
    getByBooking: (bookingId) => request(`/tickets/booking/${bookingId}`),
    getById: (id) => request(`/tickets/${id}`),
    getByPnr: (pnr) => request(`/tickets/pnr/${pnr}`),
    sendEmail: (bookingId) => request(`/tickets/email/${bookingId}`, { method: 'POST' }),
  },

  // Cancellations
  cancellations: {
    cancelBooking: ({ bookingId, reason }) => request('/cancellations', {
      method: 'POST',
      body: JSON.stringify({ booking_id: bookingId, reason }),
    }),
    getByBooking: (bookingId) => request(`/cancellations/booking/${bookingId}`),
  },

  // Refunds
  refunds: {
    getByBooking: (bookingId) => request(`/refunds/booking/${bookingId}`),
  },
};

export default api;
