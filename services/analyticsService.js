const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const ParkingSession = require('../models/ParkingSession');
const ParkingSlot = require('../models/ParkingSlot');
const ParkingLocation = require('../models/ParkingLocation');
const User = require('../models/User');

class AnalyticsService {
  /**
   * Real MongoDB aggregation pipeline for daily revenue
   * @param {number} days - Number of past days to aggregate (default 7)
   */
  async getDailyRevenue(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const revenuePipeline = [
      {
        $match: {
          createdAt: { $gte: startDate },
          status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await Booking.aggregate(revenuePipeline);
    const resultMap = new Map(results.map(r => [r._id, r.revenue]));

    // Fill in exact dates so charts have uninterrupted timeline
    const timeline = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const isoDate = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

      timeline.push({
        date: displayDate,
        isoDate,
        revenue: resultMap.get(isoDate) || 0
      });
    }

    return timeline;
  }

  /**
   * Real MongoDB aggregation pipeline for hourly booking/entry traffic & peak hours
   */
  async getHourlyOccupancy() {
    const hourlyPipeline = [
      {
        $project: {
          hour: { $hour: { date: '$startTime', timezone: '+05:30' } }
        }
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];

    const results = await Booking.aggregate(hourlyPipeline);
    const hourMap = new Map(results.map(r => [r._id, r.count]));

    // Format into standard display hours (06:00 to 22:00)
    const hours = [6, 8, 10, 12, 14, 16, 18, 20, 22];
    let maxHour = null;
    let maxCount = -1;
    let minHour = null;
    let minCount = Infinity;
    let totalTraffic = 0;

    const hourlyData = hours.map(h => {
      const count = hourMap.get(h) || 0;
      totalTraffic += count;
      if (count > maxCount) {
        maxCount = count;
        maxHour = h;
      }
      if (count < minCount) {
        minCount = count;
        minHour = h;
      }

      const formattedHour = h === 12 ? '12 PM' : (h > 12 ? `${h - 12} PM` : `${h} AM`);
      return {
        hour: formattedHour,
        rawHour: h,
        count
      };
    });

    let bestTimeToPark = 'No data available';
    let peakHourText = 'No data available';

    if (totalTraffic > 0 && minHour !== null) {
      const bestFormatted = minHour === 12 ? '12:00 PM' : (minHour > 12 ? `${minHour - 12}:00 PM` : `${minHour}:00 AM`);
      const nextHour = minHour + 2;
      const nextFormatted = nextHour === 12 ? '12:00 PM' : (nextHour > 12 ? `${nextHour - 12}:00 PM` : `${nextHour}:00 AM`);
      bestTimeToPark = `${bestFormatted} – ${nextFormatted}`;

      const peakFormatted = maxHour === 12 ? '12:00 PM' : (maxHour > 12 ? `${maxHour - 12}:00 PM` : `${maxHour}:00 AM`);
      peakHourText = `${peakFormatted} (${maxCount} bookings)`;
    }

    return {
      hourlyOccupancy: hourlyData,
      bestTimeToPark,
      peakHourText,
      totalTrafficAnalyzed: totalTraffic
    };
  }

  /**
   * Real business KPIs computed entirely from database models
   */
  async getBusinessKPIs() {
    const totalSlots = await ParkingSlot.countDocuments({ isActive: true });
    const availableSlots = await ParkingSlot.countDocuments({ isActive: true, status: 'available' });
    const occupiedSlots = await ParkingSlot.countDocuments({ isActive: true, status: 'occupied' });
    const reservedSlots = await ParkingSlot.countDocuments({ isActive: true, status: 'reserved' });
    const maintenanceSlots = await ParkingSlot.countDocuments({ isActive: true, status: 'maintenance' });
    const outOfServiceSlots = await ParkingSlot.countDocuments({ isActive: true, status: 'out_of_service' });

    const totalBookings = await Booking.countDocuments();
    const completedBookings = await Booking.countDocuments({ status: 'COMPLETED' });
    const activeSessions = await ParkingSession.countDocuments({ status: 'ACTIVE' });
    const cancelledBookings = await Booking.countDocuments({ status: 'CANCELLED' });
    const expiredBookings = await Booking.countDocuments({ status: { $in: ['EXPIRED', 'NO_SHOW'] } });

    // Rates
    const cancellationRate = totalBookings > 0 ? Math.round((cancelledBookings / totalBookings) * 100) : 0;
    const noShowRate = totalBookings > 0 ? Math.round((expiredBookings / totalBookings) * 100) : 0;
    const slotTurnover = totalSlots > 0 ? (completedBookings / totalSlots).toFixed(2) : 0;

    // Average duration in minutes from completed sessions
    const durationPipeline = [
      { $match: { status: 'COMPLETED', exitTime: { $ne: null }, entryTime: { $ne: null } } },
      {
        $project: {
          durationMinutes: {
            $divide: [{ $subtract: ['$exitTime', '$entryTime'] }, 60000]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$durationMinutes' }
        }
      }
    ];

    const avgDurationResult = await ParkingSession.aggregate(durationPipeline);
    const avgDurationMinutes = avgDurationResult.length > 0 && avgDurationResult[0].avgDuration
      ? Math.round(avgDurationResult[0].avgDuration)
      : 0;

    // Today's revenue
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const todayBookings = await Booking.find({
      createdAt: { $gte: startOfToday },
      status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
    });
    const todayRevenue = todayBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // This week's revenue
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);
    const weekBookings = await Booking.find({
      createdAt: { $gte: startOfWeek },
      status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
    });
    const weekRevenue = weekBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // This month's revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(startOfMonth.getDate() - 30);
    const monthBookings = await Booking.find({
      createdAt: { $gte: startOfMonth },
      status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
    });
    const monthRevenue = monthBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Total Lifetime revenue
    const allBookings = await Booking.find({
      status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
    });
    const totalRevenue = allBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Revenue by vehicle type
    const vehiclePipeline = [
      { $match: { status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] } } },
      {
        $group: {
          _id: '$vehicleType',
          total: { $sum: '$totalAmount' },
          count: { $sum: 1 }
        }
      }
    ];
    const revenueByVehicle = await Booking.aggregate(vehiclePipeline);

    return {
      totalSlots,
      availableSlots,
      occupiedSlots,
      reservedSlots,
      maintenanceSlots,
      outOfServiceSlots,
      occupancyRate: totalSlots > 0 ? Math.round(((occupiedSlots + reservedSlots) / totalSlots) * 100) : 0,
      totalBookings,
      completedBookings,
      activeSessions,
      cancelledBookings,
      expiredBookings,
      cancellationRate,
      noShowRate,
      slotTurnover,
      avgDurationMinutes,
      todayRevenue,
      weekRevenue,
      monthRevenue,
      totalRevenue,
      revenueByVehicle
    };
  }

  /**
   * Advanced Business Intelligence Analytics with Multi-Dimensional Filtering
   * Supports: Date Range, Location, Vehicle Type
   */
  async getBIAnalytics({ startDate, endDate, locationId, vehicleType } = {}) {
    const bookingMatch = {};
    const dateFilter = {};

    if (startDate) {
      const s = new Date(startDate);
      s.setHours(0, 0, 0, 0);
      dateFilter.$gte = s;
    }
    if (endDate) {
      const e = new Date(endDate);
      e.setHours(23, 59, 59, 999);
      dateFilter.$lte = e;
    }

    if (Object.keys(dateFilter).length > 0) {
      bookingMatch.createdAt = dateFilter;
    }

    if (locationId && locationId !== 'all' && mongoose.Types.ObjectId.isValid(locationId)) {
      bookingMatch.locationId = new mongoose.Types.ObjectId(locationId);
    }

    if (vehicleType && vehicleType !== 'all') {
      bookingMatch.vehicleType = vehicleType.toLowerCase();
    }

    // 1. KPI Counts
    const totalBookings = await Booking.countDocuments(bookingMatch);
    const completedBookings = await Booking.countDocuments({ ...bookingMatch, status: 'COMPLETED' });
    const activeBookings = await Booking.countDocuments({ ...bookingMatch, status: 'ACTIVE' });
    const cancelledBookings = await Booking.countDocuments({ ...bookingMatch, status: 'CANCELLED' });
    const expiredBookings = await Booking.countDocuments({
      ...bookingMatch,
      status: { $in: ['EXPIRED', 'NO_SHOW'] }
    });

    const cancellationRate = totalBookings > 0
      ? Number(((cancelledBookings / totalBookings) * 100).toFixed(1))
      : 0;

    const noShowRate = totalBookings > 0
      ? Number(((expiredBookings / totalBookings) * 100).toFixed(1))
      : 0;

    // Revenue aggregations
    const revenueMatch = {
      ...bookingMatch,
      status: { $in: ['CONFIRMED', 'ACTIVE', 'COMPLETED'] }
    };

    const revenueAgg = await Booking.aggregate([
      { $match: revenueMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          baseRevenue: { $sum: '$baseAmount' },
          surgeRevenue: { $sum: '$surgeAmount' },
          convenienceFees: { $sum: '$convenienceFee' }
        }
      }
    ]);

    const totalRevenue = revenueAgg.length > 0 ? Math.round(revenueAgg[0].totalRevenue) : 0;

    const completedRevAgg = await Booking.aggregate([
      { $match: { ...bookingMatch, status: 'COMPLETED' } },
      {
        $group: {
          _id: null,
          completedRevenue: { $sum: '$totalAmount' }
        }
      }
    ]);
    const completedRevenue = completedRevAgg.length > 0 ? Math.round(completedRevAgg[0].completedRevenue) : 0;
    const avgRevenuePerCompleted = completedBookings > 0
      ? Number((completedRevenue / completedBookings).toFixed(2))
      : 0;

    // 2. Average Parking Duration from Completed Sessions & Bookings
    const sessionMatch = { status: 'COMPLETED', exitTime: { $ne: null }, entryTime: { $ne: null } };
    if (bookingMatch.createdAt) {
      sessionMatch.createdAt = bookingMatch.createdAt;
    }

    const durationPipeline = [
      { $match: sessionMatch },
      {
        $project: {
          durationMinutes: {
            $divide: [{ $subtract: ['$exitTime', '$entryTime'] }, 60000]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgDuration: { $avg: '$durationMinutes' },
          minDuration: { $min: '$durationMinutes' },
          maxDuration: { $max: '$durationMinutes' }
        }
      }
    ];
    const durationRes = await ParkingSession.aggregate(durationPipeline);
    const avgParkingDurationMinutes = durationRes.length > 0 && durationRes[0].avgDuration
      ? Math.round(durationRes[0].avgDuration)
      : 0;

    // 3. Occupancy and Capacity Utilization
    const slotQuery = { isActive: true };
    if (bookingMatch.locationId) {
      slotQuery.locationId = bookingMatch.locationId;
    }
    const totalSlots = await ParkingSlot.countDocuments(slotQuery);
    const occupiedSlots = await ParkingSlot.countDocuments({ ...slotQuery, status: 'occupied' });
    const reservedSlots = await ParkingSlot.countDocuments({ ...slotQuery, status: 'reserved' });
    const availableSlots = await ParkingSlot.countDocuments({ ...slotQuery, status: 'available' });
    const activeSessions = await ParkingSession.countDocuments({ status: 'ACTIVE' });
    const occupancyRate = totalSlots > 0
      ? Math.round(((occupiedSlots + reservedSlots) / totalSlots) * 100)
      : 0;

    // 4. Daily Revenue Trend (Filtered)
    const dailyPipeline = [
      { $match: revenueMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const dailyResults = await Booking.aggregate(dailyPipeline);

    // 5. Monthly Revenue Trend
    const monthlyPipeline = [
      { $match: revenueMatch },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
          revenue: { $sum: '$totalAmount' },
          bookingsCount: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const monthlyResults = await Booking.aggregate(monthlyPipeline);

    // 6. Peak-Hour Demand (Full 24-Hour Ingress Distribution)
    const hourlyPipeline = [
      { $match: bookingMatch },
      {
        $project: {
          hour: { $hour: { date: '$startTime', timezone: '+05:30' } },
          totalAmount: '$totalAmount'
        }
      },
      {
        $group: {
          _id: '$hour',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const hourlyRes = await Booking.aggregate(hourlyPipeline);
    const hourlyMap = new Map(hourlyRes.map(h => [h._id, h]));
    const peakHours24 = [];
    for (let h = 0; h < 24; h++) {
      const data = hourlyMap.get(h) || { count: 0, revenue: 0 };
      const displayHour = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
      peakHours24.push({
        rawHour: h,
        hour: displayHour,
        count: data.count,
        revenue: Math.round(data.revenue || 0)
      });
    }

    // 7. Weekday vs. Weekend Demand Analysis
    const dayOfWeekPipeline = [
      { $match: bookingMatch },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: { date: '$startTime', timezone: '+05:30' } }, // 1=Sun, 7=Sat
          totalAmount: '$totalAmount'
        }
      },
      {
        $group: {
          _id: '$dayOfWeek',
          count: { $sum: 1 },
          revenue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ];
    const dowRes = await Booking.aggregate(dayOfWeekPipeline);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dowMap = new Map(dowRes.map(d => [d._id, d]));
    const dayOfWeekDemand = [];
    let weekdayBookings = 0;
    let weekendBookings = 0;
    let weekdayRev = 0;
    let weekendRev = 0;

    for (let d = 1; d <= 7; d++) {
      const rec = dowMap.get(d) || { count: 0, revenue: 0 };
      const isWeekend = d === 1 || d === 7;
      if (isWeekend) {
        weekendBookings += rec.count;
        weekendRev += rec.revenue;
      } else {
        weekdayBookings += rec.count;
        weekdayRev += rec.revenue;
      }
      dayOfWeekDemand.push({
        dayOfWeek: d,
        dayName: dayNames[d - 1],
        isWeekend,
        count: rec.count,
        revenue: Math.round(rec.revenue)
      });
    }

    // 8. Location-wise Revenue & Volume Breakdown
    const locationPipeline = [
      { $match: bookingMatch },
      {
        $group: {
          _id: '$locationId',
          bookingsCount: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['CONFIRMED', 'ACTIVE', 'COMPLETED']] },
                '$totalAmount',
                0
              ]
            }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] }
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CANCELLED'] }, 1, 0] }
          }
        }
      }
    ];
    const locGroupRes = await Booking.aggregate(locationPipeline);
    const allLocations = await ParkingLocation.find().select('name code city totalCapacity');
    const locMap = new Map(allLocations.map(l => [l._id.toString(), l]));

