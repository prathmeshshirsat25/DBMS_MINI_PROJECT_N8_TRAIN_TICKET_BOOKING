# Module Integration Report

## 1. Context & Objectives

Five student groups submitted disparate implementations:
- **G1 (Railway_booking_N8)**: TypeScript backend on port 5001 + Tailwind React frontend.
- **G2 (tickets-payments)**: JavaScript backend on port 5000 + Tailwind frontend with broken Unicode symbols.
- **G3 (Railway system)**: Monolithic client/server app with SQLite-to-PostgreSQL compatibility layer.
- **G4 (TICKET_BOOKING)**: CommonJS backend on port 5000 + custom React frontend.
- **G5 (railway-seat-selection)**: Express backend with static vanilla HTML/JS frontend.

The primary objective was to consolidate all five groups into **ONE unified Node.js/Express backend** and **ONE unified React frontend** without destroying existing Supabase data or rewriting working logic unnecessarily.

---

## 2. Key Conflicts Identified and Resolved

### A. Database Schema Inconsistencies
1. **User Identity Column Conflict**:
   - `users` table had duplicate columns: `user_id` and `id`, `name` and `full_name`, `password` and `password_hash`.
   - **Resolution**: Canonicalized on `user_id` as primary key (which foreign keys from `bookings` target) and `password_hash` with bcrypt. Handled backward compatibility in SQL queries by mapping both fields.

2. **Seat Availability per Schedule**:
   - The `seats` table had a global `status` column rather than per-schedule availability.
   - **Resolution**: Implemented transactional seat blocking with an expiration timestamp (`blocked_until`), auto-releasing expired blocks and updating seat status on successful payment or booking cancellation.

3. **Booking and Ticket Foreign Keys**:
   - G2 code expected `train_id` directly on the `bookings` table, whereas the actual Supabase schema linked `bookings` through `schedule_id` to `schedules`, which contained `train_id`.
   - **Resolution**: Adjusted all SQL joins in `ticketController.js` and `paymentController.js` to `FROM bookings b LEFT JOIN schedules s ON s.schedule_id = b.schedule_id LEFT JOIN trains t ON t.train_id = s.train_id`.

4. **Empty Class Fares**:
   - `class_fares` table had 0 rows in Supabase.
   - **Resolution**: Created a transparent demo fare policy (SL: ₹0.50/km, 3A: ₹1.50/km, 2A: ₹2.00/km, 1A: ₹3.00/km, minimum ₹50) applied across route distances.

### B. Architectural Consolidation
- Replaced 5 individual servers with one centralized Express app mounting all modules under `/api/*`.
- Standardized error handling via Express middleware returning `{ success: false, message: ... }`.
- Unified frontend styling with the "Summer Ocean Breeze" CSS design system, eliminating Tailwind dependency conflicts and duplicate CSS files.
- Connected the complete end-to-end journey without dead ends or fake mock responses.
