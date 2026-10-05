/**
 * ParkPulse User Dashboard, Live Session Timer & Account Management
 */
import { apiRequest, showToast, formatDateTime, formatCurrency, openModal, closeModal } from './utils.js';
import { getStoredUser, isAuthenticated } from './auth.js';
import { onSocketEvent } from './socket.js';

let activeTimerInterval = null;
let currentActiveBooking = null;

export async function initDashboard() {
  if (!isAuthenticated()) {
    window.location.href = '/login.html?redirect=/dashboard.html';
    return;
  }

  await loadUserProfile();
  await loadActiveSessionCard();
  await loadBookingsHistory();
  await loadVehicles();
  setupDashboardListeners();
  setupSocketListeners();
}

async function loadUserProfile() {
  try {
    const data = await apiRequest('/api/auth/me');
    const user = data.user;

    document.getElementById('dash-user-name').textContent = user.name;
    document.getElementById('dash-user-email').textContent = user.email;
    document.getElementById('dash-reward-points').textContent = user.rewardPoints || 0;

    // Fill profile form
    const nameInput = document.getElementById('profile-name');
    const phoneInput = document.getElementById('profile-phone');
    if (nameInput) nameInput.value = user.name;
    if (phoneInput) phoneInput.value = user.phone;

    // Rewards info
    const discountVal = Math.floor((user.rewardPoints || 0) / 100) * 20;
    const discountEl = document.getElementById('reward-discount-value');
    if (discountEl) discountEl.textContent = `₹${discountVal}`;
  } catch (err) {
    showToast('Failed to load user profile', 'error');
  }
}

