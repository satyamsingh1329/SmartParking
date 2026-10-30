const mongoose = require('mongoose');
const crypto = require('crypto');

const sensorSchema = new mongoose.Schema(
  {
    sensorId: {
      type: String,
      required: [true, 'Sensor ID is required'],
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    apiKey: {
      type: String,
      required: true,
      select: false
    },
    slotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingSlot',
      required: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true
    },
    type: {
      type: String,
      enum: ['ultrasonic', 'magnetic', 'camera_anpr', 'infrared'],
      default: 'ultrasonic'
    },
    status: {
      type: String,
      enum: ['ONLINE', 'OFFLINE', 'WARNING', 'ERROR'],
      default: 'ONLINE'
    },
    batteryLevel: {
      type: Number,
      min: 0,
      max: 100,
      default: 95
    },
    signalStrength: {
      type: Number, // dBm or percentage
      default: -65
    },
    firmwareVersion: {
      type: String,
      default: 'v2.4.1'
    },
    lastHeartbeat: {
      type: Date,
      default: Date.now
    },
    lastEvent: {
      type: Date,
      default: null
    },
    lastEventType: {
      type: String,
      enum: ['entry', 'exit', 'heartbeat', null],
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

sensorSchema.index({ slotId: 1 });
sensorSchema.index({ locationId: 1, status: 1 });

// Helper to hash sensor key
sensorSchema.statics.hashKey = function (key) {
  return crypto.createHash('sha256').update(key).digest('hex');
};

sensorSchema.methods.verifyKey = function (providedKey) {
  const hashed = crypto.createHash('sha256').update(providedKey).digest('hex');
  return this.apiKey === hashed || this.apiKey === providedKey;
};

module.exports = mongoose.model('Sensor', sensorSchema);
