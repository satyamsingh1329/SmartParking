const PricingRule = require('../models/PricingRule');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');

class PricingService {
  /**
   * Calculate live quote for a booking
   * @param {Object} params - { locationId, slotId, vehicleType, durationHours, slotType }
   */
  async calculateQuote({ locationId, slotId, vehicleType = 'car', durationHours = 2, slotType }) {
    durationHours = parseFloat(durationHours) || 1;
    if (durationHours <= 0) durationHours = 1;

    // Fetch pricing rule or fallback to location defaults
    let pricingRule = null;
    if (locationId) {
      pricingRule = await PricingRule.findOne({ locationId });
    }

    let location = null;
    if (locationId) {
      location = await ParkingLocation.findById(locationId);
    }

    // Default base rates
    const baseRates = pricingRule?.baseRates || location?.baseRates || {
      car: 40,
      bike: 20,
      ev: 50,
      vip: 70,
      accessible: 30
    };

    // Determine hourly rate based on vehicle and slot type
    let hourlyRate = baseRates[vehicleType] || 40;
    if (slotType === 'ev' || vehicleType === 'ev') {
      hourlyRate = Math.max(hourlyRate, baseRates.ev || 50);
    } else if (slotType === 'vip') {
      hourlyRate = Math.max(hourlyRate, baseRates.vip || 70);
    } else if (slotType === 'accessible') {
      hourlyRate = Math.min(hourlyRate, baseRates.accessible || 30);
    }

    // Tiered duration calculation
    let baseAmount = 0;
    const durationTiers = pricingRule?.durationTiers || [
      { maxHours: 2, flatRate: hourlyRate * 2 },
      { maxHours: 5, hourlyRate: hourlyRate },
      { maxHours: 24, hourlyRate: Math.round(hourlyRate * 0.9) }
    ];

    if (durationHours <= 2) {
      baseAmount = Math.round(hourlyRate * durationHours);
    } else if (durationHours <= 5) {
      baseAmount = Math.round(hourlyRate * 2 + (durationHours - 2) * hourlyRate);
    } else {
      baseAmount = Math.round(hourlyRate * 2 + 3 * hourlyRate + (durationHours - 5) * (hourlyRate * 0.85));
    }

    // Live occupancy calculation for surge pricing
    let occupancyPercent = 0;
    let isSurge = false;
    let surgeMultiplier = 1.0;
    let surgeAmount = 0;

    if (locationId) {
      const totalSlots = await ParkingSlot.countDocuments({ locationId, isActive: true });
      const occupiedOrReserved = await ParkingSlot.countDocuments({
        locationId,
        isActive: true,
        status: { $in: ['occupied', 'reserved'] }
      });

      if (totalSlots > 0) {
        occupancyPercent = Math.round((occupiedOrReserved / totalSlots) * 100);
      }

      const threshold = pricingRule?.surgeThreshold || 80;
      if (occupancyPercent >= threshold) {
        isSurge = true;
        surgeMultiplier = pricingRule?.surgeMultiplier || 1.25;
        surgeAmount = Math.round(baseAmount * (surgeMultiplier - 1));
      }
    }

    // EV Charging surcharge
    let evSurcharge = 0;
    if (vehicleType === 'ev' || slotType === 'ev') {
      evSurcharge = pricingRule?.evSurcharge || 30;
    }

    // Convenience fee & Tax
    const convenienceFee = pricingRule?.convenienceFee !== undefined ? pricingRule.convenienceFee : 10;
    const subtotal = baseAmount + surgeAmount + evSurcharge + convenienceFee;
    const taxPercent = pricingRule?.taxPercent !== undefined ? pricingRule.taxPercent : 18;
    const tax = Math.round(subtotal * (taxPercent / 100));
    const totalAmount = subtotal + tax;

    return {
      durationHours,
      vehicleType,
      slotType: slotType || 'standard',
      hourlyRate,
      baseAmount,
      isSurge,
      surgeMultiplier,
      surgeAmount,
      evSurcharge,
      convenienceFee,
      taxPercent,
      tax,
      totalAmount,
      occupancyPercent
    };
  }
}

module.exports = new PricingService();
