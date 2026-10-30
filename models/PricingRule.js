const mongoose = require('mongoose');

const pricingRuleSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true,
      unique: true
    },
    baseRates: {
      car: { type: Number, default: 40 },
      bike: { type: Number, default: 20 },
      ev: { type: Number, default: 50 },
      vip: { type: Number, default: 70 },
      accessible: { type: Number, default: 30 }
    },
    durationTiers: [
      {
        maxHours: { type: Number, required: true },
        flatRate: { type: Number },
        hourlyRate: { type: Number }
      }
    ],
    surgeThreshold: {
      type: Number,
      default: 80 // occupancy percent triggering surge (e.g. 80%)
    },
    surgeMultiplier: {
      type: Number,
      default: 1.25 // 1.25x
    },
    weekendMultiplier: {
      type: Number,
      default: 1.0 // 1.0 (standard) or e.g. 1.15
    },
    peakHourMultiplier: {
      type: Number,
      default: 1.0 // 1.0 or e.g. 1.20
    },
    evSurcharge: {
      type: Number,
      default: 30 // flat EV charge fee
    },
    convenienceFee: {
      type: Number,
      default: 10
    },
    taxPercent: {
      type: Number,
      default: 18 // 18% GST
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15 // check-in grace period
    },
    overstayHourlyRate: {
      type: Number,
      default: 50
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PricingRule', pricingRuleSchema);
