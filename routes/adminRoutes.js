const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAnalytics,
  getAllBookings,
  getAllUsers
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/bookings', getAllBookings);
router.get('/users', getAllUsers);

module.exports = router;
