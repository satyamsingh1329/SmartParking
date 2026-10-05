require('dotenv').config();
const mongoose = require('mongoose');
const { io } = require('socket.io-client');
const ParkingSlot = require('./models/ParkingSlot');
const Booking = require('./models/Booking');
const User = require('./models/User');

const testAutoRelease = async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkpulse');
  console.log('--- TESTING SERVER 15-MINUTE AUTO-RELEASE BACKGROUND INTERVAL ---');

  // Socket client to verify broadcast from server
  const client = io('http://localhost:5001', { reconnection: false });
  await new Promise(r => client.on('connect', r));

  const expiredEventPromise = new Promise(resolve => {
    client.on('slot:expired', (data) => {
      console.log('✓ Received real-time socket event "slot:expired":', data);
      resolve(data);
    });
  });

  // Find an available slot
  const slot = await ParkingSlot.findOne({ status: 'available' });
  const user = await User.findOne({ email: 'user@parkpulse.com' });

  // Simulate a reservation made 16 minutes ago
  const sixteenMinsAgo = new Date(Date.now() - 16 * 60 * 1000);
  const booking = await Booking.create({
    bookingId: 'PP-2026-EXPIRE-TEST',
    userId: user._id,
    slotId: slot._id,
    locationId: slot.locationId,
    vehicleNumber: 'DL01TEST99',
    vehicleType: 'car',
    startTime: sixteenMinsAgo,
    expectedEndTime: new Date(Date.now() + 2 * 3600 * 1000),
    durationHours: 2,
    baseAmount: 60,
    totalAmount: 70,
    status: 'CONFIRMED'
  });

  slot.status = 'reserved';
  slot.currentBooking = booking._id;
  slot.reservedAt = sixteenMinsAgo;
  await slot.save();

  console.log(`Created stale reservation: Slot ${slot.slotNumber}, reservedAt = ${sixteenMinsAgo.toISOString()}`);
  console.log('Waiting for server background interval (runs every 30s) to auto-release...');

  // Wait for the server interval to release the slot
  const expiredEvent = await Promise.race([
    expiredEventPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: server auto-release interval did not release within 35 seconds')), 35000))
  ]);

  const updatedSlot = await ParkingSlot.findById(slot._id);
  const updatedBooking = await Booking.findById(booking._id);

  console.log(`Updated Slot Status: ${updatedSlot.status} (expected: available)`);
  console.log(`Updated Booking Status: ${updatedBooking.status} (expected: EXPIRED)`);

  if (updatedSlot.status === 'available' && updatedBooking.status === 'EXPIRED') {
    console.log('✅ 15-MINUTE AUTO RELEASE BACKGROUND JOB PASSED PERFECTLY!');
  } else {
    console.error('❌ AUTO RELEASE FAILED');
    process.exit(1);
  }

  // Cleanup
  await Booking.deleteOne({ _id: booking._id });
  client.disconnect();
  await mongoose.disconnect();
  process.exit(0);
};

testAutoRelease().catch((err) => {
  console.error(err);
  process.exit(1);
});
