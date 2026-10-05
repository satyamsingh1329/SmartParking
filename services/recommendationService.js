const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');

class RecommendationService {
  /**
   * Recommend best slot based on multi-factor weighted scoring
   * @param {Object} params - { locationId, floor, vehicleType, requiresEV, requiresAccessible, requiresVIP }
   */
  async recommendBestSlot({
    locationId,
    floor,
    vehicleType = 'car',
    requiresEV = false,
    requiresAccessible = false,
    requiresVIP = false
  }) {
    const query = { isActive: true };
    if (locationId) query.locationId = locationId;
    if (floor) query.floor = parseInt(floor);

    // Fetch all candidate slots
    const slots = await ParkingSlot.find(query).populate('locationId');
    if (!slots || slots.length === 0) {
      return null;
    }

    // Calculate overall facility occupancy for congestion factor
    const totalSlots = slots.length;
    const occupiedCount = slots.filter(s => s.status !== 'available').length;
    const congestionRatio = totalSlots > 0 ? occupiedCount / totalSlots : 0;
    const congestionScoreBase = Math.max(0, 100 - congestionRatio * 100);

    // Normalize distances
    const distances = slots.map(s => s.distanceFromEntrance || 30);
    const minDistance = Math.min(...distances, 5);
    const maxDistance = Math.max(...distances, 100);

    // Normalize prices
    const prices = slots.map(s => s.pricePerHour || 40);
    const minPrice = Math.min(...prices, 20);
    const maxPrice = Math.max(...prices, 100);

    // Weights:
    // Distance: 30%
    // Vehicle compatibility: 20%
    // Availability: 20%
    // Price: 15%
    // Congestion: 10%
    // Slot preference: 5%

    const scoredSlots = slots.map(slot => {
      // 1. Availability score (0 or 100)
      let availabilityScore = slot.status === 'available' ? 100 : 0;

      // 2. Distance score (closer = higher)
      const dist = slot.distanceFromEntrance || 30;
      const distanceScore = maxDistance === minDistance
        ? 100
        : Math.round(((maxDistance - dist) / (maxDistance - minDistance)) * 100);

      // 3. Vehicle compatibility score
      let vehicleScore = 50;
      if (requiresEV && (slot.type === 'ev' || slot.vehicleType === 'ev')) {
        vehicleScore = 100;
      } else if (!requiresEV && slot.vehicleType === vehicleType) {
        vehicleScore = 100;
      } else if (slot.vehicleType === 'car' && vehicleType === 'car') {
        vehicleScore = 100;
      } else {
        vehicleScore = 30;
      }

      // 4. Price score (lower price = higher score)
      const pr = slot.pricePerHour || 40;
      const priceScore = maxPrice === minPrice
        ? 100
        : Math.round(((maxPrice - pr) / (maxPrice - minPrice)) * 100);

      // 5. Congestion score
      const congestionScore = Math.round(congestionScoreBase);

      // 6. Slot preference score
      let preferenceScore = 70;
      if (requiresAccessible && slot.type === 'accessible') preferenceScore = 100;
      if (requiresVIP && slot.type === 'vip') preferenceScore = 100;
      if (!requiresAccessible && !requiresVIP && slot.type === 'standard') preferenceScore = 90;

      // Weighted Total
      const totalScore = Math.round(
        distanceScore * 0.30 +
        vehicleScore * 0.20 +
        availabilityScore * 0.20 +
        priceScore * 0.15 +
        congestionScore * 0.10 +
        preferenceScore * 0.05
      );

      // Build human-readable reason
      const reasons = [];
      if (dist <= 30) reasons.push('Closest to entrance');
      if (slot.status === 'available') reasons.push('Instant availability');
      if (requiresEV && slot.type === 'ev') reasons.push('Dedicated high-speed EV charging');
      if (requiresAccessible && slot.type === 'accessible') reasons.push('Accessible priority location');
      if (congestionRatio < 0.5) reasons.push('Low zone congestion');
      if (reasons.length === 0) reasons.push('Optimal balance of distance and pricing');

      return {
        slot,
        matchScore: totalScore,
        distance: dist,
        pricePerHour: pr,
        reason: reasons.join(' • ')
      };
    });

    // Sort by match score descending (available slots prioritized)
    scoredSlots.sort((a, b) => {
      // Prioritize available slots first
      if (a.slot.status === 'available' && b.slot.status !== 'available') return -1;
      if (a.slot.status !== 'available' && b.slot.status === 'available') return 1;
      return b.matchScore - a.matchScore;
    });

    const best = scoredSlots[0];
    return {
      bestSlot: best.slot,
      matchScore: best.matchScore,
      distanceFromEntrance: best.distance,
      pricePerHour: best.pricePerHour,
      whyRecommended: best.reason,
      totalEvaluated: scoredSlots.length
    };
  }
}

module.exports = new RecommendationService();
