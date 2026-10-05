const Favorite = require('../models/Favorite');

// @desc    Get user favorite locations
// @route   GET /api/favorites
// @access  Private
exports.getFavorites = async (req, res, next) => {
  try {
    const favorites = await Favorite.find({ userId: req.user.id })
      .populate('locationId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: favorites
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Toggle favorite location
// @route   POST /api/favorites
// @access  Private
exports.toggleFavorite = async (req, res, next) => {
  try {
    const { locationId } = req.body;
    if (!locationId) {
      return res.status(400).json({ success: false, message: 'locationId is required' });
    }

    const existing = await Favorite.findOne({ userId: req.user.id, locationId });
    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      return res.status(200).json({
        success: true,
        isFavorited: false,
        message: 'Removed from favorites'
      });
    } else {
      const fav = await Favorite.create({ userId: req.user.id, locationId });
      return res.status(201).json({
        success: true,
        isFavorited: true,
        message: 'Added to favorites',
        data: fav
      });
    }
  } catch (err) {
    next(err);
  }
};
