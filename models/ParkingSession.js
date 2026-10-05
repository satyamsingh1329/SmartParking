const mongoose = require('mongoose');

const parkingSessionSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    entryTime: {
      type: Date,
      required: true,
      default: Date.now
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
      enum: ['ACTIVE', 'COMPLETED', 'OVERSTAYED'],
      default: 'ACTIVE'
    }
  },
  {
    timestamps: true
  }
);

parkingSessionSchema.index({ status: 1 });
parkingSessionSchema.index({ slotId: 1, status: 1 });

module.exports = mongoose.model('ParkingSession', parkingSessionSchema);
