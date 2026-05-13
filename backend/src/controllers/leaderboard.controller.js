const dashboardService = require('../services/dashboard.service');

async function daily(req, res) {
  res.json({ data: await dashboardService.leaderboard({ range: 'today', limit: Number(req.query.limit || 20) }) });
}

async function weekly(req, res) {
  res.json({ data: await dashboardService.leaderboard({ range: 'week', limit: Number(req.query.limit || 20) }), range: 'weekly' });
}

async function monthly(req, res) {
  res.json({ data: await dashboardService.leaderboard({ range: 'month', limit: Number(req.query.limit || 20) }), range: 'monthly' });
}

async function team(req, res) {
  const range = req.query.range || 'today';
  res.json({
    data: await dashboardService.leaderboard({
      range,
      teamId: Number(req.params.teamId),
      limit: Number(req.query.limit || 20),
    }),
    teamId: req.params.teamId,
    range,
  });
}

module.exports = { daily, weekly, monthly, team };