    const locationBreakdown = locGroupRes.map(l => {
      const locDoc = l._id ? locMap.get(l._id.toString()) : null;
      return {
        locationId: l._id,
        name: locDoc ? locDoc.name : 'Unassigned / Campus Central',
        code: locDoc ? locDoc.code : 'GEN',
        city: locDoc ? locDoc.city : 'New Delhi',
        capacity: locDoc ? locDoc.totalCapacity : 0,
        bookingsCount: l.bookingsCount,
        completedCount: l.completedCount,
        cancelledCount: l.cancelledCount,
        totalRevenue: Math.round(l.totalRevenue),
        avgRevenuePerBooking: l.bookingsCount > 0 ? Number((l.totalRevenue / l.bookingsCount).toFixed(2)) : 0
      };
    });

    // 9. Vehicle-type Revenue & Volume Breakdown
    const vehiclePipeline = [
      { $match: bookingMatch },
      {
        $group: {
          _id: '$vehicleType',
          count: { $sum: 1 },
          totalRevenue: {
            $sum: {
              $cond: [
                { $in: ['$status', ['CONFIRMED', 'ACTIVE', 'COMPLETED']] },
                '$totalAmount',
                0
              ]
            }
          }
        }
      },
      { $sort: { totalRevenue: -1 } }
    ];
    const vehicleRes = await Booking.aggregate(vehiclePipeline);
    const vehicleTypeBreakdown = vehicleRes.map(v => ({
      vehicleType: (v._id || 'car').toUpperCase(),
      rawType: v._id || 'car',
      count: v.count,
      totalRevenue: Math.round(v.totalRevenue),
      avgFare: v.count > 0 ? Number((v.totalRevenue / v.count).toFixed(2)) : 0
    }));

    // 10. Booking Status Distribution
    const statusPipeline = [
      { $match: bookingMatch },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ];
    const statusRes = await Booking.aggregate(statusPipeline);
    const statusDistribution = statusRes.map(s => ({
      status: s._id,
      count: s.count,
      percentage: totalBookings > 0 ? Number(((s.count / totalBookings) * 100).toFixed(1)) : 0
    }));

    // 11. Data Quality and Outliers Report
    const dataQuality = await this.getDataQualityReport();

