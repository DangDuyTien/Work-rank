const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const chatService = require('../services/chat.service');
const presence = require('../services/presence.service');
const samRealtime = require('../services/samRealtime.service');
const typingRealtime = require('../services/typingRealtime.service');
const { canAccessGameRoom } = require('../services/gameRoomAuth.service');

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
  samRealtime.setIo(io);
  typingRealtime.setIo(io);

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
    socket.on('game:joinRoom', async (payload = {}, ack) => {
      try {
        const auth = await canAccessGameRoom({
          userId: socket.user.id,
          userRole: socket.user.role,
          roomId: payload.roomId,
          gameType: 'game',
          clientSpectatorHint: !!payload.isSpectator,
        });

        if (!auth.allowed) {
          if (typeof ack === 'function') ack({ ok: false, error: auth.error, code: auth.code });
          socket.emit('error', { message: auth.error, code: auth.code });
          return;
        }

        socket.join(`game:${auth.roomId}`);
        if (typeof ack === 'function') {
          ack({ ok: true, roomId: auth.roomId, isSpectator: auth.isSpectator, role: auth.role });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('game:leaveRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.leave(`game:${roomId}`);
      }
    });

    // ── Quiz Game Socket Rooms ──
    socket.on('quiz:joinRoom', async (payload = {}, ack) => {
      try {
        const auth = await canAccessGameRoom({
          userId: socket.user.id,
          userRole: socket.user.role,
          roomId: payload.roomId,
          gameType: 'quiz',
          clientSpectatorHint: !!payload.isSpectator,
        });

        if (!auth.allowed) {
          if (typeof ack === 'function') ack({ ok: false, error: auth.error, code: auth.code });
          socket.emit('error', { message: auth.error, code: auth.code });
          return;
        }

        socket.join(`quiz:${auth.roomId}`);
        if (typeof ack === 'function') {
          ack({ ok: true, roomId: auth.roomId, isSpectator: auth.isSpectator, role: auth.role });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('quiz:leaveRoom', async (payload = {}) => {
      let roomId = Number(payload.roomId);
      if ((Number.isNaN(roomId) || !roomId) && payload.roomId) {
        try {
          const { QuizRoom } = require('../models');
          const cleanCode = String(payload.roomId).trim().toUpperCase().replace(/^#/, '');
          const room = await QuizRoom.findOne({ where: { code: cleanCode } });
          if (room) roomId = room.id;
        } catch {}
      }
      if (roomId) {
        socket.leave(`quiz:${roomId}`);
      }
    });

    // ── Sam Lốc Game Socket Rooms ──
    socket.on('sam:joinRoom', async (payload = {}, ack) => {
      try {
        const auth = await canAccessGameRoom({
          userId: socket.user.id,
          userRole: socket.user.role,
          roomId: payload.roomId,
          gameType: 'sam',
          clientSpectatorHint: !!payload.isSpectator,
        });

        if (!auth.allowed) {
          if (typeof ack === 'function') ack({ ok: false, error: auth.error, code: auth.code });
          socket.emit('error', { message: auth.error, code: auth.code });
          return;
        }

        socket.join(`sam:${auth.roomId}`);
        if (auth.isSpectator) {
          samRealtime.addSpectator(auth.roomId, socket.id);
        }
        if (typeof ack === 'function') {
          ack({ ok: true, roomId: auth.roomId, isSpectator: auth.isSpectator, role: auth.role });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('sam:leaveRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.leave(`sam:${roomId}`);
        samRealtime.removeSpectator(roomId, socket.id);
      }
    });

    socket.on('sam:toggleReady', async (payload = {}, ack) => {
      try {
        const samGameService = require('../services/samGame.service');
        const roomId = Number(payload.roomId);
        const isReady = Boolean(payload.isReady);
        const result = await samGameService.toggleReady(roomId, socket.user.id, isReady);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    // ── Typing Competition Socket Rooms & Actions ──
    socket.on('typing:joinRoom', async (payload = {}, ack) => {
      try {
        const auth = await canAccessGameRoom({
          userId: socket.user.id,
          userRole: socket.user.role,
          roomId: payload.roomId,
          gameType: 'typing',
          clientSpectatorHint: !!payload.isSpectator,
        });

        if (!auth.allowed) {
          if (typeof ack === 'function') ack({ ok: false, error: auth.error, code: auth.code });
          socket.emit('error', { message: auth.error, code: auth.code });
          return;
        }

        socket.join(`typing:${auth.roomId}`);
        if (auth.isSpectator) {
          typingRealtime.addSpectator(auth.roomId, socket.id);
        }
        if (typeof ack === 'function') {
          ack({ ok: true, roomId: auth.roomId, isSpectator: auth.isSpectator, role: auth.role });
        }
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing:leaveRoom', (payload = {}) => {
      const roomId = Number(payload.roomId);
      if (roomId) {
        socket.leave(`typing:${roomId}`);
        typingRealtime.removeSpectator(roomId, socket.id);
      }
    });

    socket.on('typing:toggleReady', async (payload = {}, ack) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        const isReady = Boolean(payload.isReady);
        const result = await typingGameService.toggleReady(roomId, socket.user.id, isReady);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing:switchTeam', async (payload = {}, ack) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        const result = await typingGameService.switchTeam(roomId, socket.user.id, payload.team);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing:progress', async (payload = {}) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        if (roomId) {
          await typingGameService.updateProgress(roomId, socket.user.id, payload);
        }
      } catch {
        // High frequency progress update is best-effort
      }
    });

    socket.on('typing:start', async (payload = {}, ack) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        const result = await typingGameService.startMatch(roomId, socket.user.id);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing:resetRoom', async (payload = {}, ack) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        const result = await typingGameService.resetRoom(roomId, socket.user.id);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });

    socket.on('typing:finish', async (payload = {}, ack) => {
      try {
        const typingGameService = require('../services/typingGame.service');
        const roomId = Number(payload.roomId);
        const result = await typingGameService.submitFinish(roomId, socket.user.id, payload);
        if (typeof ack === 'function') ack({ ok: true, data: result });
      } catch (err) {
        if (typeof ack === 'function') ack({ ok: false, error: err.message });
      }
    });


    socket.on('disconnect', () => {
      samRealtime.removeSpectatorFromAll(socket.id);
      typingRealtime.removeSpectatorFromAll(socket.id);
      const state = presence.removeSocket(socket.user, socket.id, (offlineUser) => {
        emitPresence(io, offlineUser, 'offline');
      });
      if (state.sockets.size > 0) return;
    });
  });
}

module.exports = registerSockets;
