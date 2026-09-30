const dashboardService = require('../services/dashboard.service');
const presence = require('../services/presence.service');
const { User } = require('../models');
const { Op } = require('sequelize');

async function overview(req, res) {
  res.json(await dashboardService.overview({
    range: req.query.range || 'today',
    teamId: req.query.teamId ? Number(req.query.teamId) : undefined,
  }));
}

async function realtimeUsers(req, res) {
  const onlineIds = presence.activeUserIds();
  const users = onlineIds.length > 0
    ? await User.findAll({
      where: { id: { [Op.in]: onlineIds }, status: 'active' },
      attributes: ['id', 'name', 'email', 'role', 'teamId'],
    })
    : [];
  res.json({ users });
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
