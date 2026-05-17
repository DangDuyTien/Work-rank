const OFFLINE_GRACE_MS = 15_000;

const presenceByUser = new Map();

function userIdOf(userOrId) {
  return String(typeof userOrId === 'object' ? userOrId.id : userOrId);
}

function snapshotUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    teamId: user.teamId,
  };
}

function getPresence(user) {
  const userId = userIdOf(user);
  if (!presenceByUser.has(userId)) {
    presenceByUser.set(userId, {
      sockets: new Set(),
      socketTypes: new Map(),
      status: 'online',
      offlineTimer: null,
      user: typeof user === 'object' ? snapshotUser(user) : { id: user },
    });
  }
  const state = presenceByUser.get(userId);
  if (typeof user === 'object') state.user = snapshotUser(user);
  return state;
}

function addSocket(user, socketId, clientType = 'web') {
  const state = getPresence(user);
  state.sockets.add(socketId);
  state.socketTypes.set(socketId, clientType || 'web');

  if (state.offlineTimer) {
    clearTimeout(state.offlineTimer);
    state.offlineTimer = null;
  }

  if (state.status === 'offline') state.status = 'online';
  return state;
}

function setStatus(user, status = 'online') {
  const state = getPresence(user);
  state.status = ['active', 'online', 'idle', 'offline'].includes(status) ? status : 'online';
  return state;
}

function removeSocket(user, socketId, onOffline) {
  const state = getPresence(user);
  state.sockets.delete(socketId);
  state.socketTypes.delete(socketId);

  if (state.sockets.size === 0) {
    state.offlineTimer = setTimeout(() => {
      if (state.sockets.size === 0) {
        state.status = 'offline';
        if (typeof onOffline === 'function') onOffline(state.user);
      }
    }, OFFLINE_GRACE_MS);
  }

  return state;
}

function getStatus(userOrId) {
  const state = presenceByUser.get(userIdOf(userOrId));
  if (!state || state.sockets.size === 0) return 'offline';
  return state.status || 'online';
}

function hasClientType(userOrId, clientType) {
  const state = presenceByUser.get(userIdOf(userOrId));
  if (!state) return false;
  return Array.from(state.socketTypes.values()).includes(clientType);
}

function socketCount(userOrId) {
  const state = presenceByUser.get(userIdOf(userOrId));
  return state ? state.sockets.size : 0;
}

function activeUserIds() {
  return Array.from(presenceByUser.entries())
    .filter(([, state]) => state.sockets.size > 0 && state.status !== 'offline')
    .map(([userId]) => userId);
}

module.exports = {
  activeUserIds,
  addSocket,
  getPresence,
  getStatus,
  hasClientType,
  removeSocket,
  setStatus,
  socketCount,
};
