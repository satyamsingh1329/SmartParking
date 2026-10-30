/**
 * ParkPulse Analytics Dataset Exporter & Excel Syllabus Generator
 * Generates relational CSV exports from MongoDB and creates a complete Excel practicals workbook.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const ExcelJS = require('exceljs');

const User = require('../models/User');
const Booking = require('../models/Booking');
const ParkingLocation = require('../models/ParkingLocation');
const ParkingSession = require('../models/ParkingSession');

const DATASETS_DIR = path.join(__dirname, 'datasets');
if (!fs.existsSync(DATASETS_DIR)) {
  fs.mkdirSync(DATASETS_DIR, { recursive: true });
}

const escapeCSV = (val) => {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

async function exportActualDatabaseData() {
  console.log('[Dataset Exporter] 1. Extracting actual MongoDB collections...');

  // Customers
  const users = await User.find().select('-password').lean();
  const userHeaders = ['user_id', 'name', 'email', 'phone', 'role', 'reward_points', 'created_at'];
  const userRows = users.map((u) => [
    u._id, u.name, u.email, u.phone, u.role, u.rewardPoints || 0, u.createdAt?.toISOString() || ''
  ].map(escapeCSV).join(','));
  fs.writeFileSync(path.join(DATASETS_DIR, 'actual_customers.csv'), [userHeaders.join(','), ...userRows].join('\n'));

  // Locations
  const locations = await ParkingLocation.find().lean();
  const locHeaders = [
    'location_id', 'location_code', 'name', 'address', 'city', 'category',
    'total_floors', 'total_capacity', 'base_rate_car', 'base_rate_bike', 'base_rate_ev', 'is_active', 'created_at'
  ];
  const locRows = locations.map((l) => [
    l._id, l.code || 'CAMPUS', l.name, l.address, l.city, l.category,
    l.totalFloors || 1, l.totalCapacity || 0,
    l.baseRates?.car || 40, l.baseRates?.bike || 20, l.baseRates?.ev || 50,
    l.isActive ? 'true' : 'false', l.createdAt?.toISOString() || ''
  ].map(escapeCSV).join(','));
  fs.writeFileSync(path.join(DATASETS_DIR, 'actual_parking_locations.csv'), [locHeaders.join(','), ...locRows].join('\n'));

  // Bookings
  const bookings = await Booking.find().lean();
  const bHeaders = [
    'booking_id', 'user_id', 'location_id', 'slot_id', 'vehicle_number', 'vehicle_type',
    'start_time', 'expected_end_time', 'duration_hours', 'base_amount', 'surge_multiplier',
    'surge_amount', 'convenience_fee', 'total_amount', 'status', 'payment_status',
    'check_in_time', 'check_out_time', 'created_at'
  ];
  const bRows = bookings.map((b) => [
    b.bookingId, b.userId, b.locationId, b.slotId, b.vehicleNumber, b.vehicleType,
    b.startTime?.toISOString() || '', b.expectedEndTime?.toISOString() || '',
    b.durationHours, b.baseAmount, b.surgeMultiplier || 1.0, b.surgeAmount || 0,
    b.convenienceFee || 0, b.totalAmount, b.status, b.paymentStatus,
    b.checkInTime?.toISOString() || '', b.checkOutTime?.toISOString() || '',
    b.createdAt?.toISOString() || ''
  ].map(escapeCSV).join(','));
  fs.writeFileSync(path.join(DATASETS_DIR, 'actual_bookings.csv'), [bHeaders.join(','), ...bRows].join('\n'));

  // Sessions
  const sessions = await ParkingSession.find().lean();
  const sHeaders = [
    'session_id', 'booking_id', 'slot_id', 'user_id', 'vehicle_number',
    'entry_time', 'exit_time', 'expected_exit_time', 'duration_minutes',
    'overstay_duration_minutes', 'overstay_fee', 'total_billed', 'status', 'created_at'
  ];
  const sRows = sessions.map((s) => {
    let dur = 0;
    if (s.exitTime && s.entryTime) {
      dur = Math.round((new Date(s.exitTime) - new Date(s.entryTime)) / 60000);
    }
    return [
      s._id, s.bookingId || '', s.slotId, s.userId || '', s.vehicleNumber,
      s.entryTime?.toISOString() || '', s.exitTime?.toISOString() || '', s.expectedExitTime?.toISOString() || '',
      dur, s.overstayDurationMinutes || 0, s.overstayFee || 0, s.totalBilled || 0, s.status,
      s.createdAt?.toISOString() || ''
    ].map(escapeCSV).join(',');
  });
  fs.writeFileSync(path.join(DATASETS_DIR, 'actual_parking_sessions.csv'), [sHeaders.join(','), ...sRows].join('\n'));

  console.log(`[Dataset Exporter] Extracted: ${users.length} actual users, ${bookings.length} bookings, ${locations.length} locations, ${sessions.length} sessions.`);
}

function generateSyllabusRelationalDatasets() {
  console.log('[Dataset Exporter] 2. Generating comprehensive 500-record relational syllabus dataset...');

  // 1. Locations (5 facilities)
  const locations = [
    { location_id: 'LOC-101', location_code: 'CAMPUS', name: 'University Campus Central', address: 'Academic Block 4, North Campus Ave', city: 'New Delhi', category: 'campus', total_floors: 3, total_capacity: 120, base_rate_car: 40, base_rate_bike: 20, base_rate_ev: 50, is_active: 'true', created_at: '2026-01-01T08:00:00Z' },
    { location_id: 'LOC-102', location_code: 'MALL', name: 'Central City Mall & Multiplex', address: 'Sector 18 Commercial Hub', city: 'Noida', category: 'mall', total_floors: 4, total_capacity: 250, base_rate_car: 50, base_rate_bike: 25, base_rate_ev: 60, is_active: 'true', created_at: '2026-01-01T08:00:00Z' },
    { location_id: 'LOC-103', location_code: 'TECHPARK', name: 'Cyber Heights Tech Park', address: 'Plot 12, Electronic City Phase 1', city: 'Bengaluru', category: 'techpark', total_floors: 5, total_capacity: 350, base_rate_car: 60, base_rate_bike: 30, base_rate_ev: 70, is_active: 'true', created_at: '2026-01-01T08:00:00Z' },
    { location_id: 'LOC-104', location_code: 'METRO', name: 'Connaught Metro Intermodal Hub', address: 'Radial Road 3, Inner Circle', city: 'New Delhi', category: 'metro', total_floors: 2, total_capacity: 180, base_rate_car: 35, base_rate_bike: 15, base_rate_ev: 45, is_active: 'true', created_at: '2026-01-01T08:00:00Z' },
    { location_id: 'LOC-105', location_code: 'HOSPITAL', name: 'Apollo Metro Care Hospital', address: 'Health City Complex, Ring Road', city: 'Gurugram', category: 'hospital', total_floors: 3, total_capacity: 150, base_rate_car: 30, base_rate_bike: 10, base_rate_ev: 40, is_active: 'true', created_at: '2026-01-01T08:00:00Z' }
  ];

  // 2. Customers (100 customers, including some who have ZERO bookings for SQL/Excel testing!)
  const firstNames = ['Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan', 'Shaurya', 'Ananya', 'Diya', 'Rhea', 'Pari', 'Anushka', 'Aadhya', 'Isha', 'Myra', 'Tara', 'Alex', 'Sarah', 'John', 'Elena', 'Michael', 'Priya', 'Rohit', 'Siddharth', 'Neha', 'Kavita'];
  const lastNames = ['Sharma', 'Verma', 'Patel', 'Reddy', 'Mehta', 'Nair', 'Iyer', 'Gupta', 'Singh', 'Chopra', 'Malhotra', 'Bhatia', 'Deshmukh', 'Joshi', 'Kulkarni', 'Kapoor', 'Das', 'Roy', 'Sen', 'Kumar'];
  
  const customers = [];
  for (let i = 1; i <= 100; i++) {
    const fn = firstNames[(i - 1) % firstNames.length];
    const ln = lastNames[(i * 3) % lastNames.length];
    const role = i === 1 ? 'ADMIN' : i === 2 ? 'GATEKEEPER' : 'USER';
    const rewardPoints = i % 7 === 0 ? 0 : Math.floor(50 + Math.random() * 850);
    const id = `USR-${1000 + i}`;
    customers.push({
      user_id: id,
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@parkpulse.io`,
      phone: `+91 98${Math.floor(10000000 + Math.random() * 89999999)}`,
      role,
      reward_points: rewardPoints,
      created_at: new Date(Date.now() - (90 + i) * 86400000).toISOString()
    });
  }

  // 3. Bookings & Sessions (500 records spanning past 90 days)
  const bookings = [];
  const sessions = [];
  const vehicleTypes = ['car', 'car', 'car', 'bike', 'bike', 'ev', 'truck'];
  const statuses = ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'CANCELLED', 'ACTIVE', 'NO_SHOW', 'EXPIRED'];
  
  // Note: We use customers 1 through 85 for bookings. Customers 86 through 100 have ZERO bookings.
  // This satisfies the college syllabus requirement: "Customers with zero bookings (LEFT JOIN / COUNTIFS)"!

  const baseDate = new Date();
  
  for (let b = 1; b <= 500; b++) {
    const user = customers[(b * 7) % 85]; // 0 to 84 (leaves 85 to 99 with zero bookings)
    const loc = locations[b % locations.length];
    const vType = vehicleTypes[b % vehicleTypes.length];
    const status = statuses[b % statuses.length];

    // Days ago between 0 and 90
    const dayAgo = (b * 13) % 90;
    // Hour between 7 and 22, with peak distribution around 9-11 AM and 5-8 PM
    let hour = 8 + ((b * 5) % 14);
    if (b % 3 === 0) hour = 9 + (b % 3); // Morning peak
    if (b % 4 === 0) hour = 17 + (b % 4); // Evening peak

    const startTime = new Date(baseDate.getTime() - dayAgo * 86400000);
    startTime.setHours(hour, (b * 11) % 60, 0, 0);

    // Duration: typically 1 to 6 hours
    let durationHours = 1 + (b % 5) * 0.5;
    
    // Syllabus Outlier Injection:
    // Outliers #1 & #2: Extreme dwell / overstay duration (e.g. 36 hours and 48 hours)
    // Outliers #3 & #4: Extreme revenue fee (> ₹2500 for multi-day VIP / lost ticket penalty)
    let isOutlier = false;
    if (b === 42 || b === 210) {
      durationHours = 36; // Duration outlier
      isOutlier = true;
    } else if (b === 105 || b === 375) {
      durationHours = 48; // Extreme duration outlier
      isOutlier = true;
    }

    const expectedEndTime = new Date(startTime.getTime() + durationHours * 3600000);
    
    let rate = loc.base_rate_car;
    if (vType === 'bike') rate = loc.base_rate_bike;
    if (vType === 'ev') rate = loc.base_rate_ev;
    if (vType === 'truck') rate = loc.base_rate_car * 1.8;

    let baseAmount = Math.round(durationHours * rate);
    const surgeMultiplier = (hour >= 9 && hour <= 11) || (hour >= 17 && hour <= 20) ? 1.25 : 1.0;
    const surgeAmount = surgeMultiplier > 1.0 ? Math.round(baseAmount * (surgeMultiplier - 1.0)) : 0;
    const convenienceFee = 10;
    const discountAmount = user.reward_points > 500 && b % 5 === 0 ? 25 : 0;
    
    let totalAmount = baseAmount + surgeAmount + convenienceFee - discountAmount;
    if (b === 88 || b === 340) {
      totalAmount = 2850; // Extreme revenue upper outlier
    }

    const bId = `BK-2026-${String(b).padStart(4, '0')}`;
    const sId = `SES-2026-${String(b).padStart(4, '0')}`;
    const slotNum = `${String.fromCharCode(65 + (b % 4))}-${(b % 3) + 1}${String((b % 20) + 1).padStart(2, '0')}`;
    const vehicleNum = `DL${String((b % 12) + 1).padStart(2, '0')}${String.fromCharCode(65 + (b % 26))}${String.fromCharCode(65 + ((b + 3) % 26))}${1000 + (b % 9000)}`;

    const checkInTime = status === 'COMPLETED' || status === 'ACTIVE' ? startTime : null;
    const checkOutTime = status === 'COMPLETED' ? expectedEndTime : null;
    const paymentStatus = status === 'CANCELLED' ? 'refunded' : status === 'NO_SHOW' ? 'failed' : 'paid';

    bookings.push({
      booking_id: bId,
      user_id: user.user_id,
      location_id: loc.location_id,
      slot_id: `SLOT-${slotNum}`,
      vehicle_number: vehicleNum,
      vehicle_type: vType,
      start_time: startTime.toISOString(),
      expected_end_time: expectedEndTime.toISOString(),
      duration_hours: durationHours,
      base_amount: baseAmount,
      surge_multiplier: surgeMultiplier,
      surge_amount: surgeAmount,
      convenience_fee: convenienceFee,
      total_amount: totalAmount,
      status,
      payment_status: paymentStatus,
      check_in_time: checkInTime ? checkInTime.toISOString() : '',
      check_out_time: checkOutTime ? checkOutTime.toISOString() : '',
      created_at: new Date(startTime.getTime() - 15 * 60000).toISOString()
    });

    if (status === 'COMPLETED' || status === 'ACTIVE') {
      const durationMins = Math.round(durationHours * 60);
      const overstayMins = isOutlier ? (durationHours - 4) * 60 : 0;
      const overstayFee = overstayMins > 0 ? Math.round(overstayMins * 1.5) : 0;

      sessions.push({
        session_id: sId,
        booking_id: bId,
        slot_id: `SLOT-${slotNum}`,
        user_id: user.user_id,
        vehicle_number: vehicleNum,
        entry_time: startTime.toISOString(),
        exit_time: checkOutTime ? checkOutTime.toISOString() : '',
        expected_exit_time: expectedEndTime.toISOString(),
        duration_minutes: durationMins,
        overstay_duration_minutes: overstayMins,
        overstay_fee: overstayFee,
        total_billed: totalAmount + overstayFee,
        status: status === 'ACTIVE' ? 'ACTIVE' : 'COMPLETED',
        created_at: startTime.toISOString()
      });
    }
  }

  // Write files to analytics/datasets/
  writeCSV(path.join(DATASETS_DIR, 'parking_locations.csv'), locations);
  writeCSV(path.join(DATASETS_DIR, 'customers.csv'), customers);
  writeCSV(path.join(DATASETS_DIR, 'bookings.csv'), bookings);
  writeCSV(path.join(DATASETS_DIR, 'parking_sessions.csv'), sessions);

  console.log(`[Dataset Exporter] Generated relational datasets:`);
  console.log(`  - ${locations.length} parking locations`);
  console.log(`  - ${customers.length} customers (15 with 0 bookings)`);
  console.log(`  - ${bookings.length} bookings`);
  console.log(`  - ${sessions.length} parking sessions`);

  return { locations, customers, bookings, sessions };
}

function writeCSV(filePath, array) {
  if (array.length === 0) return;
  const headers = Object.keys(array[0]);
  const rows = array.map((item) => headers.map((h) => escapeCSV(item[h])).join(','));
  fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
}

async function createExcelWorkbook({ locations, customers, bookings, sessions }) {
  console.log('[Dataset Exporter] 3. Building syllabus Excel practicals workbook (ParkPulse_Analytics_Practicals.xlsx)...');

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ParkPulse BI Platform';
  workbook.lastModifiedBy = 'Data Analytics Student';
  workbook.created = new Date();

  // -------------------------------------------------------------
  // Sheet 1: Bookings_Data
  // -------------------------------------------------------------
  const wsBookings = workbook.addWorksheet('Bookings_Data', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsBookings.columns = [
    { header: 'Booking_ID', key: 'booking_id', width: 16 },
    { header: 'User_ID', key: 'user_id', width: 14 },
    { header: 'Location_ID', key: 'location_id', width: 14 },
    { header: 'Slot_ID', key: 'slot_id', width: 14 },
    { header: 'Vehicle_Number', key: 'vehicle_number', width: 16 },
    { header: 'Vehicle_Type', key: 'vehicle_type', width: 14 },
    { header: 'Start_Time', key: 'start_time', width: 22 },
    { header: 'Expected_End_Time', key: 'expected_end_time', width: 22 },
    { header: 'Duration_Hours', key: 'duration_hours', width: 16 },
    { header: 'Base_Amount', key: 'base_amount', width: 14 },
    { header: 'Surge_Multiplier', key: 'surge_multiplier', width: 16 },
    { header: 'Surge_Amount', key: 'surge_amount', width: 14 },
    { header: 'Convenience_Fee', key: 'convenience_fee', width: 16 },
    { header: 'Total_Amount', key: 'total_amount', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Payment_Status', key: 'payment_status', width: 16 }
  ];

  bookings.forEach((b) => {
    wsBookings.addRow({
      booking_id: b.booking_id,
      user_id: b.user_id,
      location_id: b.location_id,
      slot_id: b.slot_id,
      vehicle_number: b.vehicle_number,
      vehicle_type: b.vehicle_type,
      start_time: b.start_time,
      expected_end_time: b.expected_end_time,
      duration_hours: Number(b.duration_hours),
      base_amount: Number(b.base_amount),
      surge_multiplier: Number(b.surge_multiplier),
      surge_amount: Number(b.surge_amount),
      convenience_fee: Number(b.convenience_fee),
      total_amount: Number(b.total_amount),
      status: b.status,
      payment_status: b.payment_status
    });
  });

  formatHeaderRow(wsBookings);

  // -------------------------------------------------------------
  // Sheet 2: Customers
  // -------------------------------------------------------------
  const wsCust = workbook.addWorksheet('Customers', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsCust.columns = [
    { header: 'User_ID', key: 'user_id', width: 14 },
    { header: 'Name', key: 'name', width: 22 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Phone', key: 'phone', width: 18 },
    { header: 'Role', key: 'role', width: 14 },
    { header: 'Reward_Points', key: 'reward_points', width: 16 },
    { header: 'Created_At', key: 'created_at', width: 22 }
  ];
  customers.forEach((c) => wsCust.addRow(c));
  formatHeaderRow(wsCust);

  // -------------------------------------------------------------
  // Sheet 3: Locations
  // -------------------------------------------------------------
  const wsLoc = workbook.addWorksheet('Locations', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsLoc.columns = [
    { header: 'Location_ID', key: 'location_id', width: 14 },
    { header: 'Location_Code', key: 'location_code', width: 16 },
    { header: 'Facility_Name', key: 'name', width: 30 },
    { header: 'City', key: 'city', width: 16 },
    { header: 'Category', key: 'category', width: 14 },
    { header: 'Total_Capacity', key: 'total_capacity', width: 16 },
    { header: 'Rate_Car', key: 'base_rate_car', width: 12 },
    { header: 'Rate_Bike', key: 'base_rate_bike', width: 12 },
    { header: 'Rate_EV', key: 'base_rate_ev', width: 12 }
  ];
  locations.forEach((l) => wsLoc.addRow(l));
  formatHeaderRow(wsLoc);

  // -------------------------------------------------------------
  // Sheet 4: Formula_Practicals (Syllabus Demonstration)
  // Demonstrates IF, Nested IF, AND, OR, IFERROR, VLOOKUP, XLOOKUP, Outliers
  // -------------------------------------------------------------
  const wsFormulas = workbook.addWorksheet('Formula_Practicals', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsFormulas.columns = [
    { header: 'Row_Ref', key: 'ref', width: 10 },
    { header: 'Booking_ID', key: 'booking_id', width: 16 },
    { header: 'Customer_Name (XLOOKUP)', key: 'cust_name', width: 24 },
    { header: 'Facility_Name (VLOOKUP)', key: 'fac_name', width: 28 },
    { header: 'Vehicle_Type', key: 'v_type', width: 14 },
    { header: 'Duration_Hours', key: 'dur', width: 15 },
    { header: 'Total_Amount', key: 'amt', width: 14 },
    { header: 'Status', key: 'status', width: 16 },
    { header: 'Syllabus_IF (Settlement State)', key: 'f_if', width: 26 },
    { header: 'Syllabus_Nested_IF (Tier Rating)', key: 'f_nested_if', width: 30 },
    { header: 'Syllabus_AND_OR (High-Yield Flag)', key: 'f_and_or', width: 28 },
    { header: 'Syllabus_IFERROR_Check', key: 'f_iferror', width: 24 },
    { header: 'Outlier_Flag (>3h Duration / Spike)', key: 'f_outlier', width: 32 }
  ];

  // Populate first 50 rows with exact dynamic Excel formulas!
  for (let r = 2; r <= 52; r++) {
    wsFormulas.addRow({
      ref: `R${r}`,
      booking_id: { formula: `Bookings_Data!A${r}` },
      cust_name: { formula: `XLOOKUP(Bookings_Data!B${r}, Customers!A:A, Customers!B:B, "Guest User")` },
      fac_name: { formula: `VLOOKUP(Bookings_Data!C${r}, Locations!A:C, 3, FALSE)` },
      v_type: { formula: `Bookings_Data!F${r}` },
      dur: { formula: `Bookings_Data!I${r}` },
      amt: { formula: `Bookings_Data!N${r}` },
      status: { formula: `Bookings_Data!O${r}` },
      f_if: { formula: `IF(Bookings_Data!O${r}="COMPLETED", "Settled & Verified", "Unsettled / Pending")` },
      f_nested_if: {
        formula: `IF(Bookings_Data!N${r}>250, "Tier 1 (Premium / Surge)", IF(Bookings_Data!N${r}>100, "Tier 2 (Standard)", "Tier 3 (Short-Stay)"))`
      },
      f_and_or: {
        formula: `IF(AND(Bookings_Data!N${r}>150, OR(Bookings_Data!F${r}="car", Bookings_Data!F${r}="ev")), "★ High-Yield Asset", "Standard Dwell")`
      },
      f_iferror: {
        formula: `IFERROR(VLOOKUP(Bookings_Data!C${r}, Locations!A:C, 3, FALSE), "Location Not Found")`
      },
      f_outlier: {
        formula: `IF(OR(Bookings_Data!I${r}>24, Bookings_Data!N${r}>1500), "🚨 STATISTICAL OUTLIER", "NORMAL")`
      }
    });
  }
  formatHeaderRow(wsFormulas);

  // -------------------------------------------------------------
  // Sheet 5: Summary_KPIs_Formulas
  // Demonstrates SUMIF, SUMIFS, AVERAGEIF, AVERAGEIFS, COUNTIF, COUNTIFS, MEAN, MEDIAN, MODE, STDEV, IQR
  // -------------------------------------------------------------
  const wsKPIs = workbook.addWorksheet('Summary_KPIs_Formulas');
  wsKPIs.columns = [
    { header: 'Syllabus Function Category', key: 'cat', width: 30 },
    { header: 'Business KPI Metric Description', key: 'desc', width: 42 },
    { header: 'Active Excel Formula', key: 'formula_text', width: 45 },
    { header: 'Computed Excel Value', key: 'val', width: 22 }
  ];

  const kpiRows = [
    ['COUNTIF', 'Total Completed Bookings', '=COUNTIF(Bookings_Data!O:O, "COMPLETED")', { formula: 'COUNTIF(Bookings_Data!O:O, "COMPLETED")' }],
    ['COUNTIF', 'Total Cancelled Bookings', '=COUNTIF(Bookings_Data!O:O, "CANCELLED")', { formula: 'COUNTIF(Bookings_Data!O:O, "CANCELLED")' }],
    ['COUNTIFS', 'Cancelled Four-Wheeler Reservations', '=COUNTIFS(Bookings_Data!F:F, "car", Bookings_Data!O:O, "CANCELLED")', { formula: 'COUNTIFS(Bookings_Data!F:F, "car", Bookings_Data!O:O, "CANCELLED")' }],
    ['SUMIF', 'Total Revenue from Electric Vehicles (EV)', '=SUMIF(Bookings_Data!F:F, "ev", Bookings_Data!N:N)', { formula: 'SUMIF(Bookings_Data!F:F, "ev", Bookings_Data!N:N)' }],
    ['SUMIFS', 'Realized Revenue (Car + Completed)', '=SUMIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")', { formula: 'SUMIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")' }],
    ['AVERAGEIF', 'Average Fee across Two-Wheelers (Bikes)', '=AVERAGEIF(Bookings_Data!F:F, "bike", Bookings_Data!N:N)', { formula: 'AVERAGEIF(Bookings_Data!F:F, "bike", Bookings_Data!N:N)' }],
    ['AVERAGEIFS', 'Average Completed Booking Fare (Cars)', '=AVERAGEIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")', { formula: 'AVERAGEIFS(Bookings_Data!N:N, Bookings_Data!F:F, "car", Bookings_Data!O:O, "COMPLETED")' }],
    ['STATISTICAL (MEAN)', 'Mean Parking Duration (Hours)', '=AVERAGE(Bookings_Data!I2:I501)', { formula: 'AVERAGE(Bookings_Data!I2:I501)' }],
    ['STATISTICAL (MEDIAN)', 'Median Parking Duration (Hours)', '=MEDIAN(Bookings_Data!I2:I501)', { formula: 'MEDIAN(Bookings_Data!I2:I501)' }],
    ['STATISTICAL (MODE)', 'Mode Duration (Most Frequent Dwell)', '=MODE.SNGL(Bookings_Data!I2:I501)', { formula: 'MODE.SNGL(Bookings_Data!I2:I501)' }],
    ['STATISTICAL (MEAN)', 'Mean Revenue per Booking (₹)', '=AVERAGE(Bookings_Data!N2:N501)', { formula: 'AVERAGE(Bookings_Data!N2:N501)' }],
    ['STATISTICAL (MEDIAN)', 'Median Revenue per Booking (₹)', '=MEDIAN(Bookings_Data!N2:N501)', { formula: 'MEDIAN(Bookings_Data!N2:N501)' }],
    ['STATISTICAL (STDEV)', 'Standard Deviation of Revenue (Sample)', '=STDEV.S(Bookings_Data!N2:N501)', { formula: 'STDEV.S(Bookings_Data!N2:N501)' }],
    ['IQR OUTLIER DETECTION', 'Q1 (25th Percentile Duration)', '=QUARTILE.INC(Bookings_Data!I2:I501, 1)', { formula: 'QUARTILE.INC(Bookings_Data!I2:I501, 1)' }],
    ['IQR OUTLIER DETECTION', 'Q3 (75th Percentile Duration)', '=QUARTILE.INC(Bookings_Data!I2:I501, 3)', { formula: 'QUARTILE.INC(Bookings_Data!I2:I501, 3)' }],
    ['IQR OUTLIER DETECTION', 'IQR (Inter-Quartile Range)', '=D16 - D15', { formula: 'D16-D15' }],
    ['IQR OUTLIER DETECTION', 'Upper Fence Threshold (Q3 + 1.5*IQR)', '=D16 + (1.5 * D17)', { formula: 'D16+(1.5*D17)' }],
    ['OUTLIERS COUNT', 'Total Extreme Outliers Detected', '=COUNTIF(Formula_Practicals!M:M, "*OUTLIER*")', { formula: 'COUNTIF(Formula_Practicals!M:M, "*OUTLIER*")' }]
  ];

  kpiRows.forEach((r) => {
    wsKPIs.addRow({
      cat: r[0],
      desc: r[1],
      formula_text: r[2],
      val: r[3]
    });
  });
  formatHeaderRow(wsKPIs);

  // -------------------------------------------------------------
  // Sheet 6: Pivot_Guide_&_Scenarios
  // Step-by-step Pivot Table construction instructions
  // -------------------------------------------------------------
  const wsPivot = workbook.addWorksheet('Pivot_Guide_&_Scenarios');
  wsPivot.columns = [
    { header: 'Pivot Table Number', key: 'p_num', width: 20 },
    { header: 'Analysis Goal', key: 'goal', width: 35 },
    { header: 'Rows (Grouping Dimension)', key: 'rows', width: 28 },
    { header: 'Columns (Segmentation)', key: 'cols', width: 24 },
    { header: 'Values (Aggregation Function)', key: 'vals', width: 32 },
    { header: 'Report Filters / Slicers', key: 'filters', width: 28 }
  ];

  const pivotGuide = [
    ['Pivot 1: Revenue by Facility & Vehicle', 'Facility Revenue Performance Matrix', 'Location_ID (or VLOOKUP Name)', 'Vehicle_Type', 'Sum of Total_Amount (Currency format)', 'Status (Filter for COMPLETED)'],
    ['Pivot 2: Peak Hours vs Day-of-Week', 'Ingress Velocity & Peak Density Heatmap', 'Start_Time (Group by Hour 0-23)', 'Start_Time (Group by Weekdays)', 'Count of Booking_ID', 'Location_ID'],
    ['Pivot 3: Lifecycle Conversion & Attrition', 'Cancellation & No-Show Breakdown', 'Location_ID', 'Status', 'Count of Booking_ID (% of Row)', 'Vehicle_Type'],
    ['Pivot 4: Average Duration & Yield', 'Dwell Time & Average Fare per Bay', 'Vehicle_Type', 'Surge_Multiplier', 'Average of Duration_Hours, Average of Total_Amount', 'Payment_Status = paid']
  ];

  pivotGuide.forEach((p) => {
    wsPivot.addRow({
      p_num: p[0],
      goal: p[1],
      rows: p[2],
      cols: p[3],
      vals: p[4],
      filters: p[5]
    });
  });
  formatHeaderRow(wsPivot);

  const excelPath = path.join(__dirname, 'ParkPulse_Analytics_Practicals.xlsx');
  await workbook.xlsx.writeFile(excelPath);
  console.log(`[Dataset Exporter] Successfully written Excel Workbook to: ${excelPath}`);
}

function formatHeaderRow(worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F172A' }
    };
    cell.font = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FF38BDF8' }
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF06B6D4' } }
    };
  });
}

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/parkpulse';
    try {
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      console.log('[Dataset Exporter] Connected to MongoDB');
      await exportActualDatabaseData();
    } catch (dbErr) {
      console.warn(`[Dataset Exporter] MongoDB unavailable (${dbErr.message}). Generating verified 500-record relational syllabus datasets & Excel workbook...`);
    }

    const syllabusData = generateSyllabusRelationalDatasets();
    await createExcelWorkbook(syllabusData);

    console.log('[Dataset Exporter] ALL EXPORT TASKS FINISHED SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('[Dataset Exporter Error]', err);
    process.exit(1);
  }
}

run();
