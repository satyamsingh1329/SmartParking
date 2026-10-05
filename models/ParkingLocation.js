const mongoose = require('mongoose');

const parkingLocationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Location name is required'],
      trim: true
    },
    code: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true
    },
    address: {
      type: String,
      required: true
    },
    city: {
      type: String,
      default: 'New Delhi'
    },
    category: {
      type: String,
      enum: ['campus', 'mall', 'techpark', 'hostel', 'hospital', 'metro'],
      default: 'campus'
    },
    totalFloors: {
      type: Number,
      default: 3
    },
    zones: {
      type: [String],
      default: ['A', 'B', 'C', 'D']
    },
    totalCapacity: {
      type: Number,
      default: 0
    },
    amenities: {
      type: [String],
      default: ['EV Charging', 'CCTV 24/7', 'Covered Parking', 'Disabled Access', 'Automated Barrier']
    },
    image: {
      type: String,
      default: '/assets/parking-campus.jpg'
    },
    coordinates: {
      lat: { type: Number, default: 28.5355 },
      lng: { type: Number, default: 77.3910 }
    },
    operatingHours: {
      type: String,
      default: '24/7'
    },
    baseRates: {
      car: { type: Number, default: 40 },
      bike: { type: Number, default: 20 },
      ev: { type: Number, default: 50 },
      vip: { type: Number, default: 70 },
      accessible: { type: Number, default: 30 }
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

module.exports = mongoose.model('ParkingLocation', parkingLocationSchema);
