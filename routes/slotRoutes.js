const express = require('express');
const router = express.Router();
const { getSlots, getSlotById, recommendSlot, updateSlotStatus } = require('../controllers/slotController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', getSlots);
router.get('/recommend', recommendSlot);
router.get('/:id', getSlotById);
router.patch('/:id/status', protect, authorize('ADMIN', 'GATEKEEPER'), updateSlotStatus);

module.exports = router;