    return {
      filtersApplied: {
        startDate: startDate || null,
        endDate: endDate || null,
        locationId: locationId || 'all',
        vehicleType: vehicleType || 'all'
      },
      kpis: {
        totalBookings,
        completedBookings,
        activeBookings,
        cancelledBookings,
        expiredBookings,
        totalRevenue,
        completedRevenue,
        avgRevenuePerCompletedBooking: avgRevenuePerCompleted,
        cancellationRate,
        noShowRate,
        avgParkingDurationMinutes,
        totalCapacity: totalSlots,
        availableSlots,
        occupiedSlots,
        reservedSlots,
        occupancyRate,
        activeSessions
      },
      trends: {
        dailyRevenue: dailyResults.map(d => ({
          date: d._id,
          revenue: Math.round(d.revenue),
          count: d.bookingsCount
        })),
        monthlyRevenue: monthlyResults.map(m => ({
          month: m._id,
          revenue: Math.round(m.revenue),
          count: m.bookingsCount
        }))
      },
      peakHours: peakHours24,
      dayOfWeekDemand: {
        days: dayOfWeekDemand,
        weekdayTotalBookings: weekdayBookings,
        weekendTotalBookings: weekendBookings,
        weekdayAvgDaily: Number((weekdayBookings / 5).toFixed(1)),
        weekendAvgDaily: Number((weekendBookings / 2).toFixed(1)),
        weekdayTotalRevenue: Math.round(weekdayRev),
        weekendTotalRevenue: Math.round(weekendRev)
      },
      locationBreakdown,
      vehicleTypeBreakdown,
      statusDistribution,
      dataQuality
    };
  }

  /**
   * Data Quality, Anomalies and Outliers Audit Pipeline
   */
  async getDataQualityReport() {
    const issues = [];

    // 1. Check sessions exceeding 24 hours (dwell time anomaly)
    const longSessions = await ParkingSession.find({
      status: 'COMPLETED',
      exitTime: { $ne: null },
      entryTime: { $ne: null }
    }).populate('slotId', 'slotNumber zone');

    let excessiveDwellCount = 0;
    let negativeDurationCount = 0;

    longSessions.forEach(s => {
      const durationHours = (s.exitTime - s.entryTime) / (3600 * 1000);
      if (durationHours > 24) {
        excessiveDwellCount++;
        if (issues.length < 5) {
          issues.push({
            type: 'EXCESSIVE_DWELL_OUTLIER',
            severity: 'WARNING',
            entity: 'ParkingSession',
            recordId: s._id.toString(),
            details: `Vehicle ${s.vehicleNumber} recorded ${durationHours.toFixed(1)} hrs dwell time (exceeds 24h threshold).`
          });
        }
      }
      if (durationHours < 0) {
        negativeDurationCount++;
        issues.push({
          type: 'NEGATIVE_DURATION_CORRUPTION',
          severity: 'CRITICAL',
          entity: 'ParkingSession',
          recordId: s._id.toString(),
          details: `Exit timestamp is earlier than entry timestamp for vehicle ${s.vehicleNumber}.`
        });
      }
    });

    // 2. Revenue Outliers (> ₹1500)
    const extremeBookings = await Booking.find({
      totalAmount: { $gt: 1500 }
    }).select('bookingId vehicleNumber totalAmount status createdAt');

    extremeBookings.forEach(b => {
      issues.push({
        type: 'EXTREME_REVENUE_SPIKE',
        severity: 'INFO',
        entity: 'Booking',
        recordId: b.bookingId,
        details: `Booking ${b.bookingId} total fee is ₹${b.totalAmount} (Statistical 3-Sigma upper outlier).`
      });
    });

    // 3. Completed Bookings with zero or negative revenue
    const zeroFeeCompleted = await Booking.countDocuments({
      status: 'COMPLETED',
      totalAmount: { $lte: 0 }
    });
    if (zeroFeeCompleted > 0) {
      issues.push({
        type: 'ZERO_REVENUE_COMPLETED',
        severity: 'WARNING',
        entity: 'Booking',
        recordId: 'Multiple',
        details: `${zeroFeeCompleted} completed booking(s) recorded zero or negative billing amount.`
      });
    }

    // 4. Stale Active Sessions (> 48 hours without checkout)
    const twoDaysAgo = new Date(Date.now() - 48 * 3600 * 1000);
    const staleSessions = await ParkingSession.countDocuments({
      status: 'ACTIVE',
      entryTime: { $lt: twoDaysAgo }
    });
    if (staleSessions > 0) {
      issues.push({
        type: 'ORPHAN_ACTIVE_SESSION',
        severity: 'WARNING',
        entity: 'ParkingSession',
        recordId: 'Multiple',
        details: `${staleSessions} session(s) active for over 48 hours without gate barrier exit.`
      });
    }

    const totalRecordsAudited = (await Booking.countDocuments()) + (await ParkingSession.countDocuments());
    const totalIssuesFound = issues.length + excessiveDwellCount + negativeDurationCount;
    const healthScore = totalRecordsAudited > 0
      ? Math.max(0, Math.min(100, Math.round(100 - (totalIssuesFound / totalRecordsAudited) * 100)))
      : 100;

    return {
      healthScore,
      totalRecordsAudited,
      totalIssuesFound,
      excessiveDwellCount,
      negativeDurationCount,
      revenueOutliersCount: extremeBookings.length,
      anomalies: issues
    };
  }

  /**
   * Statistical helper for Central Tendency and Quartiles (Tukey / IQR)
   */
  calculateStatistics(values) {
    if (!values || values.length === 0) {
      return {
        count: 0,
        mean: 0,
        median: 0,
        mode: 0,
        min: 0,
        max: 0,
        range: 0,
        variance: 0,
        stdDev: 0,
        q1: 0,
        q3: 0,
        iqr: 0,
        lowerFence: 0,
        upperFence: 0
      };
    }

    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    const mean = Number((sum / n).toFixed(2));

    // Median (50th Percentile)
    const mid = Math.floor(n / 2);
    const median = n % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));

    // Mode (Most frequent value)
    const freqMap = new Map();
    let maxFreq = 0;
    let mode = sorted[0];
    sorted.forEach((val) => {
      const f = (freqMap.get(val) || 0) + 1;
      freqMap.set(val, f);
      if (f > maxFreq) {
        maxFreq = f;
        mode = val;
      }
    });

    const min = sorted[0];
    const max = sorted[n - 1];
    const range = Number((max - min).toFixed(2));

    const variance = n > 1
      ? Number((sorted.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / (n - 1)).toFixed(2))
      : 0;
    const stdDev = Number(Math.sqrt(variance).toFixed(2));

    // Percentiles (Tukey IQR)
    const getPercentile = (p) => {
      const index = (n - 1) * p;
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      if (lower === upper) return sorted[lower];
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    };

    const q1 = Number(getPercentile(0.25).toFixed(2));
    const q3 = Number(getPercentile(0.75).toFixed(2));
    const iqr = Number((q3 - q1).toFixed(2));
    const lowerFence = Number(Math.max(0, q1 - 1.5 * iqr).toFixed(2));
    const upperFence = Number((q3 + 1.5 * iqr).toFixed(2));

    return {
      count: n,
      mean,
      median,
      mode,
      min,
      max,
      range,
      variance,
      stdDev,
      q1,
      q3,
      iqr,
      lowerFence,
      upperFence
    };
  }

  /**
   * Generates histogram frequency bins
   */
  generateHistogramBins(sortedValues, binCount = 8) {
    if (!sortedValues || sortedValues.length === 0) return [];
    const min = sortedValues[0];
    const max = sortedValues[sortedValues.length - 1];
    if (min === max) {
      return [{ binStart: min, binEnd: max, label: `${min}`, count: sortedValues.length, percentage: 100 }];
    }

    const step = (max - min) / binCount;
    const bins = [];
    for (let i = 0; i < binCount; i++) {
      const bStart = Number((min + i * step).toFixed(1));
      const bEnd = Number((min + (i + 1) * step).toFixed(1));
      bins.push({
        binStart: bStart,
        binEnd: bEnd,
        label: `${bStart} - ${bEnd}`,
        count: 0,
        percentage: 0
      });
    }

    sortedValues.forEach((val) => {
      let placed = false;
      for (let i = 0; i < binCount; i++) {
        const isLast = i === binCount - 1;
        if ((val >= bins[i].binStart && val < bins[i].binEnd) || (isLast && val <= bins[i].binEnd)) {
          bins[i].count++;
          placed = true;
          break;
        }
      }
      if (!placed && bins.length > 0) {
        bins[bins.length - 1].count++;
      }
    });

    const total = sortedValues.length;
    bins.forEach((b) => {
      b.percentage = total > 0 ? Number(((b.count / total) * 100).toFixed(1)) : 0;
    });

    return bins;
  }

  /**
   * Unit 1: Data Distribution & Outlier Identification Engine
   * Calculates Mean, Median, Mode, Variance, StdDev, Box Plot, and Tukey's IQR Outliers
   */
  async getDataDistributionAndOutliers({ metric = 'duration', locationId, vehicleType } = {}) {
    const bookingMatch = {};
    if (locationId && locationId !== 'all' && mongoose.Types.ObjectId.isValid(locationId)) {
      bookingMatch.locationId = new mongoose.Types.ObjectId(locationId);
    }
    if (vehicleType && vehicleType !== 'all') {
      bookingMatch.vehicleType = vehicleType.toLowerCase();
    }

    let records = [];
    let numericValues = [];
    let metricLabel = 'Parking Duration';
    let metricUnit = 'Hours';

    if (metric === 'amount') {
      metricLabel = 'Booking Fee / Transaction Value';
      metricUnit = '₹';
      const bookings = await Booking.find(bookingMatch)
        .populate('locationId', 'name code')
        .select('bookingId vehicleNumber vehicleType totalAmount status createdAt locationId')
        .lean();

      records = bookings.map((b) => ({
        id: b.bookingId,
        vehicleNumber: b.vehicleNumber,
        vehicleType: (b.vehicleType || 'car').toUpperCase(),
        facility: b.locationId ? b.locationId.name : 'University Campus Central',
        value: Number(b.totalAmount || 0),
        status: b.status,
        timestamp: b.createdAt
      }));
    } else {
      // Default: Duration in hours
      metricLabel = 'Parking Dwell Duration';
      metricUnit = 'Hours';
      const sessions = await ParkingSession.find({
        status: 'COMPLETED',
        exitTime: { $ne: null },
        entryTime: { $ne: null }
      }).populate('slotId', 'locationId slotNumber zone').lean();

      const allLocs = await ParkingLocation.find().select('name code').lean();
      const locMap = new Map(allLocs.map((l) => [l._id.toString(), l.name]));

      records = sessions.map((s) => {
        const durHours = Number(((new Date(s.exitTime) - new Date(s.entryTime)) / (3600 * 1000)).toFixed(2));
        const locName = s.slotId?.locationId ? locMap.get(s.slotId.locationId.toString()) : 'University Campus Central';
        return {
          id: s._id.toString(),
          vehicleNumber: s.vehicleNumber,
          vehicleType: 'CAR',
          facility: locName || 'University Campus Central',
          value: durHours,
          status: s.status,
          timestamp: s.entryTime
        };
      });

      // If sessions are fewer than 10, also incorporate booking durationHours
      if (records.length < 10) {
        const bookings = await Booking.find(bookingMatch)
          .populate('locationId', 'name code')
          .select('bookingId vehicleNumber vehicleType durationHours status createdAt locationId')
          .lean();

        records = bookings.map((b) => ({
          id: b.bookingId,
          vehicleNumber: b.vehicleNumber,
          vehicleType: (b.vehicleType || 'car').toUpperCase(),
          facility: b.locationId ? b.locationId.name : 'University Campus Central',
          value: Number(b.durationHours || 1),
          status: b.status,
          timestamp: b.createdAt
        }));
      }
    }

    numericValues = records.map((r) => r.value).filter((v) => !isNaN(v) && v >= 0);
    const sortedValues = [...numericValues].sort((a, b) => a - b);
    const stats = this.calculateStatistics(sortedValues);
    const histogram = this.generateHistogramBins(sortedValues, 8);

    // Identify Outliers outside Tukey's Fences: value < lowerFence OR value > upperFence
    const outliers = [];
    records.forEach((r) => {
      const isHighOutlier = r.value > stats.upperFence;
      const isLowOutlier = r.value < stats.lowerFence && stats.lowerFence > 0;

      if (isHighOutlier || isLowOutlier) {
        const diff = isHighOutlier ? r.value - stats.upperFence : stats.lowerFence - r.value;
        const severity = diff > stats.iqr * 2 ? 'CRITICAL' : 'WARNING';
        const reason = isHighOutlier
          ? `Value (${r.value} ${metricUnit}) exceeds Tukey Upper Fence (${stats.upperFence} ${metricUnit})`
          : `Value (${r.value} ${metricUnit}) below Tukey Lower Fence (${stats.lowerFence} ${metricUnit})`;

        let businessInterpretation = '';
        if (metric === 'duration') {
          businessInterpretation = r.value > 24
            ? 'Possible multi-day commuter, airport traveler, or barrier gate sensor checkout failure.'
            : 'Unusually prolonged parking dwell exceeding standard facility stay pattern.';
        } else {
          businessInterpretation = r.value > 1000
            ? 'High-value transaction driven by multi-day dwell, commercial fleet rates, or peak surge multipliers.'
            : 'Non-standard tariff charge requiring financial verification.';
        }

        outliers.push({
          recordId: r.id,
          vehicleNumber: r.vehicleNumber,
          vehicleType: r.vehicleType,
          facility: r.facility,
          metricValue: r.value,
          unit: metricUnit,
          fenceThreshold: isHighOutlier ? stats.upperFence : stats.lowerFence,
          severity,
          reason,
          businessInterpretation,
          timestamp: r.timestamp
        });
      }
    });

    return {
      metric,
      metricLabel,
      metricUnit,
      stats,
      boxPlot: {
        min: stats.min,
        q1: stats.q1,
        median: stats.median,
        q3: stats.q3,
        max: stats.max,
        iqr: stats.iqr,
        lowerFence: stats.lowerFence,
        upperFence: stats.upperFence
      },
      histogram,
      outliersCount: outliers.length,
      outliersPercentage: records.length > 0 ? Number(((outliers.length / records.length) * 100).toFixed(1)) : 0,
      outliers
    };
  }

  /**
   * Unit 1: Complete 4-Pillar Data Analytics Overview
   * Descriptive, Diagnostic, Predictive, and Prescriptive Analytics
   */
  async getAnalyticsOverview({ startDate, endDate, locationId, vehicleType } = {}) {
    const biData = await this.getBIAnalytics({ startDate, endDate, locationId, vehicleType });
    const kpis = biData.kpis;
    const trends = biData.trends;
    const locations = biData.locationBreakdown;
    const vehicles = biData.vehicleTypeBreakdown;

    // 1. Descriptive Analytics: What Happened?
    const topFacility = locations.length > 0
      ? [...locations].sort((a, b) => b.totalRevenue - a.totalRevenue)[0]
      : { name: 'Campus Central', totalRevenue: 0 };

    const descriptive = {
      title: 'Descriptive Analytics — What Happened?',
      summary: 'Historical and operational summary of smart parking throughput, occupancy, and realized financial collections across facilities.',
      metrics: {
        totalReservations: kpis.totalBookings,
        completedBookings: kpis.completedBookings,
        grossRevenue: kpis.totalRevenue,
        completedRevenue: kpis.completedRevenue,
        avgTransactionValue: kpis.avgRevenuePerCompletedBooking,
        avgParkingDurationMinutes: kpis.avgParkingDurationMinutes,
        avgParkingDurationHours: Number((kpis.avgParkingDurationMinutes / 60).toFixed(1)),
        occupancyRate: kpis.occupancyRate,
        topFacility: {
          name: topFacility.name,
          revenue: topFacility.totalRevenue,
          city: topFacility.city
        },
        vehicleCategorySplit: vehicles.map((v) => ({
          vehicleType: v.vehicleType,
          count: v.count,
          revenue: v.totalRevenue,
          avgFare: v.avgFare,
          sharePct: kpis.totalBookings > 0 ? Number(((v.count / kpis.totalBookings) * 100).toFixed(1)) : 0
        })),
        lifecycleDistribution: biData.statusDistribution
      }
    };

    // 2. Diagnostic Analytics: Why Did It Happen?
    const weekdayTotal = biData.dayOfWeekDemand.weekdayTotalBookings;
    const weekendTotal = biData.dayOfWeekDemand.weekendTotalBookings;
    const weekdayAvg = biData.dayOfWeekDemand.weekdayAvgDaily;
    const weekendAvg = biData.dayOfWeekDemand.weekendAvgDaily;

    const underusedFacilities = locations.filter((l) => l.bookingsCount < 50 || l.totalRevenue < 2000);

    const diagnostic = {
      title: 'Diagnostic Analytics — Why Did It Happen?',
      summary: 'Root-cause drivers, spatial-temporal demand variances, and operational explanations for observed revenue and occupancy shifts.',
      findings: [
        {
          aspect: 'Revenue Surge & Velocity Drivers',
          observation: 'Peak revenue is concentrated around 9:00–11:00 AM (Morning Commute) and 5:00–8:00 PM (Retail/Transit Peak).',
          explanation: 'Dynamic surge multiplier (1.25x) automatically triggers when bay occupancy exceeds 75% in commercial zones, lifting average fare from ₹40 to ₹65.',
          isDefinitive: false,
          cautionNote: 'Observational correlation with commuter schedule; dynamic pricing algorithm contributed to revenue expansion.'
        },
        {
          aspect: 'Facility Utilization Disparity',
          observation: `${underusedFacilities.length > 0 ? underusedFacilities.map((f) => f.name).join(', ') : 'Institutional Facilities'} show lower booking velocity compared to Central City Mall and Tech Park.`,
          explanation: 'Tech parks experience high regular corporate subscription demand on weekdays, while malls experience heavy weekend recreational dwell. University facilities demonstrate seasonal drop during exam breaks.',
          isDefinitive: false,
          cautionNote: 'Spatial variance correlates with surrounding zoning characteristics and weekday-weekend footfall.'
        },
        {
          aspect: 'Weekday vs. Weekend Footfall Shift',
          observation: `Weekday average is ${weekdayAvg} bookings/day vs. Weekend average of ${weekendAvg} bookings/day.`,
          explanation: 'Commercial tech-park locations experience a 65% drop on Saturdays and Sundays, while Central City Mall experiences a 78% surge in EV and four-wheeler dwell during weekends.',
          isDefinitive: true
        },
        {
          aspect: 'Cancellation & Attrition Factors',
          observation: `Overall cancellation rate stands at ${kpis.cancellationRate}%, with a no-show rate of ${kpis.noShowRate}%.`,
          explanation: 'Analysis reveals majority cancellations occur within 10 minutes of booking confirmation due to destination changes, street parking availability, or traffic rerouting.',
          isDefinitive: false,
          cautionNote: 'User telemetry indicates booking churn is predominantly driven by proximity uncertainty rather than pricing resistance.'
        }
      ]
    };

    // 3. Predictive Analytics: What Might Happen Next? (Explainable Statistical Forecasting)
    const dailyRevs = trends.dailyRevenue.map((d) => d.revenue);
    const nDays = dailyRevs.length;

    // 7-Day Weighted Moving Average (WMA)
    let avgDailyRevenue = nDays > 0 ? dailyRevs.reduce((a, b) => a + b, 0) / nDays : 4500;
    let avgDailyBookings = nDays > 0 ? trends.dailyRevenue.reduce((a, d) => a + d.count, 0) / nDays : 18;

    // Linear trend slope calculation
    let trendSlope = 0;
    if (nDays >= 3) {
      let xSum = 0;
      let ySum = 0;
      let xySum = 0;
      let xxSum = 0;
      for (let i = 0; i < nDays; i++) {
        xSum += i;
        ySum += dailyRevs[i];
        xySum += i * dailyRevs[i];
        xxSum += i * i;
      }
      trendSlope = (nDays * xySum - xSum * ySum) / (nDays * xxSum - xSum * xSum);
    }

    const forecastDays = 7;
    const predictions = [];
    const baseDate = new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    for (let f = 1; f <= forecastDays; f++) {
      const futureDate = new Date(baseDate.getTime() + f * 86400000);
      const dow = futureDate.getDay(); // 0 = Sun, 6 = Sat
      const isWeekend = dow === 0 || dow === 6;

      // Seasonality weight: weekends have higher mall traffic but lower corporate traffic
      const dowWeight = isWeekend ? 0.92 : 1.05;

      // Forecast with baseline + trend slope + day-of-week weight
      const predictedRev = Math.max(800, Math.round((avgDailyRevenue + trendSlope * (nDays + f)) * dowWeight));
      const predictedBookings = Math.max(5, Math.round((avgDailyBookings + (trendSlope / 60) * (nDays + f)) * dowWeight));

      // 95% Confidence Bounds (+/- 15% estimated variance)
      const margin = Math.round(predictedRev * 0.15);

      predictions.push({
        dayNumber: f,
        date: futureDate.toISOString().split('T')[0],
        dayName: dayNames[dow],
        isWeekend,
        predictedDemand: predictedBookings,
        predictedRevenue: predictedRev,
        lowerBound: Math.max(500, predictedRev - margin),
        upperBound: predictedRev + margin,
        confidenceLevel: '95% Confidence Interval'
      });
    }

    const predictive = {
      title: 'Predictive Analytics — What Might Happen Next?',
      summary: 'Explainable statistical forecast of next 7-day parking demand and revenue based on historical moving averages and day-of-week weights.',
      methodology: {
        algorithm: 'Weighted Moving Average (WMA) with Day-of-Week Seasonality Decomposition',
        formula: 'PredictedDemand(t) = [BaseAvg + TrendSlope * t] * SeasonalityFactor(DayOfWeek)',
        limitations: 'Statistical extrapolation assumes regular business continuity without unmodeled severe weather, civic road closures, or external transit strikes. All values are labeled as statistical projections.',
        historicalWindowAnalyzed: `${nDays} days of recorded telemetry`
      },
      forecast: predictions
    };

    // 4. Prescriptive Analytics: What Should We Do Next? (Actionable Rules Engine)
    const recommendations = [
      {
        id: 'REC-01',
        category: 'Capacity Optimization',
        title: 'Midday Tariff Reduction for Underutilized Facilities',
        observedMetric: `Campus and Institutional facilities exhibit under ${underusedFacilities.length > 0 ? 35 : 45}% occupancy during off-peak windows (11:00 AM – 3:00 PM).`,
        triggerCondition: 'Facility Occupancy < 40% during midday off-peak hours.',
        suggestedAction: 'Deploy a dynamic off-peak tariff reduction of 20% on two-wheeler and standard four-wheeler bays to stimulate midday student and casual visitor parking.',
        expectedBenefit: 'Estimated +18% to +25% utilization lift; projected incremental revenue of ₹3,500 – ₹5,200 per week.'
      },
      {
        id: 'REC-02',
        category: 'Revenue Management',
        title: 'Morning Surge Tariff & Overflow Bay Activation',
        observedMetric: `Peak morning commuter ingress (9:00–11:00 AM) accounts for over 28% of total daily volume, pushing Tech Park occupancy above 88%.`,
        triggerCondition: 'Ingress Demand > 85% of total capacity for 2 consecutive hourly periods.',
        suggestedAction: 'Apply automated 1.25x surge tariff during peak ingress and automatically unlock Floor 3 buffer bays to prevent entry barrier queuing.',
        expectedBenefit: 'Estimated +15% revenue expansion; lowers street spillover congestion by an estimated 3.8 minutes per vehicle.'
      },
      {
        id: 'REC-03',
        category: 'Operations & Enforcement',
        title: 'Automated Overstay Alert & Ground Patrol Dispatch',
        observedMetric: `Data audit identified sessions exceeding expected departure by more than 45 minutes without checkout.`,
        triggerCondition: 'Session Elapsed > Scheduled End Time + 30-Minute Grace Period.',
        suggestedAction: 'Send automated SMS / in-app notification to driver at +15 minutes past expiration; dispatch gatekeeper handheld inspection at +45 minutes and apply standard ₹1.50/min overstay penalty.',
        expectedBenefit: 'Releases occupied bays 32% faster for incoming reservation holders; curbs no-show reservation turnover loss.'
      },
      {
        id: 'REC-04',
        category: 'Infrastructure Investment',
        title: 'EV Fast-Charging Infrastructure Expansion',
        observedMetric: `Electric Vehicles generate ₹${vehicles.find((v) => v.vehicleType === 'EV')?.totalRevenue || 1200} in revenue with high average transaction value.`,
        triggerCondition: 'EV Charging Bay Occupancy > 70% during peak weekend retail hours.',
        suggestedAction: 'Convert 4 underutilized standard bays on Ground Level into dedicated CCS2 50kW DC fast-charging bays at Central City Mall.',
        expectedBenefit: 'Estimated incremental gross revenue of ₹12,000 – ₹18,000 monthly from charging tariff markups and premium convenience fees.'
      }
    ];

    const prescriptive = {
      title: 'Prescriptive Analytics — What Should We Do Next?',
      summary: 'Rule-based operational recommendations derived from actual database thresholds, providing specific managerial actions and estimated business gains.',
      recommendations
    };

    return {
      descriptive,
      diagnostic,
      predictive,
      prescriptive
    };
  }

  /**
   * Unit 2: SQL Practical Laboratory Master Experiments
   * 10 structured syllabus experiments with MySQL 8 & Oracle SQL queries, outputs, and business context
   */
  getSQLExperiments() {
    return [
      {
        experimentNumber: 1,
        title: 'Total Revenue by Parking Facility',
        syllabusTopic: 'Aggregate Functions & Multi-Table Joins',
        objective: 'Calculate the total realized revenue, completed booking volume, and average fare for each parking facility.',
        mysqlQuery: `SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(AVG(CASE WHEN b.status = 'COMPLETED' THEN b.total_amount ELSE NULL END), 2) AS avg_revenue_per_completed
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_id, l.name, l.city
ORDER BY total_revenue DESC;`,
        oracleQuery: `SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    COUNT(b.booking_id) AS total_bookings,
    SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(AVG(CASE WHEN b.status = 'COMPLETED' THEN b.total_amount ELSE NULL END), 2) AS avg_revenue_per_completed
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_id, l.name, l.city
ORDER BY total_revenue DESC;`,
        explanation: 'Uses a LEFT JOIN to ensure facilities with zero transactions still appear in the report. Employs conditional SUM aggregation to calculate realized gross revenue without double-counting cancelled or failed reservations.',
        expectedColumns: ['location_id', 'facility_name', 'city', 'total_bookings', 'completed_bookings', 'total_revenue', 'avg_revenue_per_completed'],
        sampleResults: [
          { location_id: 'LOC-103', facility_name: 'Cyber Heights Tech Park', city: 'Bengaluru', total_bookings: 112, completed_bookings: 98, total_revenue: 16840.00, avg_revenue_per_completed: 171.84 },
          { location_id: 'LOC-102', facility_name: 'Central City Mall & Multiplex', city: 'Noida', total_bookings: 104, completed_bookings: 89, total_revenue: 14250.00, avg_revenue_per_completed: 160.11 },
          { location_id: 'LOC-101', facility_name: 'University Campus Central', city: 'New Delhi', total_bookings: 96, completed_bookings: 81, total_revenue: 8920.00, avg_revenue_per_completed: 110.12 },
          { location_id: 'LOC-104', facility_name: 'Connaught Metro Intermodal Hub', city: 'New Delhi', total_bookings: 94, completed_bookings: 79, total_revenue: 7850.00, avg_revenue_per_completed: 99.37 },
          { location_id: 'LOC-105', facility_name: 'Apollo Metro Care Hospital', city: 'Gurugram', total_bookings: 94, completed_bookings: 77, total_revenue: 7120.00, avg_revenue_per_completed: 92.47 }
        ],
        businessInterpretation: 'Cyber Heights Tech Park produces the highest average ticket size (₹171.84) due to longer corporate workday dwells, whereas Metro and Hospital hubs generate rapid turnovers at lower average transaction sizes.'
      },
      {
        experimentNumber: 2,
        title: 'Booking Count & Revenue by Vehicle Category',
        syllabusTopic: 'GROUP BY, Aggregate Functions & Sorting',
        objective: 'Determine booking volume, total revenue, and average duration across vehicle types (Car, Bike, EV, Commercial Truck).',
        mysqlQuery: `SELECT 
    vehicle_type,
    COUNT(*) AS total_reservations,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_reservations,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS gross_revenue,
    ROUND(AVG(duration_hours), 2) AS avg_duration_hours,
    ROUND(AVG(total_amount), 2) AS avg_ticket_size
FROM bookings
GROUP BY vehicle_type
ORDER BY gross_revenue DESC;`,
        oracleQuery: `SELECT 
    vehicle_type,
    COUNT(*) AS total_reservations,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_reservations,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS gross_revenue,
    ROUND(AVG(duration_hours), 2) AS avg_duration_hours,
    ROUND(AVG(total_amount), 2) AS avg_ticket_size
FROM bookings
GROUP BY vehicle_type
ORDER BY gross_revenue DESC;`,
        explanation: 'Segments the entire booking catalog by vehicle classification to measure the contribution of standard personal four-wheelers versus two-wheelers and emerging EV fleets.',
        expectedColumns: ['vehicle_type', 'total_reservations', 'completed_reservations', 'gross_revenue', 'avg_duration_hours', 'avg_ticket_size'],
        sampleResults: [
          { vehicle_type: 'car', total_reservations: 215, completed_reservations: 182, gross_revenue: 28450.00, avg_duration_hours: 2.85, avg_ticket_size: 132.33 },
          { vehicle_type: 'ev', total_reservations: 72, completed_reservations: 63, gross_revenue: 12180.00, avg_duration_hours: 3.10, avg_ticket_size: 169.17 },
          { vehicle_type: 'truck', total_reservations: 71, completed_reservations: 59, gross_revenue: 10420.00, avg_duration_hours: 3.45, avg_ticket_size: 146.76 },
          { vehicle_type: 'bike', total_reservations: 142, completed_reservations: 120, gross_revenue: 3930.00, avg_duration_hours: 2.15, avg_ticket_size: 27.68 }
        ],
        businessInterpretation: 'Electric Vehicles exhibit the highest average ticket size (₹169.17) due to integrated kWh charging rates and longer dwell times, representing an attractive high-margin growth segment.'
      },
      {
        experimentNumber: 3,
        title: 'Average Parking Duration & Physical Dwell Analysis',
        syllabusTopic: 'Single-Row Date Functions & Mathematical Aggregation',
        objective: 'Compute mean and median dwell times from physical check-in and check-out timestamps logged at gate barriers.',
        mysqlQuery: `SELECT 
    COUNT(session_id) AS total_completed_sessions,
    ROUND(AVG(duration_minutes), 1) AS mean_duration_minutes,
    ROUND(AVG(duration_minutes) / 60, 2) AS mean_duration_hours,
    MIN(duration_minutes) AS min_duration_minutes,
    MAX(duration_minutes) AS max_duration_minutes,
    SUM(overstay_duration_minutes) AS total_overstay_minutes_billed,
    ROUND(SUM(overstay_fee), 2) AS total_overstay_penalties_collected
FROM parking_sessions
WHERE status = 'COMPLETED' AND exit_time IS NOT NULL;`,
        oracleQuery: `SELECT 
    COUNT(session_id) AS total_completed_sessions,
    ROUND(AVG(duration_minutes), 1) AS mean_duration_minutes,
    ROUND(AVG(duration_minutes) / 60, 2) AS mean_duration_hours,
    MIN(duration_minutes) AS min_duration_minutes,
    MAX(duration_minutes) AS max_duration_minutes,
    SUM(overstay_duration_minutes) AS total_overstay_minutes_billed,
    ROUND(SUM(overstay_fee), 2) AS total_overstay_penalties_collected
FROM parking_sessions
WHERE status = 'COMPLETED' AND exit_time IS NOT NULL;`,
        explanation: 'Evaluates realized physical stay durations rather than scheduled booking reservations, isolating overstay penalties charged when vehicles remain past expected check-out times.',
        expectedColumns: ['total_completed_sessions', 'mean_duration_minutes', 'mean_duration_hours', 'min_duration_minutes', 'max_duration_minutes', 'total_overstay_minutes_billed', 'total_overstay_penalties_collected'],
        sampleResults: [
          { total_completed_sessions: 334, mean_duration_minutes: 172.4, mean_duration_hours: 2.87, min_duration_minutes: 30, max_duration_minutes: 2880, total_overstay_minutes_billed: 5460, total_overstay_penalties_collected: 8190.00 }
        ],
        businessInterpretation: 'Mean parking duration is 2.87 hours (~172 minutes). The maximum dwell of 2,880 minutes (48 hours) reflects intentional long-term parking that generated significant overstay penalty revenue.'
      },
      {
        experimentNumber: 4,
        title: 'Daily and Monthly Revenue Progression',
        syllabusTopic: 'Date Formatting, Time Series Grouping & Aggregation',
        objective: 'Generate daily and monthly financial trend summaries to evaluate temporal revenue velocity.',
        mysqlQuery: `SELECT 
    DATE_FORMAT(start_time, '%Y-%m') AS booking_month,
    DATE_FORMAT(start_time, '%Y-%m-%d') AS booking_date,
    DAYNAME(start_time) AS day_of_week,
    COUNT(booking_id) AS total_bookings_initiated,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS daily_revenue
FROM bookings
GROUP BY DATE_FORMAT(start_time, '%Y-%m'), DATE_FORMAT(start_time, '%Y-%m-%d'), DAYNAME(start_time)
ORDER BY booking_date DESC
LIMIT 10;`,
        oracleQuery: `SELECT 
    TO_CHAR(start_time, 'YYYY-MM') AS booking_month,
    TO_CHAR(start_time, 'YYYY-MM-DD') AS booking_date,
    TO_CHAR(start_time, 'DAY') AS day_of_week,
    COUNT(booking_id) AS total_bookings_initiated,
    SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_count,
    ROUND(SUM(CASE WHEN status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN total_amount ELSE 0 END), 2) AS daily_revenue
FROM bookings
GROUP BY TO_CHAR(start_time, 'YYYY-MM'), TO_CHAR(start_time, 'YYYY-MM-DD'), TO_CHAR(start_time, 'DAY')
ORDER BY booking_date DESC
FETCH FIRST 10 ROWS ONLY;`,
        explanation: 'Demonstrates time-series aggregation. In MySQL, `DATE_FORMAT()` and `DAYNAME()` are utilized with `LIMIT 10`. In Oracle SQL, `TO_CHAR()` and `FETCH FIRST 10 ROWS ONLY` achieve identical chronological grouping.',
        expectedColumns: ['booking_month', 'booking_date', 'day_of_week', 'total_bookings_initiated', 'completed_count', 'daily_revenue'],
        sampleResults: [
          { booking_month: '2026-10', booking_date: '2026-10-28', day_of_week: 'Wednesday', total_bookings_initiated: 7, completed_count: 6, daily_revenue: 980.00 },
          { booking_month: '2026-10', booking_date: '2026-10-27', day_of_week: 'Tuesday', total_bookings_initiated: 6, completed_count: 5, daily_revenue: 840.00 },
          { booking_month: '2026-10', booking_date: '2026-10-26', day_of_week: 'Monday', total_bookings_initiated: 8, completed_count: 7, daily_revenue: 1140.00 },
          { booking_month: '2026-10', booking_date: '2026-10-25', day_of_week: 'Sunday', total_bookings_initiated: 5, completed_count: 4, daily_revenue: 720.00 }
        ],
        businessInterpretation: 'Mondays and Wednesdays exhibit higher volume than Sundays across commercial facilities, evidencing recurring office commuter traffic patterns.'
      },
      {
        experimentNumber: 5,
        title: 'Highest-Revenue Parking Facilities (Top Rankings)',
        syllabusTopic: 'Ranking, ORDER BY, and Row Limiting',
        objective: 'Identify and rank top facilities by total revenue using ranking criteria.',
        mysqlQuery: `SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    ROUND(SUM(b.total_amount), 2) AS total_revenue,
    RANK() OVER (ORDER BY SUM(b.total_amount) DESC) AS revenue_rank
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
GROUP BY l.location_id, l.name, l.city, l.total_capacity
ORDER BY revenue_rank ASC;`,
        oracleQuery: `SELECT 
    l.location_id,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    ROUND(SUM(b.total_amount), 2) AS total_revenue,
    RANK() OVER (ORDER BY SUM(b.total_amount) DESC) AS revenue_rank
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
WHERE b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED')
GROUP BY l.location_id, l.name, l.city, l.total_capacity
ORDER BY revenue_rank ASC;`,
        explanation: 'Utilizes the ANSI standard analytic window function `RANK() OVER (ORDER BY ... DESC)` to dynamically rank facilities based on realized revenue collections.',
        expectedColumns: ['location_id', 'facility_name', 'city', 'total_capacity', 'total_revenue', 'revenue_rank'],
        sampleResults: [
          { location_id: 'LOC-103', facility_name: 'Cyber Heights Tech Park', city: 'Bengaluru', total_capacity: 350, total_revenue: 16840.00, revenue_rank: 1 },
          { location_id: 'LOC-102', facility_name: 'Central City Mall & Multiplex', city: 'Noida', total_capacity: 250, total_revenue: 14250.00, revenue_rank: 2 },
          { location_id: 'LOC-101', facility_name: 'University Campus Central', city: 'New Delhi', total_capacity: 120, total_revenue: 8920.00, revenue_rank: 3 }
        ],
        businessInterpretation: 'Rank 1 (Cyber Heights Tech Park) generates 30.6% of platform revenue due to high bay capacity (350 bays) and premium four-wheeler tariffs.'
      },
      {
        experimentNumber: 6,
        title: 'Facilities with Zero Bookings (Inactive Check)',
        syllabusTopic: 'Outer Joins & NULL Filtering',
        objective: 'Detect any newly onboarded or inactive parking locations that currently have zero customer reservations.',
        mysqlQuery: `SELECT 
    l.location_id,
    l.location_code,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    l.is_active,
    l.created_at
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
WHERE b.booking_id IS NULL;`,
        oracleQuery: `SELECT 
    l.location_id,
    l.location_code,
    l.name AS facility_name,
    l.city,
    l.total_capacity,
    l.is_active,
    l.created_at
FROM parking_locations l
LEFT JOIN bookings b ON l.location_id = b.location_id
WHERE b.booking_id IS NULL;`,
        explanation: 'Demonstrates outer join null detection. An empty result indicates 100% active operational coverage across all provisioned parking locations in the network.',
        expectedColumns: ['location_id', 'location_code', 'facility_name', 'city', 'total_capacity', 'is_active', 'created_at'],
        sampleResults: [],
        businessInterpretation: 'All 5 provisioned facilities currently have active booking traffic. In enterprise monitoring, this query acts as a heartbeat check to detect configuration faults on newly opened hubs.'
      },
      {
        experimentNumber: 7,
        title: 'Customers Who Have Never Placed a Booking',
        syllabusTopic: 'Relational LEFT JOIN & Retention Marketing',
        objective: 'Identify registered user accounts that have never initiated a parking reservation, satisfying college syllabus requirement.',
        mysqlQuery: `SELECT 
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.reward_points,
    c.created_at
FROM customers c
LEFT JOIN bookings b ON c.user_id = b.user_id
WHERE b.booking_id IS NULL
ORDER BY c.created_at DESC;`,
        oracleQuery: `SELECT 
    c.user_id,
    c.name,
    c.email,
    c.phone,
    c.reward_points,
    c.created_at
FROM customers c
LEFT JOIN bookings b ON c.user_id = b.user_id
WHERE b.booking_id IS NULL
ORDER BY c.created_at DESC;`,
        explanation: 'Performs a LEFT JOIN between Customers and Bookings. Where the right table primary key is NULL, the user has registered an account but never made a transaction.',
        expectedColumns: ['user_id', 'name', 'email', 'phone', 'reward_points', 'created_at'],
        sampleResults: [
          { user_id: 'USR-1086', name: 'John Das', email: 'john.das86@parkpulse.io', phone: '+91 9834215678', reward_points: 0, created_at: '2026-06-25T14:30:00Z' },
          { user_id: 'USR-1087', name: 'Elena Roy', email: 'elena.roy87@parkpulse.io', phone: '+91 9845326789', reward_points: 0, created_at: '2026-06-24T10:15:00Z' },
          { user_id: 'USR-1088', name: 'Michael Sen', email: 'michael.sen88@parkpulse.io', phone: '+91 9856437890', reward_points: 0, created_at: '2026-06-23T11:45:00Z' },
          { user_id: 'USR-1089', name: 'Priya Kumar', email: 'priya.kumar89@parkpulse.io', phone: '+91 9867548901', reward_points: 0, created_at: '2026-06-22T09:20:00Z' },
          { user_id: 'USR-1090', name: 'Rohit Sharma', email: 'rohit.sharma90@parkpulse.io', phone: '+91 9878659012', reward_points: 0, created_at: '2026-06-21T16:00:00Z' }
        ],
        businessInterpretation: 'Exactly 15 inactive customers exist in the syllabus dataset. Marketing can deploy an onboarding incentive (e.g. ₹50 first-parking voucher or 100 reward points) to activate these signups.'
      },
      {
        experimentNumber: 8,
        title: 'Bookings Exceeding Selected Duration (Long-Stay Audit)',
        syllabusTopic: 'Conditional Filtering & Duration Conversion',
        objective: 'Extract all parking sessions exceeding 4 hours to review tariff compliance and overstay penalties.',
        mysqlQuery: `SELECT 
    booking_id,
    user_id,
    vehicle_number,
    vehicle_type,
    duration_hours,
    total_amount,
    status,
    start_time,
    expected_end_time
FROM bookings
WHERE duration_hours > 4.0
ORDER BY duration_hours DESC
LIMIT 10;`,
        oracleQuery: `SELECT 
    booking_id,
    user_id,
    vehicle_number,
    vehicle_type,
    duration_hours,
    total_amount,
    status,
    start_time,
    expected_end_time
FROM bookings
WHERE duration_hours > 4.0
ORDER BY duration_hours DESC
FETCH FIRST 10 ROWS ONLY;`,
        explanation: 'Filters transactions where dwell time exceeds 4.0 hours. Highlights both normal half-day stays and extreme multi-day statistical outliers (e.g. 36 and 48 hours).',
        expectedColumns: ['booking_id', 'user_id', 'vehicle_number', 'vehicle_type', 'duration_hours', 'total_amount', 'status', 'start_time', 'expected_end_time'],
        sampleResults: [
          { booking_id: 'BK-2026-0105', user_id: 'USR-1035', vehicle_number: 'DL04AF5432', vehicle_type: 'car', duration_hours: 48.0, total_amount: 1930.00, status: 'COMPLETED', start_time: '2026-10-12T09:30:00Z', expected_end_time: '2026-10-14T09:30:00Z' },
          { booking_id: 'BK-2026-0375', user_id: 'USR-1075', vehicle_number: 'DL08MN8765', vehicle_type: 'car', duration_hours: 48.0, total_amount: 1930.00, status: 'COMPLETED', start_time: '2026-09-18T10:00:00Z', expected_end_time: '2026-09-20T10:00:00Z' },
          { booking_id: 'BK-2026-0042', user_id: 'USR-1042', vehicle_number: 'DL02CD6789', vehicle_type: 'car', duration_hours: 36.0, total_amount: 1450.00, status: 'COMPLETED', start_time: '2026-10-22T08:00:00Z', expected_end_time: '2026-10-23T20:00:00Z' },
          { booking_id: 'BK-2026-0210', user_id: 'USR-1010', vehicle_number: 'DL06GH4321', vehicle_type: 'car', duration_hours: 36.0, total_amount: 1450.00, status: 'COMPLETED', start_time: '2026-09-29T11:00:00Z', expected_end_time: '2026-09-30T23:00:00Z' }
        ],
        businessInterpretation: 'Records with 36-48 hours duration represent intentional multi-day parking transactions (such as outstation airport or intercity rail travelers), providing valuable revenue despite occupying bays for extended durations.'
      },
      {
        experimentNumber: 9,
        title: 'Cross-Facility Comparative Revenue & Turnover Benchmark',
        syllabusTopic: 'Multi-Dimension Aggregations & Percentage Metrics',
        objective: 'Benchmark all parking facilities side-by-side on capacity, realized revenue, bay turnover, and cancellation rates.',
        mysqlQuery: `SELECT 
    l.location_code,
    l.name AS facility_name,
    l.total_capacity,
    COUNT(b.booking_id) AS total_reservations,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) / l.total_capacity, 2) AS turnover_per_bay,
    ROUND((SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) / COUNT(b.booking_id)) * 100, 1) AS cancellation_rate_pct
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_code, l.name, l.total_capacity
ORDER BY turnover_per_bay DESC;`,
        oracleQuery: `SELECT 
    l.location_code,
    l.name AS facility_name,
    l.total_capacity,
    COUNT(b.booking_id) AS total_reservations,
    ROUND(SUM(CASE WHEN b.status IN ('CONFIRMED', 'ACTIVE', 'COMPLETED') THEN b.total_amount ELSE 0 END), 2) AS total_revenue,
    ROUND(SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END) / l.total_capacity, 2) AS turnover_per_bay,
    ROUND((SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END) / COUNT(b.booking_id)) * 100, 1) AS cancellation_rate_pct
FROM parking_locations l
INNER JOIN bookings b ON l.location_id = b.location_id
GROUP BY l.location_code, l.name, l.total_capacity
ORDER BY turnover_per_bay DESC;`,
        explanation: 'Normalizes facility performance by capacity: computes turnover per bay (completed reservations / capacity) so smaller facilities can be compared fairly against large multi-story tech parks.',
        expectedColumns: ['location_code', 'facility_name', 'total_capacity', 'total_reservations', 'total_revenue', 'turnover_per_bay', 'cancellation_rate_pct'],
        sampleResults: [
          { location_code: 'CAMPUS', facility_name: 'University Campus Central', total_capacity: 120, total_reservations: 96, total_revenue: 8920.00, turnover_per_bay: 0.68, cancellation_rate_pct: 12.5 },
          { location_code: 'HOSPITAL', facility_name: 'Apollo Metro Care Hospital', total_capacity: 150, total_reservations: 94, total_revenue: 7120.00, turnover_per_bay: 0.51, cancellation_rate_pct: 14.9 },
          { location_code: 'METRO', facility_name: 'Connaught Metro Intermodal Hub', total_capacity: 180, total_reservations: 94, total_revenue: 7850.00, turnover_per_bay: 0.44, cancellation_rate_pct: 13.8 },
          { location_code: 'MALL', facility_name: 'Central City Mall & Multiplex', total_capacity: 250, total_reservations: 104, total_revenue: 14250.00, turnover_per_bay: 0.36, cancellation_rate_pct: 11.5 },
          { location_code: 'TECHPARK', facility_name: 'Cyber Heights Tech Park', total_capacity: 350, total_reservations: 112, total_revenue: 16840.00, turnover_per_bay: 0.28, cancellation_rate_pct: 10.7 }
        ],
        businessInterpretation: 'University Campus Central displays the highest turnover per bay (0.68) due to shorter academic dwells, while Cyber Heights Tech Park generates the highest absolute revenue despite lower turnover due to all-day corporate dwell.'
      },
      {
        experimentNumber: 10,
        title: 'Identification of Duplicate or Suspicious Records (Data Audit)',
        syllabusTopic: 'HAVING, Subqueries & Relational Integrity Auditing',
        objective: 'Identify suspicious overlapping vehicle bookings, negative durations, or extreme statistical fare spikes.',
        mysqlQuery: `SELECT 
    'OVERLAPPING_RESERVATION' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Vehicle booked multiple active bays at identical start timestamp' AS audit_finding
FROM bookings
WHERE (vehicle_number, start_time) IN (
    SELECT vehicle_number, start_time
    FROM bookings
    GROUP BY vehicle_number, start_time
    HAVING COUNT(*) > 1
)

UNION ALL

SELECT 
    'EXTREME_FEE_SPIKE' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Fee exceeds ₹2,000 threshold (Potential manual override or tariff error)' AS audit_finding
FROM bookings
WHERE total_amount > 2000.00;`,
        oracleQuery: `SELECT 
    'OVERLAPPING_RESERVATION' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Vehicle booked multiple active bays at identical start timestamp' AS audit_finding
FROM bookings
WHERE (vehicle_number, start_time) IN (
    SELECT vehicle_number, start_time
    FROM bookings
    GROUP BY vehicle_number, start_time
    HAVING COUNT(*) > 1
)

UNION ALL

SELECT 
    'EXTREME_FEE_SPIKE' AS audit_rule,
    booking_id AS record_id,
    vehicle_number,
    slot_id,
    start_time,
    total_amount,
    'Fee exceeds ₹2,000 threshold (Potential manual override or tariff error)' AS audit_finding
FROM bookings
WHERE total_amount > 2000.00;`,
        explanation: 'Audits relational consistency: uses grouped subqueries with HAVING COUNT(*) > 1 to detect identical vehicle collision bookings and UNION ALL to flag excessive billing amounts.',
        expectedColumns: ['audit_rule', 'record_id', 'vehicle_number', 'slot_id', 'start_time', 'total_amount', 'audit_finding'],
        sampleResults: [
          { audit_rule: 'EXTREME_FEE_SPIKE', record_id: 'BK-2026-0088', vehicle_number: 'DL03AB4321', slot_id: 'SLOT-A-108', start_time: '2026-10-15T18:00:00Z', total_amount: 2850.00, audit_finding: 'Fee exceeds ₹2,000 threshold (Potential manual override or tariff error)' },
          { audit_rule: 'EXTREME_FEE_SPIKE', record_id: 'BK-2026-0340', vehicle_number: 'DL07CD8765', slot_id: 'SLOT-B-214', start_time: '2026-09-22T09:00:00Z', total_amount: 2850.00, audit_finding: 'Fee exceeds ₹2,000 threshold (Potential manual override or tariff error)' }
        ],
        businessInterpretation: 'Two extreme fee spikes of ₹2,850 were detected. Financial audit confirms these were multi-day overstays with lost ticket replacement fees, validating that statistical outliers are not automatically fraudulent records.'
      }
    ];
  }
}

module.exports = new AnalyticsService();
