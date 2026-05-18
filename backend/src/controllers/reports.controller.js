const { Op } = require('sequelize');
const { DailyStat, UserMinuteStat, WorkSession } = require('../models');

const MAX_LEVEL = 200;

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function clampInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function parseUtcDate(value = dateOnly()) {
  return new Date(`${dateOnly(new Date(`${value}T00:00:00.000Z`))}T00:00:00.000Z`);
}

function addDays(value, days) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value, months) {
  const next = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
}

function weekStart(value) {
  const start = parseUtcDate(dateOnly(value));
  const day = start.getUTCDay() || 7;
  start.setUTCDate(start.getUTCDate() - day + 1);
  return start;
}

function monthStart(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function buildAggregate(period, periodStart, periodEnd) {
  return {
    period,
    periodStart,
    periodEnd,
    days: 0,
    totalSeconds: 0,
    activeSeconds: 0,
    idleSeconds: 0,
    keystrokeCount: 0,
    mouseClickCount: 0,
    sessionCount: 0,
    focusScoreTotal: 0,
    focusScoreWeight: 0,
  };
}

function addDailyStat(bucket, row = {}) {
  const activeSeconds = Number(row.activeSeconds || 0);
  const focusScore = Number(row.focusScore || 0);
  const weight = activeSeconds > 0 ? activeSeconds : 1;
  bucket.days += 1;
  bucket.totalSeconds += Number(row.totalSeconds || 0);
  bucket.activeSeconds += activeSeconds;
  bucket.idleSeconds += Number(row.idleSeconds || 0);
  bucket.keystrokeCount += Number(row.keystrokeCount || 0);
  bucket.mouseClickCount += Number(row.mouseClickCount || 0);
  bucket.sessionCount += Number(row.sessionCount || 0);
  bucket.focusScoreTotal += focusScore * weight;
  bucket.focusScoreWeight += weight;
}

function finalizeAggregate(bucket) {
  const focusScore = bucket.focusScoreWeight > 0
    ? Math.round(bucket.focusScoreTotal / bucket.focusScoreWeight)
    : 0;
  const totalActions = bucket.keystrokeCount + bucket.mouseClickCount;
  return {
    period: bucket.period,
    periodStart: bucket.periodStart,
    periodEnd: bucket.periodEnd,
    period_start: bucket.periodStart,
    period_end: bucket.periodEnd,
    days: bucket.days,
    totalSeconds: bucket.totalSeconds,
    activeSeconds: bucket.activeSeconds,
    idleSeconds: bucket.idleSeconds,
    focusScore,
    keystrokeCount: bucket.keystrokeCount,
    mouseClickCount: bucket.mouseClickCount,
    sessionCount: bucket.sessionCount,
    totalActions,
    total_seconds: bucket.totalSeconds,
    active_seconds: bucket.activeSeconds,
    idle_seconds: bucket.idleSeconds,
    focus_score: focusScore,
    keystroke_count: bucket.keystrokeCount,
    mouse_click_count: bucket.mouseClickCount,
    session_count: bucket.sessionCount,
    total_actions: totalActions,
  };
}

async function aggregateUserStatsByPeriod({ userId, period, limit }) {
  const now = parseUtcDate(dateOnly());
  const buckets = new Map();
  let firstStart;

  if (period === 'week') {
    const currentStart = weekStart(now);
    firstStart = addDays(currentStart, -7 * (limit - 1));
    for (let index = 0; index < limit; index += 1) {
      const start = addDays(firstStart, index * 7);
      const end = addDays(start, 6);
      const key = dateOnly(start);
      buckets.set(key, buildAggregate(key, key, dateOnly(end)));
    }
  } else {
    const currentStart = monthStart(now);
    firstStart = addMonths(currentStart, -(limit - 1));
    for (let index = 0; index < limit; index += 1) {
      const start = addMonths(firstStart, index);
      const end = addDays(addMonths(start, 1), -1);
      const key = dateOnly(start).slice(0, 7);
      buckets.set(key, buildAggregate(key, dateOnly(start), dateOnly(end)));
    }
  }

  const rows = await DailyStat.findAll({
    where: {
      userId,
      statDate: { [Op.gte]: dateOnly(firstStart), [Op.lte]: dateOnly(now) },
    },
    raw: true,
  });

  for (const row of rows) {
    const statDate = parseUtcDate(row.statDate);
    const key = period === 'week' ? dateOnly(weekStart(statDate)) : dateOnly(monthStart(statDate)).slice(0, 7);
    const bucket = buckets.get(key);
    if (bucket) addDailyStat(bucket, row);
  }

  return Array.from(buckets.values()).map(finalizeAggregate).reverse();
}

function levelThreshold(level) {
  const n = Math.min(MAX_LEVEL, Math.max(0, Number(level || 0)));
  return Math.round(110 * Math.pow(n, 2.3));
}

function buildLevelMilestones() {
  return Array.from({ length: MAX_LEVEL + 1 }, (_, level) => ({
    level,
    requiredActions: levelThreshold(level),
  }));
}

function buildLevelReport(totalKeystrokes, totalMouseClicks) {
  const totalActions = Number(totalKeystrokes || 0) + Number(totalMouseClicks || 0);
  const milestones = buildLevelMilestones();
  let level = 0;

  for (let nextLevel = MAX_LEVEL; nextLevel >= 0; nextLevel -= 1) {
    if (totalActions >= levelThreshold(nextLevel)) {
      level = nextLevel;
      break;
    }
  }

  const currentLevelActions = levelThreshold(level);
  const nextLevelActions = level >= MAX_LEVEL ? currentLevelActions : levelThreshold(level + 1);
  const span = Math.max(1, nextLevelActions - currentLevelActions);
  const progressPercent = level >= MAX_LEVEL
    ? 100
    : Math.min(100, Math.max(0, ((totalActions - currentLevelActions) / span) * 100));

  return {
    level,
    maxLevel: MAX_LEVEL,
    totalActions,
    totalKeystrokes: Number(totalKeystrokes || 0),
    totalMouseClicks: Number(totalMouseClicks || 0),
    currentLevelActions,
    nextLevelActions,
    remainingActions: Math.max(0, nextLevelActions - totalActions),
    progressPercent,
    milestones,
  };
}

function timezoneOffsetMinutes(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(840, Math.max(-840, parsed));
}

function dayBounds(date = dateOnly(), offsetMinutes = 0) {
  const start = new Date(`${date}T00:00:00.000Z`);
  start.setUTCMinutes(start.getUTCMinutes() + offsetMinutes);
  return {
    start,
    end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1),
  };
}

