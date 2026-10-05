/**
 * ParkPulse 2D Interactive Parking Map & Slot Selection Engine
 */
import { apiRequest, formatCurrency, showToast, openModal, closeModal } from './utils.js';
import { onSocketEvent, emitSocketEvent } from './socket.js';

let currentLocationId = null;
let currentFloor = 1;
let currentSlots = [];
let selectedSlot = null;
let selectedDuration = 2;
let selectedVehicleType = 'car';

export async function initParkingMap() {
  await loadLocations();
  setupFilterListeners();
  setupSocketListeners();
  setupDrawerListeners();
  setupRecommendationModal();
}

async function loadLocations() {
  try {
    const data = await apiRequest('/api/parking');
    const select = document.getElementById('location-selector');
    if (!select) return;

    select.innerHTML = '';
    data.data.forEach((loc, idx) => {
      const opt = document.createElement('option');
      opt.value = loc._id;
      opt.textContent = `${loc.name} (${loc.city}) - ${loc.stats.available} Available`;
      if (idx === 0) opt.selected = true;
      select.appendChild(opt);
    });

    if (data.data.length > 0) {
      currentLocationId = data.data[0]._id;
      updateLocationInfo(data.data[0]);
      await fetchSlots();
    }

    select.addEventListener('change', async (e) => {
      currentLocationId = e.target.value;
      const chosen = data.data.find(l => l._id === currentLocationId);
      if (chosen) updateLocationInfo(chosen);
      await fetchSlots();
    });
  } catch (err) {
    showToast('Failed to load parking locations', 'error');
  }
}

function updateLocationInfo(location) {
  const nameEl = document.getElementById('selected-location-name');
  const addrEl = document.getElementById('selected-location-address');
  const totalEl = document.getElementById('stat-total');
  const availEl = document.getElementById('stat-available');
  const occEl = document.getElementById('stat-occupied');
  const resEl = document.getElementById('stat-reserved');
  const rateEl = document.getElementById('stat-occupancy-rate');
  const congestionBadge = document.getElementById('congestion-badge');

  if (nameEl) nameEl.textContent = location.name;
  if (addrEl) addrEl.textContent = `${location.address}, ${location.city}`;

  if (location.stats) {
    if (totalEl) totalEl.textContent = location.stats.total;
    if (availEl) availEl.textContent = location.stats.available;
    if (occEl) occEl.textContent = location.stats.occupied;
    if (resEl) resEl.textContent = location.stats.reserved;
    if (rateEl) rateEl.textContent = `${location.stats.occupancyRate}%`;

    if (congestionBadge) {
      congestionBadge.className = `badge ${location.stats.congestion === 'HIGH' ? 'badge-occupied' : (location.stats.congestion === 'MODERATE' ? 'badge-reserved' : 'badge-available')}`;
      congestionBadge.innerHTML = `● ${location.stats.congestion} CONGESTION`;
    }
  }
}

export async function fetchSlots() {
  if (!currentLocationId) return;

  const floorSelect = document.getElementById('filter-floor');
  const zoneSelect = document.getElementById('filter-zone');
  const vehicleSelect = document.getElementById('filter-vehicle');
  const typeSelect = document.getElementById('filter-type');
  const availOnly = document.getElementById('filter-available-only')?.checked;

  const floor = floorSelect?.value || currentFloor;
  currentFloor = parseInt(floor);

  const params = new URLSearchParams({
    locationId: currentLocationId,
    floor: currentFloor
  });

  if (zoneSelect && zoneSelect.value) params.append('zone', zoneSelect.value);
  if (vehicleSelect && vehicleSelect.value) params.append('vehicleType', vehicleSelect.value);
  if (typeSelect && typeSelect.value) params.append('type', typeSelect.value);
  if (availOnly) params.append('status', 'available');

  const container = document.getElementById('parking-slots-grid');
  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem;">
        <div class="pulse-dot" style="margin: 0 auto 1rem auto; width: 12px; height: 12px;"></div>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Fetching live slot telemetry...</p>
      </div>
    `;
  }

  try {
    const res = await apiRequest(`/api/slots?${params.toString()}`);
    currentSlots = res.data;
    render2DMap(currentSlots);
  } catch (err) {
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: #ef4444;">
          Failed to load slots. <button class="btn btn-secondary btn-sm" onclick="window.location.reload()">Retry</button>
        </div>
      `;
    }
  }
}

