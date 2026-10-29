'use strict';

/**
 * PRIVATE MEDIA — SOCKET NAMESPACE `/private-media`
 *
 * A dedicated namespace keeps this capability fully isolated from the main
 * application socket: no extra events leak into `io`, and authorization is
 * re-evaluated on every connection (a revoked user cannot keep a live socket).
 *
 * Two kinds of principals:
 *   browser (JWT)      -> controllers / players
 *   Mac helper (device token) -> HOTKEY command source only
 */

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const accessService = require('../services/privateMedia/access.service');
const sessionService = require('../services/privateMedia/session.service');
const realtime = require('../services/privateMedia/realtime.service');
const deviceService = require('../services/privateMedia/device.service');

const NAMESPACE = '/private-media';
const PROGRESS_BROADCAST_INTERVAL_MS = 1200;

function unauthorized(message = 'Unauthorized') {
  return new Error(message);
}

async function authenticateBrowser(auth = {}) {
  const token = auth.token || auth.accessToken;
  if (!token) return null;

  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.tokenType === 'refresh') return null;

  const user = await User.findByPk(payload.sub, { attributes: ['id', 'name', 'email', 'status', 'tokenVersion'] });
  if (!user || user.status !== 'active') return null;
  if (payload.tokenVersion !== undefined && Number(payload.tokenVersion) !== Number(user.tokenVersion || 0)) return null;

  return user;
}

function registerPrivateMediaNamespace(io) {
  const nsp = io.of(NAMESPACE);
  realtime.attach(nsp);

  nsp.use(async (socket, next) => {
    try {
      const auth = socket.handshake.auth || {};

      // Devices and the shared room: a device always drives its owner's private
      // session; browsers may opt into the shared listening room.
      const room = sessionService.normalizeRoom(auth.room);
      socket.pmRoom = room;

      if (auth.deviceToken) {
        const device = await deviceService.authenticateToken(auth.deviceToken);
        if (!device) return next(unauthorized());

        const entitlement = await accessService.getEntitlement(device.userId);
        if (!accessService.hasPermission(entitlement, 'hotkey')) return next(unauthorized());

        socket.user = { id: device.userId };
        socket.device = device;
        socket.clientType = 'device';
        socket.entitlement = entitlement;
        return next();
      }

      const user = await authenticateBrowser(auth);
      if (!user) return next(unauthorized());

      const entitlement = await accessService.getEntitlement(user.id);
      if (!entitlement) return next(unauthorized());

      socket.user = user;
      socket.entitlement = entitlement;
      socket.clientType = 'web';
      return next();
    } catch {
      return next(unauthorized());
    }
  });

  nsp.on('connection', async (socket) => {
    const userId = Number(socket.user.id);
    let isPlayer = false;
    let lastProgressBroadcast = 0;

    // Every account has its own playback session; the rooms are scoped to it so
    // one user's state never reaches another user's browser.
    let sessionKey = sessionService.DEFAULT_SESSION_KEY;
    try {
      sessionKey = await sessionService.sessionKeyFor(userId, socket.pmRoom);
    } catch {
      // Fall back to the default room rather than dropping the connection.
    }
    socket.sessionKey = sessionKey;
    socket.join(realtime.controllersRoom(sessionKey));

    const emitState = (state) => {
      if (!state) return;
      socket.emit('private-media:state', state);
    };

    // Initial snapshot: the connecting client never has to guess.
    sessionService.getSessionState(userId, socket.pmRoom)
      .then(emitState)
      .catch(() => {});

    socket.on('private-media:subscribe', async (ack) => {
      try {
        socket.join(realtime.controllersRoom(sessionKey));
        const state = await sessionService.getSessionState(userId, socket.pmRoom);
        socket.emit('private-media:state', state);
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: 'STATE_UNAVAILABLE' });
      }
    });

    socket.on('private-media:player-hello', async (payload = {}, ack) => {
      try {
        if (socket.clientType !== 'web') throw new Error('DEVICE_CANNOT_RENDER');
        if (!accessService.hasPermission(socket.entitlement, 'control')) throw new Error('FORBIDDEN');

        isPlayer = true;
        socket.join(realtime.playersRoom(sessionKey));
        realtime.registerPlayer(socket.id, sessionKey);

        const state = await sessionService.setPlayerPresence(true, userId, socket.pmRoom);
        realtime.broadcastPlayerPresence(true, state, sessionKey);
        realtime.broadcastState(state, sessionKey);
        if (typeof ack === 'function') ack({ ok: true, state });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message || 'PLAYER_HELLO_FAILED' });
      }
    });

    socket.on('private-media:player-progress', async (payload = {}) => {
      try {
        if (!isPlayer) return;
        const state = await sessionService.syncPlayerProgress(payload, userId, socket.pmRoom);
        const now = Date.now();
        if (now - lastProgressBroadcast >= PROGRESS_BROADCAST_INTERVAL_MS) {
          lastProgressBroadcast = now;
          realtime.broadcastState(state, sessionKey);
        }
      } catch {
        // Progress is best-effort telemetry; commands remain the source of truth.
      }
    });

    socket.on('private-media:player-ack', async (payload = {}, ack) => {
      try {
        if (!isPlayer) throw new Error('NOT_A_PLAYER');
        const result = await sessionService.acknowledgeCommand({
          commandId: payload.commandId,
          actorUserId: userId,
          state: payload.state || {},
          errorCode: payload.errorCode || null,
        });
        if (result.applied) realtime.broadcastState(result.state, sessionKey);
        if (typeof ack === 'function') ack({ ok: true, state: result.state });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.message || 'ACK_FAILED' });
      }
    });

    socket.on('private-media:command', async (payload = {}, ack) => {
      try {
        const requiredPermission = socket.clientType === 'device' ? 'hotkey' : 'control';
        // Re-resolve on every command so a revoke lands immediately, even while
        // a socket is still open.
        const fresh = await accessService.getEntitlement(userId);
        if (!accessService.hasPermission(fresh, requiredPermission)) {
          socket.emit('private-media:access-revoked', { reason: 'access-revoked' });
          socket.disconnect(true);
          if (typeof ack === 'function') ack({ ok: false, error: 'ACCESS_REVOKED' });
          return;
        }
        socket.entitlement = fresh;

        const result = await sessionService.issueCommand({
          commandId: payload.commandId,
          action: payload.action,
          source: socket.clientType === 'device' ? 'HOTKEY' : 'WEB',
          actorUserId: userId,
          payload: payload.payload || {},
          room: socket.pmRoom,
        });

        if (!result.duplicate) {
          realtime.broadcastCommand(result.command, sessionKey);
          realtime.broadcastState(result.state, sessionKey);
        }
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (error) {
        if (typeof ack === 'function') {
          ack({ ok: false, error: error.code || 'COMMAND_FAILED', message: error.message });
        }
      }
    });

    socket.on('disconnect', async () => {
      if (!isPlayer) return;
      isPlayer = false;
      const remaining = realtime.unregisterPlayer(socket.id, sessionKey);
      if (remaining > 0) return;
      try {
        const state = await sessionService.setPlayerPresence(false, userId, socket.pmRoom);
        realtime.broadcastPlayerPresence(false, state, sessionKey);
        realtime.broadcastState(state, sessionKey);
      } catch {
        // Presence is advisory; the next player-hello repairs it.
      }
    });
  });

  return nsp;
}

module.exports = { registerPrivateMediaNamespace, NAMESPACE };
