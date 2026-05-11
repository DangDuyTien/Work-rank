module.exports = function sanitizeUser(user) {
  if (!user) return null;
  const value = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete value.passwordHash;
  delete value.refreshTokenHash;
  return value;
};
