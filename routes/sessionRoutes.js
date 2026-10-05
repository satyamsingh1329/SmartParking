const express = require('express');
const router = express.Router();
const {
  checkIn,
  checkOut,
  getActiveSessions,
  verifyBooking
} = require('../controllers/sessionController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/verify/:bookingId', protect, authorize('GATEKEEPER', 'ADMIN'), verifyBooking);
router.post('/check-in', protect, checkIn);
router.patch('/:id/check-out', protect, checkOut);
router.get('/active', protect, authorize('GATEKEEPER', 'ADMIN'), getActiveSessions);

module.exports = router;
