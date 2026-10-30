const ParkingSlot = require('../models/ParkingSlot');
const ParkingSession = require('../models/ParkingSession');
const Booking = require('../models/Booking');
const Sensor = require('../models/Sensor');
const bookingService = require('../services/bookingService');
const notificationService = require('../services/notificationService');
const { getIO } = require('../sockets/socketManager');

// @desc    Handle IoT sensor event (Secured with sensorAuth middleware or Operator JWT)
// @route   POST /api/sensors/event
// @access  Protected (X-Sensor-Key or Admin/Gatekeeper JWT)
exports.handleSensorEvent = async (req, res, next) => {
  try {
    const { sensorId, slotNumber, eventType, batteryLevel, signalStrength } = req.body;

    if (!eventType || (!sensorId && !slotNumber)) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Must provide eventType ("entry" | "exit") and either sensorId or slotNumber'
      });
    }

    const query = sensorId ? { sensorId: sensorId.toUpperCase() } : { slotNumber: slotNumber.toUpperCase() };
    const slot = await ParkingSlot.findOne(query);

    if (!slot) {
      return res.status(404).json({
        success: false,
        errorCode: 'SLOT_NOT_FOUND',
        message: 'No slot found matching the sensor or slot number'
      });
    }

    const now = new Date();
    let io = null;
    try {
      io = getIO();
    } catch (e) {}

    // Find and update sensor record if present
    const sensorRecord = await Sensor.findOne({ slotId: slot._id });
    if (sensorRecord) {
      sensorRecord.lastEvent = now;
      sensorRecord.lastEventType = eventType;
      sensorRecord.lastHeartbeat = now;
      sensorRecord.status = 'ONLINE';
      if (batteryLevel !== undefined) sensorRecord.batteryLevel = batteryLevel;
      if (signalStrength !== undefined) sensorRecord.signalStrength = signalStrength;
      await sensorRecord.save();
    }

    if (eventType === 'entry') {
      // 1. Identify valid booking/reservation if present
      let booking = null;
      if (slot.currentBooking) {
        booking = await Booking.findById(slot.currentBooking);
      }

      // If no current booking attached directly, check for confirmed booking on this slot
      if (!booking) {
        booking = await Booking.findOne({
          slotId: slot._id,
          status: { $in: ['CONFIRMED', 'PENDING'] }
        }).sort({ createdAt: -1 });
      }

      let activeSession = null;

      if (booking) {
        // Update booking state machine: CONFIRMED -> ACTIVE
        booking.status = 'ACTIVE';
        booking.checkInTime = now;
        await booking.save();

        activeSession = await ParkingSession.create({
          bookingId: booking._id,
          slotId: slot._id,
          userId: booking.userId,
          vehicleNumber: booking.vehicleNumber,
          entryTime: now,
          expectedExitTime: booking.expectedEndTime,
          status: 'ACTIVE'
        });

        // Notify user
        await notificationService.createNotification({
          userId: booking.userId,
          title: 'Sensor: Vehicle Parked 🚗',
          message: `Sensor detected your vehicle entering bay ${slot.slotNumber}. Parking session is active.`,
          type: 'parking_started',
          metadata: { bookingId: booking.bookingId, slotNumber: slot.slotNumber },
          io
        });
      } else {
        // Drive-in entry without prior reservation
        activeSession = await ParkingSession.create({
          bookingId: null,
          slotId: slot._id,
          vehicleNumber: 'DRIVE-IN',
          entryTime: now,
          expectedExitTime: new Date(now.getTime() + 2 * 3600 * 1000), // Default 2 hours window
          status: 'ACTIVE'
        });
      }

      // 2. Update slot state: RESERVED / AVAILABLE -> OCCUPIED
      slot.status = 'occupied';
      slot.occupiedSince = now;
      await slot.save();

      // 3. Emit Real-time Socket.IO events
      if (io) {
        io.emit('sensor:entry', {
          sensorId: slot.sensorId,
          slotId: slot._id,
          slotNumber: slot.slotNumber,
          timestamp: now
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
        if (booking) {
          io.emit('parking:started', {
            bookingId: booking.bookingId,
            slotNumber: slot.slotNumber,
            entryTime: now,
            vehicleNumber: booking.vehicleNumber
          });
        }
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      }

      return res.status(200).json({
        success: true,
        message: `IoT Telemetry: Sensor ${slot.sensorId || slot.slotNumber} confirmed ENTRY. Slot is OCCUPIED.`,
        data: {
          slot,
          session: activeSession,
          booking
        }
      });
    } else if (eventType === 'exit') {
      // 1. Find active ParkingSession on this bay
      const activeSession = await ParkingSession.findOne({
        slotId: slot._id,
        status: 'ACTIVE'
      }).sort({ entryTime: -1 });

      let booking = null;
      let finalBill = 0;

      if (activeSession) {
        activeSession.exitTime = now;
        activeSession.status = 'COMPLETED';

        // Overstay penalty calculation if departed past expected exit
        let overstayMinutes = 0;
        let overstayFee = 0;
        if (now > activeSession.expectedExitTime) {
          const diffMs = now - activeSession.expectedExitTime;
          overstayMinutes = Math.ceil(diffMs / 60000);
          const extraHours = Math.ceil(overstayMinutes / 60);
          overstayFee = extraHours * 50;
        }

        activeSession.overstayDurationMinutes = overstayMinutes;
        activeSession.overstayFee = overstayFee;

        if (activeSession.bookingId) {
          booking = await Booking.findById(activeSession.bookingId);
          if (booking) {
            booking.status = 'COMPLETED';
            booking.checkOutTime = now;
            finalBill = (booking.totalAmount || 0) + overstayFee;
            if (overstayFee > 0) booking.totalAmount = finalBill;
            await booking.save();
          }
        }
        activeSession.totalBilled = finalBill;
        await activeSession.save();
      }

      // 2. Synchronize slot state: OCCUPIED -> AVAILABLE (Never available while session is active)
      slot.status = 'available';
      slot.occupiedSince = null;
      slot.reservedAt = null;
      slot.currentBooking = null;
      await slot.save();

      // 3. Emit Real-time Socket.IO broadcasts
      if (io) {
        io.emit('sensor:exit', {
          sensorId: slot.sensorId,
          slotId: slot._id,
          slotNumber: slot.slotNumber,
          timestamp: now
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
        if (booking) {
          io.emit('parking:completed', {
            bookingId: booking.bookingId,
            slotNumber: slot.slotNumber,
            exitTime: now,
            totalBilled: finalBill
          });
        }
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      }

      return res.status(200).json({
        success: true,
        message: `IoT Telemetry: Sensor ${slot.sensorId || slot.slotNumber} confirmed EXIT. Slot is now AVAILABLE.`,
        data: {
          slot,
          session: activeSession,
          booking
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_EVENT_TYPE',
        message: 'Invalid eventType. Must be "entry" or "exit"'
      });
    }
  } catch (err) {
    next(err);
  }
};

// @desc    Sensor heartbeat ping (Updates lastHeartbeat & telemetry)
// @route   POST /api/sensors/heartbeat
// @access  Protected (X-Sensor-Key)
exports.handleHeartbeat = async (req, res, next) => {
  try {
    const { sensorId, batteryLevel, signalStrength } = req.body;
    const sId = sensorId ? sensorId.toUpperCase() : req.sensor?.sensorId;

    if (!sId) {
      return res.status(400).json({
        success: false,
        errorCode: 'SENSOR_ID_REQUIRED',
        message: 'sensorId is required'
      });
    }

    const sensor = await Sensor.findOne({ sensorId: sId });
    if (!sensor) {
      return res.status(404).json({
        success: false,
        errorCode: 'SENSOR_NOT_FOUND',
        message: 'Sensor record not registered'
      });
    }

    sensor.lastHeartbeat = new Date();
    sensor.status = 'ONLINE';
    if (batteryLevel !== undefined) sensor.batteryLevel = batteryLevel;
    if (signalStrength !== undefined) sensor.signalStrength = signalStrength;
    await sensor.save();

    res.status(200).json({
      success: true,
      message: `Heartbeat acknowledged for ${sensor.sensorId}`,
      data: {
        sensorId: sensor.sensorId,
        status: sensor.status,
        lastHeartbeat: sensor.lastHeartbeat,
        batteryLevel: sensor.batteryLevel
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all registered IoT sensors & health status (Admin / Operator)
// @route   GET /api/sensors
// @access  Private (Admin / Gatekeeper)
exports.getAllSensors = async (req, res, next) => {
  try {
    const { locationId, status } = req.query;
    const query = { isActive: true };
    if (locationId) query.locationId = locationId;
    if (status) query.status = status;

    const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);

    const sensors = await Sensor.find(query)
      .populate('slotId', 'slotNumber floor zone status')
      .populate('locationId', 'name')
      .sort({ sensorId: 1 });

    // Dynamic offline detection based on heartbeat threshold
    const enrichedSensors = sensors.map((s) => {
      const isStale = s.lastHeartbeat && s.lastHeartbeat < fiveMinsAgo;
      return {
        ...s.toObject(),
        health: isStale ? 'OFFLINE' : s.status,
        isHeartbeatStale: isStale
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedSensors.length,
      data: enrichedSensors
    });
  } catch (err) {
    next(err);
  }
};
