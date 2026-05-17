const dashboardService = require('../services/dashboard.service');

function listOptions(req, defaults = {}) {
  return {
    limit: Number(req.query.limit || defaults.limit || 20),
    page: Number(req.query.page || defaults.page || 1),
    search: req.query.search || '',
  };
}

async function daily(req, res) {
  res.json(await dashboardService.leaderboard({
    range: 'today',
    ...listOptions(req),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  }));
}

async function weekly(req, res) {
  const payload = await dashboardService.leaderboard({
    range: 'week',
    ...listOptions(req),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({ ...payload, range: 'weekly' });
}

async function monthly(req, res) {
  const payload = await dashboardService.leaderboard({
    range: 'month',
    ...listOptions(req),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({ ...payload, range: 'monthly' });
}

async function yearly(req, res) {
  const payload = await dashboardService.leaderboard({
    range: 'year',
    ...listOptions(req),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({ ...payload, range: 'yearly' });
}

async function team(req, res) {
  const range = req.query.range || 'today';
  const payload = await dashboardService.leaderboard({
    range,
    teamId: Number(req.params.teamId),
    ...listOptions(req),
    currentUserId: req.user.id,
    withCurrentUserRank: true,
  });
  res.json({
    ...payload,
    teamId: req.params.teamId,
    range,
  });
}

async function friends(req, res) {
  const range = req.query.range || 'today';
  const payload = await dashboardService.friendsLeaderboard({
    range,
    ...listOptions(req, { limit: 50 }),
    currentUserId: req.user.id,
  });
  res.json({
    ...payload,
    scope: 'friends',
    range,
  });
}

module.exports = { daily, weekly, monthly, yearly, team, friends };
