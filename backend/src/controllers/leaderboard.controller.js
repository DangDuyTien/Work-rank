const dashboardService = require('../services/dashboard.service');

async function daily(req, res) {
  res.json(await dashboardService.leaderboard({
    range: 'today',
    limit: Number(req.query.limit || 20),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  }));
}

async function weekly(req, res) {
  const payload = await dashboardService.leaderboard({
    range: 'week',
    limit: Number(req.query.limit || 20),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({ ...payload, range: 'weekly' });
}

async function monthly(req, res) {
  const payload = await dashboardService.leaderboard({
    range: 'month',
    limit: Number(req.query.limit || 20),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({ ...payload, range: 'monthly' });
}

async function team(req, res) {
  const range = req.query.range || 'today';
  const payload = await dashboardService.leaderboard({
    range,
    teamId: Number(req.params.teamId),
    limit: Number(req.query.limit || 20),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({
    ...payload,
    teamId: req.params.teamId,
    range,
  });
}

module.exports = { daily, weekly, monthly, team };
