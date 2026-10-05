const ParkingSlot = require('../models/ParkingSlot');
const recommendationService = require('../services/recommendationService');
const bookingService = require('../services/bookingService');
const { getIO } = require('../sockets/socketManager');

// @desc    Get all parking slots with filters
// @route   GET /api/slots
// @access  Public
exports.getSlots = async (req, res, next) => {
  try {
    const { locationId, floor, zone, vehicleType, type, status, search } = req.query;

    const query = { isActive: true };

    if (locationId) query.locationId = locationId;
    if (floor) query.floor = parseInt(floor);
    if (zone) query.zone = zone.toUpperCase();
    if (vehicleType) query.vehicleType = vehicleType.toLowerCase();
    if (type) query.type = type.toLowerCase();
    if (status) query.status = status.toLowerCase();
    if (search) {
      query.$or = [
        { slotNumber: { $regex: search, $options: 'i' } },
        { sensorId: { $regex: search, $options: 'i' } }
      ];
    }

    const slots = await ParkingSlot.find(query)
      .populate('locationId', 'name address')
      .populate('currentBooking', 'bookingId vehicleNumber status startTime expectedEndTime')
      .sort({ floor: 1, zone: 1, slotNumber: 1 });

    res.status(200).json({
      success: true,
      count: slots.length,
      data: slots
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single slot
// @route   GET /api/slots/:id
// @access  Public
exports.getSlotById = async (req, res, next) => {
  try {
    const slot = await ParkingSlot.findById(req.params.id)
      .populate('locationId')
      .populate('currentBooking');

    if (!slot) {
      return res.status(404).json({ success: false, message: 'Parking slot not found' });
    }

    res.status(200).json({
      success: true,
      data: slot
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Smart slot recommendation
// @route   GET /api/slots/recommend
// @access  Public
exports.recommendSlot = async (req, res, next) => {
  try {
    const { locationId, floor, vehicleType, requiresEV, requiresAccessible, requiresVIP } = req.query;

    const recommendation = await recommendationService.recommendBestSlot({
      locationId,
      floor,
      vehicleType,
      requiresEV: requiresEV === 'true',
      requiresAccessible: requiresAccessible === 'true',
      requiresVIP: requiresVIP === 'true'
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'No available slots matching your criteria at this location.'
      });
    }

    res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update slot status with state machine enforcement (Section 74)
// @route   PATCH /api/slots/:id/status
// @access  Private (Admin / Gatekeeper)
exports.updateSlotStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'reserved', 'occupied'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const slot = await ParkingSlot.findById(req.params.id);
    if (!slot) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }

    // State machine check
    const current = slot.status;
    const allowed = {
      available: ['reserved', 'occupied'],
      reserved: ['available', 'occupied'],
      occupied: ['available']
    };

    if (current !== status && (!allowed[current] || !allowed[current].includes(status))) {
      return res.status(400).json({
        success: false,
        message: `Invalid status transition from '${current}' to '${status}'`
      });
    }

    slot.status = status;
    if (status === 'occupied') {
      slot.occupiedSince = new Date();
    } else if (status === 'available') {
      slot.occupiedSince = null;
      slot.reservedAt = null;
      slot.currentBooking = null;
    } else if (status === 'reserved') {
      slot.reservedAt = new Date();
    }

    await slot.save();

    // Broadcast socket event
    let io;
    try {
      io = getIO();
      io.emit('slot:updated', {
        _id: slot._id,
        slotNumber: slot.slotNumber,
        floor: slot.floor,
        zone: slot.zone,
        status: slot.status,
        occupiedSince: slot.occupiedSince
      });
      await bookingService.broadcastUpdatedStats(io, slot.locationId);
    } catch (e) {
      // Socket not ready
    }

    res.status(200).json({
      success: true,
      message: `Slot ${slot.slotNumber} status updated to ${status}`,
      data: slot
    });
  } catch (err) {
    next(err);
  }
};
