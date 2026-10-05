const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'completed'
    },
    method: {
      type: String,
      enum: ['mock_card', 'mock_upi', 'mock_wallet', 'reward_points'],
      default: 'mock_card'
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

paymentSchema.index({ userId: 1 });
paymentSchema.index({ bookingId: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
