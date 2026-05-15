const desktopStatus = require('./desktopStatus.service');
const presence = require('./presence.service');
const simulationPresence = require('./simulationPresence.service');

function resolveUserPresence(userId) {
  const desktop = desktopStatus.getStatus(userId);
  const socketPresence = presence.getStatus(userId);
  const simulatedPresence = simulationPresence.getStatus(userId);

  if (desktop.online && desktop.tracking && !desktop.error) return 'active';
  if (socketPresence && socketPresence !== 'offline') return socketPresence;
  if (simulatedPresence && simulatedPresence !== 'offline') return simulatedPresence;
  if (desktop.online) return 'online';
  return 'offline';
}

function decorateUserPresence(user) {
  const plain = user?.toJSON ? user.toJSON() : { ...(user || {}) };
  const currentPresence = resolveUserPresence(plain.id || plain.user_id);
  return {
    ...plain,
    accountStatus: plain.accountStatus || plain.status || 'active',
    presence: currentPresence,
    presenceStatus: currentPresence,
  };
}

module.exports = { decorateUserPresence, resolveUserPresence };
