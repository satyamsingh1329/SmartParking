const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev'],
      default: 'car'
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now
    },
    expectedEndTime: {
      type: Date,
      required: true
    },
    durationHours: {
      type: Number,
      required: true,
      min: 0.5
    },
    baseAmount: {
      type: Number,
      required: true,
      default: 0
    },
    surgeMultiplier: {
      type: Number,
      default: 1.0
    },
    surgeAmount: {
      type: Number,
      default: 0
    },
    evSurcharge: {
      type: Number,
      default: 0
    },
    convenienceFee: {
      type: Number,
      default: 10
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    tax: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'OVERSTAYED'],
      default: 'CONFIRMED'
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'paid'
    },
    checkInTime: {
      type: Date,
      default: null
    },
    checkOutTime: {
      type: Date,
      default: null
    },
    qrCodeData: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ slotId: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
