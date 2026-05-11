const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, teamId: user.teamId }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

function signRefreshToken(user) {
  return jwt.sign({ sub: user.id, tokenType: 'refresh' }, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenExpiresIn,
  });
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { signAccessToken, signRefreshToken, hashToken };