async function loadActiveSessionCard() {
  const container = document.getElementById('active-parking-card-container');
  if (!container) return;

  try {
    const res = await apiRequest('/api/bookings/my');
    const activeBooking = res.data.find(b => b.status === 'ACTIVE' || b.status === 'CONFIRMED');

    if (activeBooking) {
      currentActiveBooking = activeBooking;
      renderActiveSessionCard(activeBooking, container);
      startSessionTimer(activeBooking);
    } else {
      currentActiveBooking = null;
      if (activeTimerInterval) clearInterval(activeTimerInterval);
      container.innerHTML = `
        <div class="glass-card" style="text-align: center; padding: 2.5rem 1.5rem;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🅿️</div>
          <h3 style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.5rem;">No Active Parking Session</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 400px; margin: 0 auto 1.5rem auto;">
            Need a secure spot for your car, bike, or EV? Reserve a bay in seconds with real-time navigation.
          </p>
          <a href="/parking.html" class="btn btn-primary">Find & Reserve Parking</a>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<p style="color: #ef4444;">Failed to load active session</p>`;
  }
}

function renderActiveSessionCard(booking, container) {
  const isCheckedIn = booking.status === 'ACTIVE';
  const statusBadge = isCheckedIn
    ? `<span class="badge badge-occupied">● VEHICLE PARKED (ACTIVE)</span>`
    : `<span class="badge badge-reserved">● RESERVED (AWAITING CHECK-IN)</span>`;

  container.innerHTML = `
    <div class="glass-card" style="border-left: 4px solid var(--primary); position: relative; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
        <div>
          <div style="margin-bottom: 0.4rem;">${statusBadge}</div>
          <h2 style="font-size: 1.45rem; font-weight: 800; letter-spacing: -0.5px;">
            Bay ${booking.slotId?.slotNumber || 'Assigned'} 
            <span style="font-size: 0.95rem; font-weight: 500; color: var(--text-secondary);">(${booking.locationId?.name || 'ParkPulse Facility'})</span>
          </h2>
          <div style="font-size: 0.85rem; color: var(--text-muted);">
            Floor ${booking.slotId?.floor || 1} • Zone ${booking.slotId?.zone || 'A'} • Pass: <strong style="color: var(--text-primary);">${booking.bookingId}</strong>
          </div>
        </div>
        <div style="display: flex; gap: 0.65rem;">
          <a href="/parking-pass.html?id=${booking.bookingId}" class="btn btn-secondary btn-sm">📱 View Pass</a>
          <button class="btn btn-primary btn-sm" id="btn-extend-modal">⏳ Extend Stay</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; background: rgba(0,0,0,0.25); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Vehicle</span>
          <div style="font-weight: 700; font-size: 1.05rem; font-family: 'JetBrains Mono', monospace;">${booking.vehicleNumber}</div>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Elapsed Time</span>
          <div style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary);" id="live-elapsed-time">00:00:00</div>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Remaining Time</span>
          <div style="font-weight: 700; font-size: 1.15rem; color: var(--primary);" id="live-remaining-time">--:--:--</div>
        </div>
        <div>
          <span style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Amount Paid</span>
          <div style="font-weight: 700; font-size: 1.05rem;">₹${booking.totalAmount}</div>
        </div>
      </div>

      <div id="overstay-warning-banner" style="display: none; padding: 0.85rem; background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; border-radius: var(--radius-md); color: #ff6b6b; font-size: 0.88rem; align-items: center; gap: 0.5rem;">
        <span>⚠️</span>
        <div><strong>OVERSTAY WARNING:</strong> Your reserved parking duration has ended. Additional overstay fee (₹50/hr) is currently accruing. Please extend stay or proceed to checkout.</div>
      </div>
    </div>
  `;

  document.getElementById('btn-extend-modal')?.addEventListener('click', () => {
    openModal('extend-stay-modal');
  });
}

function startSessionTimer(booking) {
  if (activeTimerInterval) clearInterval(activeTimerInterval);

  const startTime = new Date(booking.checkInTime || booking.startTime).getTime();
  const endTime = new Date(booking.expectedEndTime).getTime();

  function update() {
    const now = Date.now();
    const elapsedMs = Math.max(0, now - startTime);
    const remainingMs = endTime - now;

    // Format elapsed
    const elapsedHours = Math.floor(elapsedMs / (3600 * 1000));
    const elapsedMinutes = Math.floor((elapsedMs % (3600 * 1000)) / (60 * 1000));
    const elapsedSeconds = Math.floor((elapsedMs % (60 * 1000)) / 1000);
    const elapsedEl = document.getElementById('live-elapsed-time');
    if (elapsedEl) {
      elapsedEl.textContent = `${String(elapsedHours).padStart(2, '0')}:${String(elapsedMinutes).padStart(2, '0')}:${String(elapsedSeconds).padStart(2, '0')}`;
    }

    const remainingEl = document.getElementById('live-remaining-time');
    const overstayBanner = document.getElementById('overstay-warning-banner');

    if (remainingMs > 0) {
      const remHours = Math.floor(remainingMs / (3600 * 1000));
      const remMinutes = Math.floor((remainingMs % (3600 * 1000)) / (60 * 1000));
      const remSeconds = Math.floor((remainingMs % (60 * 1000)) / 1000);
      if (remainingEl) {
        remainingEl.textContent = `${String(remHours).padStart(2, '0')}:${String(remMinutes).padStart(2, '0')}:${String(remSeconds).padStart(2, '0')}`;
        remainingEl.style.color = 'var(--primary)';
      }
      if (overstayBanner) overstayBanner.style.display = 'none';
    } else {
      // Overstayed!
      const overstayMs = Math.abs(remainingMs);
      const ovHours = Math.floor(overstayMs / (3600 * 1000));
      const ovMinutes = Math.floor((overstayMs % (3600 * 1000)) / (60 * 1000));
      const ovSeconds = Math.floor((overstayMs % (60 * 1000)) / 1000);
      if (remainingEl) {
        remainingEl.textContent = `-${String(ovHours).padStart(2, '0')}:${String(ovMinutes).padStart(2, '0')}:${String(ovSeconds).padStart(2, '0')}`;
        remainingEl.style.color = '#ef4444';
      }
      if (overstayBanner) overstayBanner.style.display = 'flex';
    }
  }

  update();
  activeTimerInterval = setInterval(update, 1000);
}

async function loadBookingsHistory() {
  const tbody = document.getElementById('bookings-history-tbody');
  if (!tbody) return;

  try {
    const res = await apiRequest('/api/bookings/my');
    tbody.innerHTML = '';

    if (res.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No parking bookings recorded yet.
          </td>
        </tr>
      `;
      return;
    }

    res.data.forEach((b) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';

      let badgeClass = 'badge-available';
      if (b.status === 'ACTIVE') badgeClass = 'badge-occupied';
      if (b.status === 'EXPIRED' || b.status === 'CANCELLED') badgeClass = 'badge-secondary';
      if (b.status === 'CONFIRMED') badgeClass = 'badge-reserved';

      tr.innerHTML = `
        <td style="padding: 1rem 0.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
          <a href="/parking-pass.html?id=${b.bookingId}" style="color: var(--primary); text-decoration: underline;">${b.bookingId}</a>
        </td>
        <td style="padding: 1rem 0.75rem;">${b.locationId?.name || 'ParkPulse Hub'}</td>
        <td style="padding: 1rem 0.75rem; font-weight: 600;">${b.slotId?.slotNumber || 'N/A'}</td>
        <td style="padding: 1rem 0.75rem; font-family: 'JetBrains Mono', monospace;">${b.vehicleNumber}</td>
        <td style="padding: 1rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(b.startTime)}</td>
        <td style="padding: 1rem 0.75rem; font-weight: 700;">₹${b.totalAmount}</td>
        <td style="padding: 1rem 0.75rem;">
          <span class="badge ${badgeClass}">${b.status}</span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 1rem;">Failed to load history</td></tr>`;
  }
}

async function loadVehicles() {
  const container = document.getElementById('user-vehicles-list');
  if (!container) return;

  try {
    const res = await apiRequest('/api/auth/vehicles');
    container.innerHTML = '';

    if (res.vehicles.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 1.5rem; color: var(--text-muted); font-size: 0.9rem;">
          No vehicles registered. Add a car, bike, or EV for 1-click reservations.
        </div>
      `;
      return;
    }

    res.vehicles.forEach((v) => {
      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.padding = '1rem';
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.justifyContent = 'space-between';

      const icon = v.vehicleType === 'ev' ? '⚡' : (v.vehicleType === 'bike' ? '🏍️' : '🚗');

      card.innerHTML = `
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.5rem;">${icon}</span>
          <div>
            <div style="font-weight: 700; font-family: 'JetBrains Mono', monospace;">${v.vehicleNumber}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${v.model || v.vehicleType.toUpperCase()} ${v.isPrimary ? '• (Primary)' : ''}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm delete-vehicle-btn" data-id="${v._id}" style="color: #ef4444;">Delete</button>
      `;

      card.querySelector('.delete-vehicle-btn')?.addEventListener('click', async () => {
        if (confirm(`Remove vehicle ${v.vehicleNumber}?`)) {
          await apiRequest(`/api/auth/vehicles/${v._id}`, { method: 'DELETE' });
          showToast('Vehicle removed', 'info');
          await loadVehicles();
        }
      });

      container.appendChild(card);
    });
  } catch (err) {
    container.innerHTML = `<p style="color: #ef4444;">Failed to load vehicles</p>`;
  }
}

function setupDashboardListeners() {
  // Add vehicle modal
  document.getElementById('btn-add-vehicle-modal')?.addEventListener('click', () => {
    openModal('add-vehicle-modal');
  });

  document.getElementById('close-add-vehicle-modal')?.addEventListener('click', () => {
    closeModal('add-vehicle-modal');
  });

  document.getElementById('form-add-vehicle')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const number = document.getElementById('add-v-number').value.trim();
    const type = document.getElementById('add-v-type').value;
    const model = document.getElementById('add-v-model').value.trim();
    const isPrimary = document.getElementById('add-v-primary').checked;

    try {
      await apiRequest('/api/auth/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          vehicleNumber: number,
          vehicleType: type,
          model,
          isPrimary
        })
      });
      showToast('Vehicle added successfully!', 'success');
      closeModal('add-vehicle-modal');
      e.target.reset();
      await loadVehicles();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Profile update form
  document.getElementById('form-user-profile')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    const phone = document.getElementById('profile-phone').value.trim();

    try {
      const res = await apiRequest('/api/auth/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone })
      });
      localStorage.setItem('parkpulse_user', JSON.stringify(res.user));
      showToast('Profile updated successfully!', 'success');
      document.getElementById('dash-user-name').textContent = res.user.name;
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Extend stay action
  document.getElementById('btn-confirm-extend')?.addEventListener('click', async () => {
    if (!currentActiveBooking) return;
    const hours = parseFloat(document.getElementById('extend-hours-select').value) || 1;

    try {
      const res = await apiRequest(`/api/bookings/${currentActiveBooking.bookingId}/extend`, {
        method: 'PATCH',
        body: JSON.stringify({ additionalHours: hours })
      });
      showToast(`Stay extended by +${hours} hr(s) successfully!`, 'success');
      closeModal('extend-stay-modal');
      await loadActiveSessionCard();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('close-extend-modal')?.addEventListener('click', () => {
    closeModal('extend-stay-modal');
  });
}

function setupSocketListeners() {
  onSocketEvent('parking:started', () => {
    loadActiveSessionCard();
  });

  onSocketEvent('parking:completed', () => {
    loadActiveSessionCard();
    loadBookingsHistory();
  });

  onSocketEvent('booking:expired', () => {
    loadActiveSessionCard();
    loadBookingsHistory();
  });
}
