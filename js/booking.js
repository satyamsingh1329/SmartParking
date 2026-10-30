/**
 * ParkPulse Booking Wizard & Mock Payment Handler
 */
import { apiRequest, showToast, formatCurrency, triggerSuccessConfetti, openModal, closeModal } from './utils.js';
import { getStoredUser, isAuthenticated } from './auth.js';

let bookingState = {
  locationId: null,
  slotId: null,
  slotData: null,
  vehicleId: null,
  vehicleNumber: '',
  vehicleType: 'car',
  durationHours: 2,
  startTime: new Date(),
  pointsToRedeem: 0,
  quote: null
};

export async function initBookingWizard() {
  if (!isAuthenticated()) {
    showToast('Please sign in to proceed with booking', 'info');
    setTimeout(() => {
      window.location.href = `./login.html?redirect=${encodeURIComponent(window.location.href)}`;
    }, 800);
    return;
  }

  // Parse URL search parameters if arriving from parking map
  const urlParams = new URLSearchParams(window.location.search);
  const paramSlotId = urlParams.get('slotId');
  const paramLocationId = urlParams.get('locationId');
  const paramDuration = urlParams.get('duration');
  const paramVehicleType = urlParams.get('vehicleType');

  if (paramDuration) bookingState.durationHours = parseFloat(paramDuration);
  if (paramVehicleType) bookingState.vehicleType = paramVehicleType;

  await loadBookingData(paramLocationId, paramSlotId);
  setupFormListeners();
  setupPaymentModal();
}

async function loadBookingData(presetLocationId, presetSlotId) {
  try {
    // 1. Load Locations
    const locRes = await apiRequest('/api/parking');
    const locSelect = document.getElementById('book-location-select');
    if (locSelect) {
      locSelect.innerHTML = '';
      locRes.data.forEach((loc) => {
        const opt = document.createElement('option');
        opt.value = loc._id;
        opt.textContent = `${loc.name} (${loc.city})`;
        if (presetLocationId && loc._id === presetLocationId) opt.selected = true;
        locSelect.appendChild(opt);
      });
      bookingState.locationId = locSelect.value;
    }

    // 2. Load User's Vehicles
    const userRes = await apiRequest('/api/auth/me');
    const vehicles = userRes.vehicles || [];
    const vehicleSelect = document.getElementById('book-vehicle-select');
    if (vehicleSelect && vehicles.length > 0) {
      vehicleSelect.innerHTML = '<option value="">-- Choose saved vehicle or enter below --</option>';
      vehicles.forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v._id;
        opt.textContent = `${v.vehicleNumber} (${v.model || v.vehicleType.toUpperCase()})`;
        opt.setAttribute('data-number', v.vehicleNumber);
        opt.setAttribute('data-type', v.vehicleType);
        if (v.isPrimary) opt.selected = true;
        vehicleSelect.appendChild(opt);
      });

      const primary = vehicles.find(v => v.isPrimary) || vehicles[0];
      if (primary) {
        bookingState.vehicleId = primary._id;
        bookingState.vehicleNumber = primary.vehicleNumber;
        bookingState.vehicleType = primary.vehicleType;
        const vNumInput = document.getElementById('book-vehicle-number');
        if (vNumInput) vNumInput.value = primary.vehicleNumber;
        const vTypeSelect = document.getElementById('book-vehicle-type');
        if (vTypeSelect) vTypeSelect.value = primary.vehicleType;
      }
    }

    // Update user reward points in UI
    const rewardEl = document.getElementById('user-reward-points');
    if (rewardEl) {
      rewardEl.textContent = userRes.user.rewardPoints || 0;
    }

    // 3. Load Slots for selected location
    await loadSlotsForLocation(presetSlotId);
  } catch (err) {
    showToast('Failed to initialize booking data', 'error');
  }
}

