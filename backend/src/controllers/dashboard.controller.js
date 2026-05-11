const dashboardService = require('../services/dashboard.service');
const activityService = require('../services/activity.service');

async function overview(req, res) {
  res.json(await dashboardService.overview());
}

async function realtimeUsers(req, res) {
  res.json({ users: await activityService.realtimeUsers() });
}

async function teamSummary(req, res) {
  res.json(await dashboardService.overview());
}

async function heatmap(req, res) {
  res.json({ data: [] });
}

module.exports = { overview, realtimeUsers, teamSummary, heatmap };