function buildTimelineBucket(row, granularity, offsetMinutes) {
  const localTime = new Date(new Date(row.bucketStartAt).getTime() - offsetMinutes * 60 * 1000);
  const hour = localTime.getUTCHours();
  const minuteOfDay = hour * 60 + localTime.getUTCMinutes();
  const bucketMinute = granularity === 'quarter' ? Math.floor(minuteOfDay / 15) * 15 : minuteOfDay;
  const key = granularity === 'hour' ? hour : bucketMinute;
  return {
    key,
    value: {
      hour: granularity === 'hour' ? hour : Math.floor(bucketMinute / 60),
      ...(granularity !== 'hour' ? {
        minute: bucketMinute,
        time: `${String(Math.floor(bucketMinute / 60)).padStart(2, '0')}:${String(bucketMinute % 60).padStart(2, '0')}`,
      } : {}),
      keystrokes: 0,
      mouse_clicks: 0,
      active_seconds: 0,
      idle_seconds: 0,
    },
  };
}

async function userDaily(req, res) {
  const where = { userId: req.params.id };
  if (req.query.date) where.statDate = req.query.date;
  const data = await DailyStat.findAll({ where, order: [['statDate', 'DESC']], limit: Number(req.query.limit || 31) });
  res.json({ data });
}

async function userToday(req, res) {
  const stat = await DailyStat.findOne({ where: { userId: req.params.id, statDate: dateOnly() } });
  res.json({ data: stat ? [stat] : [] });
}

