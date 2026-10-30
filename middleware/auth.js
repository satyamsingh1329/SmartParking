const { verifyToken } = require('../config/jwt');
const User = require('../models/User');
const { authorize } = require('./roles');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      errorCode: 'AUTH_REQUIRED',
      message: 'Not authorized to access this route. Please log in.'
    });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        errorCode: 'USER_NOT_FOUND',
        message: 'The user belonging to this token no longer exists.'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      errorCode: 'INVALID_TOKEN',
      message: 'Invalid or expired token. Please log in again.'
    });
  }
};

// Optional auth: attaches req.user if token is present, but doesn't block if absent
const optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyToken(token);
      req.user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Ignore token failure in optional auth
    }
  }
  next();
};

module.exports = { protect, authorize, optionalAuth };
