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
const Sensor = require('./models/Sensor');
const EVChargingStation = require('./models/EVChargingStation');
const ParkingPass = require('./models/ParkingPass');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkpulse';
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected to MongoDB');

    // Clear existing collections
    await Promise.all([
      User.deleteMany(),
      Vehicle.deleteMany(),
      ParkingLocation.deleteMany(),
      ParkingSlot.deleteMany(),
      PricingRule.deleteMany(),
      Booking.deleteMany(),
      Payment.deleteMany(),
      ParkingSession.deleteMany(),
      Notification.deleteMany(),
      RewardTransaction.deleteMany(),
      Sensor.deleteMany(),
      EVChargingStation.deleteMany(),
      ParkingPass.deleteMany()
    ]);
    console.log('[Seed] Cleared existing database records');

    // 1. Create Demo Users (Role safety enforced)
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
      registrationNumber: 'DL01AB1234',
      vehicleType: 'car',
      make: 'Hyundai',
      model: 'Creta SX',
      color: 'Polar White',
      isPrimary: true
    });

    const evVehicle = await Vehicle.create({
      userId: user._id,
      vehicleNumber: 'HR26EV5678',
      registrationNumber: 'HR26EV5678',
      vehicleType: 'ev',
      make: 'Tata',
      model: 'Nexon EV Max',
      color: 'Teal Blue',
      isEV: true,
      isPrimary: false
    });

    // 3. Create Multi-Facility Parking Network (Phase 10)
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
        totalFloors: 4,
        zones: ['A', 'B', 'C'],
        operatingHours: '09:00 AM – 11:30 PM',
        amenities: ['Valet Service', 'EV Fast Charging', 'Car Wash Bay', 'Underground Surveillance'],
        image: '/assets/parking-mall.jpg',
        baseRates: { car: 40, bike: 20, ev: 55, vip: 80, accessible: 30 }
      },
      {
        name: 'Cyber Heights Tech Park',
        code: 'TECHPARK',
        address: 'Phase 2 Electronic City',
        city: 'Bengaluru',
        category: 'techpark',
        totalFloors: 5,
        zones: ['A', 'B', 'C', 'D'],
        operatingHours: '24/7',
        amenities: ['Automated Barrier', 'LPR Camera', 'Fast Charging', 'Shuttle Service'],
        image: '/assets/parking-corporate.jpg',
        baseRates: { car: 50, bike: 25, ev: 65, vip: 100, accessible: 35 }
      },
      {
        name: 'Apollo Metro Health City',
        code: 'HOSPITAL',
        address: 'Health City Ring Road',
        city: 'New Delhi',
        category: 'hospital',
        totalFloors: 2,
        zones: ['A', 'B'],
        operatingHours: '24/7 Priority Emergency Access',
        amenities: ['24/7 Emergency Drop', 'Ambulance Priority', 'Wheelchair Support', 'Direct Lift Access'],
        image: '/assets/parking-hospital.jpg',
        baseRates: { car: 25, bike: 10, ev: 40, vip: 50, accessible: 20 }
      },
      {
        name: 'Grand Central Railway Terminal',
        code: 'RAILWAY',
        address: 'Platform 1 North Entry Plaza',
        city: 'New Delhi',
        category: 'metro',
        totalFloors: 2,
        zones: ['A', 'B', 'C'],
        operatingHours: '24/7',
        amenities: ['Long-Term Stay', 'CCTV 360', 'Luggage Assistance', 'Fastag / ANPR Gate'],
        image: '/assets/parking-transit.jpg',
        baseRates: { car: 35, bike: 15, ev: 50, vip: 70, accessible: 25 }
      }
    ];

    const createdLocations = await ParkingLocation.insertMany(locationsData);
    console.log(`[Seed] Created ${createdLocations.length} parking facilities!`);
    const primaryLocation = createdLocations[0];

    // 4. Create Dynamic Pricing Rules (Phase 4)
    await PricingRule.create({
      locationId: primaryLocation._id,
      name: 'Campus Standard Dynamic Tariff',
      basePricePerHour: 30,
      durationTiers: [
        { minHours: 0, maxHours: 2, ratePerHour: 30 },
        { minHours: 2, maxHours: 5, ratePerHour: 25 },
        { minHours: 5, maxHours: 24, ratePerHour: 20 }
      ],
      surgeThreshold: 0.8,
      surgeMultiplier: 1.25,
      weekendMultiplier: 1.15,
      vehicleRates: {
        car: 1.0,
        bike: 0.5,
        ev: 1.3,
        truck: 2.0
      },
      evSurcharge: 15,
      isActive: true
    });

    // 5. Create Parking Slots with Indoor Navigation Metadata (Phase 18 & 19)
    const allSlots = [];

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

      let status = 'available';
      if (i === 1 || i === 4 || i === 8 || i === 12) status = 'occupied';
      if (i === 2) status = 'reserved';

      allSlots.push({
        locationId: primaryLocation._id,
        slotNumber: type === 'ev' ? `EV-1${numStr}` : type === 'accessible' ? `PWD-1${numStr}` : `A-1${numStr}`,
        floor: 1,
        zone: 'A',
        type,
        vehicleType,
        status,
        sensorId: `US-F1-A${numStr}`,
        distanceFromEntrance: 15 + i * 2,
        walkingDistance: 20 + i * 2,
        drivingDistance: 40 + i * 3,
        lane: `Lane A-${Math.ceil(i / 5)}`,
        navigationDirections: `Drive past Gate 1, turn left into Zone A, bay on Lane A-${Math.ceil(i / 5)}.`,
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
        walkingDistance: 35 + i * 2,
        drivingDistance: 70 + i * 3,
        lane: `Lane B-${Math.ceil(i / 5)}`,
        navigationDirections: `Enter Gate 1, proceed straight to Zone B, bay located on Lane B-${Math.ceil(i / 5)}.`,
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
        slotNumber: vehicleType === 'bike' ? `BK-2${numStr}` : type === 'vip' ? `VIP-2${numStr}` : `C-2${numStr}`,
        floor: 2,
        zone: 'C',
        type,
        vehicleType,
        status,
        sensorId: `US-F2-C${numStr}`,
        distanceFromEntrance: 50 + i * 2,
        walkingDistance: 55 + i * 2,
        drivingDistance: 110 + i * 3,
        lane: 'Ramp-2 to Zone C',
        navigationDirections: 'Ascend ramp to Floor 2, enter Zone C lane.',
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
        slotNumber: vehicleType === 'bike' ? `BK-D${numStr}` : type === 'vip' ? `VIP-D${numStr}` : `D-2${numStr}`,
        floor: 2,
        zone: 'D',
        type,
        vehicleType,
        status,
        sensorId: `US-F2-D${numStr}`,
        distanceFromEntrance: 60 + i * 2,
        walkingDistance: 65 + i * 2,
        drivingDistance: 130 + i * 3,
        lane: 'Ramp-2 to Zone D',
        navigationDirections: 'Ascend ramp to Floor 2, bear right into Zone D.',
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
        slotNumber: type === 'vip' ? `VIP-3${numStr}` : type === 'ev' ? `EV-3${numStr}` : `F3-${numStr}`,
        floor: 3,
        zone,
        type,
        vehicleType,
        status,
        sensorId: `US-F3-${zone}${numStr}`,
        distanceFromEntrance: 75 + i * 2,
        walkingDistance: 80 + i * 2,
        drivingDistance: 180 + i * 3,
        lane: `Floor 3 Lane ${zone}`,
        navigationDirections: `Take Express Ramp to Floor 3, follow signage for Zone ${zone}.`,
        pricePerHour: price,
        occupiedSince: status === 'occupied' ? new Date(Date.now() - 110 * 60 * 1000) : null
      });
    }

    const createdSlots = await ParkingSlot.insertMany(allSlots);
    console.log(`[Seed] Created ${createdSlots.length} parking slots across primary facility!`);

    // 6. Create IoT Sensor Records (Phase 2 & 21)
    const sensorsToInsert = createdSlots.map((slot, index) => {
      const isStale = index === 10 || index === 25; // Create a couple offline/warning sensors for UI realism
      return {
        sensorId: slot.sensorId,
        apiKey: `KEY-${slot.sensorId}`,
        slotId: slot._id,
        locationId: slot.locationId,
        status: isStale ? 'OFFLINE' : 'ONLINE',
        batteryLevel: Math.floor(75 + Math.random() * 25),
        signalStrength: Math.floor(-50 - Math.random() * 30),
        lastHeartbeat: isStale ? new Date(Date.now() - 15 * 60 * 1000) : new Date(),
        lastEvent: new Date(),
        lastEventType: slot.status === 'occupied' ? 'entry' : 'exit',
        firmwareVersion: '1.2.4-ESP32'
      };
    });
    await Sensor.insertMany(sensorsToInsert);
    console.log(`[Seed] Provisioned ${sensorsToInsert.length} IoT sensors with hashed API keys!`);

    // 7. Create EV Charging Stations (Phase 15)
    const evSlots = createdSlots.filter((s) => s.type === 'ev');
    const evStations = evSlots.slice(0, 8).map((slot, idx) => ({
      stationId: `EVCS-DEL-${101 + idx}`,
      locationId: primaryLocation._id,
      slotId: slot._id,
      connectorType: idx % 2 === 0 ? 'CCS2' : 'Type2',
      powerKW: idx % 2 === 0 ? 50 : 22,
      status: slot.status === 'occupied' ? 'IN_USE' : 'AVAILABLE',
      currentVehicleNumber: slot.status === 'occupied' ? 'HR26EV5678' : null,
      currentUser: slot.status === 'occupied' ? user._id : null,
      startTime: slot.status === 'occupied' ? new Date(Date.now() - 35 * 60 * 1000) : null,
      ratePerKWh: 15
    }));
    await EVChargingStation.insertMany(evStations);
    console.log(`[Seed] Registered ${evStations.length} EV charging stations!`);

    // 8. Create Parking Passes (Phase 16)
    await ParkingPass.create({
      passNumber: 'PASS-MONTHLY-A89F',
      userId: user._id,
      passType: 'MONTHLY',
      vehicleNumber: 'DL01AB1234',
      vehicleType: 'car',
      startDate: new Date(Date.now() - 5 * 24 * 3600 * 1000),
      endDate: new Date(Date.now() + 25 * 24 * 3600 * 1000),
      allowedLocations: [primaryLocation._id],
      allowedZones: ['A', 'B', 'C', 'D'],
      pricePaid: 2800,
      paymentId: 'PAY-PASS-MONTHLY-89F',
      status: 'ACTIVE',
      usageCount: 8,
      lastUsedAt: new Date(Date.now() - 24 * 3600 * 1000)
    });

    // 9. Generate Historical Bookings, Payments & Sessions (For Real MongoDB Aggregation Analytics)
    const sampleBookings = [];
    const samplePayments = [];
    const sampleSessions = [];

    // Create 30 historical sessions spread across the past 7 days
    const vehicleNumbers = ['DL01AB1234', 'HR26EV5678', 'MH12CD4321', 'KA04EF9876', 'UP16GH2468'];

    for (let day = 6; day >= 0; day--) {
      const recordsForDay = 4 + Math.floor(Math.random() * 4); // 4-7 bookings per day
      for (let r = 0; r < recordsForDay; r++) {
        const slot = createdSlots[(day * 5 + r) % createdSlots.length];
        const vNum = vehicleNumbers[r % vehicleNumbers.length];
        const entryHour = 8 + Math.floor(Math.random() * 12); // Between 8 AM and 8 PM
        const duration = 1 + Math.floor(Math.random() * 4);

        const entryDate = new Date();
        entryDate.setDate(entryDate.getDate() - day);
        entryDate.setHours(entryHour, Math.floor(Math.random() * 60), 0, 0);

        const exitDate = new Date(entryDate.getTime() + duration * 3600 * 1000);
        const amount = duration * slot.pricePerHour + 10;
        const bId = `PP-HIST-${day}-${r}-${Math.floor(100 + Math.random() * 900)}`;

        const bDoc = {
          bookingId: bId,
          userId: user._id,
          slotId: slot._id,
          locationId: primaryLocation._id,
          vehicleNumber: vNum,
          vehicleType: slot.vehicleType,
          startTime: entryDate,
          expectedEndTime: exitDate,
          durationHours: duration,
          baseAmount: duration * slot.pricePerHour,
          convenienceFee: 10,
          totalAmount: amount,
          status: 'COMPLETED',
          paymentStatus: 'paid',
          checkInTime: entryDate,
          checkOutTime: exitDate,
          createdAt: entryDate
        };
        sampleBookings.push(bDoc);

        samplePayments.push({
          paymentId: `PAY-${bId}`,
          amount,
          userId: user._id,
          status: 'completed',
          method: 'mock_card',
          isMockPayment: true,
          createdAt: entryDate
        });

        sampleSessions.push({
          slotId: slot._id,
          userId: user._id,
          vehicleNumber: vNum,
          entryTime: entryDate,
          exitTime: exitDate,
          expectedExitTime: exitDate,
          totalBilled: amount,
          status: 'COMPLETED',
          createdAt: entryDate
        });
      }
    }

    const insertedBookings = await Booking.insertMany(sampleBookings);
    // Link bookingId to payments and sessions
    samplePayments.forEach((p, idx) => (p.bookingId = insertedBookings[idx]._id));
    sampleSessions.forEach((s, idx) => (s.bookingId = insertedBookings[idx]._id));
    await Payment.insertMany(samplePayments);
    await ParkingSession.insertMany(sampleSessions);

    // Active Demo Session
    const activeSlot = createdSlots[0];
    const liveBooking = await Booking.create({
      bookingId: 'PP-2026-LIVE01',
      userId: user._id,
      slotId: activeSlot._id,
      locationId: primaryLocation._id,
      vehicleId: carVehicle._id,
      vehicleNumber: carVehicle.vehicleNumber,
      vehicleType: carVehicle.vehicleType,
      startTime: new Date(Date.now() - 3600 * 1000),
      expectedEndTime: new Date(Date.now() + 2 * 3600 * 1000),
      durationHours: 3,
      baseAmount: 90,
      surgeMultiplier: 1.0,
      convenienceFee: 10,
      totalAmount: 100,
      status: 'ACTIVE',
      paymentStatus: 'paid',
      checkInTime: new Date(Date.now() - 3600 * 1000),
      qrCodeData: 'data:image/png;base64,sample'
    });

    activeSlot.status = 'occupied';
    activeSlot.currentBooking = liveBooking._id;
    activeSlot.occupiedSince = new Date(Date.now() - 3600 * 1000);
    await activeSlot.save();

    await ParkingSession.create({
      bookingId: liveBooking._id,
      slotId: activeSlot._id,
      userId: user._id,
      vehicleNumber: carVehicle.vehicleNumber,
      entryTime: new Date(Date.now() - 3600 * 1000),
      expectedExitTime: liveBooking.expectedEndTime,
      status: 'ACTIVE'
    });

    // Sample Notification
    await Notification.create({
      userId: user._id,
      title: 'Welcome to ParkPulse! 🚀',
      message: 'Your account is active with 420 reward points. Enjoy real-time frictionless smart parking!',
      type: 'reward_earned'
    });

    console.log('[Seed] Seeding completed with rich historical data for MongoDB aggregation analytics!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]', error);
    process.exit(1);
  }
};

seedData();
