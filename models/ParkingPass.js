const mongoose = require('mongoose');

const parkingPassSchema = new mongoose.Schema(
  {
    passNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    passType: {
      type: String,
      enum: ['DAILY', 'WEEKLY', 'MONTHLY', 'STUDENT', 'EMPLOYEE', 'VIP'],
      required: true
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
    startDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: true
    },
    allowedLocations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLocation'
      }
    ],
    allowedZones: {
      type: [String],
      default: ['A', 'B', 'C', 'D']
    },
    pricePaid: {
      type: Number,
      required: true,
      default: 0
    },
    paymentId: {
      type: String,
      default: null
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
      default: 'ACTIVE'
    },
    usageCount: {
      type: Number,
      default: 0
    },
    lastUsedAt: {
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

parkingPassSchema.index({ userId: 1, status: 1 });
parkingPassSchema.index({ vehicleNumber: 1, status: 1 });
parkingPassSchema.index({ endDate: 1 });

module.exports = mongoose.model('ParkingPass', parkingPassSchema);
