const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getMe,
  updateProfile,
  addVehicle,
  getVehicles,
  deleteVehicle,
  createStaffAccount
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// Admin-only staff provisioning
router.post('/staff', protect, authorize('ADMIN'), createStaffAccount);

router.post('/vehicles', protect, addVehicle);
router.get('/vehicles', protect, getVehicles);
router.delete('/vehicles/:id', protect, deleteVehicle);

module.exports = router;
