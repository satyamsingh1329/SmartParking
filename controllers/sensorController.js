const ParkingSlot = require('../models/ParkingSlot');
const bookingService = require('../services/bookingService');
const { getIO } = require('../sockets/socketManager');

// @desc    Handle IoT sensor event (Simulated or HTTP webhook)
// @route   POST /api/sensors/event
// @access  Public / Protected by API key or Admin
exports.handleSensorEvent = async (req, res, next) => {
  try {
    const { sensorId, slotNumber, eventType } = req.body;

    if (!eventType || (!sensorId && !slotNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Must provide eventType ("entry" | "exit") and either sensorId or slotNumber'
      });
    }

    const query = sensorId ? { sensorId } : { slotNumber: slotNumber.toUpperCase() };
    const slot = await ParkingSlot.findOne(query);

    if (!slot) {
      return res.status(404).json({
        success: false,
        message: 'No slot found matching the sensor or slot number'
      });
    }

    const now = new Date();
    let io = null;
    try {
      io = getIO();
    } catch (e) {}

    if (eventType === 'entry') {
      slot.status = 'occupied';
      slot.occupiedSince = now;
      await slot.save();

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
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      }

      return res.status(200).json({
        success: true,
        message: `IoT Simulation: Sensor ${slot.sensorId || slot.slotNumber} detected ENTRY`,
        data: slot
      });
    } else if (eventType === 'exit') {
      slot.status = 'available';
      slot.occupiedSince = null;
      slot.reservedAt = null;
      slot.currentBooking = null;
      await slot.save();

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
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      }

      return res.status(200).json({
        success: true,
        message: `IoT Simulation: Sensor ${slot.sensorId || slot.slotNumber} detected EXIT`,
        data: slot
      });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid eventType. Must be "entry" or "exit"'
      });
    }
  } catch (err) {
    next(err);
  }
};
