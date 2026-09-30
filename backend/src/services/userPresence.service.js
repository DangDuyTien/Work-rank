const presence = require('./presence.service');

function resolveUserPresence(userId) {
  const socketPresence = presence.getStatus(userId);
  if (socketPresence && socketPresence !== 'offline') return socketPresence;
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
