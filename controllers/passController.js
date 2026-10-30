const ParkingPass = require('../models/ParkingPass');
const ParkingLocation = require('../models/ParkingLocation');
const crypto = require('crypto');

// Standard pricing table for passes
const PASS_PRICING = {
  DAILY: { price: 150, days: 1 },
  WEEKLY: { price: 800, days: 7 },
  MONTHLY: { price: 2800, days: 30 },
  STUDENT: { price: 1200, days: 30 },
  EMPLOYEE: { price: 1800, days: 30 },
  VIP: { price: 5000, days: 30 }
};

// @desc    Purchase a parking pass
// @route   POST /api/passes/purchase
// @access  Private (USER)
exports.purchasePass = async (req, res, next) => {
  try {
    const { passType, vehicleNumber, vehicleType, locationId } = req.body;

    if (!passType || !vehicleNumber) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'passType and vehicleNumber are required'
      });
    }

    const typeConfig = PASS_PRICING[passType.toUpperCase()];
    if (!typeConfig) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_PASS_TYPE',
        message: `Invalid passType. Must be one of: ${Object.keys(PASS_PRICING).join(', ')}`
      });
    }

    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + typeConfig.days * 24 * 3600 * 1000);
    const passNumber = `PASS-${passType.toUpperCase()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

    let allowedLocations = [];
    if (locationId) {
      allowedLocations.push(locationId);
    } else {
      // All facilities
      const allLocs = await ParkingLocation.find({ isActive: true }).select('_id');
      allowedLocations = allLocs.map((l) => l._id);
    }

    const pass = await ParkingPass.create({
      passNumber,
      userId: req.user.id,
      passType: passType.toUpperCase(),
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      vehicleType: vehicleType || 'car',
      startDate,
      endDate,
      allowedLocations,
      pricePaid: typeConfig.price,
      paymentId: `PAY-PASS-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      status: 'ACTIVE',
      qrCodeData: JSON.stringify({ passNumber, vehicleNumber: vehicleNumber.toUpperCase(), endDate })
    });

    res.status(201).json({
      success: true,
      message: `${passType} pass purchased successfully! Valid until ${endDate.toDateString()}`,
      data: pass
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user's purchased passes
// @route   GET /api/passes/my
// @access  Private (USER)
exports.getMyPasses = async (req, res, next) => {
  try {
    const passes = await ParkingPass.find({ userId: req.user.id })
      .populate('allowedLocations', 'name address')
      .sort({ createdAt: -1 });

    const now = new Date();
    // Auto-update expired passes
    for (const p of passes) {
      if (p.status === 'ACTIVE' && p.endDate < now) {
        p.status = 'EXPIRED';
        await p.save();
      }
    }

    res.status(200).json({
      success: true,
      count: passes.length,
      data: passes
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Validate if a vehicle has an active parking pass (Gatekeeper / ANPR / Operator)
// @route   POST /api/passes/validate
// @access  Private (GATEKEEPER, ADMIN)
exports.validatePass = async (req, res, next) => {
  try {
    const { vehicleNumber, locationId } = req.body;

    if (!vehicleNumber) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'vehicleNumber is required'
      });
    }

    const now = new Date();
    const pass = await ParkingPass.findOne({
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      status: 'ACTIVE',
      startDate: { $lte: now },
      endDate: { $gte: now }
    }).populate('userId', 'name email phone');

    if (!pass) {
      return res.status(200).json({
        success: true,
        isValid: false,
        message: 'No active pass found for this vehicle. Standard parking fee applies.'
      });
    }

    // Check location permission if specified
    if (locationId && pass.allowedLocations.length > 0) {
      const isAllowed = pass.allowedLocations.some((l) => l.toString() === locationId.toString());
      if (!isAllowed) {
        return res.status(200).json({
          success: true,
          isValid: false,
          message: `Pass ${pass.passNumber} is not valid for this parking facility.`
        });
      }
    }

    // Update usage
    pass.usageCount += 1;
    pass.lastUsedAt = now;
    await pass.save();

    res.status(200).json({
      success: true,
      isValid: true,
      message: `Valid ${pass.passType} pass verified for ${pass.vehicleNumber}. Access granted.`,
      data: pass
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all passes across system (Admin)
// @route   GET /api/passes
// @access  Private (ADMIN)
exports.getAllPasses = async (req, res, next) => {
  try {
    const passes = await ParkingPass.find()
      .populate('userId', 'name email')
      .populate('allowedLocations', 'name')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: passes.length,
      data: passes
    });
  } catch (err) {
    next(err);
  }
};
