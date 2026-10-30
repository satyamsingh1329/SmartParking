const bookingService = require('../services/bookingService');
const pricingService = require('../services/pricingService');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const { getIO } = require('../sockets/socketManager');

// @desc    Get instant price estimate
// @route   POST /api/bookings/quote
// @access  Public
exports.getQuote = async (req, res, next) => {
  try {
    const { locationId, slotId, vehicleType, durationHours, startTime } = req.body;

    const quote = await pricingService.calculateQuote({
      locationId,
      slotId,
      vehicleType,
      durationHours: parseFloat(durationHours) || 2,
      startTime: startTime ? new Date(startTime) : new Date()
    });

    res.status(200).json({
      success: true,
      data: quote
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create atomic booking
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
  try {
    const {
      slotId,
      locationId,
      vehicleId,
      vehicleNumber,
      vehicleType,
      durationHours,
      startTime,
      paymentMethod,
      pointsToRedeem,
      valetRequested
    } = req.body;

    if (!slotId || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Please provide slot ID and vehicle registration number'
      });
    }

    const cleanVehicleNumber = vehicleNumber.toUpperCase().replace(/\s+/g, '');
    const bookingStartTime = startTime ? new Date(startTime) : new Date();

    if (isNaN(bookingStartTime.getTime())) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_START_TIME',
        message: 'Please provide a valid ISO start time'
      });
    }

    let io = null;
    try {
      io = getIO();
    } catch (e) {}

    const booking = await bookingService.createBooking({
      userId: req.user.id,
      slotId,
      locationId,
      vehicleId,
      vehicleNumber: cleanVehicleNumber,
      vehicleType: vehicleType || 'car',
      durationHours: parseFloat(durationHours) || 2,
      startTime: bookingStartTime,
      paymentMethod: paymentMethod || 'mock_card',
      pointsToRedeem: Number(pointsToRedeem) || 0,
      valetRequested: Boolean(valetRequested),
      io
    });

    res.status(201).json({
      success: true,
      message: 'Booking confirmed successfully!',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user bookings
// @route   GET /api/bookings/my
// @access  Private
exports.getMyBookings = async (req, res, next) => {
  try {
    const bookings = await Booking.find({ userId: req.user.id })
      .populate('slotId', 'slotNumber floor zone type pricePerHour sensorId walkingDistance drivingDistance navigationDirections')
      .populate('locationId', 'name address city')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single booking by ID (Strict ownership enforced)
// @route   GET /api/bookings/:id
// @access  Private
exports.getBookingById = async (req, res, next) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id.toUpperCase() };

    const booking = await Booking.findOne(query)
      .populate('slotId')
      .populate('locationId')
      .populate('userId', 'name email phone rewardPoints');

    if (!booking) {
      return res.status(404).json({
        success: false,
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking permit not found'
      });
    }

    // Role check: Commuters can ONLY view their own bookings
    const isOwner = booking.userId._id.toString() === req.user.id;
    const isStaff = ['ADMIN', 'GATEKEEPER'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Access denied. You do not own this booking permit.'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel booking (Strict ownership enforced)
// @route   PATCH /api/bookings/:id/cancel
// @access  Private
exports.cancelBooking = async (req, res, next) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id.toUpperCase() };

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking not found'
      });
    }

    // Ownership check
    const isOwner = booking.userId.toString() === req.user.id;
    const isStaff = ['ADMIN', 'GATEKEEPER'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Access denied. You cannot cancel another user’s booking.'
      });
    }

    if (booking.status !== 'CONFIRMED' && booking.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STATUS',
        message: `Cannot cancel booking with current status '${booking.status}'`
      });
    }

    booking.status = 'CANCELLED';
    await booking.save();

    // Release slot atomically
    const slot = await ParkingSlot.findById(booking.slotId);
    if (slot && slot.status === 'reserved') {
      slot.status = 'available';
      slot.currentBooking = null;
      slot.reservedAt = null;
      await slot.save();
    }

    let io = null;
    try {
      io = getIO();
      io.emit('booking:cancelled', { bookingId: booking.bookingId });
      if (slot) {
        io.emit('slot:released', { slotId: slot._id, slotNumber: slot.slotNumber, status: 'available' });
        io.emit('slot:updated', {
          _id: slot._id,
          slotNumber: slot.slotNumber,
          floor: slot.floor,
          zone: slot.zone,
          status: 'available'
        });
        await bookingService.broadcastUpdatedStats(io, slot.locationId);
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully. Slot has been released.',
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Extend booking duration (Strict ownership enforced)
// @route   PATCH /api/bookings/:id/extend
// @access  Private
exports.extendBooking = async (req, res, next) => {
  try {
    const { additionalHours } = req.body;
    const hours = parseFloat(additionalHours) || 1;

    if (hours <= 0 || hours > 8) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_EXTENSION_DURATION',
        message: 'Extension must be between 0.5 and 8 hours'
      });
    }

    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id.toUpperCase() };

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking not found'
      });
    }

    // Ownership check
    const isOwner = booking.userId.toString() === req.user.id;
    const isStaff = ['ADMIN', 'GATEKEEPER'].includes(req.user.role);

    if (!isOwner && !isStaff) {
      return res.status(403).json({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Access denied. You cannot extend another user’s booking.'
      });
    }

    if (!['CONFIRMED', 'ACTIVE'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_STATUS',
        message: `Cannot extend booking with status '${booking.status}'`
      });
    }

    // Maximum stay cap (24 hours total)
    if (booking.durationHours + hours > 24) {
      return res.status(400).json({
        success: false,
        errorCode: 'MAX_DURATION_EXCEEDED',
        message: 'Total booking duration cannot exceed 24 hours.'
      });
    }

    // Calculate incremental cost using DB pricing rules
    const quote = await pricingService.calculateQuote({
      locationId: booking.locationId,
      slotId: booking.slotId,
      vehicleType: booking.vehicleType,
      durationHours: hours,
      startTime: booking.expectedEndTime
    });

    booking.durationHours += hours;
    booking.expectedEndTime = new Date(new Date(booking.expectedEndTime).getTime() + hours * 3600 * 1000);
    booking.totalAmount += quote.totalAmount;
    await booking.save();

    let io = null;
    try {
      io = getIO();
      io.emit('parking:extended', {
        bookingId: booking.bookingId,
        newExpectedEndTime: booking.expectedEndTime,
        additionalHours: hours,
        addedCost: quote.totalAmount
      });
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Booking extended by ${hours} hour(s) successfully!`,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update Valet Service status (Phase 17 Smart Valet Mode)
// @route   PATCH /api/bookings/:id/valet
// @access  Private (USER, GATEKEEPER, ADMIN)
exports.updateValetStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['REQUESTED', 'ASSIGNED', 'PARKED', 'RETRIEVAL_REQUESTED', 'RETURNED'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_VALET_STATUS',
        message: `Status must be one of: ${validStatuses.join(', ')}`
      });
    }

    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id.toUpperCase() };

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({
        success: false,
        errorCode: 'BOOKING_NOT_FOUND',
        message: 'Booking not found'
      });
    }

    const isOwner = booking.userId.toString() === req.user.id;
    const isStaff = ['ADMIN', 'GATEKEEPER'].includes(req.user.role);

    // USER can only trigger REQUESTED or RETRIEVAL_REQUESTED
    if (!isStaff) {
      if (!isOwner) {
        return res.status(403).json({
          success: false,
          errorCode: 'FORBIDDEN',
          message: 'Access denied'
        });
      }
      if (!['REQUESTED', 'RETRIEVAL_REQUESTED'].includes(status)) {
        return res.status(403).json({
          success: false,
          errorCode: 'STAFF_ACTION_REQUIRED',
          message: 'Only parking attendants can assign or park valet vehicles'
        });
      }
    }

    booking.valetRequested = true;
    booking.valetStatus = status;
    if (isStaff && status === 'ASSIGNED') {
      booking.valetAttendantId = req.user.id;
    }
    await booking.save();

    try {
      const io = getIO();
      if (io) {
        io.emit('valet:status_update', {
          bookingId: booking.bookingId,
          valetStatus: status,
          vehicleNumber: booking.vehicleNumber
        });
      }
    } catch (e) {}

    res.status(200).json({
      success: true,
      message: `Valet status updated to ${status}`,
      data: {
        bookingId: booking.bookingId,
        valetStatus: booking.valetStatus,
        valetAttendantId: booking.valetAttendantId
      }
    });
  } catch (err) {
    next(err);
  }
};
