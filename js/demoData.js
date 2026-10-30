/**
 * ParkPulse Static Demo Dataset for GitHub Pages
 * Provides realistic domain data for facilities, bay slots, analytics, and SQL labs
 * when running without an active backend server.
 */

export const DEMO_LOCATIONS = [
  {
    _id: "loc_campus",
    name: "Central Campus Hub",
    code: "CAMPUS",
    address: "Academic Block 4, North Campus Ave",
    city: "New Delhi",
    category: "campus",
    totalFloors: 3,
    zones: ["A", "B", "C", "D"],
    operatingHours: "24/7",
    amenities: ["EV Superchargers", "24/7 CCTV", "Covered Parking", "Accessible Ramp", "RFID Gate"],
    image: "./assets/parking-campus.jpg",
    baseRates: { car: 30, bike: 15, ev: 45, vip: 60, accessible: 25 },
    stats: { total: 40, available: 18, occupied: 16, reserved: 6, occupancyRate: 55, congestion: "MODERATE" }
  },
  {
    _id: "loc_mall",
    name: "Central City Mall & Multiplex",
    code: "MALL",
    address: "Sector 18 Commercial Hub",
    city: "Noida",
    category: "mall",
    totalFloors: 4,
    zones: ["A", "B", "C"],
    operatingHours: "09:00 AM – 11:30 PM",
    amenities: ["Valet Service", "EV Fast Charging", "Car Wash Bay", "Underground Surveillance"],
    image: "./assets/parking-mall.jpg",
    baseRates: { car: 40, bike: 20, ev: 55, vip: 80, accessible: 30 },
    stats: { total: 50, available: 12, occupied: 31, reserved: 7, occupancyRate: 76, congestion: "HIGH" }
  },
  {
    _id: "loc_techpark",
    name: "Cyber Heights Tech Park",
    code: "TECHPARK",
    address: "Phase 2 Electronic City",
    city: "Bengaluru",
    category: "techpark",
    totalFloors: 5,
    zones: ["A", "B", "C", "D"],
    operatingHours: "24/7",
    amenities: ["Automated Barrier", "LPR Camera", "Fast Charging", "Shuttle Service"],
    image: "./assets/parking-corporate.jpg",
    baseRates: { car: 50, bike: 25, ev: 65, vip: 100, accessible: 35 },
    stats: { total: 60, available: 26, occupied: 28, reserved: 6, occupancyRate: 57, congestion: "MODERATE" }
  },
  {
    _id: "loc_hospital",
    name: "Apollo Metro Health City",
    code: "HOSPITAL",
    address: "Health City Ring Road",
    city: "New Delhi",
    category: "hospital",
    totalFloors: 2,
    zones: ["A", "B"],
    operatingHours: "24/7 Priority Emergency Access",
    amenities: ["24/7 Emergency Drop", "Ambulance Priority", "Wheelchair Support", "Direct Lift Access"],
    image: "./assets/parking-hospital.jpg",
    baseRates: { car: 25, bike: 10, ev: 40, vip: 50, accessible: 20 },
    stats: { total: 35, available: 14, occupied: 17, reserved: 4, occupancyRate: 60, congestion: "MODERATE" }
  },
  {
    _id: "loc_railway",
    name: "Grand Central Railway Terminal",
    code: "RAILWAY",
    address: "Platform 1 North Entry Plaza",
    city: "New Delhi",
    category: "metro",
    totalFloors: 2,
    zones: ["A", "B", "C"],
    operatingHours: "24/7",
    amenities: ["Long-Term Stay", "CCTV 360", "Luggage Assistance", "Fastag / ANPR Gate"],
    image: "./assets/parking-transit.jpg",
    baseRates: { car: 35, bike: 15, ev: 50, vip: 70, accessible: 25 },
    stats: { total: 45, available: 19, occupied: 21, reserved: 5, occupancyRate: 58, congestion: "MODERATE" }
  }
];

