const express = require('express');
const router = express.Router();
const {
  purchasePass,
  getMyPasses,
  validatePass,
  getAllPasses
} = require('../controllers/passController');
const { protect, authorize } = require('../middleware/auth');

router.post('/purchase', protect, purchasePass);
router.get('/my', protect, getMyPasses);
router.post('/validate', protect, authorize('ADMIN', 'GATEKEEPER'), validatePass);
router.get('/', protect, authorize('ADMIN'), getAllPasses);

module.exports = router;
