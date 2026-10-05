require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const Vehicle = require('./models/Vehicle');
const ParkingLocation = require('./models/ParkingLocation');
const ParkingSlot = require('./models/ParkingSlot');
const PricingRule = require('./models/PricingRule');
const Booking = require('./models/Booking');
const Payment = require('./models/Payment');
const ParkingSession = require('./models/ParkingSession');
const Notification = require('./models/Notification');
const RewardTransaction = require('./models/RewardTransaction');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkpulse';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing collections
    await User.deleteMany();
    await Vehicle.deleteMany();
    await ParkingLocation.deleteMany();
    await ParkingSlot.deleteMany();
    await PricingRule.deleteMany();
    await Booking.deleteMany();
    await Payment.deleteMany();
    await ParkingSession.deleteMany();
    await Notification.deleteMany();
    await RewardTransaction.deleteMany();
    console.log('[Seed] Cleared existing database records');

    // 1. Create Demo Users
    const admin = await User.create({
      name: 'Sarah Connor (Admin)',
      email: 'admin@parkpulse.com',
      phone: '+91 9876543210',
      password: 'admin123',
      role: 'ADMIN',
      rewardPoints: 1200
    });

    const gatekeeper = await User.create({
      name: 'John Miller (Gatekeeper)',
      email: 'gatekeeper@parkpulse.com',
      phone: '+91 9876543211',
      password: 'gate123',
      role: 'GATEKEEPER',
      rewardPoints: 200
    });

    const user = await User.create({
      name: 'Alex Rivera',
      email: 'user@parkpulse.com',
      phone: '+91 9876543212',
      password: 'user123',
      role: 'USER',
      rewardPoints: 420
    });

    console.log('[Seed] Created demo users (Admin, Gatekeeper, User)');

    // 2. Create User Vehicles
    const carVehicle = await Vehicle.create({
      userId: user._id,
      vehicleNumber: 'DL01AB1234',
      vehicleType: 'car',
      model: 'Hyundai Creta',
      isPrimary: true
    });

    const evVehicle = await Vehicle.create({
      userId: user._id,
      vehicleNumber: 'HR26EV5678',
      vehicleType: 'ev',
      model: 'Tata Nexon EV',
      isPrimary: false
    });

    // 3. Create 5 Locations
    const locationsData = [
      {
        name: 'University Campus Central',
        code: 'CAMPUS',
        address: 'Academic Block 4, North Campus Ave',
        city: 'New Delhi',
        category: 'campus',
        totalFloors: 3,
        zones: ['A', 'B', 'C', 'D'],
        operatingHours: '24/7',
        amenities: ['EV Superchargers', '24/7 CCTV', 'Covered Parking', 'Accessible Ramp', 'RFID Gate'],
        image: '/assets/parking-campus.jpg',
        baseRates: { car: 30, bike: 15, ev: 45, vip: 60, accessible: 25 }
      },
      {
        name: 'Central City Mall & Multiplex',
        code: 'MALL',
        address: 'Sector 18 Commercial Hub',
        city: 'Noida',
        category: 'mall',
        totalFloors: 3,
        zones: ['A', 'B', 'C', 'D'],
        operatingHours: '09:00 AM - 12:00 AM',
        amenities: ['EV Charging', 'Valet Parking', 'Underground CCTV', 'Elevator Access', 'Car Wash'],
        image: '/assets/parking-mall.jpg',
        baseRates: { car: 50, bike: 25, ev: 65, vip: 100, accessible: 35 }
      },
      {
        name: 'Silicon Corporate Tech Park',
        code: 'TECHPARK',
        address: 'Cyber City Phase 2',
        city: 'Gurugram',
        category: 'techpark',
        totalFloors: 3,
        zones: ['A', 'B', 'C', 'D'],
        operatingHours: '24/7',
        amenities: ['High Speed EV Hub', 'Automated Number Plate Recognition', 'Reserved Corporate Bays', 'Security Patrol'],
        image: '/assets/parking-techpark.jpg',
        baseRates: { car: 40, bike: 20, ev: 50, vip: 80, accessible: 30 }
      },
      {
        name: 'Heritage Hostel & Sports Complex',
        code: 'HOSTEL',
        address: 'Hostel Block Road, West Gate',
        city: 'New Delhi',
        category: 'hostel',
        totalFloors: 2,
        zones: ['A', 'B'],
        operatingHours: '24/7',
        amenities: ['Two-Wheeler Dedicated Bays', 'Security Guard', 'Covered Sheds'],
        image: '/assets/parking-hostel.jpg',
        baseRates: { car: 25, bike: 10, ev: 35, vip: 50, accessible: 20 }
      },
      {
        name: 'Metro City Multi-Specialty Hospital',
        code: 'HOSPITAL',
        address: 'Emergency Wing, Ring Road',
        city: 'New Delhi',
        category: 'hospital',
        totalFloors: 3,
        zones: ['A', 'B', 'C', 'D'],
        operatingHours: '24/7',
        amenities: ['Emergency Priority Bays', 'Disabled Accessible', 'Free Ambulance Corridor', '24/7 Valet'],
        image: '/assets/parking-hospital.jpg',
        baseRates: { car: 35, bike: 15, ev: 45, vip: 60, accessible: 15 }
      }
    ];

    const createdLocations = await ParkingLocation.insertMany(locationsData);
    console.log(`[Seed] Created ${createdLocations.length} parking locations`);

    // 4. Create Pricing Rules for each location
    for (const loc of createdLocations) {
      await PricingRule.create({
        locationId: loc._id,
        baseRates: loc.baseRates,
        durationTiers: [
          { maxHours: 2, flatRate: loc.baseRates.car * 2 },
          { maxHours: 5, hourlyRate: loc.baseRates.car },
          { maxHours: 24, hourlyRate: Math.round(loc.baseRates.car * 0.85) }
        ],
        surgeThreshold: 80,
        surgeMultiplier: 1.25,
        evSurcharge: 30,
        convenienceFee: 10,
        taxPercent: 18
      });
    }

    // 5. Generate 100+ slots across multiple floors and zones for University Campus & Central Mall
    const primaryLocation = createdLocations[0]; // University Campus
    const allSlots = [];

    // Floor 1: Standard Cars, EV Charging, Accessible Parking
    // Floor 2: Two-Wheelers, VIP, Standard Cars
    // Floor 3: Corporate/Reserved, EV, Premium Standard

    // Floor 1 (40 slots across Zones A & B)
    for (let i = 1; i <= 20; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      let type = 'standard';
      let vehicleType = 'car';
      let price = primaryLocation.baseRates.car;

      if (i <= 4) {
        type = 'ev';
        vehicleType = 'ev';
        price = primaryLocation.baseRates.ev;
      } else if (i === 5 || i === 6) {
        type = 'accessible';
        vehicleType = 'car';
        price = primaryLocation.baseRates.accessible;
      }

      // Realistic mix: some occupied, some reserved, majority available
      let status = 'available';
      if (i === 2 || i === 8 || i === 14) status = 'occupied';
      if (i === 4 || i === 12) status = 'reserved';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: type === 'ev' ? `EV-1${numStr}` : (type === 'accessible' ? `PWD-1${numStr}` : `A-1${numStr}`),
        floor: 1,
        zone: 'A',
        type,
        vehicleType,
        status,
        sensorId: `US-F1-A${numStr}`,
        distanceFromEntrance: 15 + i * 2,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 45 * 60 * 1000) : null,
        reservedAt: status === 'reserved' ? new Date(Date.now() - 5 * 60 * 1000) : null
      });
    }

    for (let i = 1; i <= 20; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      let type = 'standard';
      let vehicleType = 'car';
      let price = primaryLocation.baseRates.car;

      if (i <= 4) {
        type = 'ev';
        vehicleType = 'ev';
        price = primaryLocation.baseRates.ev;
      }

      let status = 'available';
      if (i === 3 || i === 9 || i === 15) status = 'occupied';
      if (i === 7) status = 'reserved';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: type === 'ev' ? `EV-B${numStr}` : `B-1${numStr}`,
        floor: 1,
        zone: 'B',
        type,
        vehicleType,
        status,
        sensorId: `US-F1-B${numStr}`,
        distanceFromEntrance: 35 + i * 2,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 70 * 60 * 1000) : null,
        reservedAt: status === 'reserved' ? new Date(Date.now() - 8 * 60 * 1000) : null
      });
    }

    // Floor 2 (40 slots across Zones C & D)
    for (let i = 1; i <= 20; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      let type = 'standard';
      let vehicleType = 'car';
      let price = primaryLocation.baseRates.car;

      if (i <= 6) {
        type = 'standard';
        vehicleType = 'bike';
        price = primaryLocation.baseRates.bike;
      } else if (i === 7 || i === 8) {
        type = 'vip';
        vehicleType = 'car';
        price = primaryLocation.baseRates.vip;
      }

      let status = 'available';
      if (i === 5 || i === 11 || i === 17) status = 'occupied';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: vehicleType === 'bike' ? `BK-2${numStr}` : (type === 'vip' ? `VIP-2${numStr}` : `C-2${numStr}`),
        floor: 2,
        zone: 'C',
        type,
        vehicleType,
        status,
        sensorId: `US-F2-C${numStr}`,
        distanceFromEntrance: 50 + i * 2,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 30 * 60 * 1000) : null
      });
    }

    for (let i = 1; i <= 20; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      let type = 'standard';
      let vehicleType = 'car';
      let price = primaryLocation.baseRates.car;

      if (i <= 6) {
        type = 'standard';
        vehicleType = 'bike';
        price = primaryLocation.baseRates.bike;
      } else if (i === 19 || i === 20) {
        type = 'vip';
        vehicleType = 'car';
        price = primaryLocation.baseRates.vip;
      }

      let status = 'available';
      if (i === 4 || i === 12) status = 'occupied';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: vehicleType === 'bike' ? `BK-D${numStr}` : (type === 'vip' ? `VIP-D${numStr}` : `D-2${numStr}`),
        floor: 2,
        zone: 'D',
        type,
        vehicleType,
        status,
        sensorId: `US-F2-D${numStr}`,
        distanceFromEntrance: 60 + i * 2,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 95 * 60 * 1000) : null
      });
    }

    // Floor 3 (30 slots: Premium, EV, VIP)
    for (let i = 1; i <= 30; i++) {
      const numStr = i < 10 ? `0${i}` : `${i}`;
      let type = 'standard';
      let vehicleType = 'car';
      let price = primaryLocation.baseRates.car;
      const zone = i <= 15 ? 'A' : 'B';

      if (i <= 5) {
        type = 'vip';
        price = primaryLocation.baseRates.vip;
      } else if (i >= 6 && i <= 12) {
        type = 'ev';
        vehicleType = 'ev';
        price = primaryLocation.baseRates.ev;
      }

      let status = 'available';
      if (i === 2 || i === 8 || i === 22) status = 'occupied';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: type === 'vip' ? `VIP-3${numStr}` : (type === 'ev' ? `EV-3${numStr}` : `F3-${numStr}`),
        floor: 3,
        zone,
        type,
        vehicleType,
        status,
        sensorId: `US-F3-${zone}${numStr}`,
        distanceFromEntrance: 75 + i * 2,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 110 * 60 * 1000) : null
      });
    }

    // Add slots for other locations too so each has working floor maps
    for (let lIdx = 1; lIdx < createdLocations.length; lIdx++) {
      const loc = createdLocations[lIdx];
      for (let f = 1; f <= loc.totalFloors; f++) {
        for (let i = 1; i <= 10; i++) {
          const numStr = i < 10 ? `0${i}` : `${i}`;
          allSlots.push({
            locationId: loc._id,
            slotNumber: `${loc.code}-F${f}-${numStr}`,
            floor: f,
            zone: i <= 5 ? 'A' : 'B',
            type: i === 1 ? 'ev' : (i === 2 ? 'accessible' : 'standard'),
            vehicleType: i === 1 ? 'ev' : (i <= 3 ? 'bike' : 'car'),
            status: i % 4 === 0 ? 'occupied' : 'available',
            sensorId: `US-${loc.code}-F${f}-${numStr}`,
            distanceFromEntrance: 20 + i * 4,
            pricePerHour: loc.baseRates.car
          });
        }
      }
    }

    const createdSlots = await ParkingSlot.insertMany(allSlots);
    console.log(`[Seed] Created ${createdSlots.length} parking slots across all facilities!`);

    // Update location capacities
    for (const loc of createdLocations) {
      const count = await ParkingSlot.countDocuments({ locationId: loc._id });
      loc.totalCapacity = count;
      await loc.save();
    }

    // 6. Create Sample Bookings for User & Past Analytics
    const testSlot = createdSlots[0];
    const sampleBooking = await Booking.create({
      bookingId: 'PP-2026-DEMO01',
      userId: user._id,
      slotId: testSlot._id,
      locationId: primaryLocation._id,
      vehicleId: carVehicle._id,
      vehicleNumber: carVehicle.vehicleNumber,
      vehicleType: carVehicle.vehicleType,
      startTime: new Date(Date.now() - 3600 * 1000),
      expectedEndTime: new Date(Date.now() + 2 * 3600 * 1000),
      durationHours: 3,
      baseAmount: 90,
      surgeMultiplier: 1.0,
      surgeAmount: 0,
      evSurcharge: 0,
      convenienceFee: 10,
      discountAmount: 0,
      tax: 18,
      totalAmount: 118,
      status: 'ACTIVE',
      paymentStatus: 'paid',
      checkInTime: new Date(Date.now() - 3600 * 1000),
      qrCodeData: 'data:image/png;base64,sample'
    });

    testSlot.status = 'occupied';
    testSlot.currentBooking = sampleBooking._id;
    testSlot.occupiedSince = new Date(Date.now() - 3600 * 1000);
    await testSlot.save();

    await ParkingSession.create({
      bookingId: sampleBooking._id,
      slotId: testSlot._id,
      userId: user._id,
      vehicleNumber: user.phone,
      entryTime: new Date(Date.now() - 3600 * 1000),
      expectedExitTime: sampleBooking.expectedEndTime,
      status: 'ACTIVE'
    });

    await Payment.create({
      paymentId: 'PAY-DEMO9999',
      bookingId: sampleBooking._id,
      userId: user._id,
      amount: 118,
      status: 'completed',
      method: 'mock_card'
    });

    // Sample Notification
    await Notification.create({
      userId: user._id,
      title: 'Welcome to ParkPulse! 🚀',
      message: 'Your account is active with 50 bonus reward points. Enjoy frictionless parking!',
      type: 'reward_earned'
    });

    console.log('[Seed] Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedData();
