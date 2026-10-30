const mongoose = require('mongoose');

const evChargingStationSchema = new mongoose.Schema(
  {
    stationId: {
      type: String,
      required: [true, 'Station ID is required'],
      unique: true,
      trim: true,
      uppercase: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      default: null
    },
    connectorType: {
      type: String,
      enum: ['CCS2', 'Type2', 'CHAdeMO', 'GB/T'],
      default: 'CCS2'
    },
    powerKW: {
      type: Number,
      required: true,
      default: 22 // 22 kW fast charger default
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'IN_USE', 'RESERVED', 'MAINTENANCE', 'OFFLINE'],
      default: 'AVAILABLE'
    },
    currentUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    currentVehicleNumber: {
      type: String,
      default: null,
      trim: true,
      uppercase: true
    },
    startTime: {
      type: Date,
      default: null
    },
    endTime: {
      type: Date,
      default: null
    },
    energyConsumedKWh: {
      type: Number,
      default: 0
    },
    ratePerKWh: {
      type: Number,
      default: 15 // Rs. 15 per kWh
    },
    totalChargingCost: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

evChargingStationSchema.index({ locationId: 1, status: 1 });

module.exports = mongoose.model('EVChargingStation', evChargingStationSchema);
