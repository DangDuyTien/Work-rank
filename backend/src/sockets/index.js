const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const desktopStatus = require('../services/desktopStatus.service');

const presenceByUser = new Map();
const OFFLINE_GRACE_MS = 15_000;

function getPresence(user) {
  const userId = String(user.id);
  if (!presenceByUser.has(userId)) {
    presenceByUser.set(userId, {
      sockets: new Set(),
      status: 'online',
      offlineTimer: null,
      user: { id: user.id, name: user.name, email: user.email, teamId: user.teamId },
    });
  }
  return presenceByUser.get(userId);
}

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

function registerSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Missing token'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findByPk(payload.sub);
      if (!user || user.status !== 'active') return next(new Error('Invalid user'));
      socket.user = user;
      // Tag the socket with its client type (web or desktop)
      socket.clientType = socket.handshake.auth?.clientType || 'web';
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.email}, type: ${socket.clientType})`);
    socket.join(`user:${socket.user.id}`);
    if (socket.user.teamId) socket.join(`team:${socket.user.teamId}`);
    socket.join('dashboard');
    // Join a type-specific room for targeted messaging
    socket.join(`${socket.clientType}:${socket.user.id}`);
    console.log(`User ${socket.user.id} joined rooms: user:${socket.user.id}, dashboard, ${socket.clientType}:${socket.user.id}`);

    const presence = getPresence(socket.user);
    presence.sockets.add(socket.id);
    presence.user = {
      id: socket.user.id,
      name: socket.user.name,
      email: socket.user.email,
      teamId: socket.user.teamId,
    };
    if (presence.offlineTimer) {
      clearTimeout(presence.offlineTimer);
      presence.offlineTimer = null;
    }
    emitPresence(io, socket.user, presence.status === 'active' ? 'active' : 'online');

    // If desktop just connected, send its status to web sockets
    if (socket.clientType === 'desktop') {
      const status = desktopStatus.getStatus(socket.user.id);
      io.to(`web:${socket.user.id}`).emit('desktop:status', { ...status, online: true });
    }

    // If web just connected, send current desktop status
    if (socket.clientType === 'web') {
      const status = desktopStatus.getStatus(socket.user.id);
      socket.emit('desktop:status', status);
    }

    socket.on('user:status', (payload) => {
      const nextStatus = ['active', 'online', 'idle'].includes(payload?.status) ? payload.status : 'online';
      const state = getPresence(socket.user);
      state.status = nextStatus;
      console.log(`User ${socket.user.id} status update: ${nextStatus}`);
      emitPresence(io, socket.user, nextStatus);
    });

    socket.on('activity:heartbeat', (payload, ack) => {
      console.warn(`Ignored deprecated activity:heartbeat from user ${socket.user.id}; use /api/activity/batch`);
      if (typeof ack === 'function') {
        ack({ ok: false, deprecated: true, message: 'Use /api/activity/batch' });
      }
    });

    // Desktop app sends periodic heartbeat via socket (alternative to HTTP POST)
    socket.on('desktop:heartbeat', (payload) => {
      desktopStatus.heartbeat(socket.user.id, payload);
      io.to(`web:${socket.user.id}`).emit('desktop:status', desktopStatus.getStatus(socket.user.id));
    });

    // Web sends command to desktop (start/stop tracking)
    socket.on('desktop:command', (payload, ack) => {
      const action = payload?.action;
      if (!['start', 'stop', 'toggle'].includes(action)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'Invalid action' });
        return;
      }
      console.log(`Web user ${socket.user.id} sending desktop command: ${action}`);
      // Forward the command to all desktop sockets of this user
      io.to(`desktop:${socket.user.id}`).emit('desktop:command', { action });
      if (action === 'start') desktopStatus.setTracking(socket.user.id, true);
      else if (action === 'stop') desktopStatus.setTracking(socket.user.id, false);
      if (typeof ack === 'function') ack({ ok: true, action });
    });

    // Web requests current desktop status
    socket.on('desktop:status:request', (payload, ack) => {
      const status = desktopStatus.getStatus(socket.user.id);
      if (typeof ack === 'function') ack(status);
      socket.emit('desktop:status', status);
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id} (type: ${socket.clientType})`);
      const state = getPresence(socket.user);
      state.sockets.delete(socket.id);

      // If desktop disconnected, notify web sockets
      if (socket.clientType === 'desktop') {
        // Small delay to handle reconnections
        setTimeout(() => {
          const status = desktopStatus.getStatus(socket.user.id);
          if (!status.online) {
            io.to(`web:${socket.user.id}`).emit('desktop:status', { online: false, tracking: false });
          }
        }, 3000);
      }

      if (state.sockets.size > 0) return;

      state.offlineTimer = setTimeout(() => {
        if (state.sockets.size === 0) {
          state.status = 'offline';
          emitPresence(io, socket.user, 'offline');
        }
      }, OFFLINE_GRACE_MS);
    });
  });
}

module.exports = registerSockets;

