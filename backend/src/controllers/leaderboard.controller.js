const dashboardService = require('../services/dashboard.service');

async function daily(req, res) {
  res.json({ data: await dashboardService.leaderboard(Number(req.query.limit || 10)) });
}

async function weekly(req, res) {
  res.json({ data: await dashboardService.leaderboard(Number(req.query.limit || 10)), range: 'weekly' });
}

async function monthly(req, res) {
  res.json({ data: await dashboardService.leaderboard(Number(req.query.limit || 10)), range: 'monthly' });
}

async function team(req, res) {
  res.json({ data: await dashboardService.leaderboard(Number(req.query.limit || 10)), teamId: req.params.teamId });
}

module.exports = { daily, weekly, monthly, team };
