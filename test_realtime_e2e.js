const { io } = require('socket.io-client');

const runRealTimeE2ETest = async () => {
  const SERVER_URL = 'http://localhost:5001';
  console.log('====================================================');
  console.log('PARKPULSE REAL-TIME MULTI-CLIENT SOCKET.IO TEST (E2E)');
  console.log('====================================================\n');

  // Client 1: User Browser
  const clientUser = io(SERVER_URL, { reconnection: false });
  // Client 2: Admin Simulator Browser
  const clientAdmin = io(SERVER_URL, { reconnection: false });

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => {
      connected++;
      if (connected === 2) resolve();
    };
    clientUser.on('connect', () => {
      console.log('✓ Client 1 (User Browser) connected:', clientUser.id);
      check();
    });
    clientAdmin.on('connect', () => {
      console.log('✓ Client 2 (Admin Simulator Browser) connected:', clientAdmin.id);
      check();
    });
  });

  // Test 1: Real-time synchronization
  console.log('\n--- TEST 1: Real-Time IoT Entry Simulation ---');
  const slotUpdatePromise = new Promise((resolve) => {
    clientUser.on('slot:updated', (data) => {
      console.log(`[Client 1 Event Received] slot:updated -> Slot: ${data.slotNumber}, Status: ${data.status}`);
      if (data.slotNumber === 'A-108' && data.status === 'occupied') {
        resolve(data);
      }
    });
  });

  // Admin triggers entry event
  console.log('Client 2 (Admin) emits sensor:simulate entry for slot A-108...');
  clientAdmin.emit('sensor:simulate', {
    slotNumber: 'A-108',
    eventType: 'entry'
  });

  const slotEntryResult = await Promise.race([
    slotUpdatePromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for slot:updated')), 4000))
  ]);
  console.log('✅ TEST 1 PASSED: Client 1 received instant real-time slot update to OCCUPIED!');

  // Test 2: Real-time exit simulation
  console.log('\n--- TEST 2: Real-Time IoT Exit Simulation ---');
  const slotExitPromise = new Promise((resolve) => {
    clientUser.on('slot:updated', (data) => {
      if (data.slotNumber === 'A-108' && data.status === 'available') {
        console.log(`[Client 1 Event Received] slot:updated -> Slot: ${data.slotNumber}, Status: ${data.status}`);
        resolve(data);
      }
    });
  });

  console.log('Client 2 (Admin) emits sensor:simulate exit for slot A-108...');
  clientAdmin.emit('sensor:simulate', {
    slotNumber: 'A-108',
    eventType: 'exit'
  });

  await Promise.race([
    slotExitPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for slot:updated exit')), 4000))
  ]);
  console.log('✅ TEST 2 PASSED: Client 1 received instant real-time slot update to AVAILABLE!');

  // Test 3: Stats broadcasting
  console.log('\n--- TEST 3: Real-Time Telemetry Stats Broadcast ---');
  const statsPromise = new Promise((resolve) => {
    clientUser.on('stats:updated', (stats) => {
      console.log(`[Client 1 Event Received] stats:updated -> Total: ${stats.total}, Available: ${stats.available}, Occupancy: ${stats.occupancyRate}%`);
      resolve(stats);
    });
  });

  clientUser.emit('stats:request');
  await Promise.race([
    statsPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for stats:updated')), 4000))
  ]);
  console.log('✅ TEST 3 PASSED: Client 1 received verified live facility occupancy statistics!');

  clientUser.disconnect();
  clientAdmin.disconnect();

  console.log('\n====================================================');
  console.log('🎉 ALL REAL-TIME MULTI-CLIENT WEBSOCKET TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
};

runRealTimeE2ETest().catch((err) => {
  console.error('❌ E2E TEST ERROR:', err);
  process.exit(1);
});
