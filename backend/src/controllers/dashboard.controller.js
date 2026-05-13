const dashboardService = require('../services/dashboard.service');
const activityService = require('../services/activity.service');

async function overview(req, res) {
  res.json(await dashboardService.overview({
    range: req.query.range || 'today',
    teamId: req.query.teamId ? Number(req.query.teamId) : undefined,
  }));
}

async function realtimeUsers(req, res) {
  res.json({ users: await activityService.realtimeUsers() });
}

async function teamSummary(req, res) {
  res.json(await dashboardService.overview({
    range: req.query.range || 'today',
    teamId: req.query.teamId ? Number(req.query.teamId) : req.user.teamId,
  }));
}

async function heatmap(req, res) {
  res.json({
    data: await dashboardService.heatmap({
      days: Number(req.query.days || 365),
      teamId: req.query.teamId ? Number(req.query.teamId) : undefined,
    }),
  });
}

module.exports = { overview, realtimeUsers, teamSummary, heatmap };
