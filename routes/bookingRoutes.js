const express = require('express');
const router = express.Router();
const {
  getQuote,
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  extendBooking,
  updateValetStatus
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

router.post('/quote', getQuote);
router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/:id', protect, getBookingById);
router.patch('/:id/cancel', protect, cancelBooking);
router.patch('/:id/extend', protect, extendBooking);
router.patch('/:id/valet', protect, updateValetStatus);

module.exports = router;
