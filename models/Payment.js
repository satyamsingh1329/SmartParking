const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded', 'PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'],
      default: 'completed',
      index: true
    },
    method: {
      type: String,
      enum: ['mock_card', 'mock_upi', 'mock_wallet', 'reward_points', 'card', 'upi', 'netbanking'],
      default: 'mock_card'
    },
    isMockPayment: {
      type: Boolean,
      default: true
    },
    gatewayProvider: {
      type: String,
      default: 'MOCK_SANDBOX'
    },
    transactionDetails: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ bookingId: 1, status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
