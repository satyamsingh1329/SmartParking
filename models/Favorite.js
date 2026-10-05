const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ParkingLocation',
      required: true
    }
  },
  {
    timestamps: true
  }
);

favoriteSchema.index({ userId: 1, locationId: 1 }, { unique: true });

module.exports = mongoose.model('Favorite', favoriteSchema);
