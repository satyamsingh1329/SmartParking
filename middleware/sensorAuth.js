const Sensor = require('../models/Sensor');
const { verifyToken } = require('../config/jwt');
const User = require('../models/User');

const sensorAuth = async (req, res, next) => {
  const sensorKey = req.headers['x-sensor-key'] || req.headers['x-api-key'] || req.query.apiKey;
  const authHeader = req.headers.authorization;

  // 1. Check if authenticated as ADMIN or GATEKEEPER via JWT (Operator console simulation)
  if (authHeader && authHeader.startsWith('Bearer')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.id);
      if (user && ['ADMIN', 'GATEKEEPER'].includes(user.role)) {
        req.user = user;
        req.authType = 'OPERATOR';
        return next();
      }
    } catch (e) {
      // Continue to check sensor key
    }
  }

  // 2. Hardware Sensor Authentication via X-Sensor-Key
  if (!sensorKey) {
    return res.status(401).json({
      success: false,
      errorCode: 'SENSOR_AUTH_REQUIRED',
      message: 'Unauthorized IoT Sensor event. Provide valid X-Sensor-Key header or Operator JWT.'
    });
  }

  try {
    const sensorId = req.body.sensorId || req.query.sensorId;
    let sensor;

    if (sensorId) {
      sensor = await Sensor.findOne({ sensorId: sensorId.toUpperCase(), isActive: true }).select('+apiKey');
    } else {
      // Find by matching hashed key
      const hashedKey = Sensor.hashKey(sensorKey);
      sensor = await Sensor.findOne({
        $or: [{ apiKey: hashedKey }, { apiKey: sensorKey }],
        isActive: true
      }).select('+apiKey');
    }

    if (!sensor || !sensor.verifyKey(sensorKey)) {
      return res.status(403).json({
        success: false,
        errorCode: 'INVALID_SENSOR_KEY',
        message: 'Forbidden. Invalid Sensor ID or API Key.'
      });
    }

    req.sensor = sensor;
    req.authType = 'SENSOR_HARDWARE';
    next();
  } catch (error) {
    console.error('[Sensor Auth Error]', error.message);
    return res.status(500).json({
      success: false,
      errorCode: 'SENSOR_AUTH_ERROR',
      message: 'Sensor authentication failed internally'
    });
  }
};

module.exports = sensorAuth;