export function generateDemoSlots(locationId = "loc_campus", floor = 1) {
  const slots = [];
  const loc = DEMO_LOCATIONS.find(l => l._id === locationId) || DEMO_LOCATIONS[0];
  const zones = loc.zones || ["A", "B"];
  let slotIndex = 1;

  for (const zone of zones) {
    for (let num = 1; num <= 6; num++) {
      const slotNumber = `${zone}-${floor}0${num}`;
      let status = "available";
      if ((num + floor) % 3 === 0) status = "occupied";
      else if ((num + floor) % 5 === 0) status = "reserved";

      let vehicleType = "car";
      let isEV = false;
      let isAccessible = false;

      if (num === 1) {
        vehicleType = "ev";
        isEV = true;
      } else if (num === 2) {
        vehicleType = "accessible";
        isAccessible = true;
      } else if (num === 3) {
        vehicleType = "bike";
      }

      slots.push({
        _id: `slot_${locationId}_f${floor}_${slotNumber}`,
        locationId: loc,
        slotNumber,
        floor: Number(floor),
        zone,
        vehicleType,
        status,
        baseRate: loc.baseRates[vehicleType] || 30,
        isEV,
        isAccessible,
        currentSession: status === "occupied" ? {
          startTime: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          vehiclePlate: `DL 01 AB ${1000 + slotIndex}`
        } : null
      });
      slotIndex++;
    }
  }
  return slots;
}

export const DEMO_ANALYTICS_OVERVIEW = {
  descriptive: {
    totalReservations: 500,
    completedBookings: 432,
    activeSessions: 42,
    cancelledBookings: 26,
    grossRevenue: 128450,
    averageTransactionValue: 297.34,
    averageParkingDurationHours: 3.42,
    overallOccupancyRate: 64.8,
    fleetDistribution: { car: 280, bike: 110, ev: 75, suv: 35 },
    topFacilityByRevenue: { name: "Cyber Heights Tech Park", revenue: 46200 },
    topFacilityByVolume: { name: "Central Campus Hub", count: 185 },
    timeTrends: {
      daily: [
        { date: "2026-10-24", count: 68, revenue: 17400 },
        { date: "2026-10-25", count: 72, revenue: 18650 },
        { date: "2026-10-26", count: 64, revenue: 16200 },
        { date: "2026-10-27", count: 79, revenue: 20450 },
        { date: "2026-10-28", count: 83, revenue: 21800 },
        { date: "2026-10-29", count: 71, revenue: 18300 },
        { date: "2026-10-30", count: 63, revenue: 15650 }
      ],
      hourlyDemand: [
        { hour: 8, count: 28 }, { hour: 9, count: 52 }, { hour: 10, count: 68 },
        { hour: 11, count: 64 }, { hour: 12, count: 48 }, { hour: 13, count: 36 },
        { hour: 14, count: 32 }, { hour: 15, count: 42 }, { hour: 16, count: 58 },
        { hour: 17, count: 72 }, { hour: 18, count: 65 }, { hour: 19, count: 45 }
      ],
      weekdayDemand: [
        { day: "Sun", count: 48, revenue: 12400 },
        { day: "Mon", count: 82, revenue: 21800 },
        { day: "Tue", count: 86, revenue: 22600 },
        { day: "Wed", count: 84, revenue: 22100 },
        { day: "Thu", count: 88, revenue: 23400 },
        { day: "Fri", count: 74, revenue: 19250 },
        { day: "Sat", count: 38, revenue: 9900 }
      ]
    }
  },
  diagnostic: {
    revenueDrivers: [
      { factor: "Weekday Corporate Dwell Time", impact: "+34% Revenue", description: "Higher average booking duration (4.8h) at Cyber Heights Tech Park" },
      { factor: "Off-Peak Midday Footfall Drop", impact: "-22% Occupancy", description: "Utilization consistently drops below 40% between 1:00 PM and 3:30 PM" },
      { factor: "EV Supercharging Fleet Growth", impact: "+18% Revenue", description: "EV bays generate 1.5x revenue per square meter relative to standard bays" }
    ],
    underutilizedFacilities: [
      { name: "Apollo Metro Health City", occupancy: 42, reason: "Excess designated VIP bays during off-peak morning hours" },
      { name: "Grand Central Railway Terminal", occupancy: 48, reason: "Long-term traveler turnover slower on Tuesdays and Wednesdays" }
    ],
    cancellationAnalysis: {
      totalCancelled: 26,
      cancellationRate: 5.2,
      primaryReason: "Driver ETA delays exceeding 15-minute grace period"
    }
  },
  predictive: {
    method: "7-Day Weighted Moving Average (WMA) with Day-of-Week Seasonality Decomposition",
    limitations: "Forecast reflects regular semester operational patterns; does not account for unscheduled civic holidays or extreme rain events.",
    confidenceInterval: "95% (±1.96σ)",
    historicalDailyAverages: [68, 72, 64, 79, 83, 71, 63],
    forecast: [
      { date: "2026-10-31 (Sat)", day: "Saturday", predictedDemand: 42, lowerBound: 36, upperBound: 48, predictedRevenue: 10800 },
      { date: "2026-11-01 (Sun)", day: "Sunday", predictedDemand: 46, lowerBound: 40, upperBound: 52, predictedRevenue: 11900 },
      { date: "2026-11-02 (Mon)", day: "Monday", predictedDemand: 84, lowerBound: 76, upperBound: 92, predictedRevenue: 22400 },
      { date: "2026-11-03 (Tue)", day: "Tuesday", predictedDemand: 87, lowerBound: 79, upperBound: 95, predictedRevenue: 23100 },
      { date: "2026-11-04 (Wed)", day: "Wednesday", predictedDemand: 85, lowerBound: 77, upperBound: 93, predictedRevenue: 22700 },
      { date: "2026-11-05 (Thu)", day: "Thursday", predictedDemand: 89, lowerBound: 81, upperBound: 97, predictedRevenue: 23800 },
      { date: "2026-11-06 (Fri)", day: "Friday", predictedDemand: 76, lowerBound: 68, upperBound: 84, predictedRevenue: 19800 }
    ]
  },
  prescriptive: [
    {
      observedMetric: "Off-Peak Midday Occupancy drops to 38% (1:00 PM – 3:30 PM)",
      condition: "Occupancy < 40% across 3 consecutive non-peak hours",
      action: "Introduce 25% 'Happy Hours' discount multiplier (0.75x) for midday entries",
      expectedBenefit: "+14% higher midday utilization, estimated +₹4,200 incremental weekly revenue"
    },
    {
      observedMetric: "Morning Peak Ingress (8:30 AM – 10:30 AM) reaches 91% occupancy",
      condition: "Occupancy > 85% for 4 consecutive weekdays",
      action: "Activate dynamic surge multiplier (1.25x) and open auxiliary Floor 3 overflow bays",
      expectedBenefit: "Reduces search congestion by 65%, increases peak margin by ₹6,800/week"
    },
    {
      observedMetric: "Average EV Supercharger dwell time is 4.1 hours with 94% utilization",
      condition: "EV queue backlog > 4 vehicles at Cyber Heights",
      action: "Convert 6 standard car bays in Zone B to DC Fast Charging bays",
      expectedBenefit: "+₹9,500 monthly revenue, eliminates EV charging queue bottlenecks"
    },
    {
      observedMetric: "14 customer sessions exceeded reserved duration by over 60 minutes",
      condition: "Overstay duration > 1 hour without in-app extension",
      action: "Automate SMS warning at T-10m and apply standard 1.5x overstay billing rate",
      expectedBenefit: "Frees up 12 reserved bays for on-time arrivals, eliminates customer disputes"
    }
  ]
};

