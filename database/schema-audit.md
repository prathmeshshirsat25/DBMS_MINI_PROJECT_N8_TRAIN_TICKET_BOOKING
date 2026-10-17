# Supabase PostgreSQL Database Schema Audit

## Overview

The database is an existing PostgreSQL instance hosted on Supabase (`aws-0-ap-south-1.pooler.supabase.com:5432/postgres`).

---

## 1. Table Inventory

| Table Name | Record Count | Module Owner | Primary Key | Description |
|---|---|---|---|---|
| `stations` | 2,012 | G1 | `station_id` | Master railway stations across India |
| `trains` | 1,018 | G1 | `train_id` | Train master (number, name, type, coaches) |
| `routes` | 10,055 | G1 | `route_id` | Station stops, arrival/departure, distance km, day offset |
| `schedules` | 10,160 | G1 | `schedule_id` | Daily operational schedule and status |
| `train_classes` | 2,655 | G1 | `class_id` | Supported classes per train (SL, 3A, 2A, 1A, CC, 2S) |
| `class_fares` | 0 | G1 | `fare_id` | Base fare per km (empty in live DB; demo policy applied) |
| `users` | 4+ | G3 | `user_id` | Registered user credentials and profile data |
| `seats` | 1,620 | G5 | `seat_id` | Coach, seat number, class, status, block expiry |
| `bookings` | 15+ | G4 | `booking_id` | Booking headers, PNR, total amount, status |
| `passengers` | 29+ | G4 | `passenger_id` | Passenger roster per booking with seat links |
| `payments` | 7+ | G2 | `payment_id` | Transaction records, methods, amount, status |
| `tickets` | 5+ | G2 | `ticket_id` | Issued tickets with ticket number and valid status |
| `cancellations` | 3+ | G2 | `cancellation_id` | Cancellation receipts, reasons, refund amounts |
| `refunds` | 3+ | G2 | `refund_id` | Refund tracking records linked to payments |

---

## 2. PostgreSQL ENUM Types

- `booking_status`: `PENDING`, `CONFIRMED`, `CANCELLED`
- `class_type`: `SL`, `3A`, `2A`, `1A`, `CC`, `2S`
- `gender_type`: `MALE`, `FEMALE`, `OTHER`
- `payment_method`: `UPI`, `CARD`, `NETBANKING`, `WALLET`
- `payment_status`: `PENDING`, `SUCCESS`, `FAILED`, `REFUNDED`
- `refund_status`: `PENDING`, `PROCESSED`, `FAILED`
- `schedule_status`: `SCHEDULED`, `CANCELLED`, `COMPLETED`
- `seat_status`: `AVAILABLE`, `BOOKED`, `BLOCKED`
- `ticket_status`: `VALID`, `CANCELLED`
- `user_role`: `USER`, `ADMIN`

---

## 3. Relational Foreign Keys

```text
bookings.user_id                   -> users.user_id
bookings.schedule_id               -> schedules.schedule_id
bookings.source_station_id         -> stations.station_id
bookings.destination_station_id    -> stations.station_id

passengers.booking_id              -> bookings.booking_id
passengers.seat_id                 -> seats.seat_id

payments.booking_id                -> bookings.booking_id
tickets.booking_id                 -> bookings.booking_id
cancellations.booking_id           -> bookings.booking_id

refunds.booking_id                 -> bookings.booking_id
refunds.payment_id                 -> payments.payment_id

routes.train_id                    -> trains.train_id
routes.station_id                  -> stations.station_id
schedules.train_id                 -> trains.train_id
seats.train_id                     -> trains.train_id
train_classes.train_id             -> trains.train_id
class_fares.train_id               -> trains.train_id
```

---

## 4. Preservation & Integrity Note

All queries in the unified application strictly respect existing schema constraints without modifying or deleting legacy tables or columns.
Parameterized queries (`$1`, `$2`, ...) are used throughout to guarantee SQL injection safety.
