const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      trim: true,
      uppercase: true
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev'],
      default: 'car',
      required: true
    },
    model: {
      type: String,
      trim: true,
      default: ''
    },
    isPrimary: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

vehicleSchema.index({ userId: 1, vehicleNumber: 1 }, { unique: true });

module.exports = mongoose.model('Vehicle', vehicleSchema);
