// Comprehensive End-to-End Test Suite for Railway Booking System

const http = require('http');
const app = require('../src/app');
const { query } = require('../src/config/db');

let server;
let baseUrl;

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

const testResults = [];

function assert(description, condition, details = '') {
  if (condition) {
    testResults.push({ description, passed: true });
    console.log(`  ✓ PASS: ${description}`);
  } else {
    testResults.push({ description, passed: false, details });
    console.error(`  ✗ FAIL: ${description} - ${details}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('   RAILWAY BOOKING SYSTEM — INTEGRATION TEST SUITE  ');
  console.log('====================================================\n');

  // Start HTTP server on dynamic port
  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      console.log(`Test server running at ${baseUrl}\n`);
      resolve();
    });
  });

  const timestamp = Date.now();
  const testEmail = `testuser_${timestamp}@railbook.test`;
  const testPassword = 'Password123!';
  let authToken = null;
  let testUserId = null;
  let createdBookingId = null;
  let createdPnr = null;
  let sampleTrain = null;

  try {
    // ----------------------------------------------------
    // 1. Health check endpoint
    // ----------------------------------------------------
    console.log('[Phase 1: System Health]');
    const health = await makeRequest('GET', '/api/health');
    assert('Health check returns 200 and healthy status', health.status === 200 && health.data.success === true);

    // ----------------------------------------------------
    // 2. Authentication: Registration
    // ----------------------------------------------------
    console.log('\n[Phase 2: Authentication Module]');
    const regRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Integration Test User',
      full_name: 'Integration Test User',
      email: testEmail,
      phone: `98${String(timestamp).slice(-8)}`,
      password: testPassword,
      confirm_password: testPassword,
      agreed_to_terms: true,
    });
    assert('Register new user', regRes.status === 201 && regRes.data.success === true, JSON.stringify(regRes.data));
    authToken = regRes.data?.data?.token;
    testUserId = regRes.data?.data?.user?.user_id || regRes.data?.data?.user?.id;

    // ----------------------------------------------------
    // 3. Duplicate email registration rejected
    // ----------------------------------------------------
    const dupRes = await makeRequest('POST', '/api/auth/register', {
      name: 'Duplicate User',
      email: testEmail,
      phone: '9800000000',
      password: testPassword,
      confirm_password: testPassword,
      agreed_to_terms: true,
    });
    assert('Duplicate email registration rejected', dupRes.status === 409 || dupRes.status === 400);

    // ----------------------------------------------------
    // 4. Correct login
    // ----------------------------------------------------
    const loginRes = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    assert('Correct login succeeds', loginRes.status === 200 && loginRes.data.success === true);

    // ----------------------------------------------------
    // 5. Incorrect password login rejected
    // ----------------------------------------------------
    const badLogin = await makeRequest('POST', '/api/auth/login', {
      email: testEmail,
      password: 'WrongPassword123!',
    });
    assert('Incorrect password rejected', badLogin.status === 401 || badLogin.status === 400);

    // ----------------------------------------------------
    // 6. Protected /auth/me profile
    // ----------------------------------------------------
    const meRes = await makeRequest('GET', '/api/auth/me', null, authToken);
    assert('Protected /auth/me returns authenticated user', meRes.status === 200 && meRes.data.data.email === testEmail);

    // ----------------------------------------------------
    // 7. Train & Station Search
    // ----------------------------------------------------
    console.log('\n[Phase 3: Train Search & Schedule Module]');
    const stationRes = await makeRequest('GET', '/api/stations?q=Mumbai');
    assert('Station search returns matching stations', stationRes.status === 200 && Array.isArray(stationRes.data.data) && stationRes.data.data.length > 0);

    // Same source and destination validation
    const sameSearch = await makeRequest('GET', '/api/trains/search?from=BCT&to=BCT&date=2026-10-20');
    assert('Same source/destination returns validation error', sameSearch.status === 400);

    // Get a real schedule from DB to search against
    const realSched = await query(`
      SELECT s.journey_date::text as jdate, t.train_id, t.train_number, t.train_name,
             r1.station_id as src_id, s1.station_code as src_code,
             r2.station_id as dst_id, s2.station_code as dst_code
      FROM schedules s
      JOIN trains t ON s.train_id = t.train_id
      JOIN routes r1 ON r1.train_id = t.train_id
      JOIN stations s1 ON s1.station_id = r1.station_id
      JOIN routes r2 ON r2.train_id = t.train_id
      JOIN stations s2 ON s2.station_id = r2.station_id
      WHERE s.status = 'SCHEDULED' AND r1.stop_number < r2.stop_number
      LIMIT 1
    `);

    let searchDate = '2026-10-20';
    let srcCode = 'BCT';
    let dstCode = 'ADI';
    let scheduleId = 1;
    let trainId = 1;

    if (realSched.rows.length > 0) {
      searchDate = realSched.rows[0].jdate;
      srcCode = realSched.rows[0].src_code;
      dstCode = realSched.rows[0].dst_code;
      trainId = realSched.rows[0].train_id;

      // Find schedule_id
      const sc = await query('SELECT schedule_id FROM schedules WHERE train_id=$1 AND journey_date=$2 LIMIT 1', [trainId, searchDate]);
      if (sc.rows.length > 0) scheduleId = sc.rows[0].schedule_id;
    }

    const trainSearch = await makeRequest('GET', `/api/trains/search?from=${srcCode}&to=${dstCode}&date=${searchDate}`);
    assert('Train search returns operational trains', trainSearch.status === 200 && Array.isArray(trainSearch.data.data));
    if (trainSearch.data.data?.length > 0) {
      sampleTrain = trainSearch.data.data[0];
      scheduleId = sampleTrain.schedule_id;
      trainId = sampleTrain.train_id;
    }

    // Train details route
    const detailsRes = await makeRequest('GET', `/api/trains/${trainId}`);
    assert('Train details endpoint returns train master info', detailsRes.status === 200 && detailsRes.data.success === true);

    // Train routes endpoint
    const routesRes = await makeRequest('GET', `/api/trains/${trainId}/routes`);
    assert('Train routes endpoint returns ordered stops', routesRes.status === 200 && Array.isArray(routesRes.data.data));

    // ----------------------------------------------------
    // 8. Seat Selection
    // ----------------------------------------------------
    console.log('\n[Phase 4: Seat Management Module]');
    const seatsRes = await makeRequest('GET', `/api/seats/${trainId}`);
    assert('Seats list returns seat layout', seatsRes.status === 200 && seatsRes.data.success === true);

    let sampleSeatId = null;
    const allSeats = Array.isArray(seatsRes.data.data)
      ? seatsRes.data.data
      : Object.values(seatsRes.data.data || {}).flat();

    const availableSeats = allSeats.filter((s) => s.status === 'AVAILABLE');
    if (availableSeats.length > 0) {
      sampleSeatId = availableSeats[0].seat_id;
    }

    // ----------------------------------------------------
    // 9. Booking Creation (PENDING)
    // ----------------------------------------------------
    console.log('\n[Phase 5: Booking Management Module]');
    const srcStation = await query('SELECT station_id FROM stations WHERE station_code = $1', [srcCode]);
    const dstStation = await query('SELECT station_id FROM stations WHERE station_code = $1', [dstCode]);
    const srcId = srcStation.rows[0]?.station_id || 1;
    const dstId = dstStation.rows[0]?.station_id || 2;

    const bookRes = await makeRequest(
      'POST',
      '/api/bookings',
      {
        schedule_id: scheduleId,
        source_station_id: srcId,
        destination_station_id: dstId,
        total_amount: 520,
        passengers: [
          {
            name: 'Priya Sharma',
            age: 26,
            gender: 'FEMALE',
            seat_preference: 'Window',
            seat_id: sampleSeatId,
          },
        ],
      },
      authToken
    );

    assert('Create booking with transaction', bookRes.status === 201 && bookRes.data.success === true, JSON.stringify(bookRes.data));
    createdBookingId = bookRes.data?.data?.booking_id;
    createdPnr = bookRes.data?.data?.pnr;

    assert('Booking status initially PENDING', bookRes.data?.data?.status === 'PENDING');
    assert('Booking has unique PNR', typeof createdPnr === 'string' && createdPnr.length > 5);

    // ----------------------------------------------------
    // 10. My Bookings shows created booking
    // ----------------------------------------------------
    const myBookings = await makeRequest('GET', '/api/bookings/my', null, authToken);
    assert('My Bookings endpoint returns user bookings', myBookings.status === 200 && myBookings.data.data.some((b) => b.booking_id === createdBookingId));

    // ----------------------------------------------------
    // 11. Payment Processing (MOCK SUCCESS)
    // ----------------------------------------------------
    console.log('\n[Phase 6: Payment & Ticket Module]');
    const payRes = await makeRequest(
      'POST',
      '/api/payments',
      {
        booking_id: createdBookingId,
        payment_method: 'UPI',
        simulate_status: 'SUCCESS',
      },
      authToken
    );

    assert('Payment processed and booking confirmed', payRes.status === 200 && payRes.data.success === true && payRes.data.data?.booking_status === 'CONFIRMED', JSON.stringify(payRes.data));

    // ----------------------------------------------------
    // 12. Idempotency: Duplicate Payment Rejected
    // ----------------------------------------------------
    const dupPayRes = await makeRequest(
      'POST',
      '/api/payments',
      {
        booking_id: createdBookingId,
        payment_method: 'UPI',
        simulate_status: 'SUCCESS',
      },
      authToken
    );
    assert('Duplicate payment request handled gracefully / rejected', dupPayRes.status === 400 || dupPayRes.data.success === false);

    // ----------------------------------------------------
    // 13. Ticket Generation & Retrieval
    // ----------------------------------------------------
    const ticketRes = await makeRequest('GET', `/api/tickets/booking/${createdBookingId}`, null, authToken);
    assert('Valid ticket retrieved for confirmed booking', ticketRes.status === 200 && ticketRes.data.success === true && ticketRes.data.data?.pnr === createdPnr);

    // ----------------------------------------------------
    // 14. Cancellation & Seat Release
    // ----------------------------------------------------
    console.log('\n[Phase 7: Cancellation & Refund Module]');
    const cancelRes = await makeRequest(
      'POST',
      '/api/cancellations',
      {
        booking_id: createdBookingId,
        reason: 'Integration test automated cancellation',
      },
      authToken
    );

    assert('Booking cancellation processed', cancelRes.status === 200 && cancelRes.data.success === true);
    assert('Cancellation updates booking status to CANCELLED', cancelRes.data?.data?.booking_status === 'CANCELLED');

    // Verify refund record created
    const refundRes = await makeRequest('GET', `/api/refunds/booking/${createdBookingId}`, null, authToken);
    const refundAmountVal = Number(refundRes.data?.data?.refund_amount || refundRes.data?.refund?.refund_amount || refundRes.data?.refunds?.[0]?.refund_amount || 0);
    assert('Refund record created with calculated refund amount', refundRes.status === 200 && refundRes.data.success === true && refundAmountVal > 0, `Amount: ${refundAmountVal}`);

    // ----------------------------------------------------
    // 15. Security: Unauthorized Access Rejected
    // ----------------------------------------------------
    console.log('\n[Phase 8: Security & Authorization]');
    const unauthRes = await makeRequest('GET', '/api/bookings/my');
    assert('Unauthorized request without token rejected with 401', unauthRes.status === 401);

    const badTokenRes = await makeRequest('GET', '/api/bookings/my', null, 'invalid_token_xyz');
    assert('Request with invalid token rejected with 401', badTokenRes.status === 401);

  } catch (err) {
    console.error('Test execution exception:', err);
  } finally {
    if (server) {
      server.close();
    }
  }

  // Summary
  console.log('\n====================================================');
  console.log('                 TEST SUMMARY REPORT                ');
  console.log('====================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = total - passed;
  console.log(`Total Scenarios Tested: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Pass Rate: ${Math.round((passed / total) * 100)}%`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
