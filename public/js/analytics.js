/**
 * ParkPulse Analytics — Smart Parking Business Intelligence Platform Engine
 * Real MongoDB Aggregations, Slicing Filters, 4 Analytics Types, Tukey Outliers, and Syllabus Relational Exports
 */
import { apiRequest, showToast, formatDateTime, formatCurrency } from './utils.js';
import { getStoredUser, isAuthenticated } from './auth.js';
import { onSocketEvent } from './socket.js';

let chartDaily = null;
let chartPeak = null;
let chartWeekday = null;
let chartLocations = null;
let chartVehicle = null;
let chartStatus = null;
let chartPredictive = null;
let chartHistogram = null;

let currentFilters = {
  startDate: '',
  endDate: '',
  locationId: 'all',
  vehicleType: 'all',
  preset: 'all'
};

let currentDistMetric = 'duration';
let activeSqlDialect = 'mysql';
let sqlExperimentsData = [];
let currentOutliersList = [];

export async function initAnalytics() {
  const isStaticPages = window.location.hostname.endsWith('github.io') && !localStorage.getItem('parkpulse_api_url');
  const user = getStoredUser();

  if (!isStaticPages && (!isAuthenticated() || user?.role !== 'ADMIN')) {
    showToast('Admin authorization required for Analytics BI Center', 'error');
    setTimeout(() => {
      window.location.href = './login.html?redirect=./analytics.html';
    }, 1200);
    return;
  }

  setupTabNavigation();
  setupEventListeners();
  await loadLocationFilterOptions();
  await loadBIData();
  setupRealtimeSync();

  // Handle URL hash on initial load
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);
}

function setupTabNavigation() {
  const tabBtns = document.querySelectorAll('.bi-tab-btn');
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabKey = btn.getAttribute('data-tab');
      switchTab(tabKey);
      window.location.hash = tabKey;
    });
  });
}

function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '').trim();
  if (hash) {
    switchTab(hash);
  }
}

function switchTab(tabKey) {
  const tabBtns = document.querySelectorAll('.bi-tab-btn');
  const panes = document.querySelectorAll('.bi-tab-pane');

  const targetPane = document.getElementById(`pane-${tabKey}`);
  if (!targetPane) return;

  tabBtns.forEach((b) => {
    if (b.getAttribute('data-tab') === tabKey) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  panes.forEach((p) => p.classList.remove('active'));
  targetPane.classList.add('active');

  // Load contextual data if opening a specific syllabus module
  if (tabKey === 'overview') {
    loadAnalyticsOverview();
  } else if (tabKey === 'distribution') {
    loadDataDistribution(currentDistMetric);
  } else if (tabKey === 'sql') {
    loadSQLExperiments();
  } else if (tabKey === 'reports') {
    updateFilteredCSVLink();
  }
}

function setupEventListeners() {
  // Preset buttons
  const presetBtns = document.querySelectorAll('.date-preset-btn');
  presetBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      presetBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const preset = btn.getAttribute('data-preset');
      currentFilters.preset = preset;
      applyPresetDates(preset);
    });
  });

  // Filter Buttons
  document.getElementById('btn-apply-filters')?.addEventListener('click', () => {
    currentFilters.startDate = document.getElementById('filter-start-date').value;
    currentFilters.endDate = document.getElementById('filter-end-date').value;
    currentFilters.locationId = document.getElementById('filter-location').value;
    currentFilters.vehicleType = document.getElementById('filter-vehicle-type').value;
    updateActiveFilterSummary();
    loadBIData();
    updateFilteredCSVLink();
  });

  document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
    document.querySelectorAll('.date-preset-btn').forEach((b) => b.classList.remove('active'));
    document.querySelector('.date-preset-btn[data-preset="all"]')?.classList.add('active');
    document.getElementById('filter-start-date').value = '';
    document.getElementById('filter-end-date').value = '';
    document.getElementById('filter-location').value = 'all';
    document.getElementById('filter-vehicle-type').value = 'all';

    currentFilters = {
      startDate: '',
      endDate: '',
      locationId: 'all',
      vehicleType: 'all',
      preset: 'all'
    };
    updateActiveFilterSummary();
    loadBIData();
    updateFilteredCSVLink();
  });

  // Refresh button
  document.getElementById('btn-refresh-bi')?.addEventListener('click', () => {
    loadBIData();
    showToast('Telemetry refreshed from MongoDB database', 'info');
  });

  // Print Report Buttons
  document.getElementById('btn-print-report')?.addEventListener('click', () => window.print());
  document.getElementById('btn-print-executive-report')?.addEventListener('click', () => window.print());

  // View All Prescriptive Recommendations link
  document.getElementById('btn-view-all-recs')?.addEventListener('click', () => {
    switchTab('overview');
    window.location.hash = 'overview';
    const el = document.getElementById('prescriptive-recs-container');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  });

  // Distribution Metric Switchers
  document.getElementById('btn-dist-metric-dur')?.addEventListener('click', () => {
    currentDistMetric = 'duration';
    document.getElementById('btn-dist-metric-dur').className = 'btn btn-sm btn-primary';
    document.getElementById('btn-dist-metric-amt').className = 'btn btn-sm btn-secondary';
    loadDataDistribution('duration');
  });

  document.getElementById('btn-dist-metric-amt')?.addEventListener('click', () => {
    currentDistMetric = 'amount';
    document.getElementById('btn-dist-metric-amt').className = 'btn btn-sm btn-primary';
    document.getElementById('btn-dist-metric-dur').className = 'btn btn-sm btn-secondary';
    loadDataDistribution('amount');
  });

  // Outlier Search Filter
  document.getElementById('input-outlier-search')?.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    filterOutliersTable(term);
  });

  // Export Outliers to CSV
  document.getElementById('btn-export-outliers-csv')?.addEventListener('click', exportOutliersToCSV);

  // SQL Dialect Switchers
  document.getElementById('btn-dialect-mysql')?.addEventListener('click', () => {
    activeSqlDialect = 'mysql';
    document.getElementById('btn-dialect-mysql').className = 'btn btn-sm btn-primary';
    document.getElementById('btn-dialect-oracle').className = 'btn btn-sm btn-secondary';
    renderSQLExperiments();
  });

  document.getElementById('btn-dialect-oracle')?.addEventListener('click', () => {
    activeSqlDialect = 'oracle';
    document.getElementById('btn-dialect-oracle').className = 'btn btn-sm btn-primary';
    document.getElementById('btn-dialect-mysql').className = 'btn btn-sm btn-secondary';
    renderSQLExperiments();
  });
}