export const DEMO_DISTRIBUTION_DATA = {
  metric: "duration",
  sampleSize: 500,
  measures: {
    mean: 3.42,
    median: 3.0,
    mode: 2.0,
    min: 0.5,
    max: 14.5,
    variance: 4.82,
    stdDev: 2.2,
    q1: 2.0,
    q2: 3.0,
    q3: 4.5,
    iqr: 2.5,
    lowerFence: 0.0,
    upperFence: 8.25
  },
  histogram: {
    binWidth: 1.5,
    bins: [
      { range: "0.0 – 1.5 hrs", count: 42, percentage: 8.4 },
      { range: "1.5 – 3.0 hrs", count: 184, percentage: 36.8 },
      { range: "3.0 – 4.5 hrs", count: 146, percentage: 29.2 },
      { range: "4.5 – 6.0 hrs", count: 72, percentage: 14.4 },
      { range: "6.0 – 7.5 hrs", count: 34, percentage: 6.8 },
      { range: "7.5 – 9.0 hrs", count: 12, percentage: 2.4 },
      { range: "9.0+ hrs", count: 10, percentage: 2.0 }
    ]
  },
  outliers: [
    { recordId: "BK-9021", value: 14.5, threshold: 8.25, reason: "Dwell exceeds Upper Fence (Q3 + 1.5*IQR = 8.25 hrs)", interpretation: "Possible unattended overnight parking or hospital emergency overstay" },
    { recordId: "BK-8842", value: 12.0, threshold: 8.25, reason: "Dwell exceeds Upper Fence (8.25 hrs)", interpretation: "Long-term inter-city railway commuter" },
    { recordId: "BK-8719", value: 10.5, threshold: 8.25, reason: "Dwell exceeds Upper Fence (8.25 hrs)", interpretation: "Corporate Tech Park marathon deployment session" },
    { recordId: "BK-8604", value: 9.8, threshold: 8.25, reason: "Dwell exceeds Upper Fence (8.25 hrs)", interpretation: "Valet car wash & detailed maintenance session at Mall" }
  ]
};

