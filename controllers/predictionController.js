const mlPredictionService = require('../services/mlPredictionService');
const weatherService = require('../services/weatherService');

// @desc    Get ML-based availability prediction & peak hour forecasts
// @route   GET /api/predictions/availability
// @access  Public / Authenticated
exports.getAvailabilityForecast = async (req, res, next) => {
  try {
    const { locationId } = req.query;
    const forecast = await mlPredictionService.predictAvailability(locationId);

    res.status(200).json({
      success: true,
      data: forecast
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get weather impact analysis on parking traffic
// @route   GET /api/predictions/weather
// @access  Public / Authenticated
exports.getWeatherImpact = async (req, res, next) => {
  try {
    const { city } = req.query;
    const weather = await weatherService.getCurrentWeather(city);

    res.status(200).json({
      success: true,
      data: weather
    });
  } catch (err) {
    next(err);
  }
};
