const Booking = require('../models/Booking');
const ParkingSession = require('../models/ParkingSession');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingPass = require('../models/ParkingPass');
const Vehicle = require('../models/Vehicle');
const { getIO } = require('../sockets/socketManager');

class ANPRService {
  /**
   * Process a captured vehicle license plate from an optical gate camera
   * Safe mock/demo engine architecture designed for drop-in CV/ML OCR integration
   */
  async processScan({ plateNumber, locationId, gateType = 'ENTRY', confidence = 0.98 }) {
    if (!plateNumber) {
      throw new Error('License plate number is required');
    }

    const cleanPlate = plateNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const now = new Date();

    // 1. Check known vehicle registry
    const vehicleRecord = await Vehicle.findOne({
      $or: [{ vehicleNumber: cleanPlate }, { registrationNumber: cleanPlate }]
    }).populate('userId', 'name email phone');

    // 2. Check for active Parking Pass
    const activePass = await ParkingPass.findOne({
      vehicleNumber: cleanPlate,
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: now }
    });

    let io = null;
    try {
      io = getIO();
    } catch (e) {}

    if (gateType === 'ENTRY') {
      // 3. Search for a valid Confirmed Booking
      const booking = await Booking.findOne({
        vehicleNumber: cleanPlate,
        status: { $in: ['CONFIRMED', 'PENDING'] }
      })
        .populate('slotId')
        .sort({ startTime: 1 });

      if (booking && booking.slotId) {
        // Authorize with Booking
        booking.status = 'ACTIVE';
        booking.checkInTime = now;
        await booking.save();

        const session = await ParkingSession.create({
          bookingId: booking._id,
          slotId: booking.slotId._id,
          userId: booking.userId,
          vehicleNumber: cleanPlate,
          entryTime: now,
          expectedExitTime: booking.expectedEndTime,
          status: 'ACTIVE'
        });

        // Update slot to occupied
        booking.slotId.status = 'occupied';
        booking.slotId.occupiedSince = now;
        await booking.slotId.save();

        if (io) {
          io.emit('gate:activity', {
            gate: 'ENTRY',
            vehicleNumber: cleanPlate,
            action: 'BARRIER_OPENED',
            reason: `Confirmed Booking ${booking.bookingId} (Bay: ${booking.slotId.slotNumber})`,
            timestamp: now
          });
          io.emit('slot:updated', {
            _id: booking.slotId._id,
            slotNumber: booking.slotId.slotNumber,
            status: 'occupied',
            floor: booking.slotId.floor,
            zone: booking.slotId.zone
          });
        }

        return {
          authorized: true,
          gateAction: 'OPEN',
          mode: 'BOOKING',
          confidence,
          plateNumber: cleanPlate,
          slotNumber: booking.slotId.slotNumber,
          floor: booking.slotId.floor,
          zone: booking.slotId.zone,
          driverName: vehicleRecord?.userId?.name || 'Authorized Driver',
          message: `Booking verified. Welcome! Proceed to Bay ${booking.slotId.slotNumber}.`,
          session
        };
      }

      if (activePass) {
        // Authorize with Pass - assign first available slot
        const availableSlot = await ParkingSlot.findOne({
          locationId: locationId || activePass.allowedLocations[0],
          status: 'available',
          zone: { $in: activePass.allowedZones }
        });

        if (availableSlot) {
          availableSlot.status = 'occupied';
          availableSlot.occupiedSince = now;
          await availableSlot.save();

          const session = await ParkingSession.create({
            bookingId: null,
            slotId: availableSlot._id,
            userId: activePass.userId,
            vehicleNumber: cleanPlate,
            entryTime: now,
            expectedExitTime: new Date(now.getTime() + 8 * 3600 * 1000), // 8 hours pass window
            status: 'ACTIVE'
          });

          activePass.usageCount += 1;
          activePass.lastUsedAt = now;
          await activePass.save();

          if (io) {
            io.emit('gate:activity', {
              gate: 'ENTRY',
              vehicleNumber: cleanPlate,
              action: 'BARRIER_OPENED',
              reason: `Valid ${activePass.passType} Pass ${activePass.passNumber}`,
              timestamp: now
            });
          }

          return {
            authorized: true,
            gateAction: 'OPEN',
            mode: 'PASS',
            confidence,
            plateNumber: cleanPlate,
            passType: activePass.passType,
            slotNumber: availableSlot.slotNumber,
            driverName: vehicleRecord?.userId?.name || 'Pass Holder',
            message: `${activePass.passType} pass accepted. Proceed to Bay ${availableSlot.slotNumber}.`,
            session
          };
        }
      }

      // Drive-in entry without prior reservation
      const freeSlot = await ParkingSlot.findOne({
        status: 'available',
        type: 'standard'
      });

      if (!freeSlot) {
        return {
          authorized: false,
          gateAction: 'CLOSED',
          mode: 'NO_SPACE',
          confidence,
          plateNumber: cleanPlate,
          message: 'Parking facility is completely full. No available slots for drive-in.'
        };
      }

      freeSlot.status = 'occupied';
      freeSlot.occupiedSince = now;
      await freeSlot.save();

      const session = await ParkingSession.create({
        bookingId: null,
        slotId: freeSlot._id,
        vehicleNumber: cleanPlate,
        entryTime: now,
        expectedExitTime: new Date(now.getTime() + 2 * 3600 * 1000),
        status: 'ACTIVE'
      });

      if (io) {
        io.emit('gate:activity', {
          gate: 'ENTRY',
          vehicleNumber: cleanPlate,
          action: 'BARRIER_OPENED',
          reason: `Drive-in Visitor Assigned Bay ${freeSlot.slotNumber}`,
          timestamp: now
        });
      }

      return {
        authorized: true,
        gateAction: 'OPEN',
        mode: 'DRIVE_IN',
        confidence,
        plateNumber: cleanPlate,
        slotNumber: freeSlot.slotNumber,
        message: `Drive-in visitor authorized. Assigned Bay ${freeSlot.slotNumber}.`,
        session
      };
    } else {
      // EXIT GATE
      const activeSession = await ParkingSession.findOne({
        vehicleNumber: cleanPlate,
        status: 'ACTIVE'
      }).populate('slotId');

      if (!activeSession) {
        return {
          authorized: false,
          gateAction: 'MANUAL_INTERVENTION_REQUIRED',
          mode: 'NO_SESSION',
          confidence,
          plateNumber: cleanPlate,
          message: 'No active parking session found for vehicle. Contact parking attendant.'
        };
      }

      activeSession.exitTime = now;
      activeSession.status = 'COMPLETED';

      // Overstay fee calculation
      let overstayFee = 0;
      if (now > activeSession.expectedExitTime) {
        const extraHours = Math.ceil((now - activeSession.expectedExitTime) / (1000 * 3600));
        overstayFee = extraHours * 50;
      }
      activeSession.overstayFee = overstayFee;

      let booking = null;
      if (activeSession.bookingId) {
        booking = await Booking.findById(activeSession.bookingId);
        if (booking) {
          booking.status = 'COMPLETED';
          booking.checkOutTime = now;
          if (overstayFee > 0) booking.totalAmount += overstayFee;
          await booking.save();
        }
      }

      activeSession.totalBilled = (booking?.totalAmount || 0) + overstayFee;
      await activeSession.save();

      // Free slot
      if (activeSession.slotId) {
        const slot = await ParkingSlot.findById(activeSession.slotId._id);
        if (slot) {
          slot.status = 'available';
          slot.occupiedSince = null;
          slot.currentBooking = null;
          await slot.save();

          if (io) {
            io.emit('slot:updated', {
              _id: slot._id,
              slotNumber: slot.slotNumber,
              status: 'available',
              floor: slot.floor,
              zone: slot.zone
            });
          }
        }
      }

      if (io) {
        io.emit('gate:activity', {
          gate: 'EXIT',
          vehicleNumber: cleanPlate,
          action: 'BARRIER_OPENED',
          reason: `Exit authorized. Bill: Rs. ${activeSession.totalBilled}`,
          timestamp: now
        });
      }

      return {
        authorized: true,
        gateAction: 'OPEN',
        mode: 'EXIT_SUCCESS',
        confidence,
        plateNumber: cleanPlate,
        totalBilled: activeSession.totalBilled,
        overstayFee,
        message: `Exit authorized for ${cleanPlate}. Thank you for parking with ParkPulse!`,
        session: activeSession
      };
    }
  }
}

module.exports = new ANPRService();
