const mongoose = require('mongoose');

const parkingSessionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null,
      index: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    entryTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    exitTime: {
      type: Date,
      default: null
    },
    expectedExitTime: {
      type: Date,
      required: true
    },
    overstayDurationMinutes: {
      type: Number,
      default: 0
    },
    overstayFee: {
      type: Number,
      default: 0
    },
    totalBilled: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'COMPLETED', 'OVERSTAYED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true
    }
  },
  {
    timestamps: true
  }
);

parkingSessionSchema.index({ slotId: 1, status: 1 });
parkingSessionSchema.index({ userId: 1, status: 1 });
parkingSessionSchema.index({ entryTime: -1, status: 1 });

module.exports = mongoose.model('ParkingSession', parkingSessionSchema);