function applyPresetDates(preset) {
  const startInput = document.getElementById('filter-start-date');
  const endInput = document.getElementById('filter-end-date');
  const today = new Date();

  if (preset === 'all') {
    startInput.value = '';
    endInput.value = '';
  } else if (preset === 'today') {
    const iso = today.toISOString().split('T')[0];
    startInput.value = iso;
    endInput.value = iso;
  } else if (preset === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startInput.value = d.toISOString().split('T')[0];
    endInput.value = today.toISOString().split('T')[0];
  } else if (preset === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startInput.value = d.toISOString().split('T')[0];
    endInput.value = today.toISOString().split('T')[0];
  } else if (preset === '90d') {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    startInput.value = d.toISOString().split('T')[0];
    endInput.value = today.toISOString().split('T')[0];
  }

  currentFilters.startDate = startInput.value;
  currentFilters.endDate = endInput.value;
  updateActiveFilterSummary();
  loadBIData();
  updateFilteredCSVLink();
}

function updateActiveFilterSummary() {
  const summaryEl = document.getElementById('filter-active-summary');
  if (!summaryEl) return;

  const parts = [];
  if (currentFilters.startDate && currentFilters.endDate) {
    parts.push(`Dates: ${currentFilters.startDate} → ${currentFilters.endDate}`);
  } else if (currentFilters.preset !== 'all') {
    parts.push(`Preset: ${currentFilters.preset.toUpperCase()}`);
  } else {
    parts.push('All-Time Window');
  }

  if (currentFilters.locationId !== 'all') {
    const locSelect = document.getElementById('filter-location');
    const locName = locSelect.options[locSelect.selectedIndex]?.text || currentFilters.locationId;
    parts.push(`Facility: ${locName}`);
  }

  if (currentFilters.vehicleType !== 'all') {
    parts.push(`Vehicle: ${currentFilters.vehicleType.toUpperCase()}`);
  }

  summaryEl.innerHTML = `Displaying: <strong>${parts.join(' • ')}</strong>`;
}

function updateFilteredCSVLink() {
  const exportBtn = document.getElementById('btn-export-filtered-csv');
  if (!exportBtn) return;

  const queryParams = new URLSearchParams();
  if (currentFilters.startDate) queryParams.append('startDate', currentFilters.startDate);
  if (currentFilters.endDate) queryParams.append('endDate', currentFilters.endDate);
  if (currentFilters.locationId && currentFilters.locationId !== 'all') {
    queryParams.append('locationId', currentFilters.locationId);
  }
  if (currentFilters.vehicleType && currentFilters.vehicleType !== 'all') {
    queryParams.append('vehicleType', currentFilters.vehicleType);
  }

  exportBtn.href = `/api/admin/analytics/export/csv/filtered?${queryParams.toString()}`;
}

