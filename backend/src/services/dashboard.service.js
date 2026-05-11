const { Op } = require('sequelize');
const { sequelize, User, DailyStat, ActivityEvent } = require('../models');
const fraudDetection = require('./fraudDetection.service');

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function overview() {
  const statDate = today();
  const totals = await DailyStat.findOne({
    attributes: [
      [sequelize.fn('SUM', sequelize.col('active_seconds')), 'activeSeconds'],
      [sequelize.fn('SUM', sequelize.col('idle_seconds')), 'idleSeconds'],
      [sequelize.fn('AVG', sequelize.col('focus_score')), 'averageFocusScore'],
    ],
    where: { statDate },
    raw: true,
  });
  const activeSince = new Date(Date.now() - 2 * 60 * 1000);
  const trustedWhere = {
    eventTime: { [Op.gte]: activeSince },
    suspicionScore: { [Op.lt]: fraudDetection.LIMITS.highSuspicionThreshold },
  };
  const activeUsersNow = await ActivityEvent.count({ distinct: true, col: 'user_id', where: trustedWhere });
  const suspiciousEventsToday = await ActivityEvent.count({
    where: {
      eventTime: { [Op.gte]: new Date(`${statDate}T00:00:00.000Z`) },
      suspicionScore: { [Op.gte]: fraudDetection.LIMITS.highSuspicionThreshold },
    },
  });
  const activeSeconds = Number(totals?.activeSeconds || 0);
  const idleSeconds = Number(totals?.idleSeconds || 0);
  return {
    activeUsersNow,
    totalActiveSecondsToday: activeSeconds,
    averageFocusScore: Math.round(Number(totals?.averageFocusScore || 0)),
    idleRatio: activeSeconds + idleSeconds ? idleSeconds / (activeSeconds + idleSeconds) : 0,
    suspiciousEventsToday,
  };
}

async function leaderboard(limit = 20) {
  const statDate = today();
  
  // Fetch all active users and their stats for today
  const users = await User.findAll({
    where: { status: 'active' },
    attributes: ['id', 'name', 'email', 'role', 'teamId'],
    include: [{
      model: DailyStat,
      where: { statDate },
      required: false, // Left join
    }],
    order: [
      [DailyStat, 'focusScore', 'DESC'],
      [DailyStat, 'activeSeconds', 'DESC'],
    ],
    limit,
    subQuery: false, // Disable subquery to allow ordering by included model
  });

  return users.map((user, index) => {
    const data = user.toJSON();
    const stat = data.DailyStats?.[0] || {};
    delete data.DailyStats;
    return {
      ...data,
      user_id: data.id,
      ...stat,
      rankPosition: index + 1
    };
  });
}

module.exports = { overview, leaderboard };
