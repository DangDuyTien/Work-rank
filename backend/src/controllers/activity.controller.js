const { spawn } = require('child_process');
const activityService = require('../services/activity.service');
const dashboardService = require('../services/dashboard.service');

const DESKTOP_PROTOCOL = 'workrank';

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function buildDesktopUrl(action, accessToken, refreshToken) {
  const params = new URLSearchParams();
  if (accessToken) params.set('token', accessToken);
  if (refreshToken) params.set('refreshToken', refreshToken);
  params.set('ts', String(Date.now()));
  return `${DESKTOP_PROTOCOL}://${action}?${params.toString()}`;
}

function openDesktopUrl(url) {
  const options = { detached: true, stdio: 'ignore' };
  let child;
  if (process.platform === 'darwin') {
    child = spawn('open', [url], options);
  } else if (process.platform === 'win32') {
    child = spawn('cmd', ['/c', 'start', '', url], options);
  } else {
    child = spawn('xdg-open', [url], options);
  }
  child.unref();
}

function emitRealtime(req, realtime) {
  const io = req.app.get('io');
  if (!io) return;
  Promise.all([dashboardService.overview(), dashboardService.leaderboard()]).then(([overview, leaderboard]) => {
    if (realtime) {
      const payload = {
        ...realtime,
        userId: req.user.id,
        user_id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        teamId: req.user.teamId,
      };
      let target = io.to('dashboard').to(`user:${req.user.id}`);
      if (req.user.teamId) target = target.to(`team:${req.user.teamId}`);
      target.emit('activity:user:update', payload);
    }
    io.to('dashboard').emit('dashboard:overview:update', overview);
    io.to('dashboard').emit('leaderboard:update', leaderboard);
  }).catch((error) => {
    console.warn('Failed to emit realtime activity update:', error.message);
  });
}

function emitSecurityQuarantine(req, quarantine) {
  if (!quarantine?.quarantined) return;
  const io = req.app.get('io');
  if (!io) return;
  const payload = {
    type: 'device_quarantined',
    userId: req.user.id,
    user_id: req.user.id,
    name: req.user.name,
    email: req.user.email,
    teamId: req.user.teamId,
    ...quarantine,
  };
  io
    .to('role:admin')
    .to(`web:${req.user.id}`)
    .to(`desktop:${req.user.id}`)
    .emit('security:device:quarantined', payload);
}

function isBrowserActivityPayload(body = {}) {
  return body.appVersion === 'web' || String(body.deviceUuid || '').startsWith('web-');
}

function totalsFromStat(stat) {
  return {
    activeSeconds: Number(stat?.activeSeconds || 0),
    idleSeconds: Number(stat?.idleSeconds || 0),
    totalSeconds: Number(stat?.totalSeconds || 0),
    keystrokeCount: Number(stat?.keystrokeCount || 0),
    mouseClickCount: Number(stat?.mouseClickCount || 0),
    focusScore: Number(stat?.focusScore || 0),
  };
}

async function ignoredBrowserActivity(req, res) {
  const stat = await activityService.todayStats(req.user.id);
  res.status(202).json({
    count: 0,
    ignored: true,
    reason: 'desktop_only_tracking',
    message: 'Browser activity ingest is disabled. Use Desktop Tracker.',
    realtime: { totals: totalsFromStat(stat) },
  });
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
  if (isBrowserActivityPayload(req.validated.body)) {
    await ignoredBrowserActivity(req, res);
    return;
  }
  const result = await activityService.ingestBatch(req.user.id, req.validated.body);
  emitRealtime(req, result.realtime);
  emitSecurityQuarantine(req, result.quarantine);
  res.status(201).json(result);
}

async function ingestEvent(req, res) {
  const body = req.validated.body;
  if (isBrowserActivityPayload(body)) {
    await ignoredBrowserActivity(req, res);
    return;
  }
  const result = await activityService.ingestBatch(req.user.id, { ...body, events: [body] });
  emitRealtime(req, result.realtime);
  emitSecurityQuarantine(req, result.quarantine);
  res.status(201).json(result);
}

async function meToday(req, res) {
  const stat = await activityService.todayStats(req.user.id);
  res.json({ stat });
}

async function launchDesktop(req, res) {
  const action = req.validated.body.action;
  const url = buildDesktopUrl(action, getBearerToken(req), req.validated.body.refreshToken);
  openDesktopUrl(url);
  res.status(202).json({ ok: true, action });
}

module.exports = { startSession, endSession, ingestBatch, ingestEvent, meToday, launchDesktop };
