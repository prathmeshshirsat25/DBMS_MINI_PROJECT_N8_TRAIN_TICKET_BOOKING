# RailBook — Unified Railway Booking System

A full-stack railway ticket booking website integrating five independently developed modules into one cohesive, production-ready system. Built with React (Vite), Node.js, Express, and Supabase PostgreSQL.

---

## 1. Project Overview

RailBook demonstrates an end-to-end railway reservation portal inspired by IRCTC. It provides:
- Live train search by station code or city across 1,000+ real routes and operational schedules.
- Interactive seat selection across train coaches with temporary reservation locking to prevent race conditions.
- Multi-passenger roster management with quota and berth preferences.
- Secure JWT authentication with OTP password reset.
- Transactional mock payment checkout (UPI, Cards, NetBanking, Wallets).
- Printable and downloadable official Electronic Reservation Slips (ERS) with PNR and coach/seat allocations.
- Automated instant dispatch of confirmed tickets and Electronic Reservation Slips (ERS) directly to passenger's email address upon successful payment.
- Over 2,400 real Indian Railways trains, 3,500+ stations, and 48,000+ route stops with daily operational schedules.
- Full cancellation policy calculation with automated refund recording and instant seat release.

---

## 2. Integrated Group Modules

| Group | Module | Technologies | Key Endpoints |
|---|---|---|---|
| **G1** | Train Search & Schedule | Express, PostgreSQL, Lucide | `/api/stations`, `/api/trains/search`, `/api/trains/:id/routes` |
| **G2** | Payment, Tickets & Refunds | Express, PostgreSQL | `/api/payments`, `/api/tickets`, `/api/cancellations`, `/api/refunds` |
| **G3** | Authentication & Security | bcryptjs, JWT, Nodemailer | `/api/auth/register`, `/api/auth/login`, `/api/auth/me`, `/api/auth/reset-password` |
| **G4** | Booking & Passengers | Express Transactions, PostgreSQL | `/api/bookings`, `/api/passengers` |
| **G5** | Interactive Seat Management | PostgreSQL Row Locking | `/api/seats/:train_id`, `/api/seats/block`, `/api/seats/release` |

---

## 3. Technology Stack

### Frontend
- **Framework**: React 18 with Vite
- **Routing**: React Router v6
- **Styling**: Plain CSS3 with custom "Summer Ocean Breeze" design system (`--primary: #087E8B`, `--secondary: #00A6A6`, `--bg: #F5FAFC`)
- **Icons**: Lucide React
- **API Client**: Native `fetch` with centralized interceptor

### Backend
- **Runtime**: Node.js & Express 4
- **Database Driver**: `pg` (PostgreSQL client pool)
- **Authentication**: JSON Web Tokens (`jsonwebtoken`) & `bcryptjs`
- **Mail Service**: `nodemailer` (SMTP with dev fallback)

### Database
- **Platform**: Supabase PostgreSQL
- **Key Tables**: 14 tables (`stations`, `trains`, `routes`, `schedules`, `train_classes`, `class_fares`, `users`, `seats`, `bookings`, `passengers`, `payments`, `tickets`, `cancellations`, `refunds`)

---

## 4. Folder Structure

```text
railway-booking-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── db.js                 # Centralized PostgreSQL connection pool
│   │   ├── controllers/
│   │   │   ├── authController.js     # User registration, login, OTP
│   │   │   ├── bookingController.js  # Transactional booking creation
│   │   │   ├── cancellationController.js # Tiered refund calculation
│   │   │   ├── passengerController.js
│   │   │   ├── paymentController.js  # Mock payment processing & tickets
│   │   │   ├── refundController.js
│   │   │   ├── seatController.js     # Seat layout & 10-min reservation lock
│   │   │   ├── stationController.js  # Station autocomplete lookup
│   │   │   ├── ticketController.js   # Printable ticket retrieval
│   │   │   └── trainController.js    # Multi-stop route & schedule search
│   │   ├── middleware/
│   │   │   ├── auth.js               # JWT bearer verification
│   │   │   └── errorHandler.js       # Centralized JSON error handler
│   │   ├── routes/                   # Clean Express router modules
│   │   ├── app.js                    # Express app configuration
│   │   └── server.js                 # Server entry point (Port 5000)
│   ├── tests/
│   │   └── test-runner.js            # 24-scenario automated test suite
│   ├── package.json
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── common/               # Navbar, Footer, BookingSteps, StationAutocomplete
│   │   ├── context/
│   │   │   └── AuthContext.jsx       # Persistent authentication state
│   │   ├── pages/                    # 19 dedicated user journey pages
│   │   ├── services/
│   │   │   └── api.js                # Centralized backend API client
│   │   ├── styles/
│   │   │   └── global.css            # Summer Ocean Breeze design system
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
├── database/
│   └── schema-audit.md               # Detailed PostgreSQL audit & schema report
├── docs/
│   ├── API.md                        # Complete REST API reference
│   ├── INTEGRATION_REPORT.md         # Architecture & conflict resolution details
│   └── TEST_REPORT.md                # Automated test execution results
├── .gitignore
└── README.md
```

---

## 5. Local Setup & Running Instructions

### Prerequisites
- Node.js (v18 or higher recommended)
- Internet connection (to access Supabase PostgreSQL)

### Step 1: Backend Setup
```bash
cd e:\DBMS_LAB_PROJECT\Railway_booking_Main_File\backend
npm install
npm start
```
The backend API server will start on: **`http://localhost:5000`**

### Step 2: Frontend Setup
Open a new terminal:
```bash
cd e:\DBMS_LAB_PROJECT\Railway_booking_Main_File\frontend
npm install
npm run dev
```
The frontend website will open at: **`http://localhost:5173`**

### Step 3: Run Automated Test Suite
To verify end-to-end database transactions, authentication, booking, and refunds:
```bash
cd e:\DBMS_LAB_PROJECT\Railway_booking_Main_File\backend
npm test
```

---

## 6. Complete End-to-End User Journey

1. **Search Trains**: Enter source station (e.g. `BCT`), destination (e.g. `ADI`), and travel date.
2. **Select Train**: Review route duration, timings, and travel classes (`SL`, `3A`, `2A`, `1A`, `CC`, `2S`).
3. **Interactive Seat Map**: Choose coach and pick available seats. Selected seats are temporarily held for 10 minutes.
4. **Passenger Details**: Enter name, age, gender, and berth preference for each passenger.
5. **Review Summary**: Transparent breakdown showing base fare, reservation fee, and GST.
6. **Mock Payment**: Select UPI, Card, NetBanking, or Wallet. Choose a scenario: `Simulate SUCCESS`, `FAILED`, or `PENDING`.
7. **Instant Ticket Generation**: A unique PNR is generated with an official Electronic Reservation Slip.
8. **Print / Download**: Clean print view with browser print dialog support.
9. **My Bookings**: View journey history and ticket records.
10. **Cancellation & Refund**: Cancel eligible tickets to instantly release seats and record refund amount.

---

## 7. License & Credits

Developed as a Collaborative Database Management Systems (DBMS) College Integration Project.
Supabase PostgreSQL provides backend cloud persistence.