function render2DMap(slots) {
  const container = document.getElementById('parking-slots-grid');
  if (!container) return;

  if (slots.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-secondary);">
        <p style="font-size: 1.1rem; font-weight: 600;">No parking slots match the selected filters.</p>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">Try adjusting floor, zone, or vehicle type filters.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = '';

  slots.forEach((slot) => {
    const slotCard = document.createElement('div');
    slotCard.className = `parking-slot ${slot.status}`;
    slotCard.id = `slot-${slot._id}`;
    slotCard.setAttribute('data-slot-id', slot._id);
    slotCard.setAttribute('data-status', slot.status);

    // Type icon
    let typeIcon = '🚗';
    if (slot.type === 'ev' || slot.vehicleType === 'ev') typeIcon = '⚡';
    else if (slot.vehicleType === 'bike') typeIcon = '🏍️';
    else if (slot.type === 'vip') typeIcon = '⭐';
    else if (slot.type === 'accessible') typeIcon = '♿';

    // Status label & color
    let statusText = 'AVAILABLE';
    let statusColor = '#10b981';
    if (slot.status === 'occupied') {
      statusText = 'OCCUPIED';
      statusColor = '#ef4444';
    } else if (slot.status === 'reserved') {
      statusText = 'RESERVED';
      statusColor = '#f59e0b';
    }

    slotCard.innerHTML = `
      <div class="slot-top-row">
        <span class="slot-number">${slot.slotNumber}</span>
        <span class="slot-type-icon" title="${slot.type.toUpperCase()}">${typeIcon}</span>
      </div>
      <div class="slot-center">
        <span class="slot-status-text" style="color: ${statusColor};">${statusText}</span>
      </div>
      <div class="slot-bottom-row">
        <span class="slot-dist" title="Distance from entrance">📍 ${slot.distanceFromEntrance || 25}m</span>
        <span class="slot-rate">₹${slot.pricePerHour}/h</span>
      </div>
    `;

    slotCard.addEventListener('click', () => handleSlotClick(slot));
    container.appendChild(slotCard);
  });
}

function handleSlotClick(slot) {
  if (slot.status === 'occupied') {
    showToast(`Slot ${slot.slotNumber} is currently OCCUPIED by another vehicle.`, 'warning');
    return;
  }
  if (slot.status === 'reserved') {
    showToast(`Slot ${slot.slotNumber} is currently RESERVED. Please select an available slot.`, 'warning');
    return;
  }

  selectedSlot = slot;
  openReservationDrawer(slot);
}

async function openReservationDrawer(slot) {
  const drawerOverlay = document.getElementById('drawer-overlay');
  const drawerPanel = document.getElementById('reservation-drawer');

  // Populate drawer fields
  document.getElementById('drawer-slot-number').textContent = slot.slotNumber;
  document.getElementById('drawer-slot-type').textContent = `${slot.type.toUpperCase()} (${slot.vehicleType.toUpperCase()})`;
  document.getElementById('drawer-slot-location').textContent = `Floor ${slot.floor} • Zone ${slot.zone}`;
  document.getElementById('drawer-slot-distance').textContent = `${slot.distanceFromEntrance || 30} meters from gate`;
  document.getElementById('drawer-slot-rate').textContent = `₹${slot.pricePerHour} / hour`;

  // Set default vehicle selection
  const vSelect = document.getElementById('drawer-vehicle-type');
  if (vSelect) {
    vSelect.value = slot.vehicleType || 'car';
    selectedVehicleType = vSelect.value;
  }

  const durationSlider = document.getElementById('drawer-duration-slider');
  const durationDisplay = document.getElementById('drawer-duration-val');
  if (durationSlider) {
    durationSlider.value = selectedDuration;
    if (durationDisplay) durationDisplay.textContent = `${selectedDuration} Hours`;
  }

  await updateLiveQuote();

  drawerOverlay?.classList.add('active');
  drawerPanel?.classList.add('active');
}

