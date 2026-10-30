const mongoose = require('mongoose');
const ParkingSlot = require('../models/ParkingSlot');
const Booking = require('../models/Booking');
const User = require('../models/User');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSession = require('../models/ParkingSession');
const analyticsService = require('../services/analyticsService');

// @desc    Admin dashboard summary stats (100% Database Driven)
// @route   GET /api/admin/dashboard
// @access  Private (Admin)
exports.getDashboardStats = async (req, res, next) => {
  try {
    const kpis = await analyticsService.getBusinessKPIs();
    const totalUsers = await User.countDocuments();

    res.status(200).json({
      success: true,
      data: {
        totalCapacity: kpis.totalSlots,
        available: kpis.availableSlots,
        occupied: kpis.occupiedSlots,
        reserved: kpis.reservedSlots,
        maintenance: kpis.maintenanceSlots,
        outOfService: kpis.outOfServiceSlots,
        occupancyRate: kpis.occupancyRate,
        activeSessions: kpis.activeSessions,
        todayRevenue: kpis.todayRevenue,
        weekRevenue: kpis.weekRevenue,
        monthRevenue: kpis.monthRevenue,
        totalRevenue: kpis.totalRevenue,
        totalBookings: kpis.totalBookings,
        completedBookings: kpis.completedBookings,
        cancellationRate: kpis.cancellationRate,
        noShowRate: kpis.noShowRate,
        slotTurnover: kpis.slotTurnover,
        avgDurationMinutes: kpis.avgDurationMinutes,
        totalUsers
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Admin analytics charts data (100% Real Aggregation Pipeline)
// @route   GET /api/admin/analytics
// @access  Private (Admin)
exports.getAnalytics = async (req, res, next) => {
  try {
    // 1. Real Hourly Occupancy & Peak Hours Aggregation
    const hourlyData = await analyticsService.getHourlyOccupancy();

    // 2. Real Zone distribution from MongoDB
    const zones = ['A', 'B', 'C', 'D'];
    const zoneDistribution = await Promise.all(
      zones.map(async (zone) => {
        const total = await ParkingSlot.countDocuments({ zone, isActive: true });
        const occupied = await ParkingSlot.countDocuments({ zone, isActive: true, status: 'occupied' });
        return { zone: `Zone ${zone}`, total, occupied };
      })
    );

    // 3. Real Slot Type Usage from MongoDB
    const slotTypes = ['standard', 'ev', 'vip', 'accessible'];
    const typeDistribution = await Promise.all(
      slotTypes.map(async (type) => {
        const count = await ParkingSlot.countDocuments({ type, isActive: true });
        return { type: type.toUpperCase(), count };
      })
    );

    // 4. Real 7 Days Revenue Trend Aggregation
    const last7Days = await analyticsService.getDailyRevenue(7);

    // 5. KPIs
    const kpis = await analyticsService.getBusinessKPIs();

    res.status(200).json({
      success: true,
      data: {
        hourlyOccupancy: hourlyData.hourlyOccupancy,
        bestTimeToPark: hourlyData.bestTimeToPark,
        peakHourText: hourlyData.peakHourText,
        totalTrafficAnalyzed: hourlyData.totalTrafficAnalyzed,
        zoneDistribution,
        typeDistribution,
        last7Days,
        kpis: {
          slotTurnover: kpis.slotTurnover,
          avgDurationMinutes: kpis.avgDurationMinutes,
          cancellationRate: kpis.cancellationRate,
          noShowRate: kpis.noShowRate
        }
      }
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all bookings for admin with filters
// @route   GET /api/admin/bookings
// @access  Private (Admin)
exports.getAllBookings = async (req, res, next) => {
  try {
    const { status, limit = 100 } = req.query;
    const query = {};
    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('slotId', 'slotNumber floor zone type')
      .populate('userId', 'name email phone')
      .populate('locationId', 'name')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get all registered users
// @route   GET /api/admin/users
// @access  Private (Admin)
exports.getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Comprehensive Multi-Dimensional BI Analytics
// @route   GET /api/admin/analytics/bi
// @access  Private (Admin)
exports.getBIAnalytics = async (req, res, next) => {
  try {
    const { startDate, endDate, locationId, vehicleType } = req.query;
    const data = await analyticsService.getBIAnalytics({
      startDate,
      endDate,
      locationId,
      vehicleType
    });

    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Data Quality & Outliers Report
// @route   GET /api/admin/analytics/quality
// @access  Private (Admin)
exports.getDataQualityReport = async (req, res, next) => {
  try {
    const data = await analyticsService.getDataQualityReport();
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

// Helper to escape CSV values safely
const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// @desc    Export relational entities as clean CSV
// @route   GET /api/admin/analytics/export/csv/:entity
// @access  Private (Admin)
exports.exportCSV = async (req, res, next) => {
  try {
    const { entity } = req.params;
    let csv = '';
    let filename = `parkpulse_${entity}_export.csv`;

    switch (entity.toLowerCase()) {
      case 'customers':
      case 'users': {
        filename = 'parkpulse_customers.csv';
        const users = await User.find().select('-password').lean();
        const headers = ['user_id', 'name', 'email', 'phone', 'role', 'reward_points', 'created_at'];
        const rows = users.map(u => [
          u._id,
          u.name,
          u.email,
          u.phone,
          u.role,
          u.rewardPoints || 0,
          u.createdAt ? u.createdAt.toISOString() : ''
        ].map(escapeCSV).join(','));
        csv = [headers.join(','), ...rows].join('\n');
        break;
      }

      case 'bookings': {
        filename = 'parkpulse_bookings.csv';
        const bookings = await Booking.find().lean();
        const headers = [
          'booking_id', 'user_id', 'location_id', 'slot_id', 'vehicle_number', 'vehicle_type',
          'start_time', 'expected_end_time', 'duration_hours', 'base_amount', 'surge_multiplier',
          'surge_amount', 'convenience_fee', 'total_amount', 'status', 'payment_status',
          'check_in_time', 'check_out_time', 'created_at'
        ];
        const rows = bookings.map(b => [
          b.bookingId,
          b.userId,
          b.locationId,
          b.slotId,
          b.vehicleNumber,
          b.vehicleType,
          b.startTime ? b.startTime.toISOString() : '',
          b.expectedEndTime ? b.expectedEndTime.toISOString() : '',
          b.durationHours,
          b.baseAmount,
          b.surgeMultiplier || 1.0,
          b.surgeAmount || 0,
          b.convenienceFee || 0,
          b.totalAmount,
          b.status,
          b.paymentStatus,
          b.checkInTime ? b.checkInTime.toISOString() : '',
          b.checkOutTime ? b.checkOutTime.toISOString() : '',
          b.createdAt ? b.createdAt.toISOString() : ''
        ].map(escapeCSV).join(','));
        csv = [headers.join(','), ...rows].join('\n');
        break;
      }

      case 'locations':
      case 'parking_locations': {
        filename = 'parkpulse_parking_locations.csv';
        const locations = await ParkingLocation.find().lean();
        const headers = [
          'location_id', 'location_code', 'name', 'address', 'city', 'category',
          'total_floors', 'total_capacity', 'base_rate_car', 'base_rate_bike', 'base_rate_ev',
          'is_active', 'created_at'
        ];
        const rows = locations.map(l => [
          l._id,
          l.code || 'CAMPUS',
          l.name,
          l.address,
          l.city,
          l.category,
          l.totalFloors || 1,
          l.totalCapacity || 0,
          l.baseRates?.car || 40,
          l.baseRates?.bike || 20,
          l.baseRates?.ev || 50,
          l.isActive ? 'true' : 'false',
          l.createdAt ? l.createdAt.toISOString() : ''
        ].map(escapeCSV).join(','));
        csv = [headers.join(','), ...rows].join('\n');
        break;
      }

      case 'sessions':
      case 'parking_sessions': {
        filename = 'parkpulse_parking_sessions.csv';
        const sessions = await ParkingSession.find().lean();
        const headers = [
          'session_id', 'booking_id', 'slot_id', 'user_id', 'vehicle_number',
          'entry_time', 'exit_time', 'expected_exit_time', 'duration_minutes',
          'overstay_duration_minutes', 'overstay_fee', 'total_billed', 'status', 'created_at'
        ];
        const rows = sessions.map(s => {
          let durationMinutes = 0;
          if (s.exitTime && s.entryTime) {
            durationMinutes = Math.round((new Date(s.exitTime) - new Date(s.entryTime)) / 60000);
          }
          return [
            s._id,
            s.bookingId || '',
            s.slotId,
            s.userId || '',
            s.vehicleNumber,
            s.entryTime ? s.entryTime.toISOString() : '',
            s.exitTime ? s.exitTime.toISOString() : '',
            s.expectedExitTime ? s.expectedExitTime.toISOString() : '',
            durationMinutes,
            s.overstayDurationMinutes || 0,
            s.overstayFee || 0,
            s.totalBilled || 0,
            s.status,
            s.createdAt ? s.createdAt.toISOString() : ''
          ].map(escapeCSV).join(',');
        });
        csv = [headers.join(','), ...rows].join('\n');
        break;
      }

      default:
        return res.status(400).json({
          success: false,
          message: `Unknown export entity: ${entity}. Supported: customers, bookings, locations, sessions`
        });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

// @desc    Get Unit 1 Analytics Overview (Descriptive, Diagnostic, Predictive, Prescriptive)
// @route   GET /api/admin/analytics/overview
// @access  Private (Admin)
exports.getAnalyticsOverview = async (req, res, next) => {
  try {
    const { startDate, endDate, locationId, vehicleType } = req.query;
    const overview = await analyticsService.getAnalyticsOverview({
      startDate,
      endDate,
      locationId,
      vehicleType
    });
    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Unit 1 Data Distribution, Central Tendency & Tukey IQR Outliers
// @route   GET /api/admin/analytics/distribution
// @access  Private (Admin)
exports.getDataDistributionAndOutliers = async (req, res, next) => {
  try {
    const { metric = 'duration', locationId, vehicleType } = req.query;
    const data = await analyticsService.getDataDistributionAndOutliers({
      metric,
      locationId,
      vehicleType
    });
    res.status(200).json({
      success: true,
      data
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Get Unit 2 SQL Practical Laboratory Experiments & Reproducible Results
// @route   GET /api/admin/analytics/sql/experiments
// @access  Private (Admin)
exports.getSQLExperiments = async (req, res, next) => {
  try {
    const experiments = analyticsService.getSQLExperiments();
    res.status(200).json({
      success: true,
      count: experiments.length,
      data: experiments
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Export filtered bookings as CSV respecting active date/facility/vehicle filters
// @route   GET /api/admin/analytics/export/csv/filtered-bookings
// @access  Private (Admin)
exports.exportFilteredBookingsCSV = async (req, res, next) => {
  try {
    const { startDate, endDate, locationId, vehicleType } = req.query;
    const query = {};

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        const s = new Date(startDate);
        s.setHours(0, 0, 0, 0);
        query.createdAt.$gte = s;
      }
      if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999);
        query.createdAt.$lte = e;
      }
    }

    if (locationId && locationId !== 'all' && mongoose.Types.ObjectId.isValid(locationId)) {
      query.locationId = new mongoose.Types.ObjectId(locationId);
    }

    if (vehicleType && vehicleType !== 'all') {
      query.vehicleType = vehicleType.toLowerCase();
    }

    const bookings = await Booking.find(query)
      .populate('locationId', 'name code')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .lean();

    const headers = [
      'booking_id', 'customer_name', 'facility_name', 'vehicle_number', 'vehicle_type',
      'start_time', 'expected_end_time', 'duration_hours', 'base_amount', 'surge_multiplier',
      'surge_amount', 'convenience_fee', 'total_amount', 'status', 'payment_status', 'created_at'
    ];

    const rows = bookings.map((b) => [
      b.bookingId,
      b.userId?.name || 'Customer',
      b.locationId?.name || 'Campus Central',
      b.vehicleNumber,
      b.vehicleType,
      b.startTime ? b.startTime.toISOString() : '',
      b.expectedEndTime ? b.expectedEndTime.toISOString() : '',
      b.durationHours,
      b.baseAmount,
      b.surgeMultiplier || 1.0,
      b.surgeAmount || 0,
      b.convenienceFee || 0,
      b.totalAmount,
      b.status,
      b.paymentStatus,
      b.createdAt ? b.createdAt.toISOString() : ''
    ].map(escapeCSV).join(','));

    const csv = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="parkpulse_filtered_bookings.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    next(err);
  }
};

// @desc    Download Syllabus File (Excel workbook, SQL scripts, Oracle script, Tableau datasets)
// @route   GET /api/admin/analytics/download/:fileKey
// @access  Private (Admin)
exports.downloadSyllabusFile = async (req, res, next) => {
  try {
    const { fileKey } = req.params;
    const path = require('path');
    const fs = require('fs');

    const fileMap = {
      'excel': {
        path: path.join(__dirname, '../analytics/ParkPulse_Analytics_Practicals.xlsx'),
        filename: 'ParkPulse_Analytics_Practicals.xlsx',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      },
      'sql-queries': {
        path: path.join(__dirname, '../analytics/sql/analysis_queries.sql'),
        filename: 'ParkPulse_MySQL_Analysis_Queries.sql',
        contentType: 'application/sql'
      },
      'sql-schema': {
        path: path.join(__dirname, '../analytics/sql/create_tables.sql'),
        filename: 'ParkPulse_MySQL_Create_Tables.sql',
        contentType: 'application/sql'
      },
      'sql-oracle': {
        path: path.join(__dirname, '../analytics/sql/oracle_queries.sql'),
        filename: 'ParkPulse_Oracle_Queries.sql',
        contentType: 'application/sql'
      },
      'oracle-guide': {
        path: path.join(__dirname, '../analytics/sql/oracle_setup_guide.md'),
        filename: 'ParkPulse_Oracle_Setup_Guide.md',
        contentType: 'text/markdown'
      },
      'tableau-fields': {
        path: path.join(__dirname, '../tableau/tableau_calculated_fields.md'),
        filename: 'ParkPulse_Tableau_Calculated_Fields.md',
        contentType: 'text/markdown'
      },
      'tableau-guide': {
        path: path.join(__dirname, '../tableau/tableau_dashboard_guide.md'),
        filename: 'ParkPulse_Tableau_Dashboard_Guide.md',
        contentType: 'text/markdown'
      },
      'tableau-syllabus': {
        path: path.join(__dirname, '../tableau/tableau_syllabus_guide.md'),
        filename: 'ParkPulse_Tableau_Syllabus_Guide.md',
        contentType: 'text/markdown'
      },
      'dataset-bookings': {
        path: path.join(__dirname, '../analytics/datasets/bookings.csv'),
        filename: 'parkpulse_tableau_bookings.csv',
        contentType: 'text/csv'
      },
      'dataset-customers': {
        path: path.join(__dirname, '../analytics/datasets/customers.csv'),
        filename: 'parkpulse_tableau_customers.csv',
        contentType: 'text/csv'
      },
      'dataset-locations': {
        path: path.join(__dirname, '../analytics/datasets/parking_locations.csv'),
        filename: 'parkpulse_tableau_locations.csv',
        contentType: 'text/csv'
      },
      'dataset-sessions': {
        path: path.join(__dirname, '../analytics/datasets/parking_sessions.csv'),
        filename: 'parkpulse_tableau_sessions.csv',
        contentType: 'text/csv'
      }
    };

    const target = fileMap[fileKey.toLowerCase()];
    if (!target) {
      return res.status(404).json({
        success: false,
        message: `Unknown download key: ${fileKey}. Available: ${Object.keys(fileMap).join(', ')}`
      });
    }

    if (!fs.existsSync(target.path)) {
      return res.status(404).json({
        success: false,
        message: `Requested file not found on server disk: ${target.filename}`
      });
    }

    res.setHeader('Content-Type', target.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${target.filename}"`);
    const fileStream = fs.createReadStream(target.path);
    fileStream.pipe(res);
  } catch (err) {
    next(err);
  }
};


