const { sequelize } = require('../models');

// In-memory process and keep-alive health state (Zero DB cost)
const serviceState = {
  startedAt: new Date().toISOString(),
  lastHealthPingAt: null,
  healthPingCount: 0,
};

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

/**
 * Standard anti-cache headers for health & keep-alive probes
 * Ensures proxies/CDNs (Render edge, Cloudflare, etc.) do NOT serve cached responses
 * and always forward inbound keep-alive requests directly to the web process.
 */
function setNoCacheHeaders(res) {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Expires': '0',
  });
}

/**
 * GET /health and GET /api/health
 * Primary ultra-lightweight keep-alive & health check endpoint.
 *
 * Rules:
 * - Ultra-lightweight: NO database query, NO business logic, NO mutations.
 * - HTTP 200 OK immediately with tiny payload (< 200 bytes).
 * - No authentication required.
 * - Anti-cache headers to ensure inbound traffic actually hits the process.
 * - In-memory ping tracking for Admin diagnostics.
 */
function health(req, res) {
  setNoCacheHeaders(res);

  // Track inbound keep-alive ping timestamp and count
  serviceState.lastHealthPingAt = new Date().toISOString();
  serviceState.healthPingCount += 1;

  return res.status(200).json({
    ok: true,
    status: 'ok',
    service: 'workrank-backend',
    database: 'ok',
    timestamp: serviceState.lastHealthPingAt,
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

/**
 * GET /health/live and GET /api/health/live
 * Lightweight liveness probe for orchestrators.
 */
function live(req, res) {
  setNoCacheHeaders(res);
  return res.status(200).json({
    ok: true,
    status: 'live',
    service: 'workrank-backend',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
}

/**
 * GET /health/ready and GET /api/health/ready
 * Readiness probe checking database connectivity without heavy queries.
 * Only call when verifying if backend is ready to accept database traffic.
 */
async function ready(req, res) {
  setNoCacheHeaders(res);
  try {
    await sequelize.authenticate();
    return res.status(200).json({
      ok: true,
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database unreachable',
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get in-memory diagnostics for Admin Operations
 */
function getDiagnostics() {
  return {
    renderService: 'ONLINE',
    startedAt: serviceState.startedAt,
    lastHealthPingAt: serviceState.lastHealthPingAt,
    healthPingCount: serviceState.healthPingCount,
    uptimeSeconds: Math.floor(process.uptime()),
  };
}

module.exports = {
  health,
  live,
  ready,
  getDiagnostics,
};
