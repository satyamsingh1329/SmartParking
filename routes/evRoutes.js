const express = require('express');
const router = express.Router();
const {
  getChargingStations,
  startChargingSession,
  stopChargingSession,
  createStation
} = require('../controllers/evController');
const { protect, authorize } = require('../middleware/auth');

router.get('/stations', getChargingStations);
router.post('/start', protect, startChargingSession);
router.post('/stop', protect, stopChargingSession);
router.post('/stations', protect, authorize('ADMIN'), createStation);

module.exports = router;
