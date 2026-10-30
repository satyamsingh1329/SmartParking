/**
 * ParkPulse Authentication & Session Module
 */
import { apiRequest, showToast } from './utils.js';

export function getStoredUser() {
  const userStr = localStorage.getItem('parkpulse_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

export function getStoredToken() {
  return localStorage.getItem('parkpulse_token');
}

export function isAuthenticated() {
  return Boolean(getStoredToken() && getStoredUser());
}

export async function loginUser(email, password) {
  const isStaticPages = window.location.hostname.endsWith('github.io') && !localStorage.getItem('parkpulse_api_url');
  if (isStaticPages) {
    let role = 'USER';
    let name = 'Demo User';
    if (email.includes('admin')) {
      role = 'ADMIN';
      name = 'System Administrator';
    } else if (email.includes('gate')) {
      role = 'GATEKEEPER';
      name = 'Duty Gate Officer';
    }
    const demoUser = {
      _id: 'demo_user_01',
      name,
      email,
      role,
      rewardPoints: role === 'ADMIN' ? 500 : 120,
      phone: '+91 98765 43210'
    };
    const demoToken = 'demo_jwt_token_for_github_pages_preview';
    localStorage.setItem('parkpulse_token', demoToken);
    localStorage.setItem('parkpulse_user', JSON.stringify(demoUser));
    showToast(`Signed in as Demo ${role} (Static Preview) 👋`, 'success');
    return demoUser;
  }

  try {
    const data = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    localStorage.setItem('parkpulse_token', data.token);
    localStorage.setItem('parkpulse_user', JSON.stringify(data.user));

    showToast(`Welcome back, ${data.user.name}! 👋`, 'success');
    return data.user;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

export async function registerUser(formData) {
  try {
    const data = await apiRequest('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData)
    });

    localStorage.setItem('parkpulse_token', data.token);
    localStorage.setItem('parkpulse_user', JSON.stringify(data.user));

    showToast('Registration successful! +50 Bonus Points added 🎉', 'success');
    return data.user;
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

export function logoutUser() {
  localStorage.removeItem('parkpulse_token');
  localStorage.removeItem('parkpulse_user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = './index.html';
  }, 500);
}

export function renderNavAuth() {
  const authContainer = document.getElementById('nav-auth-container');
  if (!authContainer) return;

  const user = getStoredUser();

  if (user) {
    const roleBadge = user.role !== 'USER' ? `<span class="badge ${user.role === 'ADMIN' ? 'badge-occupied' : 'badge-reserved'}" style="font-size: 0.65rem; padding: 2px 6px;">${user.role}</span>` : '';
    const pointsBadge = user.rewardPoints ? `<span style="color: var(--primary); font-size: 0.8rem; font-weight: 700;">★ ${user.rewardPoints} pts</span>` : '';

    authContainer.innerHTML = `
      <div class="user-menu" id="user-menu">
        <div class="user-badge" id="user-menu-btn">
          <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
          <span style="max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${user.name.split(' ')[0]}</span>
          ${roleBadge}
          <span style="font-size: 0.75rem; color: var(--text-muted);">▼</span>
        </div>
        <div class="user-dropdown" id="user-dropdown">
          <div style="padding: 0.6rem 0.85rem; border-bottom: 1px solid var(--border-color);">
            <div style="font-weight: 700; font-size: 0.9rem;">${user.name}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${user.email}</div>
            <div style="margin-top: 0.35rem;">${pointsBadge}</div>
          </div>
          <a href="./dashboard.html" class="dropdown-item">📊 My Dashboard</a>
          <a href="./parking.html" class="dropdown-item">🚗 Find & Reserve Slot</a>
          ${user.role === 'ADMIN' ? `<a href="./admin.html" class="dropdown-item" style="color: #ef4444; font-weight: 600;">⚡ Admin Console</a>` : ''}
          ${user.role === 'GATEKEEPER' || user.role === 'ADMIN' ? `<a href="./gatekeeper.html" class="dropdown-item" style="color: #f59e0b; font-weight: 600;">🛡️ Gatekeeper Terminal</a>` : ''}
          <div class="dropdown-divider"></div>
          <div class="dropdown-item" id="nav-logout-btn" style="color: #ef4444;">🚪 Sign Out</div>
        </div>
      </div>
    `;

    const menuBtn = document.getElementById('user-menu-btn');
    const dropdown = document.getElementById('user-dropdown');
    menuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      dropdown?.classList.remove('show');
    });

    document.getElementById('nav-logout-btn')?.addEventListener('click', logoutUser);
  } else {
    authContainer.innerHTML = `
      <div style="display: flex; gap: 0.5rem;">
        <a href="./login.html" class="btn btn-secondary btn-sm">Log In</a>
        <a href="./register.html" class="btn btn-primary btn-sm">Sign Up</a>
      </div>
    `;
  }
}
