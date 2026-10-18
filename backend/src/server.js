const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const socketOptions = require('./config/socket');
const registerSockets = require('./sockets');
const { sequelize } = require('./models');
const competitionRealtime = require('./services/competition/competitionRealtime.service');
const { ensureYouTubeSchema } = require('./services/youtube/youtubeSchemaCheck');
const { ensureTypingSchema } = require('./services/typingSchemaCheck');
const { ensureDrawingSchema } = require('./services/drawingSchemaCheck');
const youtubeSyncWorker = require('./workers/youtubeSync.worker');
const keepAliveWorker = require('./workers/keepAlive.worker');
const competitionEngineWorker = require('./services/competition/competitionEngine.worker');
const outboxDispatcherWorker = require('./workers/outboxDispatcher.worker');

let serverInstance = null;
let ioInstance = null;
let isShuttingDown = false;

async function start() {
  await sequelize.authenticate();
  await ensureYouTubeSchema(sequelize);
  await ensureTypingSchema(sequelize);
  await ensureDrawingSchema(sequelize);
  const server = http.createServer(app);
  serverInstance = server;
  const io = new Server(server, socketOptions);
  ioInstance = io;
  app.set('io', io);
  competitionRealtime.setIo(io);
  const quizRealtime = require('./services/quizRealtime.service');
  quizRealtime.setIo(io);
  const samRealtime = require('./services/samRealtime.service');
  samRealtime.setIo(io);
  const typingRealtime = require('./services/typingRealtime.service');
  typingRealtime.setIo(io);
  youtubeSyncWorker.setIo(io);
  youtubeSyncWorker.startPeriodicSync();
  keepAliveWorker.startKeepAlive();

  // ─── Competition & Outbox Workers Lifecycle ──────────────────────────────
  const competitionWorkerEnabled = process.env.COMPETITION_WORKER_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';
  const outboxWorkerEnabled = process.env.OUTBOX_WORKER_ENABLED !== 'false' && process.env.NODE_ENV !== 'test';

  if (competitionWorkerEnabled) {
    // Quarantine any known audit test poison events before starting consumer
    await competitionEngineWorker.quarantineKnownPoisonEvents().catch((err) => {
      console.warn('[Server] Competition quarantine warning:', err.message);
    });
    competitionEngineWorker.start();
  }

  if (outboxWorkerEnabled) {
    outboxDispatcherWorker.start();
  }

  registerSockets(io);
  server.listen(env.port, '0.0.0.0', () => {
    console.log(`WorkRank backend listening on 0.0.0.0:${env.port}`);
  });
}

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);

  // 1. Stop background workers and await in-flight batches
  try {
    await Promise.allSettled([
      competitionEngineWorker.stop(),
      outboxDispatcherWorker.stop(),
      Promise.resolve(youtubeSyncWorker.stopPeriodicSync?.()),
    ]);
    console.log('[Server] Background workers stopped.');
  } catch (workerErr) {
    console.error('[Server] Error stopping workers:', workerErr.message);
  }

  // 2. Close Socket.IO & HTTP server
  try {
    if (ioInstance) {
      ioInstance.close();
    }
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
      console.log('[Server] HTTP and Socket.IO server closed.');
    }
  } catch (netErr) {
    console.error('[Server] Error closing server:', netErr.message);
  }

  // 3. Close database connection pool
  try {
    await sequelize.close();
    console.log('[Server] Database connection closed.');
  } catch (dbErr) {
    console.error('[Server] Error closing database connection:', dbErr.message);
  }

  console.log('[Server] Graceful shutdown completed.');
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

if (require.main === module) {
  start().catch((error) => {
    console.error('Failed to start server', error);
    process.exit(1);
  });
}

module.exports = { start, shutdown };
