const jwt = require('jsonwebtoken');

const getJWTSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[FATAL CONFIG ERROR] JWT_SECRET must be set in production environment!');
      process.exit(1);
    }
    return 'parkpulse_dev_fallback_secret_only_change_in_production_key_2026';
  }
  return secret;
};

const signToken = (payload, options = { expiresIn: '30d' }) => {
  return jwt.sign(payload, getJWTSecret(), options);
};

const verifyToken = (token) => {
  return jwt.verify(token, getJWTSecret());
};

module.exports = { getJWTSecret, signToken, verifyToken };
