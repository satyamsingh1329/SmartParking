/**
 * ParkPulse Gatekeeper Terminal Engine (Entry/Exit, QR Verification, Active Sessions)
 */
import { apiRequest, showToast, formatDateTime, formatCurrency, openModal, closeModal } from './utils.js';
import { getStoredUser, isAuthenticated } from './auth.js';
import { onSocketEvent } from './socket.js';

export async function initGatekeeper() {
  const user = getStoredUser();
  if (!isAuthenticated() || (user.role !== 'GATEKEEPER' && user.role !== 'ADMIN')) {
    showToast('Gatekeeper or Admin authorization required', 'error');
    setTimeout(() => {
      window.location.href = '/login.html?redirect=/gatekeeper.html';
    }, 1000);
    return;
  }

  await loadActiveVehicles();
  setupGatekeeperListeners();
  setupSocketListeners();
}

async function loadActiveVehicles() {
  const tbody = document.getElementById('gatekeeper-active-tbody');
  const countBadge = document.getElementById('active-vehicles-count');
  if (!tbody) return;

  try {
    const res = await apiRequest('/api/sessions/active');
    if (countBadge) countBadge.textContent = res.count;

    tbody.innerHTML = '';
    if (res.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">
            No vehicles currently parked inside the facility.
          </td>
        </tr>
      `;
      return;
    }

    res.data.forEach((sess) => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border-color)';

      const overstayBadge = sess.isOverstay
        ? `<span class="badge badge-occupied" style="margin-left: 0.5rem;">⚠️ OVERSTAY (${Math.ceil(sess.elapsedMinutes - 120)}m)</span>`
        : `<span class="badge badge-available">OK</span>`;

      tr.innerHTML = `
        <td style="padding: 1rem 0.75rem; font-weight: 700; font-family: 'JetBrains Mono', monospace;">
          ${sess.bookingId?.bookingId || sess.vehicleNumber}
        </td>
        <td style="padding: 1rem 0.75rem; font-weight: 700;">
          <span style="font-family: 'JetBrains Mono', monospace; font-size: 1rem;">${sess.vehicleNumber}</span>
        </td>
        <td style="padding: 1rem 0.75rem; font-weight: 600;">Bay ${sess.slotId?.slotNumber || 'Assigned'}</td>
        <td style="padding: 1rem 0.75rem; font-size: 0.85rem; color: var(--text-secondary);">${formatDateTime(sess.entryTime)}</td>
        <td style="padding: 1rem 0.75rem; font-weight: 600;">${sess.elapsedMinutes} mins</td>
        <td style="padding: 1rem 0.75rem;">${overstayBadge}</td>
        <td style="padding: 1rem 0.75rem;">
          <button class="btn btn-danger btn-sm checkout-action-btn" data-id="${sess._id}">Check-Out</button>
        </td>
      `;

      tr.querySelector('.checkout-action-btn')?.addEventListener('click', () => {
        processCheckOut(sess._id);
      });

      tbody.appendChild(tr);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: #ef4444; padding: 1rem;">Failed to load active vehicles</td></tr>`;
  }
}

async function verifyAndDisplayBooking(bookingId) {
  const resultContainer = document.getElementById('verification-result-box');
  if (!resultContainer) return;

  resultContainer.style.display = 'block';
  resultContainer.innerHTML = `<div style="text-align: center; padding: 1rem;">Verifying Booking Record...</div>`;

  try {
    const res = await apiRequest(`/api/sessions/verify/${bookingId.trim()}`);
    const b = res.data;

    let actionBtnHtml = '';
    if (b.status === 'CONFIRMED') {
      actionBtnHtml = `<button class="btn btn-primary" id="btn-gate-checkin">🚀 Grant Entry & Start Parking</button>`;
    } else if (b.status === 'ACTIVE') {
      actionBtnHtml = `<button class="btn btn-danger" id="btn-gate-checkout">🏁 Process Exit & Print Receipt</button>`;
    } else {
      actionBtnHtml = `<span class="badge badge-secondary" style="font-size: 0.9rem; padding: 0.5rem 1rem;">Booking is ${b.status}</span>`;
    }

    resultContainer.innerHTML = `
      <div class="glass-card" style="border: 1px solid var(--border-glow); padding: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <div>
            <span class="badge ${b.status === 'ACTIVE' ? 'badge-occupied' : (b.status === 'CONFIRMED' ? 'badge-available' : 'badge-secondary')}">${b.status}</span>
            <h3 style="font-size: 1.2rem; font-weight: 700; margin-top: 0.4rem;">Pass: ${b.bookingId}</h3>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 1.25rem; font-weight: 800; font-family: 'JetBrains Mono', monospace;">${b.vehicleNumber}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${b.vehicleType.toUpperCase()}</div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem; font-size: 0.9rem;">
          <div><strong style="color: var(--text-muted);">Assigned Bay:</strong> ${b.slotId?.slotNumber || 'A-01'} (Floor ${b.slotId?.floor || 1}, Zone ${b.slotId?.zone || 'A'})</div>
          <div><strong style="color: var(--text-muted);">Customer:</strong> ${b.userId?.name} (${b.userId?.phone})</div>
          <div><strong style="color: var(--text-muted);">Reserved Window:</strong> ${b.durationHours} Hours</div>
          <div><strong style="color: var(--text-muted);">Expected Exit:</strong> ${formatDateTime(b.expectedEndTime)}</div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          ${actionBtnHtml}
        </div>
      </div>
    `;

    document.getElementById('btn-gate-checkin')?.addEventListener('click', async () => {
      try {
        await apiRequest('/api/sessions/check-in', {
          method: 'POST',
          body: JSON.stringify({ bookingId: b.bookingId })
        });
        showToast(`Vehicle ${b.vehicleNumber} checked in at ${b.slotId?.slotNumber}! Barrier opened.`, 'success');
        verifyAndDisplayBooking(b.bookingId);
        await loadActiveVehicles();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    document.getElementById('btn-gate-checkout')?.addEventListener('click', () => {
      processCheckOut(b.bookingId);
    });
  } catch (err) {
    resultContainer.innerHTML = `
      <div style="padding: 1rem; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: var(--radius-md); color: #ff6b6b;">
        ✕ ${err.message || 'Invalid Booking ID'}
      </div>
    `;
  }
}

async function processCheckOut(idOrBookingId) {
  try {
    const res = await apiRequest(`/api/sessions/${idOrBookingId}/check-out`, {
      method: 'PATCH'
    });

    const receipt = res.data.receipt;
    showToast(`Check-out successful! Total billed: ₹${receipt.totalAmount}. Barrier opened.`, 'success');

    // Populate receipt modal
    document.getElementById('receipt-booking-id').textContent = receipt.bookingId;
    document.getElementById('receipt-slot-number').textContent = receipt.slotNumber;
    document.getElementById('receipt-vehicle-number').textContent = receipt.vehicleNumber;
    document.getElementById('receipt-duration').textContent = `${receipt.actualDurationMinutes} mins`;
    document.getElementById('receipt-base-amount').textContent = `₹${receipt.baseAmount || 0}`;
    document.getElementById('receipt-overstay-fee').textContent = `₹${receipt.overstayFee || 0}`;
    document.getElementById('receipt-total-amount').textContent = `₹${receipt.totalAmount}`;

    openModal('receipt-modal');
    await loadActiveVehicles();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function setupGatekeeperListeners() {
  const searchForm = document.getElementById('gatekeeper-search-form');
  searchForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('input-booking-lookup').value.trim();
    if (id) verifyAndDisplayBooking(id);
  });

  // Mock QR Scanner button
  document.getElementById('btn-mock-scan-qr')?.addEventListener('click', () => {
    openModal('qr-scanner-modal');
    // Simulate optical scan after 1.5s
    setTimeout(async () => {
      closeModal('qr-scanner-modal');
      // Autofill active booking if exists, or sample
      try {
        const res = await apiRequest('/api/sessions/active');
        const candidate = res.data[0];
        const scannedId = candidate?.bookingId?.bookingId || 'PP-2026-DEMO01';
        document.getElementById('input-booking-lookup').value = scannedId;
        verifyAndDisplayBooking(scannedId);
        showToast(`QR Code Scanned: ${scannedId}`, 'info');
      } catch (e) {
        document.getElementById('input-booking-lookup').value = 'PP-2026-DEMO01';
        verifyAndDisplayBooking('PP-2026-DEMO01');
      }
    }, 1500);
  });

  document.getElementById('close-scanner-modal')?.addEventListener('click', () => {
    closeModal('qr-scanner-modal');
  });

  document.getElementById('close-receipt-modal')?.addEventListener('click', () => {
    closeModal('receipt-modal');
  });

  document.getElementById('btn-print-receipt')?.addEventListener('click', () => {
    window.print();
  });
}

function setupSocketListeners() {
  onSocketEvent('parking:started', () => loadActiveVehicles());
  onSocketEvent('parking:completed', () => loadActiveVehicles());
}
