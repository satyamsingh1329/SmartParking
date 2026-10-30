const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    vehicleNumber: {
      type: String,
      required: [true, 'Vehicle number is required'],
      trim: true,
      uppercase: true,
      index: true
    },
    registrationNumber: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    vehicleType: {
      type: String,
      enum: ['car', 'bike', 'ev', 'truck'],
      default: 'car',
      required: true
    },
    make: {
      type: String,
      trim: true,
      default: ''
    },
    model: {
      type: String,
      trim: true,
      default: ''
    },
    color: {
      type: String,
      trim: true,
      default: ''
    },
    isEV: {
      type: Boolean,
      default: false
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

vehicleSchema.pre('save', function (next) {
  if (!this.registrationNumber && this.vehicleNumber) {
    this.registrationNumber = this.vehicleNumber;
  }
  if (!this.vehicleNumber && this.registrationNumber) {
    this.vehicleNumber = this.registrationNumber;
  }
  if (this.vehicleType === 'ev') {
    this.isEV = true;
  }
  next();
});

vehicleSchema.index({ userId: 1, vehicleNumber: 1 }, { unique: true });
vehicleSchema.index({ userId: 1, isPrimary: 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
