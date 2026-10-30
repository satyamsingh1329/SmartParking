const express = require('express');
const router = express.Router();
const { getAvailabilityForecast, getWeatherImpact } = require('../controllers/predictionController');

router.get('/availability', getAvailabilityForecast);
router.get('/weather', getWeatherImpact);

module.exports = router;
