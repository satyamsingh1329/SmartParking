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
      required: true,
      index: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true,
      index: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true
    },
    vehicleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    },
    vehicleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev', 'truck'],
      default: 'car'
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
      index: true
    },
    expectedEndTime: {
      type: Date,
      required: true,
      index: true
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
      enum: ['PENDING', 'CONFIRMED', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'OVERSTAYED', 'NO_SHOW'],
      default: 'CONFIRMED',
      index: true
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded', 'failed'],
      default: 'paid',
      index: true
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
    },
    isFutureBooking: {
      type: Boolean,
      default: false
    },
    checkInGracePeriodMinutes: {
      type: Number,
      default: 15
    },
    valetRequested: {
      type: Boolean,
      default: false
    },
    valetStatus: {
      type: String,
      enum: ['NONE', 'REQUESTED', 'ASSIGNED', 'PARKED', 'RETRIEVAL_REQUESTED', 'RETURNED'],
      default: 'NONE'
    },
    valetAttendantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    }
  },
  {
    timestamps: true
  }
);

bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ slotId: 1, status: 1 });
bookingSchema.index({ locationId: 1, status: 1, createdAt: -1 });
bookingSchema.index({ startTime: 1, expectedEndTime: 1, status: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
