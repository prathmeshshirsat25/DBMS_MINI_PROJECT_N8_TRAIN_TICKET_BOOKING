'use strict';

const nodemailer = require('nodemailer');
const { query } = require('../config/db.js');

/**
 * Creates and configures the nodemailer SMTP transporter.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT) || 587;
  const secure = process.env.SMTP_SECURE === 'true';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

/**
 * Format a Date object to human readable string: e.g. "Sunday, 18 Oct 2026"
 */
function formatDate(d) {
  if (!d) return 'N/A';
  const dateObj = new Date(d);
  return dateObj.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format time string: e.g. "04:50:00" -> "04:50 AM"
 */
function formatTime(t) {
  if (!t) return '--:--';
  const parts = String(t).split(':');
  if (parts.length < 2) return t;
  let h = parseInt(parts[0], 10);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

/**
 * Sends a full Electronic Reservation Slip (ERS) confirmation email for a confirmed booking.
 * Non-blocking: will catch and log errors without crashing callers.
 *
 * @param {number|string} bookingId
 * @returns {Promise<{success: boolean, messageId?: string, error?: string}>}
 */
async function sendTicketConfirmationEmail(bookingId) {
  try {
    const transporter = createTransporter();
    if (!transporter) {
      console.warn('[emailService] SMTP credentials not fully configured. Skipping email.');
      return { success: false, error: 'SMTP credentials missing' };
    }

    // 1. Fetch booking, user, ticket, train, schedule, station, and payment details
    const bookingRes = await query(
      `SELECT
         b.booking_id, b.pnr, b.total_amount, b.booking_date, b.status AS booking_status,
         u.name AS user_name, u.email AS user_email,
         t.ticket_number, t.ticket_status, t.issued_at,
         tr.train_id, tr.train_number, tr.train_name, tr.train_type,
         sch.journey_date,
         b.source_station_id, b.destination_station_id,
         src.station_name AS src_name, src.station_code AS src_code, src.city AS src_city,
         dst.station_name AS dst_name, dst.station_code AS dst_code, dst.city AS dst_city,
         pay.payment_method, pay.transaction_id, pay.payment_date, pay.payment_status
       FROM bookings b
       JOIN users u ON u.user_id = b.user_id
       LEFT JOIN tickets t ON t.booking_id = b.booking_id
       LEFT JOIN schedules sch ON sch.schedule_id = b.schedule_id
       LEFT JOIN trains tr ON tr.train_id = sch.train_id
       LEFT JOIN stations src ON src.station_id = b.source_station_id
       LEFT JOIN stations dst ON dst.station_id = b.destination_station_id
       LEFT JOIN payments pay ON pay.booking_id = b.booking_id AND pay.payment_status = 'SUCCESS'
       WHERE b.booking_id = $1
       ORDER BY pay.payment_date DESC
       LIMIT 1`,
      [bookingId]
    );

    if (bookingRes.rows.length === 0) {
      console.warn(`[emailService] Booking #${bookingId} not found for sending email.`);
      return { success: false, error: 'Booking not found' };
    }

    const b = bookingRes.rows[0];

    // 2. Fetch passengers with seat allocations
    const passRes = await query(
      `SELECT
         p.passenger_id, p.name, p.age, p.gender, p.seat_preference,
         s.coach_number, s.seat_number, s.class_type
       FROM passengers p
       LEFT JOIN seats s ON s.seat_id = p.seat_id
       WHERE p.booking_id = $1
       ORDER BY p.passenger_id`,
      [bookingId]
    );
    const passengers = passRes.rows;

    // 3. Fetch departure and arrival times from routes (if available)
    let depTime = null;
    let arrTime = null;
    if (b.train_id && b.source_station_id && b.destination_station_id) {
      const routesRes = await query(
        `SELECT station_id, departure_time, arrival_time
           FROM routes
          WHERE train_id = $1 AND station_id IN ($2, $3)`,
        [b.train_id, b.source_station_id, b.destination_station_id]
      );
      routesRes.rows.forEach((r) => {
        if (r.station_id === b.source_station_id) depTime = r.departure_time;
        if (r.station_id === b.destination_station_id) arrTime = r.arrival_time;
      });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const ticketUrl = `${frontendUrl}/ticket/${b.booking_id}`;
    const formattedJourneyDate = formatDate(b.journey_date);
    const formattedDepTime = formatTime(depTime);
    const formattedArrTime = formatTime(arrTime);
    const primaryClass = passengers[0]?.class_type || '2A';

    // 4. Construct passenger rows for HTML
    const passengerRowsHtml = passengers
      .map(
        (p, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px; font-size: 13px; color: #475569;">${idx + 1}</td>
          <td style="padding: 10px 12px; font-size: 14px; font-weight: 600; color: #1e293b;">
            ${p.name || 'Passenger'}
            <div style="font-size: 12px; font-weight: normal; color: #64748b;">${p.age || '-'} yrs, ${p.gender || '-'}</div>
          </td>
          <td style="padding: 10px 12px; font-size: 14px; font-weight: 700; color: #087E8B;">
            ${p.coach_number ? `${p.coach_number} / ${p.seat_number}` : 'Unassigned'}
          </td>
          <td style="padding: 10px 12px; font-size: 13px; color: #475569;">${p.seat_preference || 'No Preference'}</td>
          <td style="padding: 10px 12px; font-size: 13px;">
            <span style="display: inline-block; padding: 3px 8px; border-radius: 9999px; background-color: #dcfce7; color: #15803d; font-weight: 700; font-size: 11px;">
              CONFIRMED (CNF)
            </span>
          </td>
        </tr>`
      )
      .join('');

    // 5. Construct full HTML Electronic Reservation Slip (ERS)
    const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Ticket Confirmation - RailBook</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f1f5f9; padding: 24px 12px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- HEADER -->
              <tr>
                <td style="background: linear-gradient(135deg, #087E8B 0%, #0c98a6 100%); padding: 24px 28px; text-align: left;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td>
                        <span style="font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">RailBook</span>
                        <div style="font-size: 12px; color: #ccfbf1; margin-top: 2px;">Electronic Reservation Slip (ERS)</div>
                      </td>
                      <td align="right">
                        <span style="background-color: #ffffff; color: #087E8B; padding: 6px 14px; border-radius: 20px; font-weight: 700; font-size: 12px; letter-spacing: 0.5px; display: inline-block;">
                          ✓ CONFIRMED
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- GREETING -->
              <tr>
                <td style="padding: 24px 28px 12px;">
                  <h2 style="margin: 0 0 6px; font-size: 18px; color: #0f172a;">Dear ${b.user_name || 'Passenger'},</h2>
                  <p style="margin: 0; font-size: 14px; color: #475569; line-height: 1.5;">
                    Your railway ticket has been successfully booked and confirmed. Please carry this Electronic Reservation Slip (ERS) along with a valid original photo identity card during your journey.
                  </p>
                </td>
              </tr>

              <!-- PNR & TICKET HIGHLIGHT CARD -->
              <tr>
                <td style="padding: 12px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
                    <tr>
                      <td width="50%">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">PNR NUMBER</span>
                        <div style="font-size: 20px; font-weight: 800; color: #087E8B; font-family: monospace; margin-top: 2px;">${b.pnr}</div>
                      </td>
                      <td width="50%" align="right">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;">TICKET NUMBER</span>
                        <div style="font-size: 16px; font-weight: 700; color: #1e293b; font-family: monospace; margin-top: 2px;">${b.ticket_number || 'TKT-' + b.pnr.slice(-6)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- JOURNEY DETAILS -->
              <tr>
                <td style="padding: 12px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                    <tr style="background-color: #f1f5f9;">
                      <td colspan="3" style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0;">
                        <span style="font-weight: 700; font-size: 15px; color: #0f172a;">${b.train_number} — ${b.train_name}</span>
                        <span style="font-size: 12px; color: #64748b; margin-left: 8px;">(${b.train_type || 'Superfast Express'})</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 16px; width: 45%; vertical-align: top;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">ORIGIN / DEPARTURE</div>
                        <div style="font-size: 16px; font-weight: 800; color: #087E8B; margin-top: 4px;">${b.src_code}</div>
                        <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${b.src_name}</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Departure: <strong>${formattedDepTime}</strong></div>
                        <div style="font-size: 12px; color: #64748b;">${formattedJourneyDate}</div>
                      </td>
                      <td style="padding: 16px; width: 10%; text-align: center; vertical-align: middle; color: #94a3b8; font-size: 20px;">
                        ➔
                      </td>
                      <td style="padding: 16px; width: 45%; vertical-align: top; text-align: right;">
                        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">DESTINATION / ARRIVAL</div>
                        <div style="font-size: 16px; font-weight: 800; color: #087E8B; margin-top: 4px;">${b.dst_code}</div>
                        <div style="font-size: 13px; font-weight: 600; color: #1e293b;">${b.dst_name}</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Arrival: <strong>${formattedArrTime}</strong></div>
                        <div style="font-size: 12px; color: #64748b;">Class: <strong>${primaryClass}</strong></div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- PASSENGERS TABLE -->
              <tr>
                <td style="padding: 12px 28px;">
                  <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Passenger & Seat Details</div>
                  <table width="100%" cellpadding="0" cellspacing="0" style="border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; border-collapse: collapse;">
                    <thead>
                      <tr style="background-color: #f8fafc; border-bottom: 1px solid #e2e8f0; text-align: left;">
                        <th style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b;">#</th>
                        <th style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b;">Passenger Name</th>
                        <th style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b;">Coach / Seat</th>
                        <th style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b;">Berth Pref</th>
                        <th style="padding: 8px 12px; font-size: 11px; font-weight: 700; color: #64748b;">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${passengerRowsHtml}
                    </tbody>
                  </table>
                </td>
              </tr>

              <!-- FARE & PAYMENT RECEIPT -->
              <tr>
                <td style="padding: 12px 28px;">
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px;">
                    <tr>
                      <td>
                        <span style="font-size: 12px; color: #64748b;">Payment Method: <strong>${b.payment_method || 'Online'}</strong></span><br>
                        <span style="font-size: 12px; color: #64748b;">Transaction ID: <code style="color: #334155;">${b.transaction_id || 'N/A'}</code></span>
                      </td>
                      <td align="right">
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">TOTAL AMOUNT PAID</span>
                        <div style="font-size: 20px; font-weight: 800; color: #16a34a;">₹${Number(b.total_amount).toFixed(2)}</div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA BUTTON -->
              <tr>
                <td style="padding: 16px 28px; text-align: center;">
                  <a href="${ticketUrl}" target="_blank" style="display: inline-block; background-color: #087E8B; color: #ffffff; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 14px; text-decoration: none; box-shadow: 0 2px 6px rgba(8,126,139,0.3);">
                    View / Print Official Ticket Online
                  </a>
                </td>
              </tr>

              <!-- IMPORTANT INSTRUCTIONS -->
              <tr>
                <td style="padding: 12px 28px 24px; font-size: 12px; color: #64748b; line-height: 1.5; border-top: 1px solid #e2e8f0;">
                  <div style="font-weight: 700; color: #475569; margin-bottom: 4px;">Important Instructions:</div>
                  <ul style="margin: 0; padding-left: 18px;">
                    <li>One passenger must present an original photo ID (Aadhaar / Voter ID / Passport / Driving License / PAN) during journey.</li>
                    <li>Please arrive at the departure station at least 20 minutes before departure time.</li>
                    <li>Cancellations are subject to the standard railway refund rules as outlined in your portal profile.</li>
                  </ul>
                </td>
              </tr>

              <!-- FOOTER -->
              <tr>
                <td style="background-color: #0f172a; padding: 18px 28px; text-align: center; color: #94a3b8; font-size: 12px;">
                  RailBook Unified Railway Booking System &bull; College DBMS Project<br>
                  <span style="font-size: 11px; color: #64748b;">Automated confirmation email. Please do not reply directly to this email.</span>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>`;

    // 6. Plain text version
    const text = [
      '=====================================================',
      '       RAILBOOK — ELECTRONIC RESERVATION SLIP (ERS)  ',
      '=====================================================',
      `Dear ${b.user_name || 'Passenger'},`,
      'Your railway ticket booking is CONFIRMED.\n',
      `PNR Number:       ${b.pnr}`,
      `Ticket Number:    ${b.ticket_number || 'TKT-' + b.pnr.slice(-6)}`,
      `Train:            ${b.train_number} - ${b.train_name} (${b.train_type || 'Superfast'})`,
      `Journey Date:     ${formattedJourneyDate}`,
      `Origin:           ${b.src_name} (${b.src_code}) - Departs: ${formattedDepTime}`,
      `Destination:      ${b.dst_name} (${b.dst_code}) - Arrives: ${formattedArrTime}`,
      `Total Fare Paid:  ₹${Number(b.total_amount).toFixed(2)} (${b.payment_method || 'Online'})`,
      `Transaction ID:   ${b.transaction_id || 'N/A'}\n`,
      'PASSENGERS & SEATS:',
      ...passengers.map(
        (p, i) =>
          `  ${i + 1}. ${p.name} (${p.age || '-'} yrs, ${p.gender || '-'}) — Coach: ${p.coach_number || 'N/A'}, Seat: ${p.seat_number || 'N/A'} [CONFIRMED]`
      ),
      '\nView or print your full official ticket online:',
      ticketUrl,
      '\nHave a safe journey!',
      'RailBook Railway Booking System',
    ].join('\n');

    const fromAddress = process.env.EMAIL_FROM || process.env.SMTP_USER || 'railwayticketbookingsystem00@gmail.com';

    const mailOptions = {
      from: `"RailBook Support" <${fromAddress}>`,
      to: b.user_email,
      subject: `Booking Confirmed: PNR ${b.pnr} - ${b.train_name} (${b.src_code} → ${b.dst_code})`,
      text,
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✓ [emailService] Ticket confirmation email sent to ${b.user_email} (MsgID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('✗ [emailService] Failed to send ticket confirmation email:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  sendTicketConfirmationEmail,
};
