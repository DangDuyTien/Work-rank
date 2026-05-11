const activityService = require('../services/activity.service');
const dashboardService = require('../services/dashboard.service');

function emitRealtime(req) {
  const io = req.app.get('io');
  if (!io) return;
  Promise.all([dashboardService.overview(), dashboardService.leaderboard()]).then(([overview, leaderboard]) => {
    io.to('dashboard').emit('dashboard:overview:update', overview);
    io.to('dashboard').emit('leaderboard:update', leaderboard);
    io.to(`user:${req.user.id}`).emit('activity:user:update', { userId: req.user.id });
  }).catch(() => {});
}

async function startSession(req, res) {
  const result = await activityService.startSession(req.user.id, req.validated.body);
  res.status(201).json(result);
}

async function endSession(req, res) {
  const session = await activityService.endSession(req.user.id, req.validated.body.sessionId);
  res.json({ session });
}

async function ingestBatch(req, res) {
  const result = await activityService.ingestBatch(req.user.id, req.validated.body);
  emitRealtime(req);
  res.status(201).json(result);
}

async function ingestEvent(req, res) {
  const body = req.validated.body;
  const result = await activityService.ingestBatch(req.user.id, { ...body, events: [body] });
  emitRealtime(req);
  res.status(201).json(result);
}

async function meToday(req, res) {
  const stat = await activityService.todayStats(req.user.id);
  res.json({ stat });
}

module.exports = { startSession, endSession, ingestBatch, ingestEvent, meToday };