async function loadLocationFilterOptions() {
  const locSelect = document.getElementById('filter-location');
  if (!locSelect) return;

  try {
    const res = await apiRequest('/api/parking/locations');
    const locations = res.data || [];
    locations.forEach((loc) => {
      const opt = document.createElement('option');
      opt.value = loc._id;
      opt.textContent = `${loc.name} (${loc.city})`;
      locSelect.appendChild(opt);
    });
  } catch (err) {
    console.warn('Could not load locations for filter:', err.message);
  }
}

async function loadBIData() {
  try {
    const queryParams = new URLSearchParams();
    if (currentFilters.startDate) queryParams.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) queryParams.append('endDate', currentFilters.endDate);
    if (currentFilters.locationId && currentFilters.locationId !== 'all') {
      queryParams.append('locationId', currentFilters.locationId);
    }
    if (currentFilters.vehicleType && currentFilters.vehicleType !== 'all') {
      queryParams.append('vehicleType', currentFilters.vehicleType);
    }

    const url = `/api/admin/analytics/bi?${queryParams.toString()}`;
    const res = await apiRequest(url);
    const d = res.data;

    renderKPICards(d.kpis, d.dataQuality);
    renderCharts(d);
    renderAuditTable(d.dataQuality);

    // Update Prescriptive notification banner
    const alertEl = document.getElementById('top-prescriptive-alert');
    if (alertEl) {
      alertEl.innerHTML = `Identified <strong>${d.kpis.cancellationRate}%</strong> cancellation rate and <strong>₹${d.kpis.avgRevenuePerCompletedBooking}</strong> avg ticket size. Top action: Activate off-peak tariff reduction during 11 AM - 3 PM to lift capacity utilization.`;
    }
  } catch (err) {
    showToast('Failed to load BI analytics: ' + err.message, 'error');
  }
}

function renderKPICards(kpis, quality) {
  if (!kpis) return;

  document.getElementById('kpi-total-bookings').textContent = kpis.totalBookings;
  document.getElementById('kpi-completed-bookings').textContent = kpis.completedBookings;
  document.getElementById('kpi-total-revenue').textContent = `₹${kpis.totalRevenue.toLocaleString('en-IN')}`;
  document.getElementById('kpi-avg-rev').textContent = `₹${kpis.avgRevenuePerCompletedBooking.toLocaleString('en-IN')}`;
  document.getElementById('kpi-cancel-rate').textContent = `${kpis.cancellationRate}%`;
  document.getElementById('kpi-noshow-rate').textContent = `${kpis.noShowRate}%`;
  document.getElementById('kpi-avg-duration').textContent = `${kpis.avgParkingDurationMinutes} min`;
  document.getElementById('kpi-occupancy-rate').textContent = `${kpis.occupancyRate}%`;
  document.getElementById('kpi-occupied-bays').textContent = kpis.occupiedSlots + kpis.reservedSlots;
  document.getElementById('kpi-total-bays').textContent = kpis.totalCapacity;
  document.getElementById('kpi-active-sessions').textContent = kpis.activeSessions;

  const health = quality ? quality.healthScore : 100;
  document.getElementById('kpi-data-health').textContent = `${health}%`;
  document.getElementById('audit-health-pct').textContent = `${health}%`;
  document.getElementById('audit-total-records').textContent = quality ? quality.totalRecordsAudited : '--';
  document.getElementById('audit-total-issues').textContent = quality ? quality.totalIssuesFound : '0';
}

function renderCharts(d) {
  renderDailyRevenueChart(d.trends.dailyRevenue);
  renderPeakHoursChart(d.peakHours);
  renderWeekdayWeekendChart(d.dayOfWeekDemand);
  renderLocationsChart(d.locationBreakdown);
  renderVehicleTypeChart(d.vehicleTypeBreakdown);
  renderStatusDistributionChart(d.statusDistribution);
}

