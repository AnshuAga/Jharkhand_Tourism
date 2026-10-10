import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { PORT } from './src/config/constants.js';

// Import all routers
import authRoutes from './src/routes/authRoutes.js';
import itineraryRoutes from './src/routes/itineraryRoutes.js';
import destinationsRoutes from './src/routes/destinationsRoutes.js';
import chatbotRoutes from './src/routes/chatbotRoutes.js';
import marketplaceRoutes from './src/routes/marketplaceRoutes.js';
import blockchainRoutes from './src/routes/blockchainRoutes.js';
import sentimentRoutes from './src/routes/sentimentRoutes.js';
import transportRoutes from './src/routes/transportRoutes.js';
import arvrRoutes from './src/routes/arvrRoutes.js';
import adminRoutes from './src/routes/adminRoutes.js';
import vendorRoutes from './src/routes/vendorRoutes.js';
import touristRoutes from './src/routes/touristRoutes.js';
import weatherRoutes from './src/routes/weatherRoutes.js';
import paymentRoutes from './src/routes/paymentRoutes.js';
import enquiryRoutes from './src/routes/enquiryRoutes.js';

import { geoTransportService } from './src/services/geoTransportService.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

// Setup Socket.io for real-time transport tracking and alerts
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);
geoTransportService.setDemoBroadcaster((status) => {
  io.emit('transport:demo:status', status);
  io.emit('transport:vehicles', status.vehicles);
});

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'AI & Blockchain Smart Tourism Platform - Jharkhand',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/itinerary', itineraryRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/sentiment', sentimentRoutes);
app.use('/api/transport', transportRoutes);
app.use('/api/arvr', arvrRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorRoutes);
app.use('/api/tourist', touristRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/enquiries', enquiryRoutes);
// Marketplace-scoped aliases preserve the natural API shape for existing clients.
app.use('/api/marketplace/payments', paymentRoutes);
app.use('/api/marketplace/payment', paymentRoutes);

// Socket.io event handling for real-time transport telemetry and alerts
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send current authentic vehicle locations and alerts
  socket.emit('transport:vehicles', geoTransportService.getLiveVehicles());
  socket.emit('transport:alerts', geoTransportService.getTravelAlerts());

  // Listen for real driver telemetry push via socket
  socket.on('driver:telemetry', (data) => {
    if (data && data.vehicleId) {
      const updated = geoTransportService.updateVehicleTelemetry(data);
      io.emit('transport:vehicle:updated', updated);
      io.emit('transport:vehicles', geoTransportService.getLiveVehicles());
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Error Handler]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

process.on('uncaughtException', (err) => {
  console.error('🚨 [Server Uncaught Exception]:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 [Server Unhandled Rejection]:', reason);
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`✨ Jharkhand Smart Tourism Backend Server Online ✨`);
  console.log(`📡 HTTP & WebSocket running on: http://localhost:${PORT}`);
  console.log(`🚀 API Base URL: http://localhost:${PORT}/api`);
  console.log(`=======================================================`);
});
