/**
 * ParkPulse Main Application Entry
 */
import { initTheme } from './utils.js';
import { renderNavAuth } from './auth.js';
import { initSocketClient } from './socket.js';

export function initializeApp() {
  initTheme();
  renderNavAuth();
  initSocketClient();
}

// Auto init if included directly
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initializeApp);
}
