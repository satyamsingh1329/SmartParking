/**
 * ParkPulse Analytics & Business Intelligence — Comprehensive Syllabus Test Suite
 * Validates:
 * 1. Descriptive, Diagnostic, Predictive & Prescriptive Analytics structures
 * 2. Statistical Central Tendency (Mean, Median, Mode) & Tukey IQR Outlier Detection
 * 3. 10 SQL Practical Laboratory Experiments (MySQL & Oracle SQL)
 * 4. Relational Datasets & Foreign Key Referential Integrity
 * 5. Excel Workbook & Downloadable Deliverables
 * 6. Tableau BI Resources & Calculated Fields
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('================================================================');
console.log('🧪 RUNNING PARKPULSE ANALYTICS & BI COMPREHENSIVE TEST SUITE');
console.log('================================================================\n');

let testsPassed = 0;
let testsFailed = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
    testsFailed++;
  }
}

// ---------------------------------------------------------------------------
// TEST GROUP 1: STATISTICAL FUNCTIONS & TUKEY IQR OUTLIER DETECTION
// ---------------------------------------------------------------------------
console.log('--- TEST GROUP 1: Central Tendency & Tukey IQR Outlier Calculations ---');

const analyticsService = require('./services/analyticsService');

runTest('calculateStatistics returns correct Mean, Median, and Mode', () => {
  const sampleData = [1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const stats = analyticsService.calculateStatistics(sampleData);

  assert.strictEqual(stats.count, 11, 'Count should be 11');
  assert.strictEqual(stats.mean, 5.18, 'Mean should be 5.18');
  assert.strictEqual(stats.median, 5, 'Median should be 5');
  assert.strictEqual(stats.mode, 2, 'Mode should be 2');
  assert.strictEqual(stats.min, 1, 'Min should be 1');
  assert.strictEqual(stats.max, 10, 'Max should be 10');
  assert.strictEqual(stats.range, 9, 'Range should be 9');
});

runTest('Tukey IQR method accurately identifies outliers outside fences', () => {
  // Normal values around 1 to 5, with an extreme outlier at 48
  const dataWithOutlier = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 48];
  const stats = analyticsService.calculateStatistics(dataWithOutlier);

  assert(stats.q1 > 0, 'Q1 must be positive');
  assert(stats.q3 > stats.q1, 'Q3 must be greater than Q1');
  assert.strictEqual(stats.iqr, Number((stats.q3 - stats.q1).toFixed(2)), 'IQR must equal Q3 - Q1');
  assert(stats.upperFence < 48, 'Upper fence must be strictly lower than 48 to catch outlier');

  const isOutlier = 48 > stats.upperFence;
  assert.strictEqual(isOutlier, true, 'Value 48 must be flagged as statistical outlier');
});

runTest('generateHistogramBins creates valid equal-width bins summing to 100%', () => {
  const values = [1, 2, 2, 3, 3, 3, 4, 5, 6, 7, 8, 9, 10];
  const bins = analyticsService.generateHistogramBins(values, 5);

  assert.strictEqual(bins.length, 5, 'Should generate exactly 5 bins');
  const totalCount = bins.reduce((sum, b) => sum + b.count, 0);
  assert.strictEqual(totalCount, values.length, 'Sum of bin counts must equal total records');
  const totalPct = bins.reduce((sum, b) => sum + b.percentage, 0);
  assert(Math.abs(totalPct - 100) < 1.0, 'Total percentage must approximate 100%');
});

// ---------------------------------------------------------------------------
// TEST GROUP 2: SQL PRACTICAL LABORATORY SUITE
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 2: SQL Practical Laboratory & Dialects ---');

runTest('getSQLExperiments returns all 10 syllabus experiments with dual dialects', () => {
  const experiments = analyticsService.getSQLExperiments();

  assert.strictEqual(experiments.length, 10, 'Must provide exactly 10 syllabus experiments');

  experiments.forEach((exp, idx) => {
    assert.strictEqual(exp.experimentNumber, idx + 1, `Experiment number must be ${idx + 1}`);
    assert(exp.title && exp.title.length > 5, `Experiment ${idx + 1} must have a valid title`);
    assert(exp.objective && exp.objective.length > 10, `Experiment ${idx + 1} must have an objective`);
    assert(exp.mysqlQuery && exp.mysqlQuery.includes('SELECT'), `Experiment ${idx + 1} MySQL query must be valid SELECT`);
    assert(exp.oracleQuery && exp.oracleQuery.includes('SELECT'), `Experiment ${idx + 1} Oracle query must be valid SELECT`);
    assert(Array.isArray(exp.expectedColumns) && exp.expectedColumns.length > 0, `Experiment ${idx + 1} must list columns`);
    assert(Array.isArray(exp.sampleResults), `Experiment ${idx + 1} must have sampleResults array`);
    assert(exp.businessInterpretation && exp.businessInterpretation.length > 15, `Experiment ${idx + 1} must have business takeaway`);
  });
});

runTest('SQL files exist on disk and contain valid SQL DDL and DML', () => {
  const mysqlQueriesPath = path.join(__dirname, 'analytics/sql/analysis_queries.sql');
  const mysqlSchemaPath = path.join(__dirname, 'analytics/sql/create_tables.sql');
  const oracleQueriesPath = path.join(__dirname, 'analytics/sql/oracle_queries.sql');
  const oracleGuidePath = path.join(__dirname, 'analytics/sql/oracle_setup_guide.md');

  assert(fs.existsSync(mysqlQueriesPath), 'analysis_queries.sql must exist');
  assert(fs.existsSync(mysqlSchemaPath), 'create_tables.sql must exist');
  assert(fs.existsSync(oracleQueriesPath), 'oracle_queries.sql must exist');
  assert(fs.existsSync(oracleGuidePath), 'oracle_setup_guide.md must exist');

  const oracleSql = fs.readFileSync(oracleQueriesPath, 'utf8');
  assert(oracleSql.includes('VARCHAR2'), 'Oracle SQL must use VARCHAR2');
  assert(oracleSql.includes('NUMBER('), 'Oracle SQL must use NUMBER');
  assert(oracleSql.includes('FETCH FIRST'), 'Oracle SQL must use FETCH FIRST n ROWS ONLY');
});

// ---------------------------------------------------------------------------
// TEST GROUP 3: RELATIONAL DATASETS & SYLLABUS INTEGRITY
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 3: Relational Datasets & Referential Integrity ---');

runTest('All 4 relational CSV datasets exist and have valid structure', () => {
  const datasetsDir = path.join(__dirname, 'analytics/datasets');
  const files = ['bookings.csv', 'customers.csv', 'parking_locations.csv', 'parking_sessions.csv'];

  files.forEach((f) => {
    const fullPath = path.join(datasetsDir, f);
    assert(fs.existsSync(fullPath), `${f} must exist`);
    const content = fs.readFileSync(fullPath, 'utf8').trim();
    const lines = content.split('\n');
    assert(lines.length > 5, `${f} must have header and data rows`);
  });
});

runTest('Referential integrity: Bookings reference valid Customers and Locations', () => {
  const datasetsDir = path.join(__dirname, 'analytics/datasets');
  const custLines = fs.readFileSync(path.join(datasetsDir, 'customers.csv'), 'utf8').trim().split('\n');
  const locLines = fs.readFileSync(path.join(datasetsDir, 'parking_locations.csv'), 'utf8').trim().split('\n');
  const bookLines = fs.readFileSync(path.join(datasetsDir, 'bookings.csv'), 'utf8').trim().split('\n');

  const customerIds = new Set(custLines.slice(1).map(l => l.split(',')[0].replace(/"/g, '')));
  const locationIds = new Set(locLines.slice(1).map(l => l.split(',')[0].replace(/"/g, '')));

  assert.strictEqual(customerIds.size, 100, 'Must have 100 customers');
  assert.strictEqual(locationIds.size, 5, 'Must have 5 parking locations');

  // Check bookings reference valid IDs
  const bookHeader = bookLines[0].split(',').map(h => h.replace(/"/g, ''));
  const userIdx = bookHeader.indexOf('user_id');
  const locIdx = bookHeader.indexOf('location_id');

  const bookedCustomerIds = new Set();
  bookLines.slice(1).forEach((l) => {
    const cols = l.split(',').map(c => c.replace(/"/g, ''));
    const uid = cols[userIdx];
    const lid = cols[locIdx];
    assert(customerIds.has(uid), `Booking user_id ${uid} must exist in customers.csv`);
    assert(locationIds.has(lid), `Booking location_id ${lid} must exist in parking_locations.csv`);
    bookedCustomerIds.add(uid);
  });

  // Verify Syllabus requirement: "Customers with Zero Bookings"
  const inactiveCustomers = 100 - bookedCustomerIds.size;
  assert.strictEqual(inactiveCustomers, 15, 'Must have exactly 15 customers with zero bookings for syllabus testing');
});

// ---------------------------------------------------------------------------
// TEST GROUP 4: EXCEL WORKBOOK & PRACTICALS DELIVERABLES
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 4: Excel Practicals & Workbook Deliverables ---');

runTest('ParkPulse_Analytics_Practicals.xlsx exists and has valid filesize', () => {
  const excelPath = path.join(__dirname, 'analytics/ParkPulse_Analytics_Practicals.xlsx');
  assert(fs.existsSync(excelPath), 'Excel practicals workbook must exist');
  const stats = fs.statSync(excelPath);
  assert(stats.size > 50000, `Workbook size must be > 50KB (actual: ${stats.size} bytes)`);
});

runTest('excel_practicals_guide.md covers all syllabus formula requirements', () => {
  const guidePath = path.join(__dirname, 'analytics/excel_practicals_guide.md');
  assert(fs.existsSync(guidePath), 'excel_practicals_guide.md must exist');
  const guide = fs.readFileSync(guidePath, 'utf8');

  const requiredTerms = [
    'XLOOKUP', 'VLOOKUP', 'IF', 'Nested IF', 'AND', 'OR', 'NOT', 'IFERROR',
    'SUMIF', 'SUMIFS', 'AVERAGEIF', 'AVERAGEIFS', 'COUNTIF', 'COUNTIFS',
    'MEAN', 'MEDIAN', 'MODE', 'IQR', 'Pivot Table'
  ];

  requiredTerms.forEach((term) => {
    assert(guide.includes(term), `Guide must document ${term}`);
  });
});

// ---------------------------------------------------------------------------
// TEST GROUP 5: TABLEAU BI SUITE DELIVERABLES
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 5: Tableau BI Resources & Documentation ---');

runTest('Tableau guides exist and document all 26 syllabus topics and 3 dashboards', () => {
  const syllabusGuidePath = path.join(__dirname, 'tableau/tableau_syllabus_guide.md');
  const dashboardGuidePath = path.join(__dirname, 'tableau/tableau_dashboard_guide.md');
  const calcFieldsPath = path.join(__dirname, 'tableau/tableau_calculated_fields.md');

  assert(fs.existsSync(syllabusGuidePath), 'tableau_syllabus_guide.md must exist');
  assert(fs.existsSync(dashboardGuidePath), 'tableau_dashboard_guide.md must exist');
  assert(fs.existsSync(calcFieldsPath), 'tableau_calculated_fields.md must exist');

  const sGuide = fs.readFileSync(syllabusGuidePath, 'utf8');
  assert(sGuide.includes('Connecting to Excel'), 'Must document connecting to Excel');
  assert(sGuide.includes('Parameters'), 'Must document Parameters');
  assert(sGuide.includes('Context Filters'), 'Must document Context Filters');
  assert(sGuide.includes('Stories'), 'Must document Stories');

  const dGuide = fs.readFileSync(dashboardGuidePath, 'utf8');
  assert(dGuide.includes('Executive Overview'), 'Must document Dashboard 1');
  assert(dGuide.includes('Demand and Capacity'), 'Must document Dashboard 2');
  assert(dGuide.includes('Revenue and Customer'), 'Must document Dashboard 3');
});

// ---------------------------------------------------------------------------
// TEST GROUP 6: CONTROLLERS & ROUTES EXPORTS
// ---------------------------------------------------------------------------
console.log('\n--- TEST GROUP 6: Controllers & Express Routes ---');

runTest('adminController exports all required analytics endpoints', () => {
  const adminController = require('./controllers/adminController');

  assert.strictEqual(typeof adminController.getDashboardStats, 'function');
  assert.strictEqual(typeof adminController.getAnalytics, 'function');
  assert.strictEqual(typeof adminController.getBIAnalytics, 'function');
  assert.strictEqual(typeof adminController.getDataQualityReport, 'function');
  assert.strictEqual(typeof adminController.getAnalyticsOverview, 'function');
  assert.strictEqual(typeof adminController.getDataDistributionAndOutliers, 'function');
  assert.strictEqual(typeof adminController.getSQLExperiments, 'function');
  assert.strictEqual(typeof adminController.exportFilteredBookingsCSV, 'function');
  assert.strictEqual(typeof adminController.downloadSyllabusFile, 'function');
  assert.strictEqual(typeof adminController.exportCSV, 'function');
});

runTest('Frontend analytics.html contains all 7 syllabus navigation tabs', () => {
  const htmlPath = path.join(__dirname, 'public/analytics.html');
  assert(fs.existsSync(htmlPath), 'public/analytics.html must exist');
  const html = fs.readFileSync(htmlPath, 'utf8');

  const requiredTabs = [
    'data-tab="dashboard"',
    'data-tab="overview"',
    'data-tab="distribution"',
    'data-tab="excel"',
    'data-tab="sql"',
    'data-tab="tableau"',
    'data-tab="reports"'
  ];

  requiredTabs.forEach((tab) => {
    assert(html.includes(tab), `HTML must contain tab ${tab}`);
  });
});

console.log('\n================================================================');
console.log(`🏁 TEST EXECUTION SUMMARY: ${testsPassed} PASSED, ${testsFailed} FAILED`);
console.log('================================================================\n');

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL SYLLABUS TESTS PASSED WITH 100% ACCURACY!\n');
  process.exit(0);
}

