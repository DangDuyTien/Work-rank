'use strict';

// Authenticated per-session realtime bus. Output preferences stay on each device.

let namespace = null;
// sessionKey -> Map<socketId, userId> (count people, including multiple tabs).
const playerSockets = new Map();

/**
 * Shared listening membership, keyed by USER (not by socket) so five tabs of the
 * same person count as one listener. Each entry keeps every live socket id, so
 * closing one tab does not make somebody "leave" while another tab is open.
 */
const listeners = new Map();

const DEFAULT_KEY = 'primary';
// The single shared playback session key. A literal (not an import) keeps this
// module free of a require cycle with session.service.
const SHARED_SESSION_KEY = 'room:shared';
// Every web socket of an entitled account joins this room: one feed, both modes.
const CHAT_ROOM = 'pm:chat:global';

function controllersRoom(sessionKey) {
  return `pm:${sessionKey || DEFAULT_KEY}:controllers`;
}

function playersRoom(sessionKey) {
  return `pm:${sessionKey || DEFAULT_KEY}:players`;
}

/** One room per account: lets a read marker reach that account's other tabs. */
function userRoom(userId) {
  return `pm:user:${Number(userId) || 0}`;
}

function chatRoom() {
  return CHAT_ROOM;
}

function roomKeyOf(state, fallback) {
  return state?.sessionKey || fallback || DEFAULT_KEY;
}

function attach(nsp) {
  if (namespace !== nsp) {
    playerSockets.clear();
    listeners.clear();
  }
  namespace = nsp;
}

function isAttached() {
  return Boolean(namespace);
}

function broadcastState(state, sessionKey) {
  if (!namespace || !state) return;
  namespace.to(controllersRoom(roomKeyOf(state, sessionKey))).emit('private-media:state', { ...state, participantCount: playerCount(roomKeyOf(state, sessionKey)) });
}

function broadcastCommand(command, sessionKey) {
  if (!namespace || !command) return;
  namespace.to(playersRoom(sessionKey)).emit('private-media:command', command);
}

/**
 * Chat is one system-wide channel: every entitled web socket is in `CHAT_ROOM`,
 * whichever playback mode it is in. Device sockets (Mac hotkey helper) are not
 * in that room — they have no UI and no business receiving message bodies.
 */
function broadcastChat(message) {
  if (!namespace || !message) return 0;
  namespace.to(CHAT_ROOM).emit('private-media:chat-message', message);
  return 1;
}

/** Authoritative midnight switch, pushed to every open client at once. */
function broadcastChatDay(payload) {
  if (!namespace || !payload) return 0;
  namespace.to(CHAT_ROOM).emit('private-media:chat-day', payload);
  return 1;
}

/** Deliver an event to every live socket of one account (never to other users). */
function broadcastToUser(userId, event, payload) {
  if (!namespace || !event) return 0;
  namespace.to(userRoom(userId)).emit(event, payload);
  return 1;
}

function broadcastPlayerPresence(online, state = null, sessionKey) {  if (!namespace) return;
  namespace.to(controllersRoom(roomKeyOf(state, sessionKey))).emit(
    online ? 'private-media:player-online' : 'private-media:player-offline',
    state || { online: Boolean(online) },
  );
}

function registerPlayer(socketId, sessionKey, userId) {
  const key = sessionKey || DEFAULT_KEY;
  if (!playerSockets.has(key)) playerSockets.set(key, new Map());
  playerSockets.get(key).set(socketId, Number(userId));
  return playerSockets.get(key).size;
}

function unregisterPlayer(socketId, sessionKey) {
  const key = sessionKey || DEFAULT_KEY;
  const set = playerSockets.get(key);
  if (!set) return 0;
  set.delete(socketId);
  if (!set.size) playerSockets.delete(key);
  return set.size;
}

function playerCount(sessionKey) {
  const key = sessionKey || DEFAULT_KEY;
  return new Set(playerSockets.get(key)?.values() || []).size;
}

