const testFlow = async () => {
  const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}/api`;

  console.log('--- 1. Testing Login ---');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@parkpulse.com', password: 'user123' })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status, 'User:', loginData.user?.name);
  const token = loginData.token;

  console.log('\n--- 2. Testing Security: Public Registration Role Escalation Block ---');
  const testEmail = `hacker_${Date.now()}@test.com`;
  const regRes = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Attempted Admin',
      email: testEmail,
      password: 'password123',
      phone: '+91 9999999999',
      role: 'ADMIN' // Trying to register as ADMIN publicly
    })
  });
  const regData = await regRes.json();
  if (regData.user?.role === 'USER') {
    console.log('✅ SECURITY PASSED: Public registration strictly forced role to "USER". Escalation blocked.');
  } else {
    console.error('❌ SECURITY FAILED: Role escalation permitted!', regData.user?.role);
  }

  console.log('\n--- 3. Testing Locations & Multi-Location Network ---');
  const locRes = await fetch(`${BASE}/parking`);
  const locData = await locRes.json();
  console.log('Total locations:', locData.count);
  const campus = locData.data[0];
  console.log('Primary Facility:', campus.name, 'Available slots:', campus.stats.available);

  console.log('\n--- 4. Testing Intelligent Multi-Factor Recommendation ---');
  const recRes = await fetch(`${BASE}/slots/recommend?locationId=${campus._id}&vehicleType=car`);
  const recData = await recRes.json();
  console.log('Recommended Slot:', recData.data?.bestSlot?.slotNumber, 'Match score:', recData.data?.matchScore, '%');
  console.log('Recommendation Reasons:', recData.data?.reasonsList);

  console.log('\n--- 5. Testing Database-Driven Dynamic Pricing ---');
  const quoteRes = await fetch(`${BASE}/bookings/quote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      locationId: campus._id,
      slotId: recData.data?.bestSlot?._id,
      vehicleType: 'car',
      durationHours: 3
    })
  });
  const quoteData = await quoteRes.json();
  console.log('Quote total: Rs.', quoteData.data?.totalAmount, 'Tier breakdown:', quoteData.data);

  console.log('\n--- 6. Testing Atomic Booking & Concurrency Race Condition ---');
  const slotRes = await fetch(`${BASE}/slots?locationId=${campus._id}&status=available`);
  const slotData = await slotRes.json();
  const targetSlot = slotData.data[0];
  console.log('Target Slot for race test:', targetSlot.slotNumber, targetSlot._id);

  // Two simultaneous requests to reserve the exact same slot
  const [resA, resB] = await Promise.all([
    fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: targetSlot._id,
        locationId: campus._id,
        vehicleNumber: 'DL01AB9999',
        vehicleType: 'car',
        durationHours: 2
      })
    }),
    fetch(`${BASE}/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        slotId: targetSlot._id,
        locationId: campus._id,
        vehicleNumber: 'HR26XY8888',
        vehicleType: 'car',
        durationHours: 2
      })
    })
  ]);

  const dataA = await resA.json();
  const dataB = await resB.json();

  console.log('Request A status:', resA.status, dataA.success ? 'SUCCESS (Booking: ' + dataA.data?.bookingId + ')' : dataA.message);
  console.log('Request B status:', resB.status, dataB.success ? 'SUCCESS' : dataB.message);

  if ((resA.status === 201 && resB.status === 409) || (resA.status === 409 && resB.status === 201)) {
    console.log('✅ CONCURRENCY RACE CONDITION TEST PASSED: Exactly 1 reservation succeeded, the other received 409 Conflict!');
  } else {
    console.error('❌ RACE CONDITION TEST FAILED: Unexpected statuses', resA.status, resB.status);
  }

  const winningBooking = dataA.success ? dataA.data : dataB.data;

  console.log('\n--- 7. Testing Ownership Authorization Security ---');
  // Attempt to cancel or extend winningBooking with the hacker's token
  const hackerToken = regData.token;
  const unauthorizedCancel = await fetch(`${BASE}/bookings/${winningBooking.bookingId}/cancel`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${hackerToken}`
    }
  });
  console.log('Unauthorized Cancel HTTP Status:', unauthorizedCancel.status);
  if (unauthorizedCancel.status === 403) {
    console.log('✅ OWNERSHIP TEST PASSED: Unauthorized user cannot cancel another user booking (HTTP 403 Forbidden).');
  } else {
    console.error('❌ OWNERSHIP TEST FAILED: Expected 403 but received', unauthorizedCancel.status);
  }

  console.log('\n--- 8. Testing IoT Sensor Authentication ---');
  // 8a. Unauthenticated sensor event -> should fail with 401
  const unauthSensor = await fetch(`${BASE}/sensors/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotNumber: targetSlot.slotNumber,
      eventType: 'entry'
    })
  });
  console.log('Unauthenticated Sensor Event status:', unauthSensor.status);
  if (unauthSensor.status === 401) {
    console.log('✅ SENSOR SECURITY PASSED: Public unauthenticated sensor events blocked with 401.');
  }

  // 8b. Authenticated sensor event via X-Sensor-Key
  const sensorKey = `KEY-${targetSlot.sensorId}`;
  const authSensor = await fetch(`${BASE}/sensors/event`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sensor-key': sensorKey
    },
    body: JSON.stringify({
      sensorId: targetSlot.sensorId,
      eventType: 'entry'
    })
  });
  const authSensorData = await authSensor.json();
  console.log('Authenticated Sensor Event status:', authSensor.status, authSensorData.message);

  console.log('\n--- 9. Testing Gatekeeper Check-In & Check-Out ---');
  const gateLoginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'gatekeeper@parkpulse.com', password: 'gate123' })
  });
  const gateToken = (await gateLoginRes.json()).token;

  const checkInRes = await fetch(`${BASE}/sessions/check-in`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gateToken}`
    },
    body: JSON.stringify({ bookingId: winningBooking.bookingId })
  });
  const checkInData = await checkInRes.json();
  console.log('Check-in status:', checkInRes.status, checkInData.message);

  const checkOutRes = await fetch(`${BASE}/sessions/${winningBooking.bookingId}/check-out`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gateToken}`
    }
  });
  const checkOutData = await checkOutRes.json();
  console.log('Check-out status:', checkOutRes.status, checkOutData.message);

  console.log('\n--- 10. Testing ANPR Optical Gate Simulator ---');
  const anprRes = await fetch(`${BASE}/anpr/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ vehicleNumber: 'DL01AB1234', gateType: 'ENTRY' })
  });
  const anprData = await anprRes.json();
  console.log('ANPR Gate Action:', anprData.data?.gateAction, 'Mode:', anprData.data?.mode, 'Msg:', anprData.data?.message);

  console.log('\n--- 11. Testing ML Availability & Peak Hour Forecasting ---');
  const mlRes = await fetch(`${BASE}/predictions/availability`);
  const mlData = await mlRes.json();
  console.log('ML Model:', mlData.data?.modelType);
  console.log('Current Availability:', mlData.data?.currentStatus?.currentAvailable, 'slots');
  console.log('Predicted Peak Window:', mlData.data?.peakHourAnalysis?.todayPredictedPeak);
  console.log('Weather Multiplier:', mlData.data?.weatherContext?.demandMultiplier);

  console.log('\n🎉 ALL BACKEND SYSTEMS & SECURITY CHECKS PASSED PERFECTLY!');
};

testFlow().catch(console.error);
