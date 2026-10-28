'use strict';

/**
 * PRIVATE MEDIA — REALTIME BUS
 *
 * Thin wrapper around the `/private-media` Socket.IO namespace so HTTP
 * controllers can push state without importing socket internals.
 *
 * Rooms:
 *   pm:controllers  every entitled viewer/controller (state fan-out)
 *   pm:players      browser player tabs (command fan-out)
 */

let namespace = null;
const playerSockets = new Set();

function attach(nsp) {
  namespace = nsp;
}

function isAttached() {
  return Boolean(namespace);
}

function broadcastState(state) {
  if (!namespace || !state) return;
  namespace.to('pm:controllers').emit('private-media:state', state);
}

function broadcastCommand(command) {
  if (!namespace || !command) return;
  namespace.to('pm:players').emit('private-media:command', command);
}

function broadcastPlayerPresence(online, state = null) {
  if (!namespace) return;
  namespace.to('pm:controllers').emit(
    online ? 'private-media:player-online' : 'private-media:player-offline',
    state || { online: Boolean(online) },
  );
}

function registerPlayer(socketId) {
  playerSockets.add(socketId);
  return playerSockets.size;
}

function unregisterPlayer(socketId) {
  playerSockets.delete(socketId);
  return playerSockets.size;
}

function playerCount() {
  return playerSockets.size;
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
};
