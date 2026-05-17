const { QueryTypes } = require('sequelize');
const { sequelize, User } = require('../models');
const activityService = require('../services/activity.service');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

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
  const [onlineRows, activeUsers, daily] = await Promise.all([
    activityService.realtimeUsers(),
    User.count({ where: { status: 'active' } }),
    sequelize.query(`
      SELECT
        COUNT(DISTINCT user_id) AS active_users_today,
        COALESCE(SUM(keystroke_count), 0) AS keystrokes_today,
        COALESCE(SUM(mouse_click_count), 0) AS clicks_today,
        COALESCE(SUM(session_count), 0) AS sessions_today
      FROM daily_stats
      WHERE stat_date = :today
    `, {
      replacements: { today: todayKey() },
      type: QueryTypes.SELECT,
      plain: true,
    }),
  ]);

  const keystrokesToday = Number(daily?.keystrokes_today || 0);
  const clicksToday = Number(daily?.clicks_today || 0);

  return {
    usersOnline: Array.isArray(onlineRows) ? onlineRows.length : 0,
    activeUsers,
    activeUsersToday: Number(daily?.active_users_today || 0),
    keystrokesToday,
    clicksToday,
    actionsToday: keystrokesToday + clicksToday,
    sessionsToday: Number(daily?.sessions_today || 0),
  };
}

async function health(req, res) {
  let realtime = {
    usersOnline: 0,
    activeUsers: 0,
    activeUsersToday: 0,
    keystrokesToday: 0,
    clicksToday: 0,
    actionsToday: 0,
    sessionsToday: 0,
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

module.exports = { health };
