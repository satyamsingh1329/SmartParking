const express = require('express');
const router = express.Router();
const { handleSensorEvent } = require('../controllers/sensorController');

// Public or API-key secured IoT sensor event webhook
router.post('/event', handleSensorEvent);

module.exports = router;
