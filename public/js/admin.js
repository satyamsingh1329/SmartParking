/**
 * ParkPulse Operator Control Center, Live IoT Fleet & Analytics Engine
 */
import { apiRequest, showToast, formatDateTime, formatCurrency } from './utils.js';
import { getStoredUser, isAuthenticated } from './auth.js';
import { onSocketEvent, emitSocketEvent } from './socket.js';

let revenueChart = null;
let occupancyChart = null;
let zoneChart = null;
let typeChart = null;

export async function initAdmin() {
  const user = getStoredUser();
  if (!isAuthenticated() || user.role !== 'ADMIN') {
    showToast('Admin authorization required', 'error');
    setTimeout(() => {
      window.location.href = '/login.html?redirect=/admin.html';
    }, 1000);
    return;
  }

  setupTabs();
  await loadAdminMetrics();
  await loadSimulatorSlots();
  await loadSensorFleet();
  setupANPRControls();
  await loadEVStations();
  await loadMLPredictions();
  await loadAnalyticsCharts();
  await loadAdminBookings();
  setupSimulatorControls();
  setupSocketListeners();
}

function setupTabs() {
  const buttons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.tab-panel');

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      panels.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId)?.classList.add('active');

      // Trigger resize for charts if switching to analytics tab
      if (targetId === 'tab-analytics-ml') {
        setTimeout(() => {
          revenueChart?.resize();
          occupancyChart?.resize();
          zoneChart?.resize();
          typeChart?.resize();
        }, 100);
      }
    });
  });

  document.getElementById('btn-refresh-sensors')?.addEventListener('click', () => loadSensorFleet());
  document.getElementById('btn-refresh-ev')?.addEventListener('click', () => loadEVStations());
  document.getElementById('btn-refresh-bookings')?.addEventListener('click', () => loadAdminBookings());
}

async function loadAdminMetrics() {
  try {
    const res = await apiRequest('/api/admin/dashboard');
    const d = res.data;

    document.getElementById('metric-total-capacity').textContent = d.totalCapacity;
    document.getElementById('metric-available').textContent = d.available;
    document.getElementById('metric-occupied').textContent = d.occupied;
    document.getElementById('metric-reserved').textContent = d.reserved;
    document.getElementById('metric-occupancy-rate').textContent = `${d.occupancyRate}%`;
    document.getElementById('metric-active-sessions').textContent = d.activeSessions;
    document.getElementById('metric-today-revenue').textContent = `₹${d.todayRevenue}`;
    document.getElementById('metric-total-bookings').textContent = d.totalBookings;
  } catch (err) {
    showToast('Failed to load admin metrics', 'error');
  }
}

async function loadSimulatorSlots() {
  const slotSelect = document.getElementById('sim-slot-select');
  if (!slotSelect) return;

  try {
    const res = await apiRequest('/api/slots');
    slotSelect.innerHTML = '';

    res.data.forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot._id;
      opt.textContent = `${slot.slotNumber} (Floor ${slot.floor}, Zone ${slot.zone}) - Currently ${slot.status.toUpperCase()}`;
      opt.setAttribute('data-slot-number', slot.slotNumber);
      opt.setAttribute('data-sensor-id', slot.sensorId || `US-${slot.slotNumber}`);
      opt.setAttribute('data-status', slot.status);
      slotSelect.appendChild(opt);
    });

    slotSelect.addEventListener('change', () => {
      const selected = slotSelect.selectedOptions[0];
      if (selected) {
        document.getElementById('sim-sensor-id').textContent = selected.getAttribute('data-sensor-id');
        document.getElementById('sim-slot-status').textContent = selected.getAttribute('data-status').toUpperCase();
      }
    });

    if (res.data.length > 0) {
      slotSelect.dispatchEvent(new Event('change'));
    }
  } catch (err) {
    showToast('Failed to load slots for simulator', 'error');
  }
}

