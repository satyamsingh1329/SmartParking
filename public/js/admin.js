/**
 * ParkPulse Admin Control Center, Live IoT Simulator & Analytics Engine
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

  await loadAdminMetrics();
  await loadSimulatorSlots();
  await loadAnalyticsCharts();
  await loadAdminBookings();
  setupSimulatorControls();
  setupSocketListeners();
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
      const res = await apiRequest('/api/sensors/event', {
        method: 'POST',
        body: JSON.stringify({
          slotNumber,
          sensorId,
          eventType: 'entry'
        })
      });

      showToast(`🟢 SENSOR EVENT TRIGGERED: Vehicle entered bay ${slotNumber}!`, 'success');
      selected.setAttribute('data-status', 'occupied');
      document.getElementById('sim-slot-status').textContent = 'OCCUPIED';
      selected.textContent = `${slotNumber} - Currently OCCUPIED`;
      await loadAdminMetrics();
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
      const res = await apiRequest('/api/sensors/event', {
        method: 'POST',
        body: JSON.stringify({
          slotNumber,
          sensorId,
          eventType: 'exit'
        })
      });

      showToast(`⚪ SENSOR EVENT TRIGGERED: Vehicle exited bay ${slotNumber}!`, 'info');
      selected.setAttribute('data-status', 'available');
      document.getElementById('sim-slot-status').textContent = 'AVAILABLE';
      selected.textContent = `${slotNumber} - Currently AVAILABLE`;
      await loadAdminMetrics();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadAnalyticsCharts() {
  if (typeof Chart === 'undefined') return;

  try {
    const res = await apiRequest('/api/admin/analytics');
    const a = res.data;

    // Display Best Time Recommendation
    const tipEl = document.getElementById('best-time-tip');
    if (tipEl) tipEl.textContent = a.bestTimeToPark || '02:00 PM – 04:00 PM';

    // 1. Hourly Occupancy Chart
    const occCanvas = document.getElementById('chart-occupancy');
    if (occCanvas) {
      if (occupancyChart) occupancyChart.destroy();
      occupancyChart = new Chart(occCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: a.hourlyOccupancy.map(h => h.hour),
          datasets: [{
            label: 'Occupied Bays',
            data: a.hourlyOccupancy.map(h => h.count),
            backgroundColor: 'rgba(16, 185, 129, 0.65)',
            borderColor: '#10b981',
            borderRadius: 6,
            borderWidth: 1.5
          }]
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
          labels: a.last7Days.map(d => d.date),
          datasets: [{
            label: 'Daily Revenue (₹)',
            data: a.last7Days.map(d => d.revenue),
            borderColor: '#06b6d4',
            backgroundColor: 'rgba(6, 182, 212, 0.15)',
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#06b6d4'
          }]
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
          labels: a.zoneDistribution.map(z => z.zone),
          datasets: [
            {
              label: 'Total Bays',
              data: a.zoneDistribution.map(z => z.total),
              backgroundColor: 'rgba(255,255,255,0.15)',
              borderRadius: 4
            },
            {
              label: 'Occupied',
              data: a.zoneDistribution.map(z => z.occupied),
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
          labels: a.typeDistribution.map(t => t.type),
          datasets: [{
            data: a.typeDistribution.map(t => t.count),
            backgroundColor: ['#10b981', '#06b6d4', '#eab308', '#8b5cf6'],
            borderWidth: 0
          }]
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
  onSocketEvent('slot:updated', () => loadSimulatorSlots());
}
