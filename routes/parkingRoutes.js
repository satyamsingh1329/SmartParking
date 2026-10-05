const express = require('express');
const router = express.Router();
const {
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  deleteLocation
} = require('../controllers/parkingController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.get('/', getLocations);
router.get('/:id', getLocationById);
router.post('/', protect, authorize('ADMIN'), createLocation);
router.put('/:id', protect, authorize('ADMIN'), updateLocation);
router.delete('/:id', protect, authorize('ADMIN'), deleteLocation);

module.exports = router;