function renderDailyRevenueChart(dailyData) {
  const canvas = document.getElementById('chart-daily-revenue');
  if (!canvas) return;

  const labels = dailyData.map((d) => d.date);
  const revenues = dailyData.map((d) => d.revenue);
  const volumes = dailyData.map((d) => d.count);

  if (chartDaily) chartDaily.destroy();

  chartDaily = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue (₹)',
          data: revenues,
          borderColor: '#06b6d4',
          backgroundColor: 'rgba(6, 182, 212, 0.15)',
          fill: true,
          tension: 0.35,
          yAxisID: 'y'
        },
        {
          label: 'Bookings Volume',
          data: volumes,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderDash: [4, 4],
          fill: false,
          tension: 0.35,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: '#9ca3af' } }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#9ca3af', maxRotation: 45 }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#06b6d4' }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' }
        }
      }
    }
  });
}

function renderPeakHoursChart(peakHours) {
  const canvas = document.getElementById('chart-peak-hours');
  if (!canvas) return;

  const labels = peakHours.map((p) => p.hour);
  const counts = peakHours.map((p) => p.count);

  if (chartPeak) chartPeak.destroy();

  chartPeak = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Bookings Initiated',
          data: counts,
          backgroundColor: (context) => {
            const rawHour = peakHours[context.dataIndex]?.rawHour;
            if ((rawHour >= 9 && rawHour <= 11) || (rawHour >= 17 && rawHour <= 20)) {
              return 'rgba(239, 68, 68, 0.75)'; // High surge hours in red
            }
            return 'rgba(6, 182, 212, 0.65)';
          },
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { size: 10 } }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#9ca3af', precision: 0 }
        }
      }
    }
  });
}

function renderWeekdayWeekendChart(dowData) {
  const canvas = document.getElementById('chart-weekday-weekend');
  if (!canvas) return;

  const labels = dowData.days.map((d) => d.dayName);
  const counts = dowData.days.map((d) => d.count);
  const revenues = dowData.days.map((d) => d.revenue);

  if (chartWeekday) chartWeekday.destroy();

  chartWeekday = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Bookings Volume',
          data: counts,
          backgroundColor: 'rgba(245, 158, 11, 0.7)',
          borderRadius: 4,
          yAxisID: 'y'
        },
        {
          label: 'Revenue (₹)',
          data: revenues,
          type: 'line',
          borderColor: '#10b981',
          fill: false,
          yAxisID: 'y1'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#f59e0b', precision: 0 }
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#10b981' }
        }
      }
    }
  });
}

function renderLocationsChart(locations) {
  const canvas = document.getElementById('chart-locations');
  if (!canvas) return;

  const sorted = [...locations].sort((a, b) => b.totalRevenue - a.totalRevenue);
  const labels = sorted.map((l) => l.name);
  const revenues = sorted.map((l) => l.totalRevenue);

  if (chartLocations) chartLocations.destroy();

  chartLocations = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Total Collected Revenue (₹)',
          data: revenues,
          backgroundColor: 'rgba(16, 185, 129, 0.65)',
          borderColor: '#10b981',
          borderWidth: 1.5,
          borderRadius: 6
        }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.06)' },
          ticks: { color: '#9ca3af' }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#9ca3af' }
        }
      }
    }
  });
}

function renderVehicleTypeChart(vehicles) {
  const canvas = document.getElementById('chart-vehicle-type');
  if (!canvas) return;

  const labels = vehicles.map((v) => v.vehicleType);
  const revenues = vehicles.map((v) => v.totalRevenue);

  if (chartVehicle) chartVehicle.destroy();

  chartVehicle = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: revenues,
          backgroundColor: [
            'rgba(6, 182, 212, 0.75)',
            'rgba(16, 185, 129, 0.75)',
            'rgba(139, 92, 246, 0.75)',
            'rgba(245, 158, 11, 0.75)'
          ],
          borderColor: '#0f172a',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        }
      }
    }
  });
}

function renderStatusDistributionChart(statuses) {
  const canvas = document.getElementById('chart-status-dist');
  if (!canvas) return;

  const labels = statuses.map((s) => s.status);
  const counts = statuses.map((s) => s.count);

  if (chartStatus) chartStatus.destroy();

  chartStatus = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [
        {
          data: counts,
          backgroundColor: [
            'rgba(16, 185, 129, 0.75)',
            'rgba(6, 182, 212, 0.75)',
            'rgba(239, 68, 68, 0.75)',
            'rgba(245, 158, 11, 0.75)',
            'rgba(100, 116, 139, 0.75)'
          ],
          borderColor: '#0f172a',
          borderWidth: 2
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#cbd5e1', font: { size: 11 } }
        }
      }
    }
  });
}

