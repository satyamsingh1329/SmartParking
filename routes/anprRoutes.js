const express = require('express');
const router = express.Router();
const { scanPlate, simulateANPR } = require('../controllers/anprController');
const { protect, authorize } = require('../middleware/auth');

// Protected Gate camera optical feed
router.post('/scan', protect, authorize('ADMIN', 'GATEKEEPER'), scanPlate);

// Interactive demonstrator endpoint
router.post('/simulate', simulateANPR);

module.exports = router;
