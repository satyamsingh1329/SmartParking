require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { connectDB, isDBConnected, closeDB } = require('./config/db');
const { initSocket, getIO } = require('./sockets/socketManager');
const bookingService = require('./services/bookingService');
const errorHandler = require('./middleware/errorHandler');

// Route Imports
const authRoutes = require('./routes/authRoutes');
const parkingRoutes = require('./routes/parkingRoutes');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sensorRoutes = require('./routes/sensorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const favoriteRoutes = require('./routes/favoriteRoutes');
const evRoutes = require('./routes/evRoutes');
const passRoutes = require('./routes/passRoutes');
const anprRoutes = require('./routes/anprRoutes');
const predictionRoutes = require('./routes/predictionRoutes');

const app = express();
const server = http.createServer(app);

// CORS Policy Configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5000', 'http://localhost:5001', 'http://127.0.0.1:5000', 'http://127.0.0.1:5001'];

const corsOptions = {
  origin: (origin, callback) => {
    if (
      !origin ||
      !process.env.CORS_ORIGIN ||
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(origin) ||
      process.env.NODE_ENV !== 'production'
    ) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
};

// Initialize Socket.io with matching CORS policy
const io = new Server(server, {
  cors: corsOptions
});
initSocket(io);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Permissive for CDN libraries (Chart.js, Socket.io, QRCode, Fonts)
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors(corsOptions));

// Global API Rate Limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'RATE_LIMIT_EXCEEDED',
    message: 'Too many requests from this client. Please retry after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// Strict Rate Limiter for Authentication (Brute-Force Protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    errorCode: 'AUTH_RATE_LIMIT',
    message: 'Too many authentication attempts. Please wait 15 minutes before retrying.'
  }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Body Parsers with safe payload caps
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Static Assets with HTML extension resolution
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use(express.static(__dirname, { extensions: ['html'] }));

// Direct Frontend Page Routes (clean URL support for /analytics, /admin, /dashboard, etc.)
const frontendPages = [
  'parking',
  'dashboard',
  'booking',
  'admin',
  'analytics',
  'gatekeeper',
  'login',
  'register',
  'parking-pass'
];
frontendPages.forEach((page) => {
  app.get(`/${page}`, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', `${page}.html`));
  });
});

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/slots', slotRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sensors', sensorRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/ev', evRoutes);
app.use('/api/passes', passRoutes);
app.use('/api/anpr', anprRoutes);
app.use('/api/predictions', predictionRoutes);

// Health Check API (with DB readiness)
app.get('/api/health', (req, res) => {
  const dbReady = isDBConnected();
  const statusCode = dbReady ? 200 : 503;

  res.status(statusCode).json({
    status: dbReady ? 'healthy' : 'degraded',
    platform: 'ParkPulse Real-Time Smart Parking Platform',
    version: '2.0.0',
    database: dbReady ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Liveness probe (always responds if process is alive)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'alive' });
});

// 404 API Endpoint Handler
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    errorCode: 'NOT_FOUND',
    message: `API endpoint ${req.originalUrl} not found`
  });
});

// Single Page Navigation Fallback for Browser Navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized Error Handler
app.use(errorHandler);

// Background job interval references (for graceful shutdown)
let autoReleaseInterval = null;
let sensorWatchdogInterval = null;

// Periodic 30s Auto-Release Background Job (Grace Period / No-Show release)
const startBackgroundJobs = () => {
  autoReleaseInterval = setInterval(async () => {
    try {
      const activeIO = getIO();
      await bookingService.releaseExpiredReservations(activeIO);
    } catch (err) {
      // Silently continue — background job should not crash server
    }
  }, 30 * 1000);

  // Periodic Sensor Stale Heartbeat Detection
  // Marks sensors OFFLINE if no heartbeat in 5 minutes
  sensorWatchdogInterval = setInterval(async () => {
    try {
      const Sensor = require('./models/Sensor');
      const staleThreshold = new Date(Date.now() - 5 * 60 * 1000);
      const result = await Sensor.updateMany(
        { status: 'ONLINE', lastHeartbeat: { $lt: staleThreshold } },
        { $set: { status: 'OFFLINE' } }
      );
      if (result.modifiedCount > 0) {
        console.log(`[Sensor Watchdog] Marked ${result.modifiedCount} stale sensor(s) as OFFLINE`);
      }
    } catch (err) {
      // Silently continue
    }
  }, 60 * 1000);
};

// Graceful Shutdown Handler
let isShuttingDown = false;

const gracefulShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[ParkPulse] Received ${signal}. Starting graceful shutdown...`);

  // Stop accepting new connections
  if (autoReleaseInterval) clearInterval(autoReleaseInterval);
  if (sensorWatchdogInterval) clearInterval(sensorWatchdogInterval);

  // Close Socket.IO connections
  try {
    const activeIO = getIO();
    activeIO.close();
    console.log('[ParkPulse] Socket.IO connections closed.');
  } catch (e) {
    // Socket may not be initialized
  }

  // Close HTTP server
  server.close(() => {
    console.log('[ParkPulse] HTTP server closed.');
  });

  // Close MongoDB
  await closeDB();

  console.log('[ParkPulse] Graceful shutdown complete.');
  process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Boot Sequence: Connect to DB first, then start server
const PORT = process.env.PORT || 5000;

const boot = async () => {
  try {
    // 1. Connect to MongoDB (blocks until success or exits on failure)
    await connectDB();

    // 2. Start HTTP server only after DB is ready
    server.listen(PORT, () => {
      console.log(`[ParkPulse Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
      console.log(`[ParkPulse URL] Access application at: http://localhost:${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        const fallbackPort = Number(PORT) + 1;
        console.warn(`[ParkPulse] Port ${PORT} is already in use. Falling back to port ${fallbackPort}...`);
        server.listen(fallbackPort, () => {
          console.log(`[ParkPulse Server] Running on port ${fallbackPort} in ${process.env.NODE_ENV || 'development'} mode`);
          console.log(`[ParkPulse URL] Access application at: http://localhost:${fallbackPort}`);
        });
      } else {
        console.error('[ParkPulse Server Error]', err.message);
        process.exit(1);
      }
    });

    // 3. Start background jobs
    startBackgroundJobs();
  } catch (err) {
    console.error('[ParkPulse] Failed to start:', err.message);
    process.exit(1);
  }
};

boot();

module.exports = { app, server };
