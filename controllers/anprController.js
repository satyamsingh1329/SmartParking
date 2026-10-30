const anprService = require('../services/anprService');

// @desc    Process camera ANPR plate scan
// @route   POST /api/anpr/scan
// @access  Private (GATEKEEPER, ADMIN)
exports.scanPlate = async (req, res, next) => {
  try {
    const { plateNumber, locationId, gateType, confidence } = req.body;

    if (!plateNumber) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'plateNumber is required'
      });
    }

    const result = await anprService.processScan({
      plateNumber,
      locationId,
      gateType: gateType ? gateType.toUpperCase() : 'ENTRY',
      confidence: confidence || 0.98
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

// @desc    ANPR optical simulation suite for demonstrator
// @route   POST /api/anpr/simulate
// @access  Public / Private (GATEKEEPER, ADMIN)
exports.simulateANPR = async (req, res, next) => {
  try {
    const { vehicleNumber, gateType, locationId } = req.body;
    const testPlate = vehicleNumber || 'MH12AB1234';

    const result = await anprService.processScan({
      plateNumber: testPlate,
      locationId,
      gateType: gateType || 'ENTRY',
      confidence: 0.99
    });

    res.status(200).json({
      success: true,
      simulation: true,
      demoModeNotice: 'ANPR simulated optical sensor pipeline with live Mongoose state synchronization',
      data: result
    });
  } catch (err) {
    next(err);
  }
};
