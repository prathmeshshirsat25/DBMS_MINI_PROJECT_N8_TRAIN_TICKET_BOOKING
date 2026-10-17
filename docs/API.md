# REST API Documentation — RailBook Backend

All API endpoints are hosted under the `/api` prefix. Standard JSON responses are returned for all endpoints.

## Response Standard

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

---

## 1. Authentication (`/api/auth`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/register` | `POST` | Public | Create new user account. Returns JWT token. |
| `/api/auth/login` | `POST` | Public | Authenticate user credentials. Returns JWT token. |
| `/api/auth/me` | `GET` | Bearer | Retrieve profile of the currently logged-in user. |
| `/api/auth/profile` | `PUT` | Bearer | Update user full name and phone number. |
| `/api/auth/forgot-password` | `POST` | Public | Generate 6-digit OTP for password recovery. |
| `/api/auth/verify-otp` | `POST` | Public | Validate OTP without consuming it. |
| `/api/auth/reset-password` | `POST` | Public | Update password using verified OTP. |
| `/api/auth/change-password` | `PUT` | Bearer | Update password with current password verification. |
| `/api/auth/logout` | `POST` | Bearer | Invalidate client session token. |

---

## 2. Stations & Trains (`/api/stations`, `/api/trains`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/stations` | `GET` | Public | Autocomplete station search by code, name, or city (`?q=Mumbai`). |
| `/api/stations/:id` | `GET` | Public | Retrieve single station details. |
| `/api/trains` | `GET` | Public | Paginated list of trains (`?page=1&limit=20&q=Express`). |
| `/api/trains/search` | `GET` | Public | Search trains between stations (`?from=BCT&to=ADI&date=YYYY-MM-DD&class=3A`). |
| `/api/trains/available-dates` | `GET` | Public | Query operational dates on a route (`?from=BCT&to=ADI&month=YYYY-MM`). |
| `/api/trains/:id` | `GET` | Public | Retrieve train master details with supported travel classes. |
| `/api/trains/:id/routes` | `GET` | Public | Complete ordered route stops with arrival/departure timings. |
| `/api/trains/:id/schedule` | `GET` | Public | Operational schedule status on a specific date (`?date=YYYY-MM-DD`). |

---

## 3. Seats Management (`/api/seats`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/seats/:train_id` | `GET` | Public | Retrieve coach and seat layout with live availability states. |
| `/api/seats/block` | `POST` | Public | Hold selected seats for 10 minutes (`{ seat_ids: [1,2], minutes: 10 }`). |
| `/api/seats/release` | `POST` | Public | Release temporarily blocked seats (`{ seat_ids: [1,2] }`). |
| `/api/seats/book` | `POST` | Public | Finalize booking of seats after payment (`{ seat_ids: [1,2] }`). |

---

## 4. Bookings & Passengers (`/api/bookings`, `/api/passengers`)

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/bookings` | `POST` | Bearer | Create a booking with passenger roster in a transaction (`status = 'PENDING'`). |
| `/api/bookings/my` | `GET` | Bearer | Retrieve all bookings for the authenticated user. |
| `/api/bookings/:id` | `GET` | Bearer | Retrieve detailed booking with passengers and station details. |
| `/api/bookings/:id/cancel` | `PATCH` | Bearer | Cancel a pending or unconfirmed booking. |
| `/api/passengers/booking/:booking_id` | `GET` | Bearer | Retrieve passengers allocated to a specific booking. |

---

## 5. Payments, Tickets, Cancellations & Refunds

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/payments` | `POST` | Bearer | Execute mock payment transaction (`SUCCESS`, `FAILED`, `PENDING`). Confirms booking and generates ticket on success. |
| `/api/payments/booking/:booking_id` | `GET` | Bearer | Retrieve payment record for a booking. |
| `/api/tickets/booking/:booking_id` | `GET` | Bearer | Retrieve full printable Electronic Reservation Slip (ERS). |
| `/api/tickets/pnr/:pnr` | `GET` | Bearer | Lookup ticket by 10-digit PNR. |
| `/api/cancellations` | `POST` | Bearer | Cancel confirmed ticket, release seats, and create refund record. |
| `/api/cancellations/booking/:booking_id` | `GET` | Bearer | Retrieve cancellation receipt. |
| `/api/refunds/booking/:booking_id` | `GET` | Bearer | Retrieve refund status and calculated refund amount. |
| `/api/refunds/:refund_id/process` | `PATCH` | Admin | Mark refund as `PROCESSED` or `FAILED`. |