function closeReservationDrawer() {
  document.getElementById('drawer-overlay')?.classList.remove('active');
  document.getElementById('reservation-drawer')?.classList.remove('active');
  selectedSlot = null;
}

async function updateLiveQuote() {
  if (!selectedSlot) return;

  const duration = selectedDuration;
  const quoteContainer = document.getElementById('drawer-quote-details');
  if (!quoteContainer) return;

  try {
    const res = await apiRequest('/api/bookings/quote', {
      method: 'POST',
      body: JSON.stringify({
        locationId: selectedSlot.locationId?._id || selectedSlot.locationId,
        slotId: selectedSlot._id,
        vehicleType: selectedVehicleType,
        durationHours: duration,
        slotType: selectedSlot.type
      })
    });

    const q = res.data;
    const surgeBadge = q.isSurge
      ? `<span class="badge badge-surge" style="margin-left: 0.5rem;">🔥 HIGH DEMAND (${q.surgeMultiplier}x)</span>`
      : '';

    quoteContainer.innerHTML = `
      <div class="quote-row">
        <span>Base Parking (${duration}h @ ₹${q.hourlyRate}/h)</span>
        <span>₹${q.baseAmount}</span>
      </div>
      ${q.surgeAmount > 0 ? `
      <div class="quote-row" style="color: #ff6b6b;">
        <span>Demand Surge Surcharge ${surgeBadge}</span>
        <span>+₹${q.surgeAmount}</span>
      </div>` : ''}
      ${q.evSurcharge > 0 ? `
      <div class="quote-row" style="color: var(--cyan);">
        <span>⚡ EV Charging Fee</span>
        <span>+₹${q.evSurcharge}</span>
      </div>` : ''}
      <div class="quote-row">
        <span>Platform Convenience Fee</span>
        <span>+₹${q.convenienceFee}</span>
      </div>
      <div class="quote-row">
        <span>GST & Taxes (${q.taxPercent}%)</span>
        <span>+₹${q.tax}</span>
      </div>
      <div class="quote-row total">
        <span>Estimated Total</span>
        <span style="color: var(--primary); font-size: 1.3rem;">₹${q.totalAmount}</span>
      </div>
    `;

    // Enable reserve button
    const reserveBtn = document.getElementById('drawer-confirm-btn');
    if (reserveBtn) {
      reserveBtn.disabled = false;
      reserveBtn.textContent = `Reserve for ₹${q.totalAmount}`;
    }
  } catch (err) {
    quoteContainer.innerHTML = `<p style="color: #ef4444; font-size: 0.85rem;">Failed to fetch live quote</p>`;
  }
}

function setupDrawerListeners() {
  document.getElementById('drawer-close-btn')?.addEventListener('click', closeReservationDrawer);
  document.getElementById('drawer-overlay')?.addEventListener('click', closeReservationDrawer);

  const durationSlider = document.getElementById('drawer-duration-slider');
  durationSlider?.addEventListener('input', async (e) => {
    selectedDuration = parseFloat(e.target.value);
    const display = document.getElementById('drawer-duration-val');
    if (display) display.textContent = `${selectedDuration} Hours`;
    await updateLiveQuote();
  });

  const vSelect = document.getElementById('drawer-vehicle-type');
  vSelect?.addEventListener('change', async (e) => {
    selectedVehicleType = e.target.value;
    await updateLiveQuote();
  });

  // Confirm Reservation Button
  document.getElementById('drawer-confirm-btn')?.addEventListener('click', () => {
    if (!selectedSlot) return;
    // Redirect to booking wizard with query params
    window.location.href = `/booking.html?slotId=${selectedSlot._id}&locationId=${selectedSlot.locationId?._id || selectedSlot.locationId}&duration=${selectedDuration}&vehicleType=${selectedVehicleType}`;
  });
}

function setupFilterListeners() {
  const filters = ['filter-floor', 'filter-zone', 'filter-vehicle', 'filter-type', 'filter-available-only'];
  filters.forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => fetchSlots());
  });

  // Floor switcher tabs
  const floorButtons = document.querySelectorAll('.floor-tab-btn');
  floorButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
      floorButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFloor = parseInt(btn.getAttribute('data-floor'));
      const floorSelect = document.getElementById('filter-floor');
      if (floorSelect) floorSelect.value = currentFloor;
      fetchSlots();
    });
  });
}

