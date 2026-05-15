const { Op } = require('sequelize');
const { sequelize, User, DailyStat, ActivityEvent, UserProfilePreference } = require('../models');
const fraudDetection = require('./fraudDetection.service');
const { resolveUserPresence } = require('./userPresence.service');
const { calculateFocusScore, calculateRankScore } = require('../utils/score');

function today() {
  return new Date().toISOString().slice(0, 10);
}

function rangeDates(range = 'today') {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = new Date(end);

  if (range === 'week' || range === 'weekly') {
    const day = start.getUTCDay() || 7;
    start.setUTCDate(start.getUTCDate() - day + 1);
  } else if (range === 'month' || range === 'monthly') {
    start.setUTCDate(1);
  }

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function normalizeRange(range) {
  if (range === 'daily') return 'today';
  if (range === 'weekly') return 'week';
  if (range === 'monthly') return 'month';
  return range || 'today';
}

function statWhereForRange(range) {
  const normalized = normalizeRange(range);
  const dates = rangeDates(normalized);
  if (normalized === 'today') return { statDate: dates.end };
  return { statDate: { [Op.gte]: dates.start, [Op.lte]: dates.end } };
}

function userInclude(teamId, options = {}) {
  const where = { status: 'active' };
  if (teamId) where.teamId = teamId;
  const include = options.withProfile
    ? [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }]
    : [];
  return { model: User, attributes: ['id', 'name', 'email', 'role', 'teamId', 'isVerified', 'status'], where, include };
}

function aggregateRows(rows) {
  return rows.reduce((acc, row) => {
    acc.activeSeconds += Number(row.activeSeconds || 0);
    acc.idleSeconds += Number(row.idleSeconds || 0);
    acc.keystrokeCount += Number(row.keystrokeCount || 0);
    acc.mouseClickCount += Number(row.mouseClickCount || 0);
    acc.sessionCount += Number(row.sessionCount || 0);
    return acc;
  }, { activeSeconds: 0, idleSeconds: 0, keystrokeCount: 0, mouseClickCount: 0, sessionCount: 0 });
}

async function overview({ range = 'today', teamId } = {}) {
  const statDate = today();
  const rows = await DailyStat.findAll({
    where: statWhereForRange(range),
    include: [userInclude(teamId)],
  });
  const totals = aggregateRows(rows);
  const activeSince = new Date(Date.now() - 2 * 60 * 1000);
  const trustedWhere = {
    eventTime: { [Op.gte]: activeSince },
    suspicionScore: { [Op.lt]: fraudDetection.LIMITS.highSuspicionThreshold },
  };
  const teamInclude = teamId ? [{ model: User, attributes: [], where: { teamId } }] : [];
  const activeUsersNow = await ActivityEvent.count({
    distinct: true,
    col: 'user_id',
    where: trustedWhere,
    include: teamInclude,
  });
  const suspiciousEventsToday = await ActivityEvent.count({
    where: {
      eventTime: { [Op.gte]: new Date(`${statDate}T00:00:00.000Z`) },
      suspicionScore: { [Op.gte]: fraudDetection.LIMITS.highSuspicionThreshold },
    },
    include: teamInclude,
  });
  const activeSeconds = Number(totals.activeSeconds || 0);
  const idleSeconds = Number(totals.idleSeconds || 0);
  return {
    range: normalizeRange(range),
    activeUsersNow,
    totalActiveSecondsToday: activeSeconds,
    totalActiveSeconds: activeSeconds,
    totalIdleSeconds: idleSeconds,
    totalKeystrokes: Number(totals.keystrokeCount || 0),
    totalMouseClicks: Number(totals.mouseClickCount || 0),
    totalSessions: Number(totals.sessionCount || 0),
    averageFocusScore: rows.length
      ? Math.round(rows.reduce((sum, row) => sum + Number(row.focusScore || 0), 0) / rows.length)
      : 0,
    idleRatio: activeSeconds + idleSeconds ? idleSeconds / (activeSeconds + idleSeconds) : 0,
    suspiciousEventsToday,
  };
}

async function leaderboard({ range = 'today', teamId, limit = 20 } = {}) {
  const rows = await DailyStat.findAll({
    where: statWhereForRange(range),
    include: [userInclude(teamId, { withProfile: true })],
  });

  const byUser = new Map();
  for (const row of rows) {
    const plain = row.toJSON();
    const user = plain.User;
    if (!user) continue;
    const avatarData = user.UserProfilePreference?.avatarData || null;
    delete user.UserProfilePreference;
    const existing = byUser.get(String(user.id)) || {
      ...user,
      avatarData,
      user_id: user.id,
      activeSeconds: 0,
      idleSeconds: 0,
      totalSeconds: 0,
      keystrokeCount: 0,
      mouseClickCount: 0,
      sessionCount: 0,
    };
    existing.activeSeconds += Number(plain.activeSeconds || 0);
    existing.idleSeconds += Number(plain.idleSeconds || 0);
    existing.totalSeconds += Number(plain.totalSeconds || 0);
    existing.keystrokeCount += Number(plain.keystrokeCount || 0);
    existing.mouseClickCount += Number(plain.mouseClickCount || 0);
    existing.sessionCount += Number(plain.sessionCount || 0);
    byUser.set(String(user.id), existing);
  }

  const ranked = Array.from(byUser.values()).map((row) => {
    const focusScore = calculateFocusScore(row.activeSeconds, row.idleSeconds);
    const score = calculateRankScore({ ...row, focusScore });
    return {
      ...row,
      focusScore,
      score,
    };
  }).sort((a, b) => {
    const scoreDiff = Number(b.score || 0) - Number(a.score || 0);
    if (scoreDiff) return scoreDiff;
    const focusDiff = Number(b.focusScore || 0) - Number(a.focusScore || 0);
    if (focusDiff) return focusDiff;
    return Number(b.activeSeconds || 0) - Number(a.activeSeconds || 0);
  }).slice(0, limit);

  return ranked.map((row, index) => {
    const userPresence = resolveUserPresence(row.id);
    return {
      ...row,
      accountStatus: row.status || 'active',
      presence: userPresence,
      presenceStatus: userPresence,
      score: row.score,
      rankPosition: index + 1
    };
  });
}

async function heatmap({ days = 365, teamId } = {}) {
  const safeDays = Math.min(365, Math.max(1, Number(days || 365)));
  const end = new Date();
  const start = new Date(Date.now() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  const rows = await DailyStat.findAll({
    where: { statDate: { [Op.gte]: start.toISOString().slice(0, 10), [Op.lte]: end.toISOString().slice(0, 10) } },
    include: [userInclude(teamId)],
    raw: true,
  });
  const byDate = new Map();
  for (const row of rows) {
    const date = row.statDate;
    const current = byDate.get(date) || 0;
    byDate.set(date, current + Number(row.keystrokeCount || 0) + Number(row.mouseClickCount || 0));
  }
  const maxCount = Math.max(0, ...byDate.values());
  const data = [];
  for (let i = safeDays - 1; i >= 0; i -= 1) {
    const current = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const date = current.toISOString().slice(0, 10);
    const count = byDate.get(date) || 0;
    const level = !count || !maxCount ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
    data.push({ date, count, level });
  }
  return data;
}

module.exports = { overview, leaderboard, heatmap, rangeDates, normalizeRange };
