const { signToken } = require('../config/jwt');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const RewardTransaction = require('../models/RewardTransaction');

const generateToken = (id) => {
  return signToken({ id });
};

// @desc    Register a new user (Public endpoint ALWAYS assigns role USER)
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Please provide all required fields (name, email, phone, password)'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        errorCode: 'WEAK_PASSWORD',
        message: 'Password must be at least 6 characters long'
      });
    }

    const emailRegex = /^\S+@\S+\.\S+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_EMAIL',
        message: 'Please provide a valid email address'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errorCode: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists'
      });
    }

    // CRITICAL SECURITY ENFORCEMENT:
    // Public registrations are ALWAYS assigned the 'USER' role.
    // Client-supplied roles (e.g. role: 'ADMIN') are strictly rejected/ignored.
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role: 'USER',
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

// @desc    Admin-only staff creation (provision GATEKEEPER or ADMIN accounts)
// @route   POST /api/auth/staff
// @access  Private (ADMIN only)
exports.createStaffAccount = async (req, res, next) => {
  try {
    const { name, email, phone, password, role } = req.body;

    if (!name || !email || !phone || !password || !role) {
      return res.status(400).json({
        success: false,
        errorCode: 'VALIDATION_ERROR',
        message: 'Please provide name, email, phone, password, and role'
      });
    }

    if (!['ADMIN', 'GATEKEEPER'].includes(role)) {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_ROLE',
        message: 'Staff role must be either ADMIN or GATEKEEPER'
      });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        errorCode: 'EMAIL_EXISTS',
        message: 'An account with this email already exists'
      });
    }

    const staff = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: phone.trim(),
      password,
      role
    });

    res.status(201).json({
      success: true,
      message: `Staff account (${role}) created successfully`,
      user: {
        id: staff._id,
        name: staff.name,
        email: staff.email,
        phone: staff.phone,
        role: staff.role
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
        errorCode: 'CREDENTIALS_MISSING',
        message: 'Please provide email and password'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        errorCode: 'INVALID_CREDENTIALS',
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

    if (name) user.name = name.trim();
    if (phone) user.phone = phone.trim();

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
        errorCode: 'VEHICLE_DATA_MISSING',
        message: 'Vehicle number and vehicle type are required'
      });
    }

    const cleanNumber = vehicleNumber.toUpperCase().replace(/\s+/g, '');

    // If marked primary, unset other primaries
    if (isPrimary) {
      await Vehicle.updateMany({ userId: req.user.id }, { isPrimary: false });
    }

    const vehicle = await Vehicle.create({
      userId: req.user.id,
      vehicleNumber: cleanNumber,
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

// @desc    Delete vehicle (with ownership check)
// @route   DELETE /api/auth/vehicles/:id
// @access  Private
exports.deleteVehicle = async (req, res, next) => {
  try {
    const vehicle = await Vehicle.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!vehicle) {
      return res.status(404).json({ success: false, errorCode: 'NOT_FOUND', message: 'Vehicle not found or not owned by you' });
    }
    res.status(200).json({ success: true, message: 'Vehicle removed successfully' });
  } catch (err) {
    next(err);
  }
};