function setupRecommendationModal() {
  const recBtn = document.getElementById('btn-smart-recommend');
  if (!recBtn) return;

  recBtn.addEventListener('click', async () => {
    recBtn.disabled = true;
    recBtn.innerHTML = `⚡ Analyzing best slot...`;

    try {
      const vType = document.getElementById('filter-vehicle')?.value || 'car';
      const requiresEV = vType === 'ev';

      const res = await apiRequest(`/api/slots/recommend?locationId=${currentLocationId}&floor=${currentFloor}&vehicleType=${vType}&requiresEV=${requiresEV}`);
      const rec = res.data;

      // Populate recommendation modal
      document.getElementById('rec-match-score').textContent = `${rec.matchScore}%`;
      document.getElementById('rec-slot-number').textContent = rec.bestSlot.slotNumber;
      document.getElementById('rec-floor-zone').textContent = `Floor ${rec.bestSlot.floor} • Zone ${rec.bestSlot.zone}`;
      document.getElementById('rec-distance').textContent = `${rec.distanceFromEntrance}m from entrance`;
      document.getElementById('rec-rate').textContent = `₹${rec.pricePerHour}/hr`;
      document.getElementById('rec-reason').textContent = rec.whyRecommended;

      // Setup booking action for this recommended slot
      const reserveRecBtn = document.getElementById('rec-reserve-btn');
      if (reserveRecBtn) {
        reserveRecBtn.onclick = () => {
          closeModal('recommendation-modal');
          selectedSlot = rec.bestSlot;
          openReservationDrawer(rec.bestSlot);
        };
      }

      openModal('recommendation-modal');
    } catch (err) {
      showToast(err.message || 'No suitable recommendation found', 'warning');
    } finally {
      recBtn.disabled = false;
      recBtn.innerHTML = `⚡ Find My Best Slot`;
    }
  });

  document.getElementById('close-rec-modal')?.addEventListener('click', () => closeModal('recommendation-modal'));
}

function setupSocketListeners() {
  // Real-time slot update event from backend broadcast
  onSocketEvent('slot:updated', (slotData) => {
    console.log('[Socket] slot:updated received:', slotData);
    const slotCard = document.getElementById(`slot-${slotData._id}`);
    if (slotCard) {
      slotCard.className = `parking-slot ${slotData.status}`;
      slotCard.setAttribute('data-status', slotData.status);

      const statusEl = slotCard.querySelector('.slot-status-text');
      if (statusEl) {
        statusEl.textContent = slotData.status.toUpperCase();
        statusEl.style.color = slotData.status === 'available' ? '#10b981' : (slotData.status === 'occupied' ? '#ef4444' : '#f59e0b');
      }
    }
  });

  // Real-time stats update event from backend
  onSocketEvent('stats:updated', (stats) => {
    if (!currentLocationId || String(stats.locationId) === String(currentLocationId)) {
      const totalEl = document.getElementById('stat-total');
      const availEl = document.getElementById('stat-available');
      const occEl = document.getElementById('stat-occupied');
      const resEl = document.getElementById('stat-reserved');
      const rateEl = document.getElementById('stat-occupancy-rate');
      const congestionBadge = document.getElementById('congestion-badge');

      if (totalEl) totalEl.textContent = stats.total;
      if (availEl) availEl.textContent = stats.available;
      if (occEl) occEl.textContent = stats.occupied;
      if (resEl) resEl.textContent = stats.reserved;
      if (rateEl) rateEl.textContent = `${stats.occupancyRate}%`;

      if (congestionBadge) {
        congestionBadge.className = `badge ${stats.congestionLevel === 'HIGH' ? 'badge-occupied' : (stats.congestionLevel === 'MODERATE' ? 'badge-reserved' : 'badge-available')}`;
        congestionBadge.innerHTML = `● ${stats.congestionLevel} CONGESTION`;
      }
    }
  });

  // Slot expired event
  onSocketEvent('slot:expired', (data) => {
    showToast(`Slot ${data.slotNumber} auto-released and is now AVAILABLE!`, 'info');
  });
}