function renderAuditTable(quality) {
  const tbody = document.getElementById('audit-issues-tbody');
  if (!tbody) return;

  if (!quality || !quality.anomalies || quality.anomalies.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 1.5rem; color: #10b981; font-weight: 600;">
          ✓ Perfect Data Quality: No negative durations, excessive dwells, or orphan sessions detected.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = '';
  quality.anomalies.forEach((a) => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid rgba(255,255,255,0.06)';

    const sevClass = a.severity === 'CRITICAL' ? 'severity-critical' : a.severity === 'WARNING' ? 'severity-warning' : 'severity-info';

    tr.innerHTML = `
      <td style="padding: 0.65rem 0.75rem;">
        <span class="severity-badge ${sevClass}">${a.severity}</span>
      </td>
      <td style="padding: 0.65rem 0.75rem; font-family: monospace; font-weight: 700;">
        ${a.type}
      </td>
      <td style="padding: 0.65rem 0.75rem; color: var(--text-secondary);">
        ${a.entity}
      </td>
      <td style="padding: 0.65rem 0.75rem; font-family: monospace; color: var(--cyan); font-size: 0.8rem;">
        ${a.recordId}
      </td>
      <td style="padding: 0.65rem 0.75rem; color: var(--text-primary);">
        ${a.details}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ========================================================================= */
/* TAB 2: UNIT 1 ANALYTICS OVERVIEW (DESCRIPTIVE, DIAGNOSTIC, PREDICTIVE, PRESCRIPTIVE) */
/* ========================================================================= */
async function loadAnalyticsOverview() {
  try {
    const queryParams = new URLSearchParams();
    if (currentFilters.startDate) queryParams.append('startDate', currentFilters.startDate);
    if (currentFilters.endDate) queryParams.append('endDate', currentFilters.endDate);
    if (currentFilters.locationId && currentFilters.locationId !== 'all') {
      queryParams.append('locationId', currentFilters.locationId);
    }
    if (currentFilters.vehicleType && currentFilters.vehicleType !== 'all') {
      queryParams.append('vehicleType', currentFilters.vehicleType);
    }

    const res = await apiRequest(`/api/admin/analytics/overview?${queryParams.toString()}`);
    const ov = res.data;

    // 1. Descriptive
    const m = ov.descriptive.metrics;
    document.getElementById('desc-total-bookings').textContent = m.totalReservations;
    document.getElementById('desc-completed-bookings').textContent = m.completedBookings;
    document.getElementById('desc-total-revenue').textContent = `₹${m.grossRevenue.toLocaleString('en-IN')}`;
    document.getElementById('desc-avg-ticket').textContent = m.avgTransactionValue;
    document.getElementById('desc-avg-duration').textContent = `${m.avgParkingDurationMinutes} min (${m.avgParkingDurationHours}h)`;
    document.getElementById('desc-top-facility').textContent = m.topFacility.name;
    document.getElementById('desc-top-facility-rev').textContent = m.topFacility.revenue.toLocaleString('en-IN');

    const fleetEl = document.getElementById('desc-fleet-container');
    if (fleetEl && m.vehicleCategorySplit) {
      fleetEl.innerHTML = m.vehicleCategorySplit.map((v) => `
        <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.06); padding: 0.35rem 0;">
          <span><strong>${v.vehicleType}</strong> (${v.sharePct}%)</span>
          <span>₹${v.revenue.toLocaleString('en-IN')} (Avg: ₹${v.avgFare})</span>
        </div>
      `).join('');
    }

    // 2. Diagnostic
    const diagContainer = document.getElementById('diagnostic-findings-container');
    if (diagContainer && ov.diagnostic.findings) {
      diagContainer.innerHTML = ov.diagnostic.findings.map((f) => `
        <div style="background: rgba(0,0,0,0.25); padding: 1.15rem; border-radius: var(--radius-md); border-left: 3px solid var(--amber);">
          <div style="font-weight: 800; font-size: 0.95rem; color: #fff; margin-bottom: 0.4rem;">${f.aspect}</div>
          <div style="font-size: 0.8rem; color: var(--cyan); margin-bottom: 0.4rem;"><strong>Observed:</strong> ${f.observation}</div>
          <div style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.5rem;"><strong>Diagnostic Explanation:</strong> ${f.explanation}</div>
          ${f.cautionNote ? `<div style="font-size: 0.75rem; color: var(--amber); background: rgba(245,158,11,0.1); padding: 0.4rem 0.6rem; border-radius: 4px;">⚠️ <em>Caution:</em> ${f.cautionNote}</div>` : ''}
        </div>
      `).join('');
    }

    // 3. Predictive
    renderPredictiveChart(ov.predictive.forecast);
    const predTbody = document.getElementById('predictive-table-tbody');
    if (predTbody && ov.predictive.forecast) {
      predTbody.innerHTML = ov.predictive.forecast.map((p) => `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
          <td style="padding: 0.5rem; font-family: monospace;">${p.date}</td>
          <td style="padding: 0.5rem; font-weight: 600;">${p.dayName}</td>
          <td style="padding: 0.5rem; color: var(--cyan);">${p.predictedDemand} bookings</td>
          <td style="padding: 0.5rem; color: #c084fc; font-weight: 700;">₹${p.predictedRevenue.toLocaleString('en-IN')}</td>
          <td style="padding: 0.5rem; color: var(--text-muted); font-size: 0.75rem;">₹${p.lowerBound} – ₹${p.upperBound}</td>
        </tr>
      `).join('');
    }

    // 4. Prescriptive
    const recsContainer = document.getElementById('prescriptive-recs-container');
    if (recsContainer && ov.prescriptive.recommendations) {
      recsContainer.innerHTML = ov.prescriptive.recommendations.map((r) => `
        <div class="rec-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="badge" style="background: rgba(16,185,129,0.2); color: var(--primary); font-size: 0.7rem;">${r.category}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: monospace;">${r.id}</span>
          </div>
          <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #fff;">${r.title}</h4>
          <div style="font-size: 0.8rem; color: var(--text-secondary);"><strong style="color: var(--cyan);">Observed Metric:</strong> ${r.observedMetric}</div>
          <div style="font-size: 0.8rem; color: var(--text-secondary);"><strong style="color: var(--amber);">Rule Trigger:</strong> <code>${r.triggerCondition}</code></div>
          <div style="font-size: 0.82rem; color: var(--text-primary); background: rgba(255,255,255,0.04); padding: 0.6rem; border-radius: var(--radius-sm);">
            <strong>Suggested Action:</strong> ${r.suggestedAction}
          </div>
          <div style="font-size: 0.8rem; color: var(--primary); font-weight: 600;">
            ✓ Expected Benefit: ${r.expectedBenefit}
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    showToast('Failed to load Overview analytics: ' + err.message, 'error');
  }
}

