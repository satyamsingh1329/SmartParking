const PricingRule = require('../models/PricingRule');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');

class PricingService {
  /**
   * Calculate live quote for a booking strictly from database configuration
   * @param {Object} params - { locationId, slotId, vehicleType, durationHours, slotType, startTime }
   */
  async calculateQuote({ locationId, slotId, vehicleType = 'car', durationHours = 2, slotType, startTime = new Date() }) {
    durationHours = parseFloat(durationHours) || 1;
    if (durationHours <= 0) durationHours = 1;

    // 1. Fetch Location & PricingRule from Database
    let location = null;
    let pricingRule = null;

    if (locationId) {
      pricingRule = await PricingRule.findOne({ locationId });
      location = await ParkingLocation.findById(locationId);
    } else if (slotId) {
      const slot = await ParkingSlot.findById(slotId);
      if (slot) {
        locationId = slot.locationId;
        pricingRule = await PricingRule.findOne({ locationId });
        location = await ParkingLocation.findById(locationId);
      }
    }

    // Default fallback rates only if DB record hasn't been created yet
    const baseRates = pricingRule?.baseRates || location?.baseRates || {
      car: 40,
      bike: 20,
      ev: 50,
      vip: 70,
      accessible: 30
    };

    // 2. Determine base hourly rate for vehicle & bay category
    let hourlyRate = baseRates[vehicleType] !== undefined ? baseRates[vehicleType] : 40;
    if (slotType === 'ev' || vehicleType === 'ev') {
      hourlyRate = Math.max(hourlyRate, baseRates.ev || 50);
    } else if (slotType === 'vip') {
      hourlyRate = Math.max(hourlyRate, baseRates.vip || 70);
    } else if (slotType === 'accessible') {
      hourlyRate = Math.min(hourlyRate, baseRates.accessible || 30);
    }

    // 3. Dynamic Duration Tier Calculation from DB PricingRule
    let baseAmount = 0;
    const tiers = pricingRule?.durationTiers && pricingRule.durationTiers.length > 0
      ? [...pricingRule.durationTiers].sort((a, b) => a.maxHours - b.maxHours)
      : [];

    if (tiers.length > 0) {
      let remaining = durationHours;
      let prevMax = 0;

      for (let i = 0; i < tiers.length; i++) {
        const tier = tiers[i];
        const span = tier.maxHours - prevMax;
        if (remaining <= 0) break;

        const hoursInSpan = Math.min(remaining, span);

        // If tier specifies a flatRate and commuter duration fits within initial flat bracket
        if (tier.flatRate !== undefined && prevMax === 0 && durationHours <= tier.maxHours) {
          baseAmount += tier.flatRate;
          remaining -= hoursInSpan;
        } else {
          const rateForTier = tier.hourlyRate !== undefined ? tier.hourlyRate : hourlyRate;
          baseAmount += rateForTier * hoursInSpan;
          remaining -= hoursInSpan;
        }
        prevMax = tier.maxHours;
      }

      // Any excess duration beyond the highest configured tier
      if (remaining > 0) {
        const lastTier = tiers[tiers.length - 1];
        const topRate = lastTier.hourlyRate !== undefined ? lastTier.hourlyRate : hourlyRate;
        baseAmount += remaining * topRate;
      }
    } else {
      baseAmount = Math.round(hourlyRate * durationHours);
    }

    // 4. Weekend / Peak Multiplier check based on startTime
    const bookingDate = new Date(startTime);
    const dayOfWeek = bookingDate.getDay(); // 0 is Sunday, 6 is Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    let weekendMultiplier = 1.0;
    if (isWeekend && pricingRule?.weekendMultiplier && pricingRule.weekendMultiplier > 1.0) {
      weekendMultiplier = pricingRule.weekendMultiplier;
      baseAmount = Math.round(baseAmount * weekendMultiplier);
    }

    // 5. Live Occupancy & Demand Surge Calculation from Database
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

      const threshold = pricingRule?.surgeThreshold !== undefined ? pricingRule.surgeThreshold : 80;
      if (occupancyPercent >= threshold) {
        isSurge = true;
        surgeMultiplier = pricingRule?.surgeMultiplier !== undefined ? pricingRule.surgeMultiplier : 1.25;
        surgeAmount = Math.round(baseAmount * (surgeMultiplier - 1));
      }
    }

    // 6. EV Charging Surcharge from DB
    let evSurcharge = 0;
    if (vehicleType === 'ev' || slotType === 'ev') {
      evSurcharge = pricingRule?.evSurcharge !== undefined ? pricingRule.evSurcharge : 30;
    }

    // 7. Convenience Fee & GST from DB
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
      isWeekend,
      weekendMultiplier,
      isSurge,
      surgeMultiplier,
      surgeAmount,
      evSurcharge,
      convenienceFee,
      taxPercent,
      tax,
      totalAmount,
      occupancyPercent,
      gracePeriodMinutes: pricingRule?.gracePeriodMinutes || 15,
      overstayHourlyRate: pricingRule?.overstayHourlyRate || 50
    };
  }
}

module.exports = new PricingService();
