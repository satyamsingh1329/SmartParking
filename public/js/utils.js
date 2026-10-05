/**
 * ParkPulse Utility & UI Helper Modules
 */

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

// API Client Helper
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('parkpulse_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || `Request failed with status ${res.status}`);
    }
    return data;
  } catch (error) {
    console.error(`[API Error] ${endpoint}:`, error.message);
    throw error;
  }
}

// Theme Management
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