async function userLevel(req, res) {
  const where = { userId: req.params.id };
  const [totalKeystrokes, totalMouseClicks] = await Promise.all([
    DailyStat.sum('keystrokeCount', { where }),
    DailyStat.sum('mouseClickCount', { where }),
  ]);

  res.set('Cache-Control', 'no-store');
  res.json({ data: buildLevelReport(totalKeystrokes, totalMouseClicks) });
}

async function userTimeline(req, res) {
  const date = req.query.date || dateOnly();
  const offsetMinutes = timezoneOffsetMinutes(req.query.timezoneOffsetMinutes);
  const granularity = ['minute', 'quarter'].includes(req.query.granularity) ? req.query.granularity : 'hour';
  const bounds = dayBounds(date, offsetMinutes);
  const rows = await UserMinuteStat.findAll({
    where: {
      userId: req.params.id,
      bucketStartAt: { [Op.between]: [bounds.start, bounds.end] },
    },
    order: [['bucketStartAt', 'ASC']],
    raw: true,
  });

  const buckets = new Map();
  for (const minuteStat of rows) {
    const bucket = buildTimelineBucket(minuteStat, granularity, offsetMinutes);
    const row = buckets.get(bucket.key) || bucket.value;
    row.keystrokes += Number(minuteStat.keystrokeCount || 0);
    row.mouse_clicks += Number(minuteStat.mouseClickCount || 0);
    row.active_seconds += Number(minuteStat.activeSeconds || 0);
    row.idle_seconds += Number(minuteStat.idleSeconds || 0);
    buckets.set(bucket.key, row);
  }
  const sortKey = granularity === 'hour' ? 'hour' : 'minute';
  res.json({
    granularity,
    source: 'user_minute_stats',
    data: Array.from(buckets.values()).sort((a, b) => Number(a[sortKey]) - Number(b[sortKey])),
  });
}

async function userHeatmap(req, res) {
  const days = Math.min(365, Math.max(1, Number(req.query.days || 365)));
  const end = new Date();
  const start = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  const rows = await DailyStat.findAll({
    where: {
      userId: req.params.id,
      statDate: { [Op.gte]: dateOnly(start), [Op.lte]: dateOnly(end) },
    },
    raw: true,
  });
  const byDate = new Map(rows.map((row) => [row.statDate, row]));
  const maxCount = rows.reduce((max, row) => Math.max(max, Number(row.keystrokeCount || 0) + Number(row.mouseClickCount || 0)), 0);
  const data = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const current = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dateOnly(current);
    const row = byDate.get(key);
    const count = row ? Number(row.keystrokeCount || 0) + Number(row.mouseClickCount || 0) : 0;
    const level = !count || !maxCount ? 0 : Math.min(4, Math.max(1, Math.ceil((count / maxCount) * 4)));
    data.push({ date: key, count, level });
  }
  res.json({ data });
}

async function userSessions(req, res) {
  const data = await WorkSession.findAll({
    where: { userId: req.params.id },
    order: [['startedAt', 'DESC']],
    limit: Math.min(50, Math.max(1, Number(req.query.limit || 10))),
  });
  res.json({ data });
}

async function userWeekly(req, res) {
  const limit = clampInt(req.query.limit, 12, 1, 104);
  const data = await aggregateUserStatsByPeriod({ userId: req.params.id, period: 'week', limit });
  res.json({ data, period: 'week', limit });
}

async function userMonthly(req, res) {
  const limit = clampInt(req.query.limit, 12, 1, 36);
  const data = await aggregateUserStatsByPeriod({ userId: req.params.id, period: 'month', limit });
  res.json({ data, period: 'month', limit });
}

async function exportCsv(req, res) {
  const rows = await DailyStat.findAll({ order: [['statDate', 'DESC']], limit: 100, raw: true });
  const header = ['user_id','stat_date','total_seconds','active_seconds','idle_seconds','focus_score','keystroke_count','mouse_click_count','session_count'];
  const body = rows.map((row) => header.map((key) => row[key] ?? row[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] ?? '').join(','));
  res.header('Content-Type', 'text/csv');
  res.attachment('workrank-report.csv');
  res.send([header.join(','), ...body].join('\n'));
}

module.exports = { userDaily, userToday, userLevel, userTimeline, userHeatmap, userSessions, userWeekly, userMonthly, exportCsv };
