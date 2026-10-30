const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAnalytics,
  getAllBookings,
  getAllUsers,
  getBIAnalytics,
  getDataQualityReport,
  exportCSV,
  getAnalyticsOverview,
  getDataDistributionAndOutliers,
  getSQLExperiments,
  exportFilteredBookingsCSV,
  downloadSyllabusFile
} = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/roles');

router.use(protect);
router.use(authorize('ADMIN'));

router.get('/dashboard', getDashboardStats);
router.get('/analytics', getAnalytics);
router.get('/analytics/bi', getBIAnalytics);
router.get('/analytics/quality', getDataQualityReport);
router.get('/analytics/overview', getAnalyticsOverview);
router.get('/analytics/distribution', getDataDistributionAndOutliers);
router.get('/analytics/sql/experiments', getSQLExperiments);
router.get('/analytics/export/csv/filtered', exportFilteredBookingsCSV);
router.get('/analytics/download/:fileKey', downloadSyllabusFile);
router.get('/analytics/export/csv/:entity', exportCSV);
router.get('/bookings', getAllBookings);
router.get('/users', getAllUsers);

module.exports = router;
