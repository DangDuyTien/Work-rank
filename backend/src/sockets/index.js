const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const desktopStatus = require('../services/desktopStatus.service');
const presence = require('../services/presence.service');

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

    const state = presence.addSocket(socket.user, socket.id, socket.clientType);
    emitPresence(io, socket.user, state.status === 'active' ? 'active' : 'online');

    // If desktop just connected, send its status to web sockets
    if (socket.clientType === 'desktop') {
      const status = desktopStatus.getStatus(socket.user.id);
      const nextPresence = status.tracking && !status.error ? 'active' : 'online';
      presence.setStatus(socket.user, nextPresence);
      io.to(`web:${socket.user.id}`).emit('desktop:status', { ...status, online: true });
      emitPresence(io, socket.user, nextPresence);
    }

    // If web just connected, send current desktop status
    if (socket.clientType === 'web') {
      const status = desktopStatus.getStatus(socket.user.id);
      socket.emit('desktop:status', status);
    }

    socket.on('user:status', (payload) => {
      const nextStatus = ['active', 'online', 'idle'].includes(payload?.status) ? payload.status : 'online';
      presence.setStatus(socket.user, nextStatus);
      console.log(`User ${socket.user.id} status update: ${nextStatus}`);
      emitPresence(io, socket.user, nextStatus);
    });

    // Desktop app sends periodic heartbeat via socket (alternative to HTTP POST)
    socket.on('desktop:heartbeat', (payload) => {
      desktopStatus.heartbeat(socket.user.id, payload);
      const status = desktopStatus.getStatus(socket.user.id);
      const nextPresence = status.online && status.tracking && !status.error ? 'active' : 'online';
      presence.setStatus(socket.user, nextPresence);
      emitPresence(io, socket.user, nextPresence);
      io.to(`web:${socket.user.id}`).emit('desktop:status', status);
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
      if (action === 'start' || action === 'stop') {
        const nextPresence = action === 'start' ? 'active' : 'online';
        presence.setStatus(socket.user, nextPresence);
        emitPresence(io, socket.user, nextPresence);
      }
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
      const state = presence.removeSocket(socket.user, socket.id, (offlineUser) => {
        emitPresence(io, offlineUser, 'offline');
      });

      // If desktop disconnected, notify web sockets
      if (socket.clientType === 'desktop') {
        // Small delay to handle reconnections
        setTimeout(() => {
          const status = desktopStatus.getStatus(socket.user.id);
          if (!status.online) {
            io.to(`web:${socket.user.id}`).emit('desktop:status', { online: false, tracking: false });
            const nextPresence = presence.hasClientType(socket.user.id, 'web') ? 'online' : 'offline';
            presence.setStatus(socket.user, nextPresence);
            emitPresence(io, socket.user, nextPresence);
          }
        }, 3000);
      }
      if (state.sockets.size > 0) return;
    });
  });
}

module.exports = registerSockets;
