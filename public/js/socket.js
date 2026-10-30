/**
 * ParkPulse Real-Time Socket.io Client Manager
 */
import { showToast, getApiBaseUrl } from './utils.js';

let socket = null;
const eventHandlers = new Map();

export function initSocketClient() {
  if (socket) return socket;

  const indicator = document.getElementById('socket-indicator');
  const dot = document.getElementById('socket-pulse-dot');
  const label = document.getElementById('socket-label');

  const apiBase = getApiBaseUrl();

  // On static GitHub Pages without connected backend:
  if (apiBase === null) {
    if (dot) dot.style.background = '#06b6d4';
    if (label) label.textContent = 'STATIC PREVIEW';
    return null;
  }

  // Connect to the host origin
  if (typeof io !== 'function') {
    console.warn('[Socket.io] Client script not loaded yet');
    return null;
  }

  socket = apiBase ? io(apiBase) : io();

  const indicator = document.getElementById('socket-indicator');
  const dot = document.getElementById('socket-pulse-dot');
  const label = document.getElementById('socket-label');

  socket.on('connect', () => {
    console.log(`[Socket.io] Connected with ID: ${socket.id}`);
    if (dot) dot.style.background = '#10b981';
    if (label) label.textContent = 'LIVE SYNC';

    // If logged in, join personal user channel
    const userStr = localStorage.getItem('parkpulse_user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        socket.emit('user:join', user.id || user._id);
      } catch (e) {}
    }
  });

  socket.on('disconnect', () => {
    console.warn('[Socket.io] Disconnected');
    if (dot) dot.style.background = '#ef4444';
    if (label) label.textContent = 'OFFLINE';
  });

  socket.on('reconnecting', () => {
    if (dot) dot.style.background = '#f59e0b';
    if (label) label.textContent = 'RECONNECTING';
  });

  // Global Real-Time Event Listeners
  socket.on('notification:broadcast', (data) => {
    showToast(`${data.title}: ${data.message}`, 'info');
  });

  socket.on('alert:overstay', (data) => {
    showToast(`⚠️ OVERSTAY DETECTED: Booking ${data.bookingId} has exceeded duration!`, 'warning', 8000);
  });

  return socket;
}

export function onSocketEvent(eventName, callback) {
  if (!socket) initSocketClient();
  if (socket) {
    socket.on(eventName, callback);
  }
}

export function emitSocketEvent(eventName, data) {
  if (!socket) initSocketClient();
  if (socket) {
    socket.emit(eventName, data);
  }
}

export function getSocket() {
  if (!socket) initSocketClient();
  return socket;
}
