const { DailyStat } = require('../models');

async function userDaily(req, res) {
  const data = await DailyStat.findAll({ where: { userId: req.params.id }, order: [['statDate', 'DESC']], limit: 31 });
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

module.exports = { userDaily, userWeekly, userMonthly, exportCsv };
