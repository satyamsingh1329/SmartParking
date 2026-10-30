/**
 * End-to-end verification script for ParkPulse Analytics BI Endpoints
 */
require('dotenv').config();
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { app, server } = require('./server');
const User = require('./models/User');

async function testAll() {
  console.log('\n--- 1. Testing Database & Server Boot ---');
  // Wait 1.5s for DB connection
  await new Promise(r => setTimeout(r, 1500));

  const adminUser = await User.findOne({ role: 'ADMIN' });
  if (!adminUser) {
    throw new Error('Admin user not found. Did you run npm run seed?');
  }

  const token = jwt.sign(
    { id: adminUser._id, role: adminUser.role },
    process.env.JWT_SECRET || 'secret123',
    { expiresIn: '1h' }
  );
  console.log('✓ Admin authenticated token generated');

  const port = server.address()?.port || process.env.PORT || 5000;
  console.log(`✓ Server running on port ${port}`);

  // Helper for requests
  function makeRequest(path) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port: port,
          path: path,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`
          }
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const contentType = res.headers['content-type'] || '';
              if (contentType.includes('application/json')) {
                resolve({ status: res.statusCode, body: JSON.parse(data) });
              } else {
                resolve({ status: res.statusCode, body: data, headers: res.headers });
              }
            } catch (e) {
              resolve({ status: res.statusCode, body: data });
            }
          });
        }
      );
      req.on('error', reject);
      req.end();
    });
  }

  console.log('\n--- 2. Testing /api/admin/analytics/bi ---');
  const biRes = await makeRequest('/api/admin/analytics/bi');
  console.log(`Status: ${biRes.status}`);
  if (biRes.status !== 200 || !biRes.body.success) {
    throw new Error('BI endpoint failed: ' + JSON.stringify(biRes.body));
  }
  const biData = biRes.body.data;
  console.log('✓ Total Bookings:', biData.kpis.totalBookings);
  console.log('✓ Total Revenue: ₹' + biData.kpis.totalRevenue);
  console.log('✓ Avg Revenue / Completed: ₹' + biData.kpis.avgRevenuePerCompletedBooking);
  console.log('✓ Cancellation Rate: ' + biData.kpis.cancellationRate + '%');
  console.log('✓ Peak Hours Array Length:', biData.peakHours.length);
  console.log('✓ Daily Revenue Trend Days:', biData.trends.dailyRevenue.length);
  console.log('✓ Location Breakdown Items:', biData.locationBreakdown.length);
  console.log('✓ Vehicle Type Items:', biData.vehicleTypeBreakdown.length);

  console.log('\n--- 3. Testing /api/admin/analytics/bi with Filters ---');
  const filteredRes = await makeRequest('/api/admin/analytics/bi?vehicleType=car&preset=30d');
  console.log(`Status: ${filteredRes.status}`);
  console.log('✓ Filtered Car Bookings:', filteredRes.body.data.kpis.totalBookings);

  console.log('\n--- 4. Testing /api/admin/analytics/quality ---');
  const qualRes = await makeRequest('/api/admin/analytics/quality');
  console.log(`Status: ${qualRes.status}`);
  console.log('✓ Health Score:', qualRes.body.data.healthScore + '%');
  console.log('✓ Records Audited:', qualRes.body.data.totalRecordsAudited);

  console.log('\n--- 5. Testing CSV Export Endpoints ---');
  const exportEntities = ['customers', 'bookings', 'locations', 'sessions'];
  for (const ent of exportEntities) {
    const expRes = await makeRequest(`/api/admin/analytics/export/csv/${ent}`);
    console.log(`✓ Export ${ent}: status ${expRes.status}, length ${expRes.body.length} bytes`);
    if (expRes.status !== 200 || expRes.body.length < 50) {
      throw new Error(`Export for ${ent} returned invalid content`);
    }
  }

  console.log('\n=============================================');
  console.log('🎉 ALL PARKPULSE BI TESTS PASSED PERFECTLY!');
  console.log('=============================================\n');

  setTimeout(() => {
    process.exit(0);
  }, 500);
}

testAll().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
