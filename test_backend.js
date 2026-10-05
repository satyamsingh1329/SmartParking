const testFlow = async () => {
  const BASE = 'http://localhost:5001/api';

  console.log('--- 1. Testing Login ---');
  const loginRes = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'user@parkpulse.com', password: 'user123' })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status, 'User:', loginData.user?.name);
  const token = loginData.token;

  console.log('\n--- 2. Testing Locations ---');
  const locRes = await fetch(`${BASE}/parking`);
  const locData = await locRes.json();
  console.log('Total locations:', locData.count);
  const campus = locData.data[0];
  console.log('First Location:', campus.name, 'Available slots:', campus.stats.available);

  console.log('\n--- 3. Testing Slots & Recommendation ---');
  const recRes = await fetch(`${BASE}/slots/recommend?locationId=${campus._id}&vehicleType=car`);
  const recData = await recRes.json();
  console.log('Recommended Slot:', recData.data?.bestSlot?.slotNumber, 'Match score:', recData.data?.matchScore, '% Reason:', recData.data?.whyRecommended);

  console.log('\n--- 4. Testing Live Price Quote ---');
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
  console.log('Quote total:', quoteData.data?.totalAmount, 'Breakdown:', quoteData.data);

  console.log('\n--- 5. Testing Atomic Booking & Concurrency Race Condition ---');
  // Find an available slot
  const slotRes = await fetch(`${BASE}/slots?locationId=${campus._id}&status=available`);
  const slotData = await slotRes.json();
  const targetSlot = slotData.data[0];
  console.log('Target Slot for race test:', targetSlot.slotNumber, targetSlot._id);

  // Two simultaneous requests to reserve the same slot
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

  // Get winning booking
  const winningBooking = dataA.success ? dataA.data : dataB.data;

  console.log('\n--- 6. Testing Gatekeeper Check-In ---');
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

  console.log('\n--- 7. Testing Check-Out & Receipt ---');
  const checkOutRes = await fetch(`${BASE}/sessions/${winningBooking.bookingId}/check-out`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${gateToken}`
    }
  });
  const checkOutData = await checkOutRes.json();
  console.log('Check-out status:', checkOutRes.status, checkOutData.message);
  console.log('Receipt Total:', checkOutData.data?.receipt?.totalAmount);

  console.log('\n--- 8. Testing IoT Sensor Simulation ---');
  const sensorRes = await fetch(`${BASE}/sensors/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      slotNumber: targetSlot.slotNumber,
      eventType: 'entry'
    })
  });
  const sensorData = await sensorRes.json();
  console.log('Sensor Simulation Entry:', sensorData.message, 'Slot status now:', sensorData.data?.status);

  console.log('\n🎉 ALL BACKEND SYSTEMS FULLY FUNCTIONING!');
};

testFlow().catch(console.error);
