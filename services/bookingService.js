const QRCode = require('qrcode');
const Booking = require('../models/Booking');
const ParkingSlot = require('../models/ParkingSlot');
const Payment = require('../models/Payment');
const User = require('../models/User');
const RewardTransaction = require('../models/RewardTransaction');
const pricingService = require('./pricingService');
const notificationService = require('./notificationService');

class BookingService {
  /**
   * Generate collision-resistant unique booking ID
   */
  generateBookingId() {
    const timestamp = Date.now().toString(36).toUpperCase().slice(-4);
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    return `PP-2026-${timestamp}${randomHex}`;
  }

  /**
   * Create an atomic booking reservation
   */
  async createBooking({
    userId,
    slotId,
    locationId,
    vehicleId,
    vehicleNumber,
    vehicleType = 'car',
    durationHours = 2,
    startTime = new Date(),
    paymentMethod = 'mock_card',
    pointsToRedeem = 0,
    valetRequested = false,
    io
  }) {
    // 1. Calculate price quote
    const slot = await ParkingSlot.findById(slotId);
    if (!slot) {
      const err = new Error('Slot does not exist');
      err.statusCode = 404;
      throw err;
    }

    // Role / Restriction validation for emergency, staff and VIP bays
    const user = await User.findById(userId);
    if (['emergency', 'staff'].includes(slot.type) && (!user || !['ADMIN', 'GATEKEEPER'].includes(user.role))) {
      const err = new Error(`Slot ${slot.slotNumber} is restricted to emergency / authorized staff vehicles only.`);
      err.statusCode = 403;
      throw err;
    }

    const quote = await pricingService.calculateQuote({
      locationId: slot.locationId,
      slotId: slot._id,
      vehicleType,
      durationHours,
      slotType: slot.type
    });

    // 2. Handle reward points discount if requested
    let discountAmount = 0;
    let redeemedPoints = 0;

    if (pointsToRedeem > 0 && user && user.rewardPoints >= pointsToRedeem) {
      // 100 points = ₹20 discount
      discountAmount = Math.min(Math.floor((pointsToRedeem / 100) * 20), quote.totalAmount);
      redeemedPoints = Math.round((discountAmount / 20) * 100);
    }

    const valetFee = valetRequested ? 50 : 0;
    const finalTotal = Math.max(0, quote.totalAmount + valetFee - discountAmount);
    const bookingId = this.generateBookingId();
    const parsedStartTime = new Date(startTime);
    const expectedEndTime = new Date(parsedStartTime.getTime() + durationHours * 3600 * 1000);
    const isFutureBooking = parsedStartTime.getTime() - Date.now() > 30 * 60 * 1000;

    // 3. ATOMIC SLOT RESERVATION
    // Must find slot with status === 'available' and atomically update to 'reserved'
    const reservedSlot = await ParkingSlot.findOneAndUpdate(
      { _id: slotId, status: 'available' },
      {
        status: 'reserved',
        reservedAt: new Date()
      },
      { returnDocument: 'after' }
    );

    if (!reservedSlot) {
      const err = new Error(`Slot ${slot.slotNumber} was just reserved by another user. Please select another slot.`);
      err.statusCode = 409;
      throw err;
    }

    try {
      // 4. Generate QR code pass data
      const qrPayload = {
        bookingId,
        slot: reservedSlot.slotNumber,
        floor: reservedSlot.floor,
        zone: reservedSlot.zone,
        lane: reservedSlot.lane || 'L-1',
        vehicle: vehicleNumber.toUpperCase(),
        entry: parsedStartTime.toISOString(),
        exit: expectedEndTime.toISOString(),
        platform: 'PARKPULSE'
      };

      const qrCodeData = await QRCode.toDataURL(JSON.stringify(qrPayload), {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 300,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      // 5. Create Booking Document
      const booking = await Booking.create({
        bookingId,
        userId,
        slotId: reservedSlot._id,
        locationId: reservedSlot.locationId,
        vehicleId: vehicleId || null,
        vehicleNumber: vehicleNumber.toUpperCase(),
        vehicleType,
        startTime: parsedStartTime,
        expectedEndTime,
        durationHours,
        baseAmount: quote.baseAmount,
        surgeMultiplier: quote.surgeMultiplier,
        surgeAmount: quote.surgeAmount,
        evSurcharge: quote.evSurcharge,
        convenienceFee: quote.convenienceFee,
        discountAmount,
        tax: quote.tax,
        totalAmount: finalTotal,
        status: 'CONFIRMED',
        paymentStatus: 'paid',
        qrCodeData,
        isFutureBooking,
        checkInGracePeriodMinutes: 15,
        valetRequested,
        valetStatus: valetRequested ? 'REQUESTED' : 'NONE'
      });

      // Update slot reference to current booking
      reservedSlot.currentBooking = booking._id;
      await reservedSlot.save();

      // 6. Record Payment with mock environment transparency
      const paymentId = `PAY-${Math.floor(100000 + Math.random() * 900000)}`;
      await Payment.create({
        paymentId,
        bookingId: booking._id,
        userId,
        amount: finalTotal,
        status: 'completed',
        method: paymentMethod,
        isMockPayment: true,
        gatewayProvider: 'PARKPULSE_SANDBOX_GATEWAY',
        transactionDetails: {
          breakdown: quote,
          valetFee,
          discountAmount,
          paidAt: new Date()
        }
      });

      // 7. Update User Rewards:
      if (redeemedPoints > 0) {
        user.rewardPoints -= redeemedPoints;
        await RewardTransaction.create({
          userId,
          bookingId: booking._id,
          points: -redeemedPoints,
          type: 'redeemed',
          description: `Redeemed ${redeemedPoints} points for ₹${discountAmount} discount on booking ${bookingId}`,
          balanceAfter: user.rewardPoints
        });
      }

      // Earn 1 point per ₹10 spent
      const earnedPoints = Math.floor(finalTotal / 10);
      if (earnedPoints > 0) {
        user.rewardPoints += earnedPoints;
        await RewardTransaction.create({
          userId,
          bookingId: booking._id,
          points: earnedPoints,
          type: 'earned',
          description: `Earned ${earnedPoints} loyalty points for booking ${bookingId}`,
          balanceAfter: user.rewardPoints
        });
      }
      await user.save();

      // 8. Notifications
      await notificationService.createNotification({
        userId,
        title: 'Booking Confirmed 🎉',
        message: `Your bay ${reservedSlot.slotNumber} is confirmed! Pass ID: ${bookingId}. Check-in within 15 minutes.`,
        type: 'booking_confirmed',
        metadata: { bookingId, slotNumber: reservedSlot.slotNumber },
        io
      });

      // 9. Real-Time Socket Broadcasts
      if (io) {
        io.emit('slot:reserved', {
          slotId: reservedSlot._id,
          slotNumber: reservedSlot.slotNumber,
          floor: reservedSlot.floor,
          zone: reservedSlot.zone,
          status: 'reserved',
          reservedAt: reservedSlot.reservedAt
        });

        io.emit('slot:updated', {
          _id: reservedSlot._id,
          slotNumber: reservedSlot.slotNumber,
          floor: reservedSlot.floor,
          zone: reservedSlot.zone,
          status: 'reserved'
        });

        io.emit('booking:created', {
          bookingId: booking.bookingId,
          slotNumber: reservedSlot.slotNumber,
          totalAmount: booking.totalAmount
        });

        this.broadcastUpdatedStats(io, reservedSlot.locationId);
      }

      return {
        ...booking.toObject(),
        navigation: {
          slotNumber: reservedSlot.slotNumber,
          floor: reservedSlot.floor,
          zone: reservedSlot.zone,
          lane: reservedSlot.lane || 'L-1',
          walkingDistanceMeters: reservedSlot.walkingDistance || 25,
          drivingDistanceMeters: reservedSlot.drivingDistance || 60,
          directions:
            reservedSlot.navigationDirections ||
            `Drive to Floor ${reservedSlot.floor}, follow signs to Zone ${reservedSlot.zone}, bay ${reservedSlot.slotNumber}.`
        }
      };
    } catch (err) {
      // Rollback slot reservation if any subsequent step failed
      await ParkingSlot.findByIdAndUpdate(slotId, {
        status: 'available',
        currentBooking: null,
        reservedAt: null
      });
      throw err;
    }
  }

  /**
   * Auto-release unclaimed reservations after grace period (15 minutes)
   */
  async releaseExpiredReservations(io) {
    try {
      const expirationThreshold = new Date(Date.now() - 15 * 60 * 1000); // 15 mins ago

      const expiredSlots = await ParkingSlot.find({
        status: 'reserved',
        reservedAt: { $lt: expirationThreshold }
      });

      if (expiredSlots.length === 0) return;

      console.log(`[Auto-Release] Releasing ${expiredSlots.length} expired reservations...`);

      for (const slot of expiredSlots) {
        if (slot.currentBooking) {
          const booking = await Booking.findById(slot.currentBooking);
          if (booking && booking.status === 'CONFIRMED') {
            booking.status = 'NO_SHOW';
            await booking.save();

            await notificationService.createNotification({
              userId: booking.userId,
              title: 'Reservation Expired (No-Show) ⚠️',
              message: `Your reservation for slot ${slot.slotNumber} (${booking.bookingId}) expired due to 15-min check-in window.`,
              type: 'slot_expired',
              metadata: { bookingId: booking.bookingId },
              io
            });

            if (io) {
              io.emit('booking:expired', { bookingId: booking.bookingId, slotNumber: slot.slotNumber });
            }
          }
        }

        // Release slot back to available
        slot.status = 'available';
        slot.currentBooking = null;
        slot.reservedAt = null;
        await slot.save();

        if (io) {
          io.emit('slot:expired', {
            slotId: slot._id,
            slotNumber: slot.slotNumber,
            floor: slot.floor,
            zone: slot.zone
          });

          io.emit('slot:updated', {
            _id: slot._id,
            slotNumber: slot.slotNumber,
            floor: slot.floor,
            zone: slot.zone,
            status: 'available'
          });

          this.broadcastUpdatedStats(io, slot.locationId);
        }
      }
    } catch (error) {
      console.error('[Auto-Release Error]', error);
    }
  }

  /**
   * Broadcast real-time stats to all connected clients
   */
  async broadcastUpdatedStats(io, locationId) {
    try {
      const query = { isActive: true };
      if (locationId) query.locationId = locationId;

      const totalSlots = await ParkingSlot.countDocuments(query);
      const available = await ParkingSlot.countDocuments({ ...query, status: 'available' });
      const occupied = await ParkingSlot.countDocuments({ ...query, status: 'occupied' });
      const reserved = await ParkingSlot.countDocuments({ ...query, status: 'reserved' });
      const occupancyRate = totalSlots > 0 ? Math.round(((occupied + reserved) / totalSlots) * 100) : 0;

      let congestionLevel = 'LOW';
      if (occupancyRate > 80) congestionLevel = 'HIGH';
      else if (occupancyRate > 50) congestionLevel = 'MODERATE';

      const stats = {
        total: totalSlots,
        available,
        occupied,
        reserved,
        occupancyRate,
        congestionLevel,
        locationId
      };

      io.emit('stats:updated', stats);
      io.emit('occupancy:updated', { occupancyRate, congestionLevel });
    } catch (err) {
      console.error('[broadcastUpdatedStats Error]', err.message);
    }
  }
}

module.exports = new BookingService();
