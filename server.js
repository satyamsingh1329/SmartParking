require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const connectDB = require('./config/db');
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

// Connect to MongoDB
connectDB();

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
  }
});
initSocket(io);

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Permissive for CDN libraries (Chart.js, Socket.io, QRCode, Fonts)
    crossOriginEmbedderPolicy: false
  })
);

app.use(cors());

// Rate Limiting (Protects API from DDoS, 500 requests per 15 mins)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    success: false,
    message: 'Too many requests from this IP. Please try again after 15 minutes.'
  }
});
app.use('/api/', apiLimiter);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static Assets
app.use(express.static(path.join(__dirname, 'public')));

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

// Health Check API
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    platform: 'ParkPulse Real-Time Smart Parking Platform',
    timestamp: new Date().toISOString()
  });
});

// Periodic 15-Minute Auto-Release Background Job (Section 27, 70)
// Runs every 30 seconds to clean up reservations older than 15 minutes
setInterval(async () => {
  try {
    const activeIO = getIO();
    await bookingService.releaseExpiredReservations(activeIO);
  } catch (err) {
    // Ignore background release error logging
  }
}, 30 * 1000);

// Centralized Error Handler
app.use(errorHandler);

let PORT = process.env.PORT || 5000;

const startServer = (port) => {
  server.listen(port, () => {
    console.log(`[ParkPulse Server] Running on port ${port} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[ParkPulse URL] Access application at: http://localhost:${port}`);
  });
};

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.warn(`[ParkPulse] Port ${PORT} is already in use (e.g. macOS AirPlay). Falling back to port ${Number(PORT) + 1}...`);
    PORT = Number(PORT) + 1;
    startServer(PORT);
  } else {
    console.error('[ParkPulse Server Error]', err);
  }
});

startServer(PORT);

module.exports = { app, server };
