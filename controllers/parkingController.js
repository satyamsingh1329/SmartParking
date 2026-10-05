const ParkingLocation = require('../models/ParkingLocation');
const ParkingSlot = require('../models/ParkingSlot');
const PricingRule = require('../models/PricingRule');

// @desc    Get all parking locations with live occupancy metrics
// @route   GET /api/parking
// @access  Public
exports.getLocations = async (req, res, next) => {
  try {
    const locations = await ParkingLocation.find({ isActive: true }).lean();

    // Enrich each location with live statistics from MongoDB
    const enrichedLocations = await Promise.all(
      locations.map(async (loc) => {
        const total = await ParkingSlot.countDocuments({ locationId: loc._id, isActive: true });
        const available = await ParkingSlot.countDocuments({ locationId: loc._id, isActive: true, status: 'available' });
        const occupied = await ParkingSlot.countDocuments({ locationId: loc._id, isActive: true, status: 'occupied' });
        const reserved = await ParkingSlot.countDocuments({ locationId: loc._id, isActive: true, status: 'reserved' });
        const occupancyRate = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;

        let congestion = 'LOW';
        if (occupancyRate > 80) congestion = 'HIGH';
        else if (occupancyRate > 50) congestion = 'MODERATE';

        return {
          ...loc,
          stats: {
            total,
            available,
            occupied,
            reserved,
            occupancyRate,
            congestion
          }
        };
      })
    );

    res.status(200).json({
      success: true,
      count: enrichedLocations.length,
      data: enrichedLocations
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get single parking location
// @route   GET /api/parking/:id
// @access  Public
exports.getLocationById = async (req, res, next) => {
  try {
    const location = await ParkingLocation.findById(req.params.id);
    if (!location) {
      return res.status(404).json({ success: false, message: 'Parking facility not found' });
    }

    const pricingRule = await PricingRule.findOne({ locationId: location._id });

    const total = await ParkingSlot.countDocuments({ locationId: location._id, isActive: true });
    const available = await ParkingSlot.countDocuments({ locationId: location._id, isActive: true, status: 'available' });
    const occupied = await ParkingSlot.countDocuments({ locationId: location._id, isActive: true, status: 'occupied' });
    const reserved = await ParkingSlot.countDocuments({ locationId: location._id, isActive: true, status: 'reserved' });
    const occupancyRate = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;

    let congestion = 'LOW';
    if (occupancyRate > 80) congestion = 'HIGH';
    else if (occupancyRate > 50) congestion = 'MODERATE';

    res.status(200).json({
      success: true,
      data: {
        ...location.toObject(),
        pricingRule,
        stats: {
          total,
          available,
          occupied,
          reserved,
          occupancyRate,
          congestion
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Create parking location
// @route   POST /api/parking
// @access  Private (Admin)
exports.createLocation = async (req, res, next) => {
  try {
    const location = await ParkingLocation.create(req.body);
    // Create default pricing rule for this location
    await PricingRule.create({
      locationId: location._id,
      baseRates: location.baseRates
    });

    res.status(201).json({
      success: true,
      data: location
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update parking location
// @route   PUT /api/parking/:id
// @access  Private (Admin)
exports.updateLocation = async (req, res, next) => {
  try {
    const location = await ParkingLocation.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Parking location not found' });
    }
    res.status(200).json({ success: true, data: location });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete parking location
// @route   DELETE /api/parking/:id
// @access  Private (Admin)
exports.deleteLocation = async (req, res, next) => {
  try {
    const location = await ParkingLocation.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!location) {
      return res.status(404).json({ success: false, message: 'Parking location not found' });
    }
    res.status(200).json({ success: true, message: 'Location deactivated successfully' });
  } catch (err) {
    next(err);
  }
};
