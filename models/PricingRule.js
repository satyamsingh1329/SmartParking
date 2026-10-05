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
        maxHours: { type: Number, default: 2 },
        flatRate: { type: Number, default: 80 }
      },
      {
        maxHours: { type: Number, default: 5 },
        hourlyRate: { type: Number, default: 40 }
      },
      {
        maxHours: { type: Number, default: 24 },
        hourlyRate: { type: Number, default: 35 }
      }
    ],
    surgeThreshold: {
      type: Number,
      default: 80 // occupancy percent triggering surge
    },
    surgeMultiplier: {
      type: Number,
      default: 1.25 // 1.25x
    },
    evSurcharge: {
      type: Number,
      default: 30 // ₹30 flat surcharge
    },
    convenienceFee: {
      type: Number,
      default: 10
    },
    taxPercent: {
      type: Number,
      default: 18 // 18% GST
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('PricingRule', pricingRuleSchema);
