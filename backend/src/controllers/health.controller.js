const { User } = require('../models');
const { sequelize } = require('../models');
const presence = require('../services/presence.service');

function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${Math.max(1, minutes)}m`;
}

async function loadPublicStats() {
  const onlineIds = presence.activeUserIds();
  const activeUsers = await User.count({ where: { status: 'active' } });

  return {
    usersOnline: onlineIds.length,
    activeUsers,
    activeUsersToday: onlineIds.length,
  };
}

async function health(req, res) {
  let realtime = {
    usersOnline: 0,
    activeUsers: 0,
    activeUsersToday: 0,
  };
  let database = 'ok';

  try {
    realtime = await loadPublicStats();
  } catch (error) {
    database = 'degraded';
    console.warn('Public health stats failed:', error.message);
  }

  res.set('Cache-Control', 'no-store');
  res.json({
    status: 'ok',
    database,
    timestamp: new Date().toISOString(),
    uptime: formatUptime(process.uptime()),
    uptimeSeconds: Math.floor(process.uptime()),
    cycle: '5s',
    users: realtime.usersOnline,
    realtime,
  });
}

/**
 * GET /health/live
 * Lightweight liveness probe for Kubernetes / orchestrators.
 */
function live(req, res) {
  res.set('Cache-Control', 'no-store');
  return res.json({
    status: 'live',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    pid: process.pid,
  });
}

/**
 * GET /health/ready
 * Readiness probe checking database connectivity without heavy queries.
 */
async function ready(req, res) {
  res.set('Cache-Control', 'no-store');
  try {
    await sequelize.authenticate();
    return res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database unreachable',
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = { health, live, ready };
