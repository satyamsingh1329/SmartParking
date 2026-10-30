const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');

class RecommendationService {
  /**
   * Recommend best slot based on multi-factor weighted scoring.
   * STRICT FILTER: Only available slots are candidates. Occupied/Reserved slots are NEVER recommended.
   * @param {Object} params - { locationId, floor, vehicleType, requiresEV, requiresAccessible, requiresVIP, maxPrice }
   */
  async recommendBestSlot({
    locationId,
    floor,
    vehicleType = 'car',
    requiresEV = false,
    requiresAccessible = false,
    requiresVIP = false,
    maxPrice
  }) {
    // 1. STRICT CANDIDATE FILTER: Only truly AVAILABLE and active slots
    const candidateQuery = {
      isActive: true,
      status: 'available'
    };

    if (locationId) candidateQuery.locationId = locationId;
    if (floor) candidateQuery.floor = parseInt(floor);
    if (maxPrice) candidateQuery.pricePerHour = { $lte: parseFloat(maxPrice) };

    const candidateSlots = await ParkingSlot.find(candidateQuery).populate('locationId');
    if (!candidateSlots || candidateSlots.length === 0) {
      return null;
    }

    // 2. Fetch overall facility stats to calculate zone congestion
    const facilityQuery = { isActive: true };
    if (locationId) facilityQuery.locationId = locationId;
    const allFacilitySlots = await ParkingSlot.find(facilityQuery);
    const totalCount = allFacilitySlots.length;
    const busyCount = allFacilitySlots.filter(s => s.status !== 'available').length;
    const overallCongestionRatio = totalCount > 0 ? busyCount / totalCount : 0;

    // Normalize distances
    const distances = candidateSlots.map(s => s.distanceFromEntrance || 30);
    const minDistance = Math.min(...distances, 5);
    const maxDistance = Math.max(...distances, 120);

    // Normalize prices
    const prices = candidateSlots.map(s => s.pricePerHour || 40);
    const minPrice = Math.min(...prices, 20);
    const maxPriceVal = Math.max(...prices, 100);

    // 3. Multi-Factor Scoring
    const scoredSlots = candidateSlots.map(slot => {
      // 1. Walking / Entrance Distance Score (30%) - closer = higher score
      const dist = slot.distanceFromEntrance || 30;
      const distanceScore = maxDistance === minDistance
        ? 100
        : Math.round(((maxDistance - dist) / (maxDistance - minDistance)) * 100);

      // 2. Vehicle Compatibility (20%)
      let vehicleScore = 60;
      if (requiresEV && (slot.type === 'ev' || slot.vehicleType === 'ev')) {
        vehicleScore = 100;
      } else if (!requiresEV && slot.vehicleType === vehicleType) {
        vehicleScore = 100;
      } else if (slot.vehicleType === 'car' && vehicleType === 'car') {
        vehicleScore = 100;
      } else if (slot.vehicleType === 'bike' && vehicleType === 'bike') {
        vehicleScore = 100;
      } else {
        vehicleScore = 20;
      }

      // 3. Price Attractiveness Score (15%) - lower price = higher score
      const pr = slot.pricePerHour || 40;
      const priceScore = maxPriceVal === minPrice
        ? 100
        : Math.round(((maxPriceVal - pr) / (maxPriceVal - minPrice)) * 100);

      // 4. Zone Congestion Score (15%)
      const zoneSlots = allFacilitySlots.filter(s => s.zone === slot.zone && s.floor === slot.floor);
      const zoneBusy = zoneSlots.filter(s => s.status !== 'available').length;
      const zoneCongestionRatio = zoneSlots.length > 0 ? zoneBusy / zoneSlots.length : overallCongestionRatio;
      const congestionScore = Math.max(0, Math.round((1 - zoneCongestionRatio) * 100));

      // 5. Floor Accessibility / Ground Floor Convenience (10%)
      // Floor 1 is faster to access and exit
      const floorScore = slot.floor === 1 ? 100 : (slot.floor === 2 ? 80 : 65);

      // 6. Slot Special Category Preference (10%)
      let preferenceScore = 75;
      if (requiresAccessible && slot.type === 'accessible') preferenceScore = 100;
      if (requiresVIP && slot.type === 'vip') preferenceScore = 100;
      if (!requiresAccessible && !requiresVIP && slot.type === 'standard') preferenceScore = 90;

      // Weighted Total
      const totalScore = Math.round(
        distanceScore * 0.30 +
        vehicleScore * 0.20 +
        priceScore * 0.15 +
        congestionScore * 0.15 +
        floorScore * 0.10 +
        preferenceScore * 0.10
      );

      // Explainable AI / Intelligent matching reasons
      const reasons = [];
      reasons.push('✓ Available now');
      if (dist <= 30) reasons.push(`✓ ${dist}m walking distance to entrance`);
      else reasons.push(`✓ ${dist}m from entry gate`);

      if (requiresEV && (slot.type === 'ev' || slot.vehicleType === 'ev')) {
        reasons.push('✓ Dedicated high-speed EV charging');
      }
      if (requiresAccessible && slot.type === 'accessible') {
        reasons.push('✓ Priority accessible ramp positioning');
      }
      if (requiresVIP && slot.type === 'vip') {
        reasons.push('✓ Premium VIP designated bay');
      }
      if (zoneCongestionRatio < 0.5) {
        reasons.push('✓ Low zone congestion & smooth lane exit');
      }
      if (pr <= minPrice + 10) {
        reasons.push('✓ Economical rate tier');
      }
      if (slot.floor === 1) {
        reasons.push('✓ Ground level quick exit');
      }

      return {
        slot,
        matchScore: Math.min(99, Math.max(70, totalScore)),
        distance: dist,
        pricePerHour: pr,
        reasons,
        summaryReason: reasons.slice(0, 3).join(' • ')
      };
    });

    // Sort by match score descending
    scoredSlots.sort((a, b) => b.matchScore - a.matchScore);
    const best = scoredSlots[0];

    return {
      bestSlot: best.slot,
      matchScore: best.matchScore,
      distanceFromEntrance: best.distance,
      pricePerHour: best.pricePerHour,
      reasonsList: best.reasons,
      whyRecommended: best.summaryReason,
      totalCandidatesEvaluated: scoredSlots.length
    };
  }
}

module.exports = new RecommendationService();
