/**
 * ParkPulse Utility & UI Helper Modules
 * GitHub Pages static preview support with live backend API bridging
 */
import {
  DEMO_LOCATIONS,
  generateDemoSlots,
  DEMO_ANALYTICS_OVERVIEW,
  DEMO_DISTRIBUTION_DATA,
  DEMO_SQL_EXPERIMENTS
} from './demoData.js';

// Toast Notifications
export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = {
    success: '✓',
    error: '✕',
    warning: '⚠️',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <span style="font-weight: 700; font-size: 1.1rem;">${iconMap[type] || '•'}</span>
    <div style="flex: 1; font-size: 0.88rem; line-height: 1.4;">${message}</div>
  `;

  container.appendChild(toast);
  // Animate in
  setTimeout(() => toast.classList.add('show'), 10);

  // Auto remove
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Modal Management
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Formatters
export function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount || 0);
}

export function formatDateTime(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function formatTimeOnly(dateStr) {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// API Base URL Resolver
export function getApiBaseUrl() {
  const saved = localStorage.getItem('parkpulse_api_url');
  if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');

  if (window.PARKPULSE_API_URL) return window.PARKPULSE_API_URL.replace(/\/+$/, '');

  const hostname = window.location.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
    return ''; // Relative to current local Express server
  }

  // GitHub Pages or static host without configured backend
  if (hostname.endsWith('github.io')) {
    return null; // Signals static GitHub Pages preview mode
  }

  return '';
}

export function setApiBaseUrl(url) {
  if (!url || !url.trim()) {
    localStorage.removeItem('parkpulse_api_url');
  } else {
    localStorage.setItem('parkpulse_api_url', url.trim().replace(/\/+$/, ''));
  }
}

// API Client Helper with Static GitHub Pages Fallback
export async function apiRequest(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('parkpulse_token');
  const method = (options.method || 'GET').toUpperCase();

  // If a live backend URL is configured or running locally with Express
  if (baseUrl !== null) {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const fullUrl = `${baseUrl}${cleanEndpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    };

    try {
      const res = await fetch(fullUrl, {
        ...options,
        headers
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }
      return data;
    } catch (error) {
      console.warn(`[Live API Failed] Falling back to static data for ${endpoint}:`, error.message);
      // If live backend is unreachable, gracefully fall through to static preview for GET queries
      if (method !== 'GET') throw error;
    }
  }

  // Static GitHub Pages Mode (Read queries serve verified demo datasets)
  if (method === 'GET') {
    if (endpoint.startsWith('/api/parking')) {
      return { success: true, count: DEMO_LOCATIONS.length, data: DEMO_LOCATIONS };
    }

    if (endpoint.startsWith('/api/slots')) {
      const url = new URL(endpoint, 'http://dummy.local');
      const locationId = url.searchParams.get('locationId') || 'loc_campus';
      const floor = url.searchParams.get('floor') || 1;
      const slots = generateDemoSlots(locationId, floor);
      return { success: true, count: slots.length, data: slots };
    }

    if (endpoint.includes('/api/admin/analytics/overview')) {
      return { success: true, data: DEMO_ANALYTICS_OVERVIEW };
    }

    if (endpoint.includes('/api/admin/analytics/distribution')) {
      return { success: true, data: DEMO_DISTRIBUTION_DATA };
    }

    if (endpoint.includes('/api/admin/analytics/sql/experiments')) {
      return { success: true, data: DEMO_SQL_EXPERIMENTS };
    }

    if (endpoint.includes('/api/bookings/my')) {
      return {
        success: true,
        count: 1,
        data: [{
          _id: "demo_bk_01",
          bookingId: "BK-7042",
          slotId: { slotNumber: "A-102", zone: "A", floor: 1 },
          locationId: { name: "Central Campus Hub", address: "North Campus Ave" },
          vehicleType: "car",
          vehiclePlate: "DL 01 AB 1234",
          totalAmount: 90,
          status: "CONFIRMED",
          createdAt: new Date().toISOString()
        }]
      };
    }

    if (endpoint.includes('/api/passes/my')) {
      return { success: true, count: 0, data: [] };
    }
  }

  // For write operations on GitHub Pages without backend
  showToast(
    'ℹ️ Running in GitHub Pages static preview mode. To create real bookings with MongoDB atomic locks, connect your ParkPulse backend in Settings (⚙️).',
    'warning',
    6000
  );
  throw new Error('Database write operations require a connected ParkPulse API backend.');
}

// Theme & Navigation Setup
export function initTheme() {
  const savedTheme = localStorage.getItem('parkpulse_theme') || 'dark';
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
  }

  const themeBtns = document.querySelectorAll('.theme-toggle-btn');
  themeBtns.forEach((btn) => {
    btn.innerHTML = savedTheme === 'light' ? '🌙' : '☀️';
    btn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('parkpulse_theme', isLight ? 'light' : 'dark');
      btn.innerHTML = isLight ? '🌙' : '☀️';
    });
  });

  // Inject Backend API Settings Button if running on GitHub Pages
  setupBackendConfigUI();
}