async function loadSlotsForLocation(presetSlotId) {
  const slotSelect = document.getElementById('book-slot-select');
  if (!slotSelect) return;

  slotSelect.innerHTML = '<option value="">Loading available bays...</option>';

  try {
    const res = await apiRequest(`/api/slots?locationId=${bookingState.locationId}&status=available`);
    slotSelect.innerHTML = '';

    if (res.data.length === 0) {
      slotSelect.innerHTML = '<option value="">No available bays at this facility</option>';
      return;
    }

    res.data.forEach((slot) => {
      const opt = document.createElement('option');
      opt.value = slot._id;
      opt.textContent = `${slot.slotNumber} (Floor ${slot.floor} • Zone ${slot.zone} • ${slot.type.toUpperCase()}) - ₹${slot.pricePerHour}/h`;
      if (presetSlotId && slot._id === presetSlotId) {
        opt.selected = true;
        bookingState.slotData = slot;
      }
      slotSelect.appendChild(opt);
    });

    bookingState.slotId = slotSelect.value;
    if (!bookingState.slotData) {
      bookingState.slotData = res.data[0];
    }

    await calculateBookingQuote();
  } catch (err) {
    slotSelect.innerHTML = '<option value="">Error loading slots</option>';
  }
}

async function calculateBookingQuote() {
  if (!bookingState.slotId || !bookingState.locationId) return;

  const quoteContainer = document.getElementById('booking-quote-breakdown');
  if (!quoteContainer) return;

  try {
    const res = await apiRequest('/api/bookings/quote', {
      method: 'POST',
      body: JSON.stringify({
        locationId: bookingState.locationId,
        slotId: bookingState.slotId,
        vehicleType: bookingState.vehicleType,
        durationHours: bookingState.durationHours,
        slotType: bookingState.slotData?.type || 'standard'
      })
    });

    const q = res.data;
    bookingState.quote = q;

    // Calculate discount
    let discount = 0;
    if (bookingState.pointsToRedeem > 0) {
      discount = Math.min(Math.floor((bookingState.pointsToRedeem / 100) * 20), q.totalAmount);
    }
    const finalPayable = Math.max(0, q.totalAmount - discount);

    quoteContainer.innerHTML = `
      <div class="quote-row">
        <span>Base Rate (${bookingState.durationHours} hrs @ ₹${q.hourlyRate}/h)</span>
        <span>₹${q.baseAmount}</span>
      </div>
      ${q.surgeAmount > 0 ? `
      <div class="quote-row" style="color: #ff6b6b;">
        <span>🔥 High Occupancy Surge (${q.surgeMultiplier}x)</span>
        <span>+₹${q.surgeAmount}</span>
      </div>` : ''}
      ${q.evSurcharge > 0 ? `
      <div class="quote-row" style="color: var(--cyan);">
        <span>⚡ EV High-Speed Charging</span>
        <span>+₹${q.evSurcharge}</span>
      </div>` : ''}
      <div class="quote-row">
        <span>Platform Convenience Fee</span>
        <span>+₹${q.convenienceFee}</span>
      </div>
      <div class="quote-row">
        <span>Taxes & GST (${q.taxPercent}%)</span>
        <span>+₹${q.tax}</span>
      </div>
      ${discount > 0 ? `
      <div class="quote-row" style="color: #10b981; font-weight: 600;">
        <span>★ Reward Points Discount (${bookingState.pointsToRedeem} pts)</span>
        <span>-₹${discount}</span>
      </div>` : ''}
      <div class="quote-row total">
        <span>Final Payable</span>
        <span style="color: var(--primary); font-size: 1.4rem;">₹${finalPayable}</span>
      </div>
    `;

    const payBtn = document.getElementById('btn-open-payment');
    if (payBtn) {
      payBtn.disabled = false;
      payBtn.textContent = `Pay ₹${finalPayable} & Confirm Booking`;
    }
  } catch (err) {
    quoteContainer.innerHTML = `<p style="color: #ef4444;">Unable to generate live quote.</p>`;
  }
}

