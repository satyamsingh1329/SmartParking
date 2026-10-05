const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: [
        'booking_confirmed',
        'booking_cancelled',
        'slot_released',
        'slot_expired',
        'parking_started',
        'parking_completed',
        'overstay_alert',
        'high_congestion',
        'surge_pricing',
        'reward_earned'
      ],
      default: 'booking_confirmed'
    },
    isRead: {
      type: Boolean,
      default: false
    },
    metadata: {
      type: Object,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
