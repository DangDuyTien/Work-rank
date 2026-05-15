const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/activity.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const desktopStatus = require('../services/desktopStatus.service');
const presence = require('../services/presence.service');

const router = express.Router();
const desktopOfflineTimers = new Map();

function emitPresence(io, user, status) {
  const payload = {
    userId: user.id,
    user_id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
    status,
    presence: status,
    lastSeenAt: new Date().toISOString(),
  };
  let target = io.to('dashboard').to(`user:${user.id}`);
  if (user.teamId) target = target.to(`team:${user.teamId}`);
  target.emit('user:status:update', payload);
}

function presenceFromDesktopStatus(status) {
  return status.online && status.tracking && !status.error ? 'active' : 'online';
}

function scheduleDesktopOfflineCheck(io, user) {
  const key = String(user.id);
  const currentTimer = desktopOfflineTimers.get(key);
  if (currentTimer) clearTimeout(currentTimer);

  const timer = setTimeout(() => {
    desktopOfflineTimers.delete(key);
    const status = desktopStatus.getStatus(user.id);
    if (status.online) return;

    const nextPresence = presence.hasClientType(user.id, 'web') ? 'online' : 'offline';
    presence.setStatus(user, nextPresence);
    io.to(`user:${user.id}`).emit('desktop:status', { online: false, tracking: false });
    emitPresence(io, user, nextPresence);
  }, 25_000);

  desktopOfflineTimers.set(key, timer);
}

const platform = z.enum(['macos', 'windows', 'linux']).optional();
const desktopAction = z.enum(['start', 'stop', 'toggle']);
const event = z.object({
  sessionId: z.coerce.number().int().positive().optional(),
  timestamp: z.string().datetime().optional(),
  activeSeconds: z.coerce.number().int().min(0).max(3600).default(0),
  idleSeconds: z.coerce.number().int().min(0).max(3600).default(0),
  keystrokeCount: z.coerce.number().int().min(0).default(0),
  mouseClickCount: z.coerce.number().int().min(0).default(0),
  mouseMoveCount: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.any()).optional(),
  sequence: z.coerce.number().int().positive(),
});
const deviceFields = {
  deviceUuid: z.string().min(1).max(191),
  deviceName: z.string().min(1).max(191).optional(),
  platform,
  appVersion: z.string().max(50).optional(),
  deviceSecret: z.string().min(32).max(128).optional(),
};

router.post('/session/start', auth, validate(z.object({ body: z.object({ ...deviceFields, startedAt: z.string().datetime().optional() }) })), asyncHandler(controller.startSession));
router.post('/session/end', auth, validate(z.object({ body: z.object({ sessionId: z.coerce.number().int().positive() }) })), asyncHandler(controller.endSession));
router.post('/batch', auth, validate(z.object({ body: z.object({ ...deviceFields, sessionId: z.coerce.number().int().positive().optional(), events: z.array(event).min(1).max(60), signature: z.string().length(64).optional() }) })), asyncHandler(controller.ingestBatch));
router.post('/events', auth, validate(z.object({ body: z.object({ ...deviceFields, ...event.shape }) })), asyncHandler(controller.ingestEvent));
router.get('/me/today', auth, asyncHandler(controller.meToday));
router.post('/desktop-launch', auth, validate(z.object({ body: z.object({
  action: desktopAction,
  refreshToken: z.string().min(1).optional().nullable(),
  apiUrl: z.string().min(1).optional().nullable(),
}) })), asyncHandler(controller.launchDesktop));

// Desktop status heartbeat (desktop app POSTs every ~10s)
router.post('/desktop-status', auth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  desktopStatus.heartbeat(req.user.id, req.body);
  const status = desktopStatus.getStatus(req.user.id);
  const nextPresence = presenceFromDesktopStatus(status);
  presence.setStatus(req.user, nextPresence);
  // Broadcast desktop status to the user's web sockets
  const io = req.app.get('io');
  if (io) {
    io.to(`user:${req.user.id}`).emit('desktop:status', status);
    emitPresence(io, req.user, nextPresence);
    scheduleDesktopOfflineCheck(io, req.user);
  }
  res.json({ ok: true });
});

// Web frontend GETs to check if desktop tracker is online
router.get('/desktop-status', auth, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(desktopStatus.getStatus(req.user.id));
});

module.exports = router;
