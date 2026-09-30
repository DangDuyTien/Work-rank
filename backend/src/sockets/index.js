const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const chatService = require('../services/chat.service');
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

function chatUserPayload(user) {
  return {
    userId: user.id,
    user_id: user.id,
    name: user.name,
    email: user.email,
  };
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
      socket.clientType = 'web';
      return next();
    } catch (error) {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    if (socket.user.teamId) socket.join(`team:${socket.user.teamId}`);
    if (socket.user.role) socket.join(`role:${socket.user.role}`);
    socket.join('dashboard');
    socket.join(`web:${socket.user.id}`);

    const state = presence.addSocket(socket.user, socket.id, 'web');
    emitPresence(io, socket.user, state.status === 'active' ? 'active' : 'online');

    socket.on('user:status', (payload) => {
      const nextStatus = ['active', 'online', 'idle'].includes(payload?.status) ? payload.status : 'online';
      presence.setStatus(socket.user, nextStatus);
      emitPresence(io, socket.user, nextStatus);
    });

    socket.on('chat:send', async (payload = {}, ack) => {
      try {
        const message = await chatService.sendMessage(
          socket.user.id,
          payload.receiverId || payload.friendId,
          payload.body,
          payload.clientMessageId,
        );
        const eventPayload = {
          ...message,
          sender: chatUserPayload(socket.user),
        };
        io.to(`web:${message.receiverId}`).emit('chat:message', eventPayload);
        io.to(`web:${message.senderId}`).emit('chat:message', eventPayload);
        if (typeof ack === 'function') ack({ ok: true, message: eventPayload });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Không gửi được tin nhắn' });
      }
    });

    socket.on('chat:typing', async (payload = {}) => {
      const receiverId = Number(payload.receiverId || payload.friendId || 0);
      if (!receiverId || receiverId === Number(socket.user.id)) return;
      try {
        if (!(await chatService.areFriends(socket.user.id, receiverId))) return;
        io.to(`web:${receiverId}`).emit('chat:typing', {
          fromUserId: socket.user.id,
          isTyping: payload.isTyping !== false,
          at: Date.now(),
        });
      } catch {
        // Typing indicators are best-effort only.
      }
    });

    socket.on('chat:read', async (payload = {}, ack) => {
      try {
        const result = await chatService.markRead(socket.user.id, payload.friendId || payload.senderId);
        io.to(`web:${result.friendId}`).emit('chat:read', {
          readerId: socket.user.id,
          readAt: result.readAt,
          count: result.count,
        });
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message || 'Không cập nhật được trạng thái đọc' });
      }
    });

    // ── Capital Board Game Socket Rooms ──
    socket.on('game:joinRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.join(`game:${roomId}`);
      }
    });

    socket.on('game:leaveRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.leave(`game:${roomId}`);
      }
    });

    // ── Quiz Game Socket Rooms ──
    socket.on('quiz:joinRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.join(`quiz:${roomId}`);
      }
    });

    socket.on('quiz:leaveRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.leave(`quiz:${roomId}`);
      }
    });

    socket.on('disconnect', () => {
      const state = presence.removeSocket(socket.user, socket.id, (offlineUser) => {
        emitPresence(io, offlineUser, 'offline');
      });
      if (state.sockets.size > 0) return;
    });
  });
}

module.exports = registerSockets;
