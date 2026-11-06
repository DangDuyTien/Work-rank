'use strict';

const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const access = require('../services/privateMedia/access.service');
const sessions = require('../services/privateMedia/session.service');
const realtime = require('../services/privateMedia/realtime.service');
const devices = require('../services/privateMedia/device.service');
const audit = require('../services/privateMedia/audit.service');
const chats = require('../services/privateMedia/chat.service');
const chatClock = require('../services/privateMedia/chatClock.service');
const NAMESPACE = '/private-media';

function registerPrivateMediaNamespace(io) {
  const nsp = io.of(NAMESPACE);
  realtime.attach(nsp);
  // The 00:00 Vietnam rollover is pushed from the server, not guessed per tab.
  chatClock.start();
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
    // Account-scoped room: a read marker reaches this user's other tabs only.
    socket.join(realtime.userRoom(userId));
    /**
     * Chat is one channel for the whole system, so every entitled WEB socket
     * joins the chat room regardless of the listening mode. A device socket is a
     * hotkey helper: it is not in the room and never receives message bodies.
     */
    if (socket.clientType === 'web') {
      socket.join(realtime.chatRoom());
      socket.emit('private-media:chat-day', chatClock.payloadAt());
    }
    /**
     * Shared listening presence. Membership is keyed by account, so opening a
     * second tab does not add a second avatar, and closing one tab does not make
     * the person leave while another tab is still listening.
     */
    const listening = room === 'shared' && socket.clientType === 'web'
      ? realtime.joinListeningRoom(socket.id, socket.user)
      : { joined: false };
    if (listening.joined) realtime.broadcastParticipants();
    else realtime.emitParticipantsTo(socket);
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
        // The "đang phát" badge in the participant list follows the real player.
        if (room === 'shared') realtime.broadcastParticipants();
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
    /**
     * One finished queue item, one advance.
     *
     * The ack tells the reporting browser whether the server accepted the end,
     * so the player can stop waiting instead of guessing with a timer. The
     * server itself stays idempotent: a second report for the same queue item
     * is `stale` and never advances again.
     */
    const ended = async (payload = {}, error = false, ack) => {
      try {
        if (!isPlayer || !await authorized()) return;
        const result = await sessions.autoAdvance({
          userId,
          room,
          currentQueueItemId: payload.currentQueueItemId,
          errorCode: error ? payload.errorCode : null,
          eventId: payload.eventId,
        });
        const accepted = !result.stale && !result.premature;
        if (accepted) realtime.broadcastState(result.state, key);
        if (typeof ack === 'function') {
          ack({
            ok: accepted,
            stale: Boolean(result.stale),
            premature: Boolean(result.premature),
            advanced: Boolean(result.advanced),
            state: result.state,
          });
        }
      } catch { /* canonical snapshot repairs a failed report */ }
    };
    socket.on('private-media:player-ended', (payload, ack) => ended(payload, false, ack));
    socket.on('private-media:player-error', (payload, ack) => ended(payload, true, ack));
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
    /**
     * Chat rides the same authenticated socket as playback, so a revoked account
     * loses it at the same moment it loses the player. The sender identity is
     * `userId` from the handshake — never a field in the payload, and never a
     * room: there is exactly one public channel.
     */
    socket.on('private-media:chat-send', async (payload = {}, ack) => {
      try {
        if (!await authorized()) return;
        const result = await chats.createMessage({
          userId,
          content: payload.content,
          clientMessageId: payload.clientMessageId,
        });
        // A duplicate retry is still acknowledged (so the sender stops retrying)
        // but is not re-broadcast: the room already has that message id.
        if (!result.duplicate) realtime.broadcastChat(result.message);
        if (typeof ack === 'function') {
          ack({
            ok: true,
            message: result.message,
            duplicate: result.duplicate,
            day: result.day,
            dayEndsAt: result.dayEndsAt,
            serverNow: result.serverNow,
          });
        }
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.code || 'CHAT_FAILED', message: error.message });
      }
    });
    /**
     * Read marker. Sent when the panel is actually visible and scrolled to the
     * newest message — never on tab focus alone, because a focused tab with a
     * collapsed chat has not read anything.
     */
    socket.on('private-media:chat-read', async (payload = {}, ack) => {
      try {
        if (!await authorized()) return;
        const result = await chats.markRead({ userId, messageId: payload.messageId ?? null });
        realtime.broadcastToUser(userId, 'private-media:chat-read', result);
        if (typeof ack === 'function') ack({ ok: true, ...result });
      } catch (error) {
        if (typeof ack === 'function') ack({ ok: false, error: error.code || 'CHAT_READ_FAILED' });
      }
    });
    socket.on('disconnect', async () => {
      // Leaving shared listening is about the account's last socket, not about
      // whether this particular tab owned the player.
      if (listening.joined || room === 'shared') {
        const { left } = realtime.leaveListeningRoom(socket.id, userId);
        if (left) realtime.broadcastParticipants();
      }
      if (!isPlayer) return;
      isPlayer = false;
      realtime.unregisterPlayer(socket.id, key);
      try {
        const state = await sessions.setPlayerPresence(realtime.playerCount(key) > 0, userId, room);
        realtime.broadcastState(state, key);
        if (room === 'shared') {
          realtime.broadcastParticipants();
          await audit.record({ action: 'LEAVE_LISTENING_SESSION', actorUserId: userId, source: 'WEB', metadata: { sessionId: state.sessionId } });
        }
      } catch { /* next hello repairs presence */ }
    });
    snapshot().catch(() => {});
  });
  return nsp;
}
module.exports = { registerPrivateMediaNamespace, NAMESPACE };