function setupSimulatorControls() {
  // Simulate Entry
  document.getElementById('btn-sim-entry')?.addEventListener('click', async () => {
    const slotSelect = document.getElementById('sim-slot-select');
    const selected = slotSelect.selectedOptions[0];
    if (!selected) return;

    const slotNumber = selected.getAttribute('data-slot-number');
    const sensorId = selected.getAttribute('data-sensor-id');

    try {
      await apiRequest('/api/sensors/event', {
        method: 'POST',
        body: JSON.stringify({
          slotNumber,
          sensorId,
          eventType: 'entry'
        })
      });

      showToast(`🟢 SENSOR EVENT: Vehicle detected entering bay ${slotNumber}!`, 'success');
      selected.setAttribute('data-status', 'occupied');
      document.getElementById('sim-slot-status').textContent = 'OCCUPIED';
      selected.textContent = `${slotNumber} - Currently OCCUPIED`;
      await loadAdminMetrics();
      await loadSensorFleet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Simulate Exit
  document.getElementById('btn-sim-exit')?.addEventListener('click', async () => {
    const slotSelect = document.getElementById('sim-slot-select');
    const selected = slotSelect.selectedOptions[0];
    if (!selected) return;

    const slotNumber = selected.getAttribute('data-slot-number');
    const sensorId = selected.getAttribute('data-sensor-id');

    try {
      await apiRequest('/api/sensors/event', {
        method: 'POST',
        body: JSON.stringify({
          slotNumber,
          sensorId,
          eventType: 'exit'
        })
      });

      showToast(`⚪ SENSOR EVENT: Vehicle exited bay ${slotNumber}!`, 'info');
      selected.setAttribute('data-status', 'available');
      document.getElementById('sim-slot-status').textContent = 'AVAILABLE';
      selected.textContent = `${slotNumber} - Currently AVAILABLE`;
      await loadAdminMetrics();
      await loadSensorFleet();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Phase 21: IoT Sensor Fleet Management
 */
async function loadSensorFleet() {
  const tbody = document.getElementById('sensor-fleet-tbody');
  if (!tbody) return;

  try {
    const res = await apiRequest('/api/sensors');
    tbody.innerHTML = '';

    res.data.slice(0, 30).forEach((s) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';

      const isOnline = s.health === 'ONLINE';
      const statusPill = isOnline
        ? `<span class="sensor-pill sensor-online">● ONLINE</span>`
        : `<span class="sensor-pill sensor-offline">● OFFLINE</span>`;

      const bayLabel = s.slotId ? `Bay ${s.slotId.slotNumber} (F${s.slotId.floor}-${s.slotId.zone})` : 'Unassigned';

      tr.innerHTML = `
        <td style="padding: 0.65rem 0.75rem; font-family: 'JetBrains Mono', monospace; font-weight: 700;">${s.sensorId}</td>
        <td style="padding: 0.65rem 0.75rem;">${bayLabel}</td>
        <td style="padding: 0.65rem 0.75rem;">${statusPill}</td>
        <td style="padding: 0.65rem 0.75rem;">🔋 ${s.batteryLevel || 90}%</td>
        <td style="padding: 0.65rem 0.75rem; color: var(--text-muted);">${s.signalStrength || -65} dBm</td>
        <td style="padding: 0.65rem 0.75rem; font-size: 0.75rem; color: var(--text-secondary);">${formatDateTime(s.lastHeartbeat)}</td>
        <td style="padding: 0.65rem 0.75rem; font-size: 0.75rem;">${s.lastEventType ? s.lastEventType.toUpperCase() : 'None'}</td>
        <td style="padding: 0.65rem 0.75rem;">
          <button class="btn btn-secondary btn-sm btn-ping-heartbeat" data-sensor-id="${s.sensorId}" style="padding: 0.2rem 0.5rem; font-size: 0.72rem;">Heartbeat</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll('.btn-ping-heartbeat').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const sensorId = e.target.getAttribute('data-sensor-id');
        try {
          await apiRequest('/api/sensors/heartbeat', {
            method: 'POST',
            body: JSON.stringify({ sensorId })
          });
          showToast(`Heartbeat confirmed for ${sensorId}`, 'success');
          await loadSensorFleet();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" style="padding: 1rem; color: var(--crimson);">Failed to load sensors: ${err.message}</td></tr>`;
  }
}

/**
 * Phase 11: ANPR Optical Gate Simulator Controls
 */
function setupANPRControls() {
  document.querySelectorAll('.anpr-quick-fill').forEach((btn) => {
    btn.addEventListener('click', () => {
      const plate = btn.getAttribute('data-plate');
      const input = document.getElementById('anpr-plate-input');
      if (input) input.value = plate;
    });
  });

  document.getElementById('btn-trigger-anpr')?.addEventListener('click', async () => {
    const plateInput = document.getElementById('anpr-plate-input');
    const gateSelect = document.getElementById('anpr-gate-direction');
    const resultPanel = document.getElementById('anpr-result-panel');
    const plate = plateInput?.value.trim().toUpperCase();
    const gateType = gateSelect?.value || 'ENTRY';

    if (!plate) {
      showToast('Please specify a license plate number', 'error');
      return;
    }

    try {
      const res = await apiRequest('/api/anpr/simulate', {
        method: 'POST',
        body: JSON.stringify({ vehicleNumber: plate, gateType })
      });

      const d = res.data;
      resultPanel.style.display = 'block';

      if (d.authorized) {
        resultPanel.style.background = 'rgba(16, 185, 129, 0.12)';
        resultPanel.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        resultPanel.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.4rem;">🟢</span>
              <strong style="color: var(--primary); font-size: 1.1rem;">ACCESS AUTHORIZED — BARRIER OPENED</strong>
            </div>
            <span class="badge badge-available">Mode: ${d.mode}</span>
          </div>
          <p style="margin: 0.25rem 0; font-size: 0.9rem;">${d.message}</p>
          <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem; font-size: 0.82rem; color: var(--text-secondary); flex-wrap: wrap;">
            <span>Plate: <strong>${d.plateNumber}</strong></span>
            ${d.slotNumber ? `<span>Assigned Bay: <strong>${d.slotNumber}</strong></span>` : ''}
            ${d.driverName ? `<span>Driver: <strong>${d.driverName}</strong></span>` : ''}
            ${d.totalBilled !== undefined ? `<span>Final Bill: <strong>₹${d.totalBilled}</strong></span>` : ''}
            <span>Optical Confidence: <strong>${Math.round(d.confidence * 100)}%</strong></span>
          </div>
        `;
      } else {
        resultPanel.style.background = 'rgba(239, 68, 68, 0.12)';
        resultPanel.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        resultPanel.innerHTML = `
          <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
            <span style="font-size: 1.4rem;">🔴</span>
            <strong style="color: var(--crimson); font-size: 1.1rem;">BARRIER CLOSED — ACCESS DENIED</strong>
          </div>
          <p style="margin: 0.25rem 0; font-size: 0.9rem;">${d.message}</p>
        `;
      }

      await loadAdminMetrics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

/**
 * Phase 15: EV Charging Stations Management
 */
async function loadEVStations() {
  const container = document.getElementById('ev-stations-grid');
  if (!container) return;

  try {
    const res = await apiRequest('/api/ev/stations');
    container.innerHTML = '';

    res.data.forEach((st) => {
      const isAvailable = st.status === 'AVAILABLE';
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '1.25rem';
      card.style.borderColor = isAvailable ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.4)';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
          <div>
            <span style="font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 0.95rem; color: var(--cyan);">${st.stationId}</span>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${st.locationId?.name || 'Main Facility'}</div>
          </div>
          <span class="badge ${isAvailable ? 'badge-available' : 'badge-surge'}">${st.status}</span>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; font-size: 0.82rem; margin-bottom: 1rem;">
          <div>
            <span style="color: var(--text-muted); display: block;">Connector</span>
            <strong>${st.connectorType}</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Power Rating</span>
            <strong>${st.powerKW} kW Fast</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Tariff</span>
            <strong>₹${st.ratePerKWh}/kWh</strong>
          </div>
          <div>
            <span style="color: var(--text-muted); display: block;">Current Vehicle</span>
            <strong>${st.currentVehicleNumber || 'None'}</strong>
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem;">
          ${
            isAvailable
              ? `<button class="btn btn-secondary btn-sm btn-ev-start" data-station-id="${st.stationId}" style="flex: 1; font-size: 0.8rem;">Start Charge</button>`
              : `<button class="btn btn-danger btn-sm btn-ev-stop" data-station-id="${st.stationId}" style="flex: 1; font-size: 0.8rem;">Stop & Settle</button>`
          }
        </div>
      `;
      container.appendChild(card);
    });

    // Wire EV triggers
    document.querySelectorAll('.btn-ev-start').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const stationId = e.target.getAttribute('data-station-id');
        const vNum = prompt('Enter vehicle registration number for EV session:', 'HR26EV5678');
        if (!vNum) return;
        try {
          await apiRequest('/api/ev/start', {
            method: 'POST',
            body: JSON.stringify({ stationId, vehicleNumber: vNum })
          });
          showToast(`EV session commenced at ${stationId}`, 'success');
          await loadEVStations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    document.querySelectorAll('.btn-ev-stop').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        const stationId = e.target.getAttribute('data-station-id');
        try {
          const res = await apiRequest('/api/ev/stop', {
            method: 'POST',
            body: JSON.stringify({ stationId })
          });
          showToast(`EV charging settled at ${stationId}. Total: ₹${res.data.totalChargingCost}`, 'success');
          await loadEVStations();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="color: var(--crimson);">Failed to load EV stations: ${err.message}</div>`;
  }
}

/**
 * Phase 12 & 14: Machine Learning Availability Prediction
 */
async function loadMLPredictions() {
  const container = document.getElementById('ml-horizons-container');
  if (!container) return;

  try {
    const res = await apiRequest('/api/predictions/availability');
    const d = res.data;

    const weatherDesc = document.getElementById('ml-weather-desc');
    const weatherMult = document.getElementById('ml-weather-mult');
    if (weatherDesc) weatherDesc.textContent = `${d.weatherContext.condition} (${d.weatherContext.temperatureC}°C)`;
    if (weatherMult) weatherMult.textContent = `${d.weatherContext.demandMultiplier}x`;

    const peakToday = document.getElementById('peak-today-window');
    const peakWeekly = document.getElementById('peak-weekly-window');
    const peakLowest = document.getElementById('peak-lowest-window');
    const peakRate = document.getElementById('peak-rate-window');

    if (peakToday) peakToday.textContent = d.peakHourAnalysis.todayPredictedPeak;
    if (peakWeekly) peakWeekly.textContent = d.peakHourAnalysis.weeklyPeak;
    if (peakLowest) peakLowest.textContent = d.peakHourAnalysis.lowestDemandPeriod;
    if (peakRate) peakRate.textContent = d.peakHourAnalysis.peakOccupancyRate;

    container.innerHTML = '';
    d.forecastHorizons.forEach((h) => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '1rem';
      card.style.background = 'rgba(0,0,0,0.3)';

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-weight: 700; color: var(--cyan); font-size: 0.88rem;">In ${h.minutesAhead} Minutes</span>
          <span class="badge" style="font-size: 0.72rem; background: rgba(255,255,255,0.1);">${h.targetTime}</span>
        </div>
        <div style="font-size: 1.5rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.25rem;">
          ${h.predictedAvailableSlots} <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">available</span>
        </div>
        <div style="font-size: 0.8rem; color: var(--text-secondary);">
          Predicted Occupancy: <strong>${h.predictedOccupancyRate}%</strong>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error('Failed to load ML predictions:', err);
  }
}

async function loadAnalyticsCharts() {
  if (typeof Chart === 'undefined') return;

  try {
    const res = await apiRequest('/api/admin/analytics');
    const a = res.data;

    // Display Best Time Tip
    const tipEl = document.getElementById('best-time-tip');
    if (tipEl) tipEl.textContent = a.peakHourText || a.bestTimeToPark;

    // Real KPIs
    if (a.kpis) {
      document.getElementById('kpi-slot-turnover').textContent = a.kpis.slotTurnover;
      document.getElementById('kpi-avg-duration').textContent = `${a.kpis.avgDurationMinutes} min`;
      document.getElementById('kpi-cancel-rate').textContent = `${a.kpis.cancellationRate}%`;
      document.getElementById('kpi-noshow-rate').textContent = `${a.kpis.noShowRate}%`;
    }

    // 1. Hourly Occupancy Chart
    const occCanvas = document.getElementById('chart-occupancy');
    if (occCanvas) {
      if (occupancyChart) occupancyChart.destroy();
      occupancyChart = new Chart(occCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: a.hourlyOccupancy.map((h) => h.hour),
          datasets: [
            {
              label: 'Bookings / Sessions',
              data: a.hourlyOccupancy.map((h) => h.count),
              backgroundColor: 'rgba(16, 185, 129, 0.65)',
              borderColor: '#10b981',
              borderRadius: 6,
              borderWidth: 1.5
            }
          ]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
          }
        }
      });
    }

    // 2. Revenue Chart
    const revCanvas = document.getElementById('chart-revenue');
    if (revCanvas) {
      if (revenueChart) revenueChart.destroy();
      revenueChart = new Chart(revCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels: a.last7Days.map((d) => d.date),
          datasets: [
            {
              label: 'Daily Revenue (₹)',
              data: a.last7Days.map((d) => d.revenue),
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.15)',
              tension: 0.35,
              fill: true,
              pointBackgroundColor: '#06b6d4'
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
          }
        }
      });
    }

    // 3. Zone Distribution Chart
    const zoneCanvas = document.getElementById('chart-zones');
    if (zoneCanvas) {
      if (zoneChart) zoneChart.destroy();
      zoneChart = new Chart(zoneCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: a.zoneDistribution.map((z) => z.zone),
          datasets: [
            {
              label: 'Total Bays',
              data: a.zoneDistribution.map((z) => z.total),
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 4
            },
            {
              label: 'Occupied',
              data: a.zoneDistribution.map((z) => z.occupied),
              backgroundColor: 'rgba(239, 68, 68, 0.75)',
              borderRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          scales: {
            y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: '#9ca3af' } },
            x: { grid: { display: false }, ticks: { color: '#9ca3af' } }
          }
        }
      });
    }

    // 4. Type Distribution Chart
    const typeCanvas = document.getElementById('chart-types');
    if (typeCanvas) {
      if (typeChart) typeChart.destroy();
      typeChart = new Chart(typeCanvas.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: a.typeDistribution.map((t) => t.type),
          datasets: [
            {
              data: a.typeDistribution.map((t) => t.count),
              backgroundColor: ['#10b981', '#06b6d4', '#eab308', '#8b5cf6'],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: 'bottom', labels: { color: '#9ca3af', boxWidth: 12 } }
          }
        }
      });
    }
  } catch (err) {
    console.error('Failed to render analytics charts:', err);
  }
}

async function loadAdminBookings() {
  const tbody = document.getElementById('admin-bookings-tbody');
  if (!tbody) return;

  try {
    const res = await apiRequest('/api/admin/bookings');
    tbody.innerHTML = '';

    res.data.forEach((b) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';

      tr.innerHTML = `
        <td style="padding: 0.85rem 0.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace;">${b.bookingId}</td>
        <td style="padding: 0.85rem 0.75rem;">${b.userId?.name || 'Customer'}</td>
        <td style="padding: 0.85rem 0.75rem; font-weight: 600;">Bay ${b.slotId?.slotNumber || 'A-01'}</td>
        <td style="padding: 0.85rem 0.75rem; font-family: 'JetBrains Mono', monospace;">${b.vehicleNumber}</td>
        <td style="padding: 0.85rem 0.75rem; font-size: 0.82rem; color: var(--text-secondary);">${formatDateTime(b.createdAt)}</td>
        <td style="padding: 0.85rem 0.75rem; font-weight: 700;">₹${b.totalAmount}</td>
        <td style="padding: 0.85rem 0.75rem;"><span class="badge badge-available">${b.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 1rem;">Failed to load bookings</td></tr>`;
  }
}

function setupSocketListeners() {
  onSocketEvent('stats:updated', () => loadAdminMetrics());
  onSocketEvent('slot:updated', () => {
    loadSimulatorSlots();
    loadSensorFleet();
  });
  onSocketEvent('gate:activity', (data) => {
    showToast(`Gate Activity: ${data.vehicleNumber} -> ${data.reason}`, 'info');
  });
  onSocketEvent('ev:status_change', () => loadEVStations());
}
