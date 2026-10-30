const express = require('express');
const router = express.Router();
const { handleSensorEvent, handleHeartbeat, getAllSensors } = require('../controllers/sensorController');
const sensorAuth = require('../middleware/sensorAuth');
const { protect, authorize } = require('../middleware/auth');

// Protected IoT Sensor Webhook (Requires X-Sensor-Key or Admin/Gatekeeper JWT)
router.post('/event', sensorAuth, handleSensorEvent);

// Sensor Heartbeat Telemetry (Requires X-Sensor-Key or Admin/Gatekeeper JWT)
router.post('/heartbeat', sensorAuth, handleHeartbeat);

// Get All Registered Sensors & Live Health Telemetry (Admin / Gatekeeper)
router.get('/', protect, authorize('ADMIN', 'GATEKEEPER'), getAllSensors);

module.exports = router;
