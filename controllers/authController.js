const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const RewardTransaction = require('../models/RewardTransaction');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'parkpulse_super_secret_jwt_key_2026_secured_production_token', {
    expiresIn: '30d'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (name, email, phone, password)'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Default to USER unless explicitly permitted admin creation
    const userRole = (role === 'ADMIN' || role === 'GATEKEEPER') ? role : 'USER';

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      phone,
      password,
      role: userRole,
      rewardPoints: 50 // 50 Welcome bonus points!
    });

    // Record welcome bonus transaction
    await RewardTransaction.create({
      userId: user._id,
      points: 50,
      type: 'bonus',
      description: 'Welcome bonus on sign up 🎉',
      balanceAfter: 50
    });

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rewardPoints: user.rewardPoints
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rewardPoints: user.rewardPoints
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const vehicles = await Vehicle.find({ userId: req.user.id });
    const rewardHistory = await RewardTransaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      user,
      vehicles,
      rewardHistory
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone } = req.body;
    const user = await User.findById(req.user.id);

    if (name) user.name = name;
    if (phone) user.phone = phone;

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        rewardPoints: user.rewardPoints
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Add vehicle to user account
// @route   POST /api/auth/vehicles
// @access  Private
exports.addVehicle = async (req, res, next) => {
  try {
    const { vehicleNumber, vehicleType, model, isPrimary } = req.body;

    if (!vehicleNumber || !vehicleType) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number and vehicle type are required'
      });
    }

    // If marked primary, unset other primaries
    if (isPrimary) {
      await Vehicle.updateMany({ userId: req.user.id }, { isPrimary: false });
    }

    const vehicle = await Vehicle.create({
      userId: req.user.id,
      vehicleNumber: vehicleNumber.toUpperCase().trim(),
      vehicleType,
      model: model || '',
      isPrimary: Boolean(isPrimary)
    });

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      vehicle
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get user vehicles
// @route   GET /api/auth/vehicles
// @access  Private
exports.getVehicles = async (req, res, next) => {
  try {
    const vehicles = await Vehicle.find({ userId: req.user.id }).sort({ isPrimary: -1, createdAt: -1 });
    res.status(200).json({
      success: true,
      vehicles
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete vehicle
// @route   DELETE /api/auth/vehicles/:id
// @access  Private
exports.deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }
    res.status(200).json({ success: true, message: 'Vehicle removed successfully' });
  } catch (err) {
    next(err);
  }
};
