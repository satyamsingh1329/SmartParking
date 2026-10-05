const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const ParkingLocation = require('../models/ParkingLocation');
const bookingService = require('../services/bookingService');

let ioInstance = null;

const initSocket = (io) => {
  ioInstance = io;

  io.on('connection', async (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // Join user specific room if userId is provided
    socket.on('user:join', (userId) => {
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.io] Socket ${socket.id} joined room user:${userId}`);
      }
    });

    // Client requests initial slots data
    socket.on('slots:request', async (filters = {}) => {
      try {
        const query = { isActive: true };
        if (filters.locationId) query.locationId = filters.locationId;
        if (filters.floor) query.floor = parseInt(filters.floor);
        if (filters.zone) query.zone = filters.zone;
        if (filters.vehicleType) query.vehicleType = filters.vehicleType;
        if (filters.type) query.type = filters.type;
        if (filters.status) query.status = filters.status;

        const slots = await ParkingSlot.find(query).sort({ floor: 1, zone: 1, slotNumber: 1 });
        socket.emit('slots:init', slots);
      } catch (err) {
        console.error('[Socket slots:request Error]', err.message);
      }
    });

    // Client requests initial stats
    socket.on('stats:request', async (locationId) => {
      try {
        const query = { isActive: true };
        if (locationId) query.locationId = locationId;

        const total = await ParkingSlot.countDocuments(query);
        const available = await ParkingSlot.countDocuments({ ...query, status: 'available' });
        const occupied = await ParkingSlot.countDocuments({ ...query, status: 'occupied' });
        const reserved = await ParkingSlot.countDocuments({ ...query, status: 'reserved' });
        const occupancyRate = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;

        let congestionLevel = 'LOW';
        if (occupancyRate > 80) congestionLevel = 'HIGH';
        else if (occupancyRate > 50) congestionLevel = 'MODERATE';

        socket.emit('stats:init', {
          total,
          available,
          occupied,
          reserved,
          occupancyRate,
          congestionLevel,
          locationId
        });
      } catch (err) {
        console.error('[Socket stats:request Error]', err.message);
      }
    });

    // Real-Time IoT Sensor Event Simulation via Socket (Section 36, 37, 66)
    socket.on('sensor:simulate', async (data) => {
      try {
        const { slotId, slotNumber, eventType } = data; // eventType: 'entry' | 'exit'
        const query = slotId ? { _id: slotId } : { slotNumber };
        const slot = await ParkingSlot.findOne(query);

        if (!slot) {
          socket.emit('sensor:error', { message: 'Slot not found for sensor simulation' });
          return;
        }

        if (eventType === 'entry') {
          // Vehicle entered -> mark slot occupied
          slot.status = 'occupied';
          slot.occupiedSince = new Date();
          await slot.save();

          io.emit('sensor:entry', {
            sensorId: slot.sensorId,
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            timestamp: new Date()
          });

          io.emit('slot:occupied', {
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            status: 'occupied'
          });

          io.emit('slot:updated', {
            _id: slot._id,
            slotNumber: slot.slotNumber,
            floor: slot.floor,
            zone: slot.zone,
            status: 'occupied',
            occupiedSince: slot.occupiedSince
          });
        } else if (eventType === 'exit') {
          // Vehicle exited -> mark slot available
          slot.status = 'available';
          slot.occupiedSince = null;
          slot.reservedAt = null;
          slot.currentBooking = null;
          await slot.save();

          io.emit('sensor:exit', {
            sensorId: slot.sensorId,
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            timestamp: new Date()
          });

          io.emit('slot:released', {
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            status: 'available'
          });

          io.emit('slot:updated', {
            _id: slot._id,
            slotNumber: slot.slotNumber,
            floor: slot.floor,
            zone: slot.zone,
            status: 'available'
          });
        }

        // Broadcast updated statistics
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      } catch (err) {
        console.error('[Socket sensor:simulate Error]', err);
        socket.emit('sensor:error', { message: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

const getIO = () => {
  if (!ioInstance) {
    throw new Error('Socket.io has not been initialized');
  }
  return ioInstance;
};

module.exports = { initSocket, getIO };
