const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const activityService = require('../services/activity.service');

function registerSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('Missing token'));
      const payload = jwt.verify(token, env.jwtSecret);
      const user = await User.findByPk(payload.sub);
      if (!user) return next(new Error('Invalid user'));
      socket.user = user;
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id} (User: ${socket.user.email})`);
    socket.join(`user:${socket.user.id}`);
    if (socket.user.teamId) socket.join(`team:${socket.user.teamId}`);
    socket.join('dashboard');
    console.log(`User ${socket.user.id} joined rooms: user:${socket.user.id}, dashboard`);

    socket.on('user:status', (payload) => {
      console.log(`User ${socket.user.id} status update: ${payload.status}`);
      io.to('dashboard').emit('user:status:update', { userId: socket.user.id, ...payload });
    });

    socket.on('activity:heartbeat', async (payload) => {
      try {
        console.log(`User ${socket.user.id} heartbeat: k=${payload.keystrokes}, c=${payload.clicks}`);
        
        // Persist to database immediately
        await activityService.upsertDailyStat(socket.user.id, new Date(), {
          activeSeconds: Number(payload.activeSeconds || 0),
          idleSeconds: 0,
          keystrokeCount: Number(payload.keystrokes || 0),
          mouseClickCount: Number(payload.clicks || 0)
        });

        // Broadcast to dashboard room
        io.to('dashboard').emit('activity:user:update', { userId: socket.user.id, ...payload });
      } catch (error) {
        console.error('Failed to persist heartbeat:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      io.to('dashboard').emit('user:status:update', { userId: socket.user.id, status: 'offline' });
    });
  });
}

module.exports = registerSockets;