function playerUserIds(sessionKey = SHARED_SESSION_KEY) {
  return new Set(playerSockets.get(sessionKey)?.values() || []);
}

// ── Shared listening participants ───────────────────────────────────────────

/**
 * Register one socket as a listener of the shared room.
 * @returns {{ joined: boolean, count: number }} joined=true only for the FIRST
 *          socket of that account, which is the only case worth broadcasting.
 */
function joinListeningRoom(socketId, user) {
  const userId = Number(user?.id);
  if (!userId || !socketId) return { joined: false, count: listeners.size };
  const existing = listeners.get(userId);
  if (existing) {
    existing.sockets.add(socketId);
    // A renamed account or a new avatar should show up on the next snapshot.
    existing.name = user.name || existing.name;
    existing.avatarUrl = user.avatarUrl ?? existing.avatarUrl;
    return { joined: false, count: listeners.size };
  }
  listeners.set(userId, {
    id: userId,
    name: user?.name || 'Thành viên',
    avatarUrl: user?.avatarUrl || null,
    sockets: new Set([socketId]),
    since: new Date().toISOString(),
  });
  return { joined: true, count: listeners.size };
}

/**
 * Remove one socket. The listener only leaves when their LAST socket closes, so
 * a second tab, a reload or a route change never flickers the avatar list.
 */
function leaveListeningRoom(socketId, userId) {
  const id = Number(userId);
  const entry = listeners.get(id);
  if (!entry) return { left: false, count: listeners.size };
  entry.sockets.delete(socketId);
  if (entry.sockets.size > 0) return { left: false, count: listeners.size };
  listeners.delete(id);
  return { left: true, count: listeners.size };
}

/** Drop an account entirely (access revoked): no ghost avatar can remain. */
function removeListener(userId) {
  const removed = listeners.delete(Number(userId));
  return { left: removed, count: listeners.size };
}

/**
 * Snapshot for the UI: distinct accounts, alphabetically stable so avatars do
 * not jump around on every join/leave, with the player flag resolved live.
 */
function listeningParticipants() {
  const playing = playerUserIds();
  return [...listeners.values()]
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      avatarUrl: entry.avatarUrl,
      online: true,
      isPlayer: playing.has(entry.id),
      since: entry.since,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'vi') || a.id - b.id);
}

function listeningSnapshot() {
  const participants = listeningParticipants();
  return { participants, count: participants.length, serverNow: Date.now() };
}

function broadcastParticipants() {
  if (!namespace) return null;
  const snapshot = listeningSnapshot();
  namespace.to(CHAT_ROOM).emit('private-media:participants', snapshot);
  return snapshot;
}

function emitParticipantsTo(socket) {
  if (!socket) return null;
  const snapshot = listeningSnapshot();
  socket.emit('private-media:participants', snapshot);
  return snapshot;
}

/**
 * Immediately cut a user's access: notify their controllers, then disconnect
 * every socket they hold in this namespace (web controllers, players, devices).
 */
function revokeUser(userId, reason = 'access-revoked') {
  if (!namespace) return 0;
  const target = Number(userId);
  let closed = 0;
  const removal = removeListener(target);

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
  if (removal.left) broadcastParticipants();
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
  isListening: (userId, key) => [...(playerSockets.get(key)?.values() || [])].includes(Number(userId)),
  attach,
  isAttached,
  broadcastState,
  broadcastCommand,
  broadcastChat,
  broadcastChatDay,
  broadcastToUser,
  broadcastPlayerPresence,
  registerPlayer,
  unregisterPlayer,
  playerCount,
  revokeUser,
  revokeDevice,
  controllersRoom,
  playersRoom,
  userRoom,
  chatRoom,
  // Shared listening participants
  joinListeningRoom,
  leaveListeningRoom,
  removeListener,
  listeningParticipants,
  listeningSnapshot,
  broadcastParticipants,
  emitParticipantsTo,
  SHARED_SESSION_KEY,
  CHAT_ROOM,
};
