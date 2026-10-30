'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const access = require('../services/privateMedia/access.service');
const sessions = require('../services/privateMedia/session.service');
const realtime = require('../services/privateMedia/realtime.service');
const devices = require('../services/privateMedia/device.service');
const audit = require('../services/privateMedia/audit.service');
const NAMESPACE = '/private-media';

function registerPrivateMediaNamespace(io) {
  const nsp = io.of(NAMESPACE);
  realtime.attach(nsp);
  nsp.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};
      socket.pmRoom = sessions.normalizeRoom(auth.room);
      if (auth.deviceToken) {
        socket.device = await devices.authenticateToken(auth.deviceToken);
        if (!socket.device) throw new Error();
        socket.user = { id: socket.device.userId };
        socket.clientType = 'device';
      } else {
        const payload = jwt.verify(auth.token || auth.accessToken, env.jwtSecret);
        if (payload.tokenType === 'refresh') throw new Error();
        const user = await User.findByPk(payload.sub);
        if (!user || user.status !== 'active' || (payload.tokenVersion !== undefined && Number(payload.tokenVersion) !== Number(user.tokenVersion || 0))) throw new Error();
        socket.user = user;
        socket.clientType = 'web';
      }
      const e = await access.getEntitlement(socket.user.id);
      if (!access.hasPermission(e, socket.device ? 'hotkey' : 'view')) throw new Error();
      next();
    } catch { next(new Error('Unauthorized')); }
  });
  nsp.on('connection', async (socket) => {
    const userId = Number(socket.user.id);
    const room = socket.pmRoom;
    const key = await sessions.sessionKeyFor(userId, room);
    let isPlayer = false;
    let lastTick = 0;
    // Re-check each inbound event, including subscribe/progress/ended/ack.
    const authorized = async () => {
      const e = await access.getEntitlement(userId);
      const deviceValid = !socket.device || await devices.authenticateToken(socket.handshake.auth.deviceToken);
      if (!socket.connected || !deviceValid || !access.hasPermission(e, socket.device ? 'hotkey' : 'view')) {
        socket.emit('private-media:access-revoked', { reason: 'access-revoked' }); socket.disconnect(true); return false;
      }
      return true;
    };
    const snapshot = async () => {
      if (!await authorized()) return;
      socket.join(realtime.controllersRoom(key));
      const state = await sessions.getSessionState(userId, room);
      if (socket.connected) socket.emit('private-media:state', state);
      return state;
    };
    socket.on('private-media:subscribe', async (ack) => {
      try { const state = await snapshot(); if (typeof ack === 'function') ack({ ok: Boolean(state), state }); } catch { /* reconnect retries snapshot */ }
    });
    socket.on('private-media:player-hello', async (_, ack) => {
      try {
        if (!await authorized() || socket.clientType !== 'web') return;
        const first = !isPlayer;
        isPlayer = true;
        socket.join(realtime.playersRoom(key));
        realtime.registerPlayer(socket.id, key, userId);
        const state = await sessions.setPlayerPresence(true, userId, room);
        if (!socket.connected) { realtime.unregisterPlayer(socket.id, key); return; }
        realtime.broadcastState(state, key);
        if (first && room === 'shared') await audit.record({ action: 'JOIN_LISTENING_SESSION', actorUserId: userId, source: 'WEB', metadata: { sessionId: state.sessionId } });
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch { /* next hello repairs presence */ }
    });
    socket.on('private-media:player-progress', async (payload = {}) => {
      if (!isPlayer || Date.now() - lastTick < 1500) return;
      lastTick = Date.now();
      try {
        if (!await authorized()) return;
        const state = await sessions.syncPlayerProgress(payload, userId, room);
        socket.emit('private-media:state', state);
      } catch { /* progress is advisory */ }
    });
    const ended = async (payload = {}, error = false) => {
      try {
        if (!isPlayer || !await authorized()) return;
        const result = await sessions.autoAdvance({ userId, room, currentQueueItemId: payload.currentQueueItemId, errorCode: error ? payload.errorCode : null });
        if (!result.stale && !result.premature) realtime.broadcastState(result.state, key);
      } catch { /* canonical snapshot repairs a failed report */ }
    };
    socket.on('private-media:player-ended', (payload) => ended(payload));
    socket.on('private-media:player-error', (payload) => ended(payload, true));
    socket.on('private-media:player-ack', async (payload = {}, ack) => {
      try {
        if (!isPlayer || !await authorized()) return;
        const result = await sessions.acknowledgeCommand({ ...payload, actorUserId: userId, room });
        if (typeof ack === 'function') ack({ ok: true, state: result.state });
      } catch { /* acknowledgements cannot mutate playback */ }
    });
    socket.on('private-media:command', async (payload = {}, ack) => {
      try {
        if (!await authorized()) return;
        const result = await sessions.issueCommand({ commandId: payload.commandId, action: payload.action, payload: payload.payload || {}, actorUserId: userId, room, source: socket.device ? 'HOTKEY' : 'WEB' });
        if (!result.duplicate) { realtime.broadcastCommand(result.command, key); realtime.broadcastState(result.state, key); }
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (error) { if (typeof ack === 'function') ack({ ok: false, error: error.code || 'COMMAND_FAILED', message: error.message }); }
    });
    socket.on('disconnect', async () => {
      if (!isPlayer) return;
      isPlayer = false;
      realtime.unregisterPlayer(socket.id, key);
      try {
        const state = await sessions.setPlayerPresence(realtime.playerCount(key) > 0, userId, room);
        realtime.broadcastState(state, key);
        if (room === 'shared') await audit.record({ action: 'LEAVE_LISTENING_SESSION', actorUserId: userId, source: 'WEB', metadata: { sessionId: state.sessionId } });
      } catch { /* next hello repairs presence */ }
    });
    snapshot().catch(() => {});
  });
  return nsp;
}
module.exports = { registerPrivateMediaNamespace, NAMESPACE };