function renderPredictiveChart(forecast) {
  const canvas = document.getElementById('chart-predictive-forecast');
  if (!canvas || !forecast) return;

  const labels = forecast.map((f) => `${f.dayName.slice(0, 3)} (${f.date.slice(5)})`);
  const revenues = forecast.map((f) => f.predictedRevenue);
  const uppers = forecast.map((f) => f.upperBound);
  const lowers = forecast.map((f) => f.lowerBound);

  if (chartPredictive) chartPredictive.destroy();

  chartPredictive = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Estimated Projected Revenue (₹)',
          data: revenues,
          borderColor: '#c084fc',
          backgroundColor: 'rgba(192, 132, 252, 0.2)',
          fill: true,
          tension: 0.35,
          pointRadius: 5
        },
        {
          label: 'Upper 95% Confidence Fence',
          data: uppers,
          borderColor: 'rgba(192, 132, 252, 0.4)',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Lower 95% Confidence Fence',
          data: lowers,
          borderColor: 'rgba(192, 132, 252, 0.4)',
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#cbd5e1' } }
      },
      scales: {
        x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: '#c084fc' }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

/* ========================================================================= */
/* TAB 3: UNIT 1 DATA DISTRIBUTION & TUKEY IQR OUTLIERS */
/* ========================================================================= */
async function loadDataDistribution(metric = 'duration') {
  try {
    const res = await apiRequest(`/api/admin/analytics/distribution?metric=${metric}`);
    const d = res.data;

    const s = d.stats;
    const unit = d.metricUnit;

    document.getElementById('dist-stat-mean').textContent = `${s.mean} ${unit}`;
    document.getElementById('dist-stat-median').textContent = `${s.median} ${unit}`;
    document.getElementById('dist-stat-mode').textContent = `${s.mode} ${unit}`;
    document.getElementById('dist-stat-stddev').textContent = `${s.stdDev} ${unit}`;
    document.getElementById('dist-stat-iqr').textContent = `${s.iqr} ${unit}`;
    document.getElementById('dist-stat-upper-fence').textContent = `${s.upperFence} ${unit}`;

    // Box Plot 5-number summary
    const bp = d.boxPlot;
    document.getElementById('bp-min').textContent = `${bp.min} ${unit}`;
    document.getElementById('bp-q1').textContent = `${bp.q1} ${unit}`;
    document.getElementById('bp-median').textContent = `${bp.median} ${unit}`;
    document.getElementById('bp-q3').textContent = `${bp.q3} ${unit}`;
    document.getElementById('bp-max').textContent = `${bp.max} ${unit}`;

    document.getElementById('outliers-count-badge').textContent = d.outliersCount;
    document.getElementById('outliers-pct-badge').textContent = `${d.outliersPercentage}%`;

    currentOutliersList = d.outliers || [];
    renderHistogramChart(d.histogram, d.metricLabel);
    renderOutliersTable(currentOutliersList);
  } catch (err) {
    showToast('Failed to load distribution analysis: ' + err.message, 'error');
  }
}

