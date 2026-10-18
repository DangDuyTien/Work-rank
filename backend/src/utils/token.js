const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user, sessionId = crypto.randomUUID()) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      teamId: user.teamId,
      tokenVersion: Number(user?.tokenVersion || 0),
      jti: sessionId,
    },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn },
  );
}

function signRefreshToken(user, sessionId = crypto.randomUUID()) {
  return jwt.sign(
    { sub: user.id, tokenType: 'refresh', tokenVersion: Number(user?.tokenVersion || 0), jti: sessionId },
    env.refreshTokenSecret,
    {
      expiresIn: env.refreshTokenExpiresIn,
    }
  );
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, hashToken };
