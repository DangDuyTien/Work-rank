const PRESENCE_TTL_MS = 90_000;

const simulatedPresenceByUser = new Map();

function now() {
  return Date.now();
}

function setStatus(userId, status = 'offline', options = {}) {
  const id = String(userId || '');
  if (!id) return;

  if (status === 'offline') {
    simulatedPresenceByUser.delete(id);
    return;
  }

  simulatedPresenceByUser.set(id, {
    status: ['active', 'online', 'idle'].includes(status) ? status : 'online',
    updatedAt: now(),
    expiresAt: now() + Number(options.ttlMs || PRESENCE_TTL_MS),
  });
}

function getStatus(userId) {
  const id = String(userId || '');
  const entry = simulatedPresenceByUser.get(id);
  if (!entry) return 'offline';

  if (entry.expiresAt <= now()) {
    simulatedPresenceByUser.delete(id);
    return 'offline';
  }

  return entry.status;
}

function clear() {
  simulatedPresenceByUser.clear();
}

function activeCount() {
  let count = 0;
  for (const id of simulatedPresenceByUser.keys()) {
    if (getStatus(id) !== 'offline') count += 1;
  }
  return count;
}

function activeUserIds() {
  const ids = [];
  for (const id of simulatedPresenceByUser.keys()) {
    if (getStatus(id) !== 'offline') ids.push(id);
  }
  return ids;
}

module.exports = {
  activeCount,
  activeUserIds,
  clear,
  getStatus,
  setStatus,
};
