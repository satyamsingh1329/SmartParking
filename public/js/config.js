/**
 * ParkPulse Central Frontend Configuration
 * 
 * To connect the frontend (e.g., hosted on GitHub Pages) to your deployed backend (e.g., on Render),
 * configure BACKEND_API_URL below, OR set it dynamically in the browser using the "⚙️ Backend API" navbar button.
 */
export const APP_CONFIG = {
  // Set to your deployed Render URL (e.g., 'https://parkpulse-backend.onrender.com')
  // When empty string (''), requests use relative paths (same origin / local Express)
  BACKEND_API_URL: '',

  // Allows static preview exploration on GitHub Pages when backend is offline
  ENABLE_STATIC_DEMO_FALLBACK: true,

  // Application Details
  APP_NAME: 'ParkPulse',
  TAGLINE: 'Find. Reserve. Analyze. Optimize.',
  VERSION: '2.0.0',
  REPOSITORY_URL: 'https://github.com/satyamsingh1329/SmartParking',
  PAGES_URL: 'https://satyamsingh1329.github.io/SmartParking/'
};