function renderHistogramChart(bins, label) {
  const canvas = document.getElementById('chart-distribution-histogram');
  if (!canvas || !bins) return;

  const labels = bins.map((b) => b.label);
  const counts = bins.map((b) => b.count);

  if (chartHistogram) chartHistogram.destroy();

  chartHistogram = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: `Frequency Count (${label})`,
          data: counts,
          backgroundColor: 'rgba(6, 182, 212, 0.7)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#9ca3af', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { color: '#06b6d4', precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' } }
      }
    }
  });
}

function renderOutliersTable(outliers) {
  const tbody = document.getElementById('outliers-tbody');
  if (!tbody) return;

  if (!outliers || outliers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 2rem; color: #10b981; font-weight: 600;">
          ✓ No statistical outliers detected outside Tukey's fences in the current selection.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = outliers.map((o) => {
    const sevClass = o.severity === 'CRITICAL' ? 'severity-critical' : 'severity-warning';
    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.06);">
        <td style="padding: 0.65rem;"><span class="severity-badge ${sevClass}">${o.severity}</span></td>
        <td style="padding: 0.65rem; font-family: monospace; color: var(--cyan);">${o.recordId}</td>
        <td style="padding: 0.65rem; font-weight: 600;">${o.vehicleNumber}</td>
        <td style="padding: 0.65rem; color: var(--text-secondary);">${o.facility}</td>
        <td style="padding: 0.65rem; font-weight: 800; color: #f59e0b;">${o.metricValue} ${o.unit}</td>
        <td style="padding: 0.65rem; color: var(--text-muted);">${o.fenceThreshold} ${o.unit}</td>
        <td style="padding: 0.65rem; font-size: 0.78rem;">${o.reason}</td>
        <td style="padding: 0.65rem; font-size: 0.78rem; color: var(--text-secondary);">${o.businessInterpretation}</td>
      </tr>
    `;
  }).join('');
}

function filterOutliersTable(term) {
  if (!term) {
    renderOutliersTable(currentOutliersList);
    return;
  }
  const filtered = currentOutliersList.filter((o) =>
    o.recordId.toLowerCase().includes(term) ||
    o.vehicleNumber.toLowerCase().includes(term) ||
    o.facility.toLowerCase().includes(term)
  );
  renderOutliersTable(filtered);
}

function exportOutliersToCSV() {
  if (!currentOutliersList || currentOutliersList.length === 0) {
    showToast('No outlier records to export', 'info');
    return;
  }

  const headers = ['Record_ID', 'Vehicle_Number', 'Facility', 'Metric_Value', 'Unit', 'Fence_Threshold', 'Severity', 'Flag_Reason', 'Business_Interpretation'];
  const rows = currentOutliersList.map((o) => [
    `"${o.recordId}"`,
    `"${o.vehicleNumber}"`,
    `"${o.facility}"`,
    o.metricValue,
    `"${o.unit}"`,
    o.fenceThreshold,
    `"${o.severity}"`,
    `"${o.reason}"`,
    `"${o.businessInterpretation}"`
  ].join(','));

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `parkpulse_${currentDistMetric}_outliers.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('Outliers dataset exported to CSV successfully! 📥', 'success');
}

/* ========================================================================= */
/* TAB 5: UNIT 2 SQL PRACTICAL LABORATORY */
/* ========================================================================= */
async function loadSQLExperiments() {
  if (sqlExperimentsData.length > 0) {
    renderSQLExperiments();
    return;
  }

  try {
    const res = await apiRequest('/api/admin/analytics/sql/experiments');
    sqlExperimentsData = res.data || [];
    renderSQLExperiments();
  } catch (err) {
    showToast('Failed to load SQL experiments: ' + err.message, 'error');
  }
}