function setupBackendConfigUI() {
  const isGitHubPages = window.location.hostname.endsWith('github.io');
  const navActions = document.querySelector('.nav-actions');
  if (!navActions || document.getElementById('btn-api-config')) return;

  const configBtn = document.createElement('button');
  configBtn.id = 'btn-api-config';
  configBtn.className = 'btn btn-secondary btn-sm';
  configBtn.style.padding = '0.35rem 0.65rem';
  configBtn.style.fontSize = '0.8rem';
  configBtn.style.display = 'inline-flex';
  configBtn.style.alignItems = 'center';
  configBtn.style.gap = '0.3rem';

  const currentUrl = localStorage.getItem('parkpulse_api_url');
  if (currentUrl) {
    configBtn.innerHTML = '🟢 API Connected';
    configBtn.style.borderColor = 'var(--primary)';
  } else if (isGitHubPages) {
    configBtn.innerHTML = '⚙️ Backend API';
  } else {
    configBtn.innerHTML = '⚙️ API';
  }

  configBtn.addEventListener('click', openBackendConfigModal);
  navActions.insertBefore(configBtn, navActions.firstChild);
}

function openBackendConfigModal() {
  let modal = document.getElementById('modal-backend-config');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-backend-config';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 500px;">
        <div class="modal-header">
          <h3 style="margin: 0; font-size: 1.2rem; font-weight: 700;">⚙️ ParkPulse Backend API Connection</h3>
          <button class="modal-close-btn" id="close-api-config-modal">&times;</button>
        </div>
        <div class="modal-body" style="padding: 1.25rem 0;">
          <p style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.5;">
            GitHub Pages hosts the static frontend. You can connect your live Express/MongoDB backend (e.g. deployed on Render, Railway, or running locally) to enable live atomic reservations and telemetry.
          </p>

          <label style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 0.4rem;">Backend Server URL</label>
          <input type="url" id="input-api-url" class="form-input" placeholder="e.g. https://parkpulse-analytics.onrender.com or http://localhost:5000" style="width: 100%; margin-bottom: 1rem;" value="${localStorage.getItem('parkpulse_api_url') || ''}">

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" id="btn-set-local-api">Use Localhost (http://localhost:5000)</button>
            <button class="btn btn-secondary btn-sm" id="btn-clear-api">Reset to Static Preview</button>
          </div>
          <div id="api-test-status" style="margin-top: 1rem; font-size: 0.85rem;"></div>
        </div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button class="btn btn-secondary" id="btn-cancel-api-modal">Cancel</button>
          <button class="btn btn-primary" id="btn-save-api-url">Save & Test Connection</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('close-api-config-modal').onclick = () => closeModal('modal-backend-config');
    document.getElementById('btn-cancel-api-modal').onclick = () => closeModal('modal-backend-config');

    document.getElementById('btn-set-local-api').onclick = () => {
      document.getElementById('input-api-url').value = 'http://localhost:5000';
    };

    document.getElementById('btn-clear-api').onclick = () => {
      localStorage.removeItem('parkpulse_api_url');
      document.getElementById('input-api-url').value = '';
      showToast('Switched to static demo preview mode', 'info');
      closeModal('modal-backend-config');
      setTimeout(() => window.location.reload(), 400);
    };

    document.getElementById('btn-save-api-url').onclick = async () => {
      const url = document.getElementById('input-api-url').value.trim();
      const statusEl = document.getElementById('api-test-status');
      if (!url) {
        localStorage.removeItem('parkpulse_api_url');
        showToast('Reset to default static mode', 'info');
        closeModal('modal-backend-config');
        window.location.reload();
        return;
      }

      statusEl.innerHTML = '<span style="color: var(--cyan);">⏳ Testing connection to backend...</span>';
      try {
        const testRes = await fetch(`${url.replace(/\/+$/, '')}/health`);
        const testData = await testRes.json();
        if (testData.status === 'alive' || testRes.ok) {
          localStorage.setItem('parkpulse_api_url', url.replace(/\/+$/, ''));
          statusEl.innerHTML = '<span style="color: var(--primary);">✓ Backend connected successfully! Reloading...</span>';
          showToast('Backend API connected!', 'success');
          setTimeout(() => window.location.reload(), 800);
        } else {
          statusEl.innerHTML = `<span style="color: var(--crimson);">✕ Server replied with status ${testRes.status}</span>`;
        }
      } catch (err) {
        statusEl.innerHTML = `<span style="color: var(--crimson);">✕ Connection failed: ${err.message}. Check CORS settings or server status.</span>`;
      }
    };
  }

  openModal('modal-backend-config');
}

// Trigger Confetti Celebration (canvas-confetti CDN)
export function triggerSuccessConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}
