const mongoose = require('mongoose');

const parkingSlotSchema = new mongoose.Schema(
  {
    slotNumber: {
      type: String,
      required: [true, 'Slot number is required'],
      trim: true,
      uppercase: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      index: true
    },
    floor: {
      type: Number,
      required: true,
      default: 1
    },
    zone: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      enum: ['A', 'B', 'C', 'D']
    },
    type: {
      type: String,
      enum: ['standard', 'ev', 'vip', 'accessible', 'emergency', 'staff'],
      default: 'standard'
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev'],
      default: 'car'
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'occupied', 'maintenance', 'out_of_service'],
      default: 'available',
      index: true
    },
    sensorId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true
    },
    distanceFromEntrance: {
      type: Number,
      default: 20 // meters
    },
    walkingDistance: {
      type: Number,
      default: 25 // meters
    },
    drivingDistance: {
      type: Number,
      default: 60 // meters
    },
    navigationDirections: {
      type: String,
      default: 'Follow main driveway to gate, turn right into assigned zone.'
    },
    lane: {
      type: String,
      default: 'L-1'
    },
    pricePerHour: {
      type: Number,
      default: 40
    },
    currentBooking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    occupiedSince: {
      type: Date,
      default: null
    },
    reservedAt: {
      type: Date,
      default: null
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

// Virtual for facilityId backward compatibility
parkingSlotSchema.virtual('facilityId').get(function () {
  return this.locationId;
});

parkingSlotSchema.index({ locationId: 1, slotNumber: 1 }, { unique: true });
parkingSlotSchema.index({ locationId: 1, floor: 1, zone: 1 });
parkingSlotSchema.index({ locationId: 1, status: 1 });
parkingSlotSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('ParkingSlot', parkingSlotSchema);
