const mongoose = require('mongoose');

const rewardTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    points: {
      type: Number,
      required: true
    },
    type: {
      type: String,
      enum: ['earned', 'redeemed', 'bonus'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true
  }
);

rewardTransactionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('RewardTransaction', rewardTransactionSchema);