function setupFormListeners() {
  document.getElementById('book-location-select')?.addEventListener('change', async (e) => {
    bookingState.locationId = e.target.value;
    await loadSlotsForLocation();
  });

  document.getElementById('book-slot-select')?.addEventListener('change', async (e) => {
    bookingState.slotId = e.target.value;
    await calculateBookingQuote();
  });

  document.getElementById('book-vehicle-select')?.addEventListener('change', (e) => {
    const selectedOpt = e.target.selectedOptions[0];
    if (selectedOpt && selectedOpt.value) {
      bookingState.vehicleId = selectedOpt.value;
      const num = selectedOpt.getAttribute('data-number');
      const typ = selectedOpt.getAttribute('data-type');
      if (num) {
        document.getElementById('book-vehicle-number').value = num;
        bookingState.vehicleNumber = num;
      }
      if (typ) {
        document.getElementById('book-vehicle-type').value = typ;
        bookingState.vehicleType = typ;
      }
      calculateBookingQuote();
    }
  });

  document.getElementById('book-vehicle-number')?.addEventListener('input', (e) => {
    bookingState.vehicleNumber = e.target.value.toUpperCase();
  });

  document.getElementById('book-vehicle-type')?.addEventListener('change', (e) => {
    bookingState.vehicleType = e.target.value;
    calculateBookingQuote();
  });

  const durationInput = document.getElementById('book-duration');
  durationInput?.addEventListener('input', (e) => {
    bookingState.durationHours = parseFloat(e.target.value) || 1;
    document.getElementById('duration-val-label').textContent = `${bookingState.durationHours} Hours`;
    calculateBookingQuote();
  });

  // Reward points slider / toggle
  const redeemCheckbox = document.getElementById('redeem-points-checkbox');
  redeemCheckbox?.addEventListener('change', (e) => {
    if (e.target.checked) {
      const user = getStoredUser();
      // Redeem up to available in multiples of 100
      const available = user?.rewardPoints || 0;
      bookingState.pointsToRedeem = Math.floor(available / 100) * 100;
      if (bookingState.pointsToRedeem === 0) {
        showToast('You need at least 100 reward points to redeem discount', 'info');
        e.target.checked = false;
      }
    } else {
      bookingState.pointsToRedeem = 0;
    }
    calculateBookingQuote();
  });
}

function setupPaymentModal() {
  const openPayBtn = document.getElementById('btn-open-payment');
  openPayBtn?.addEventListener('click', () => {
    if (!bookingState.slotId) {
      showToast('Please select a parking bay', 'warning');
      return;
    }
    if (!bookingState.vehicleNumber) {
      showToast('Please provide your vehicle number', 'warning');
      return;
    }

    openModal('mock-payment-modal');
  });

  document.getElementById('close-payment-modal')?.addEventListener('click', () => {
    closeModal('mock-payment-modal');
  });

  // Submit Mock Payment
  document.getElementById('btn-confirm-payment')?.addEventListener('click', async () => {
    const payBtn = document.getElementById('btn-confirm-payment');
    payBtn.disabled = true;
    payBtn.innerHTML = `Processing Secure Mock Payment...`;

    try {
      const selectedMethod = document.querySelector('input[name="mock-pay-method"]:checked')?.value || 'mock_card';

      const res = await apiRequest('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({
          slotId: bookingState.slotId,
          locationId: bookingState.locationId,
          vehicleId: bookingState.vehicleId,
          vehicleNumber: bookingState.vehicleNumber,
          vehicleType: bookingState.vehicleType,
          durationHours: bookingState.durationHours,
          startTime: new Date(),
          paymentMethod: selectedMethod,
          pointsToRedeem: bookingState.pointsToRedeem
        })
      });

      triggerSuccessConfetti();
      showToast('Booking Confirmed! Generating Digital QR Pass...', 'success');

      closeModal('mock-payment-modal');

      setTimeout(() => {
        window.location.href = `./parking-pass.html?id=${res.data.bookingId}`;
      }, 1200);
    } catch (err) {
      showToast(err.message, 'error');
      payBtn.disabled = false;
      payBtn.innerHTML = `Complete Payment`;
    }
  });
}
