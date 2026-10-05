const ParkingSession = require('../models/ParkingSession');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const notificationService = require('../services/notificationService');
const bookingService = require('../services/bookingService');
const { getIO } = require('../sockets/socketManager');

// @desc    Verify booking for gatekeeper QR / search
// @route   GET /api/sessions/verify/:bookingId
// @access  Private (Gatekeeper / Admin)
exports.verifyBooking = async (req, res, next) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId: bookingId.toUpperCase() })
      .populate('slotId')
      .populate('locationId')
      .populate('userId', 'name email phone');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Invalid Booking ID' });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check-in vehicle (Start parking session)
// @route   POST /api/sessions/check-in
// @access  Private (Gatekeeper / Admin / User)
exports.checkIn = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return res.status(400).json({ success: false, message: 'Booking ID is required for check-in' });
    }

    const booking = await Booking.findOne({ bookingId: bookingId.toUpperCase() });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.status === 'ACTIVE') {
      return res.status(400).json({ success: false, message: 'Vehicle is already checked in' });
    }

    if (booking.status !== 'CONFIRMED') {
      return res.status(400).json({
        success: false,
        message: `Cannot check in. Booking status is '${booking.status}'`
      });
    }

    const now = new Date();
    booking.status = 'ACTIVE';
    booking.checkInTime = now;
    await booking.save();

    // Update slot to occupied
    const slot = await ParkingSlot.findById(booking.slotId);
    if (slot) {
      slot.status = 'occupied';
      slot.occupiedSince = now;
      await slot.save();
    }

    // Create active session
    const session = await ParkingSession.create({
      bookingId: booking._id,
      slotId: booking.slotId,
      userId: booking.userId,
      vehicleNumber: booking.vehicleNumber,
      entryTime: now,
      expectedExitTime: booking.expectedEndTime,
      status: 'ACTIVE'
    });

    let io = null;
    try {
      io = getIO();
      io.emit('parking:started', {
        bookingId: booking.bookingId,
        slotNumber: slot?.slotNumber,
        entryTime: now,
        vehicleNumber: booking.vehicleNumber
      });

      if (slot) {
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
    } catch (e) {}

    // Send user notification
    await notificationService.createNotification({
      userId: booking.userId,
      title: 'Vehicle Parked 🚗',
      message: `Checked in at slot ${slot?.slotNumber || 'reserved'}. Expected exit: ${booking.expectedEndTime.toLocaleTimeString()}`,
      type: 'parking_started',
      metadata: { bookingId: booking.bookingId, slotNumber: slot?.slotNumber },
      io
    });

    res.status(200).json({
      success: true,
      message: `Check-in successful for ${booking.vehicleNumber} at slot ${slot?.slotNumber}`,
      data: {
        session,
        booking
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Check-out vehicle (End parking session & calculate final bill)
// @route   PATCH /api/sessions/:id/check-out
// @access  Private (Gatekeeper / Admin / User)
exports.checkOut = async (req, res, next) => {
  try {
    const isObjectId = req.params.id.match(/^[0-9a-fA-F]{24}$/);
    let session;

    if (isObjectId) {
      session = await ParkingSession.findById(req.params.id);
    }
    if (!session) {
      const booking = await Booking.findOne({ bookingId: req.params.id.toUpperCase() });
      if (booking) {
        session = await ParkingSession.findOne({ bookingId: booking._id, status: 'ACTIVE' });
      }
    }

    if (!session || session.status === 'COMPLETED') {
      return res.status(404).json({ success: false, message: 'Active parking session not found' });
    }

    const booking = await Booking.findById(session.bookingId);
    const slot = await ParkingSlot.findById(session.slotId);
    const now = new Date();

    // Check for overstay
    let overstayMinutes = 0;
    let overstayFee = 0;
    if (now > session.expectedExitTime) {
      const diffMs = now - session.expectedExitTime;
      overstayMinutes = Math.ceil(diffMs / (60 * 1000));
      // Overstay rate: ₹50 flat per extra hour started
      const overstayHours = Math.ceil(overstayMinutes / 60);
      overstayFee = overstayHours * 50;
    }

    const totalBilled = (booking?.totalAmount || 0) + overstayFee;

    // Complete session
    session.exitTime = now;
    session.overstayDurationMinutes = overstayMinutes;
    session.overstayFee = overstayFee;
    session.totalBilled = totalBilled;
    session.status = 'COMPLETED';
    await session.save();

    // Complete booking
    if (booking) {
      booking.status = 'COMPLETED';
      booking.checkOutTime = now;
      if (overstayFee > 0) {
        booking.totalAmount = totalBilled;
      }
      await booking.save();
    }

    // Release slot
    if (slot) {
      slot.status = 'available';
      slot.currentBooking = null;
      slot.occupiedSince = null;
      slot.reservedAt = null;
      await slot.save();
    }

    let io = null;
    try {
      io = getIO();
      io.emit('parking:completed', {
        bookingId: booking?.bookingId,
        slotNumber: slot?.slotNumber,
        exitTime: now,
        totalBilled
      });

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

    // Send checkout notification
    if (booking) {
      await notificationService.createNotification({
        userId: booking.userId,
        title: 'Parking Completed ✅',
        message: `Checked out from ${slot?.slotNumber}. Total billed: ₹${totalBilled}. Thank you for parking with ParkPulse!`,
        type: 'parking_completed',
        metadata: { bookingId: booking.bookingId, totalBilled },
        io
      });
    }

    // Prepare digital receipt
    const receipt = {
      receiptId: `REC-${Date.now().toString(36).toUpperCase()}`,
      bookingId: booking?.bookingId,
      slotNumber: slot?.slotNumber,
      vehicleNumber: session.vehicleNumber,
      entryTime: session.entryTime,
      exitTime: session.exitTime,
      durationHours: booking?.durationHours,
      actualDurationMinutes: Math.round((session.exitTime - session.entryTime) / (60 * 1000)),
      baseAmount: booking?.baseAmount,
      surgeAmount: booking?.surgeAmount,
      evSurcharge: booking?.evSurcharge,
      overstayMinutes,
      overstayFee,
      tax: booking?.tax,
      totalAmount: totalBilled,
      issuedAt: now
    };

    res.status(200).json({
      success: true,
      message: 'Check-out successful. Have a safe drive!',
      data: {
        session,
        receipt
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get active sessions
// @route   GET /api/sessions/active
// @access  Private (Gatekeeper / Admin)
exports.getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await ParkingSession.find({ status: 'ACTIVE' })
      .populate('bookingId')
      .populate('slotId')
      .populate('userId', 'name email phone')
      .sort({ entryTime: -1 });

    const enrichedSessions = sessions.map((sess) => {
      const now = new Date();
      const isOverstay = now > sess.expectedExitTime;
      const elapsedMinutes = Math.round((now - sess.entryTime) / (60 * 1000));
      const remainingMinutes = Math.max(0, Math.round((sess.expectedExitTime - now) / (60 * 1000)));

      return {
        ...sess.toObject(),
        isOverstay,
        elapsedMinutes,
        remainingMinutes
      };
    });

    res.status(200).json({
      success: true,
      count: enrichedSessions.length,
      data: enrichedSessions
    });
  } catch (err) {
    next(err);
  }
};
