'use strict';

/**
 * PRIVATE MEDIA — REALTIME BUS
 *
 * Thin wrapper around the `/private-media` Socket.IO namespace so HTTP
 * controllers can push state without importing socket internals.
 *
 * Rooms are per playback session, because each account now has its own:
 *   pm:<sessionKey>:controllers  that account's viewers/controllers
 *   pm:<sessionKey>:players      that account's player tabs
 *
 * Without the key in the room name, one user's pause would reach everybody's
 * browser — which is exactly the "shared listening" that had to be fixed.
 */

let namespace = null;
// sessionKey -> Set<socketId>
const playerSockets = new Map();

const DEFAULT_KEY = 'primary';

function controllersRoom(sessionKey) {
  return `pm:${sessionKey || DEFAULT_KEY}:controllers`;
}

function playersRoom(sessionKey) {
  return `pm:${sessionKey || DEFAULT_KEY}:players`;
}

function roomKeyOf(state, fallback) {
  return state?.sessionKey || fallback || DEFAULT_KEY;
}

function attach(nsp) {
  namespace = nsp;
}

function isAttached() {
  return Boolean(namespace);
}

function broadcastState(state, sessionKey) {
  if (!namespace || !state) return;
  namespace.to(controllersRoom(roomKeyOf(state, sessionKey))).emit('private-media:state', state);
}

function broadcastCommand(command, sessionKey) {
  if (!namespace || !command) return;
  namespace.to(playersRoom(sessionKey)).emit('private-media:command', command);
}

function broadcastPlayerPresence(online, state = null, sessionKey) {
  if (!namespace) return;
  namespace.to(controllersRoom(roomKeyOf(state, sessionKey))).emit(
    online ? 'private-media:player-online' : 'private-media:player-offline',
    state || { online: Boolean(online) },
  );
}

function registerPlayer(socketId, sessionKey) {
  const key = sessionKey || DEFAULT_KEY;
  if (!playerSockets.has(key)) playerSockets.set(key, new Set());
  playerSockets.get(key).add(socketId);
  return playerSockets.get(key).size;
}

function unregisterPlayer(socketId, sessionKey) {
  const key = sessionKey || DEFAULT_KEY;
  const set = playerSockets.get(key);
  if (!set) return 0;
  set.delete(socketId);
  return set.size;
}

function playerCount(sessionKey) {
  const key = sessionKey || DEFAULT_KEY;
  return playerSockets.get(key)?.size || 0;
}

/**
 * Immediately cut a user's access: notify their controllers, then disconnect
 * every socket they hold in this namespace (web controllers, players, devices).
 */
function revokeUser(userId, reason = 'access-revoked') {
  if (!namespace) return 0;
  const target = Number(userId);
  let closed = 0;

  for (const socket of namespace.sockets.values()) {
    const socketUserId = Number(socket.user?.id);
    if (!socketUserId || socketUserId !== target) continue;
    try {
      socket.emit('private-media:access-revoked', { reason });
      socket.disconnect(true);
      closed += 1;
    } catch {
      // A socket that cannot be closed is already gone.
    }
  }
  return closed;
}

function revokeDevice(deviceId, reason = 'device-revoked') {
  if (!namespace) return 0;
  let closed = 0;
  for (const socket of namespace.sockets.values()) {
    if (Number(socket.device?.id) !== Number(deviceId)) continue;
    try {
      socket.emit('private-media:access-revoked', { reason });
      socket.disconnect(true);
      closed += 1;
    } catch {
      // ignore
    }
  }
  return closed;
}

module.exports = {
  attach,
  isAttached,
  broadcastState,
  broadcastCommand,
  broadcastPlayerPresence,
  registerPlayer,
  unregisterPlayer,
  playerCount,
  revokeUser,
  revokeDevice,
  controllersRoom,
  playersRoom,
};
