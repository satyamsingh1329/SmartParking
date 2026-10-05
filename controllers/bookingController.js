const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const pricingService = require('../services/pricingService');
const bookingService = require('../services/bookingService');
const notificationService = require('../services/notificationService');
const { getIO } = require('../sockets/socketManager');

// @desc    Calculate live quote before booking
// @route   POST /api/bookings/quote
// @access  Public
exports.getQuote = async (req, res, next) => {
  try {
    const { locationId, slotId, vehicleType, durationHours, slotType } = req.body;

    const quote = await pricingService.calculateQuote({
      locationId,
      slotId,
      vehicleType,
      durationHours,
      slotType
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
      pointsToRedeem
    } = req.body;

    if (!slotId || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide slot ID and vehicle number'
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
      vehicleNumber,
      vehicleType: vehicleType || 'car',
      durationHours: durationHours || 2,
      startTime: startTime || new Date(),
      paymentMethod: paymentMethod || 'mock_card',
      pointsToRedeem: Number(pointsToRedeem) || 0,
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
      .populate('slotId', 'slotNumber floor zone type pricePerHour sensorId')
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

// @desc    Get single booking by ID
// @route   GET /api/bookings/:id
// @access  Private
exports.getBookingById = async (req, res, next) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id };

    const booking = await Booking.findOne(query)
      .populate('slotId')
      .populate('locationId')
      .populate('userId', 'name email phone rewardPoints');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Role check: Admin and Gatekeeper can view any booking, user can only view their own
    if (req.user.role === 'USER' && booking.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this booking' });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Cancel booking
// @route   PATCH /api/bookings/:id/cancel
// @access  Private
exports.cancelBooking = async (req, res, next) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id };

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (req.user.role === 'USER' && booking.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status '${booking.status}'`
      });
    }

    booking.status = 'CANCELLED';
    await booking.save();

    // Release slot
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

// @desc    Extend booking duration
// @route   PATCH /api/bookings/:id/extend
// @access  Private
exports.extendBooking = async (req, res, next) => {
  try {
    const { additionalHours } = req.body;
    const hours = parseFloat(additionalHours) || 1;

    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    const query = isObjectId ? { _id: req.params.id } : { bookingId: req.params.id };

    const booking = await Booking.findOne(query);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!['CONFIRMED', 'ACTIVE'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot extend booking with status '${booking.status}'`
      });
    }

    // Calculate extra cost
    const quote = await pricingService.calculateQuote({
      locationId: booking.locationId,
      slotId: booking.slotId,
      vehicleType: booking.vehicleType,
      durationHours: hours
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