export const DEMO_SQL_EXPERIMENTS = [
  {
    experimentNumber: 1,
    objective: "Total Revenue and Completed Booking Volume by Parking Facility",
    mysqlQuery: "SELECT pl.name AS facility_name, pl.city, COUNT(b.booking_id) AS total_bookings, SUM(b.total_amount) AS gross_revenue, ROUND(AVG(b.total_amount), 2) AS avg_ticket_size FROM parking_locations pl INNER JOIN bookings b ON pl.location_id = b.location_id WHERE b.status = 'COMPLETED' GROUP BY pl.name, pl.city ORDER BY gross_revenue DESC;",
    oracleQuery: "SELECT pl.name AS facility_name, pl.city, COUNT(b.booking_id) AS total_bookings, SUM(b.total_amount) AS gross_revenue, ROUND(AVG(b.total_amount), 2) AS avg_ticket_size FROM parking_locations pl INNER JOIN bookings b ON pl.location_id = b.location_id WHERE b.status = 'COMPLETED' GROUP BY pl.name, pl.city ORDER BY gross_revenue DESC;",
    explanation: "Calculates gross collections and average ticket sizes across operational hubs using INNER JOIN and aggregate functions.",
    expectedColumns: ["facility_name", "city", "total_bookings", "gross_revenue", "avg_ticket_size"],
    sampleOutput: [
      { facility_name: "Cyber Heights Tech Park", city: "Bengaluru", total_bookings: 142, gross_revenue: 46200, avg_ticket_size: 325.35 },
      { facility_name: "Central City Mall & Multiplex", city: "Noida", total_bookings: 128, gross_revenue: 35840, avg_ticket_size: 280.00 },
      { facility_name: "Central Campus Hub", city: "New Delhi", total_bookings: 96, gross_revenue: 23040, avg_ticket_size: 240.00 },
      { facility_name: "Grand Central Railway Terminal", city: "New Delhi", total_bookings: 66, gross_revenue: 23100, avg_ticket_size: 350.00 }
    ],
    takeaway: "Cyber Heights Tech Park produces 36% of gross system collections due to higher corporate dwell times."
  },
  {
    experimentNumber: 7,
    objective: "Identification of Inactive Registered Customers with Zero Bookings (LEFT JOIN)",
    mysqlQuery: "SELECT c.customer_id, c.full_name, c.email, c.phone, c.created_at FROM customers c LEFT JOIN bookings b ON c.customer_id = b.customer_id WHERE b.booking_id IS NULL ORDER BY c.created_at ASC;",
    oracleQuery: "SELECT c.customer_id, c.full_name, c.email, c.phone, c.created_at FROM customers c LEFT JOIN bookings b ON c.customer_id = b.customer_id WHERE b.booking_id IS NULL ORDER BY c.created_at ASC;",
    explanation: "Isolates registered accounts that have never initiated a parking reservation, identifying marketing re-engagement targets.",
    expectedColumns: ["customer_id", "full_name", "email", "phone", "created_at"],
    sampleOutput: [
      { customer_id: "CUST-0086", full_name: "Aditya Verma", email: "aditya.v@example.com", phone: "+91 98110 44101", created_at: "2026-10-02" },
      { customer_id: "CUST-0087", full_name: "Meera Krishnan", email: "meera.k@example.com", phone: "+91 98110 44102", created_at: "2026-10-04" },
      { customer_id: "CUST-0088", full_name: "Rohan Sengupta", email: "rohan.s@example.com", phone: "+91 98110 44103", created_at: "2026-10-05" }
    ],
    takeaway: "Exactly 15 out of 100 registered customers (15%) are inactive, providing a high-conversion cohort for a 'First Park 50% Off' push promotion."
  }
];