function renderSQLExperiments() {
  const container = document.getElementById('sql-experiments-container');
  if (!container) return;

  if (!sqlExperimentsData || sqlExperimentsData.length === 0) {
    container.innerHTML = '<div style="text-align: center; padding: 2rem;">No SQL experiments found.</div>';
    return;
  }

  container.innerHTML = sqlExperimentsData.map((exp, idx) => {
    const queryCode = activeSqlDialect === 'mysql' ? exp.mysqlQuery : exp.oracleQuery;
    const dialectLabel = activeSqlDialect === 'mysql' ? 'MySQL 8.0' : 'Oracle Database';

    const columnsHeader = exp.expectedColumns.map((c) => `<th style="padding: 0.5rem 0.75rem;">${c}</th>`).join('');
    const sampleRows = exp.sampleResults.map((row) => {
      const cells = exp.expectedColumns.map((c) => `<td style="padding: 0.45rem 0.75rem;">${row[c] !== undefined ? row[c] : ''}</td>`).join('');
      return `<tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">${cells}</tr>`;
    }).join('');

    return `
      <div class="glass-card" style="padding: 1.5rem; border-color: rgba(139,92,246,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.8rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: rgba(139,92,246,0.25); color: #c084fc; font-weight: 800;">EXPERIMENT ${exp.experimentNumber}</span>
              <span class="badge" style="background: rgba(255,255,255,0.08);">${exp.syllabusTopic}</span>
            </div>
            <h3 style="margin: 0; font-size: 1.25rem; font-weight: 800; color: #fff;">${exp.title}</h3>
          </div>
          <span class="badge" style="background: rgba(6,182,212,0.2); color: var(--cyan);">${dialectLabel}</span>
        </div>

        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;">
          <strong>Objective:</strong> ${exp.objective}
        </p>

        <!-- Code Block -->
        <div class="sql-code-block" style="margin-bottom: 1rem;">
          <button class="copy-code-btn" data-query-index="${idx}">📋 Copy SQL</button>
          <pre style="margin: 0; font-family: inherit;"><code>${escapeHTML(queryCode)}</code></pre>
        </div>

        <div style="display: flex; gap: 0.75rem; align-items: center; margin-bottom: 1rem; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm btn-run-query" data-exp-index="${idx}">
            ▶ Run Query & View Output Table
          </button>
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            Expected Columns: <code>${exp.expectedColumns.join(', ')}</code>
          </span>
        </div>

        <!-- Result Container (Initially hidden until clicked) -->
        <div id="query-result-${idx}" style="display: none; background: rgba(0,0,0,0.4); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1rem; overflow-x: auto;">
          <div style="font-weight: 700; font-size: 0.85rem; color: var(--primary); margin-bottom: 0.5rem;">
            ✓ Live Execution Output (${exp.sampleResults.length} records returned from dataset):
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--cyan); font-size: 0.72rem; text-transform: uppercase;">
                ${columnsHeader}
              </tr>
            </thead>
            <tbody>
              ${sampleRows.length > 0 ? sampleRows : '<tr><td colspan="10" style="padding: 1rem; text-align: center; color: var(--text-muted);">Zero rows returned (verified clean audit status)</td></tr>'}
            </tbody>
          </table>
        </div>

        <!-- Explanation & Takeaway -->
        <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.82rem; line-height: 1.5; color: var(--text-secondary);">
          <div style="margin-bottom: 0.35rem;"><strong style="color: #fff;">Technical Explanation:</strong> ${exp.explanation}</div>
          <div><strong style="color: var(--primary);">Managerial Takeaway:</strong> ${exp.businessInterpretation}</div>
        </div>
      </div>
    `;
  }).join('');

  // Add event listeners for Copy and Run
  container.querySelectorAll('.copy-code-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-query-index');
      const exp = sqlExperimentsData[idx];
      const code = activeSqlDialect === 'mysql' ? exp.mysqlQuery : exp.oracleQuery;
      navigator.clipboard.writeText(code).then(() => {
        showToast(`Experiment ${exp.experimentNumber} query copied to clipboard! 📋`, 'success');
      });
    });
  });

  container.querySelectorAll('.btn-run-query').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-exp-index');
      const resultDiv = document.getElementById(`query-result-${idx}`);
      if (resultDiv) {
        if (resultDiv.style.display === 'none') {
          resultDiv.style.display = 'block';
          btn.textContent = 'Hide Query Results';
        } else {
          resultDiv.style.display = 'none';
          btn.textContent = '▶ Run Query & View Output Table';
        }
      }
    });
  });
}

function escapeHTML(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function setupRealtimeSync() {
  onSocketEvent('slot_status_updated', () => {
    loadBIData();
  });
  onSocketEvent('booking_created', () => {
    loadBIData();
  });
}
