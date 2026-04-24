require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const logger = require('./config/logger');
const { getPool } = require('./config/database');
const { startReminderWorker } = require('./jobs/reminderWorker');
const { startFollowUpWorker } = require('./jobs/followUpWorker');
const { startExternalSyncScheduler } = require('./services/externalDbSync');

// Routes
const authRoutes = require('./routes/auth');
const leadRoutes = require('./routes/leads');
const userRoutes = require('./routes/users');
const reminderRoutes = require('./routes/reminders');
const webhookRoutes = require('./routes/webhook');
const dashboardRoutes = require('./routes/dashboard');
const sourcesRoutes = require('./routes/sources');
const captureRoutes = require('./routes/capture');

// Ensure log directory exists
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir);

const app = express();
const httpServer = http.createServer(app);

// ── Socket.io (real-time lead feed) ──────────────────────────
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', methods: ['GET', 'POST'] },
});
app.set('io', io); // make io accessible in controllers

io.on('connection', (socket) => {
  logger.debug(`Socket connected: ${socket.id}`);
  socket.on('join:dashboard', () => socket.join('dashboard'));
  socket.on('disconnect', () => logger.debug(`Socket disconnected: ${socket.id}`));
});

// ── Security Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting — global
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

// Raw body for Meta webhook signature verification (MUST be before json parser for /webhook)
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// JSON parser for all other routes
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',      authRoutes);
app.use('/api/leads',     leadRoutes);
app.use('/api/users',     userRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/webhook',   webhookRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sources',   sourcesRoutes);
app.use('/api/capture',   captureRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'WizoneLMS' });
});

// ── 404 & Error Handlers ──────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// ── Startup ───────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await getPool();
    logger.info('Database connected');

    startReminderWorker();
    startFollowUpWorker();
    startExternalSyncScheduler();
    logger.info('Background workers started');

    httpServer.listen(PORT, () => {
      logger.info(`Wizone LMS backend running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Startup failed:', err);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received. Shutting down...');
  const { closePool } = require('./config/database');
  await closePool();
  process.exit(0);
});
