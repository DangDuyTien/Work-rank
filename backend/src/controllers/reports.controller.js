const { Op } = require('sequelize');
const { DailyStat, ActivityEvent, WorkSession } = require('../models');
const fraudDetection = require('../services/fraudDetection.service');

function dateOnly(value = new Date()) {
  return value.toISOString().slice(0, 10);
}

function dayBounds(date = dateOnly()) {
  return {
    start: new Date(`${date}T00:00:00.000Z`),
    end: new Date(`${date}T23:59:59.999Z`),
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

async function userTimeline(req, res) {
  const date = req.query.date || dateOnly();
  const bounds = dayBounds(date);
  const events = await ActivityEvent.findAll({
    where: {
      userId: req.params.id,
      eventTime: { [Op.between]: [bounds.start, bounds.end] },
      suspicionScore: { [Op.lt]: fraudDetection.LIMITS.highSuspicionThreshold },
    },
    raw: true,
  });
  const byHour = new Map();
  for (const event of events) {
    const hour = new Date(event.eventTime).getUTCHours();
    const row = byHour.get(hour) || { hour, keystrokes: 0, mouse_clicks: 0, active_seconds: 0, idle_seconds: 0 };
    row.keystrokes += Number(event.keystrokeCount || 0);
    row.mouse_clicks += Number(event.mouseClickCount || 0);
    row.active_seconds += Number(event.activeSeconds || 0);
    row.idle_seconds += Number(event.idleSeconds || 0);
    byHour.set(hour, row);
  }
  res.json({ data: Array.from(byHour.values()).sort((a, b) => a.hour - b.hour) });
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
  res.json({ data: [], message: 'Weekly report aggregation pending' });
}

async function userMonthly(req, res) {
  res.json({ data: [], message: 'Monthly report aggregation pending' });
}

async function exportCsv(req, res) {
  const rows = await DailyStat.findAll({ order: [['statDate', 'DESC']], limit: 100, raw: true });
  const header = ['user_id','stat_date','total_seconds','active_seconds','idle_seconds','focus_score','keystroke_count','mouse_click_count','session_count'];
  const body = rows.map((row) => header.map((key) => row[key] ?? row[key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] ?? '').join(','));
  res.header('Content-Type', 'text/csv');
  res.attachment('workrank-report.csv');
  res.send([header.join(','), ...body].join('\n'));
}

module.exports = { userDaily, userToday, userTimeline, userHeatmap, userSessions, userWeekly, userMonthly, exportCsv };
