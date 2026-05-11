const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const { signAccessToken, signRefreshToken, hashToken } = require('../utils/token');
const sanitizeUser = require('../utils/sanitizeUser');

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await user.update({ refreshTokenHash: hashToken(refreshToken), lastSeenAt: new Date() });
  return { accessToken, refreshToken, user: sanitizeUser(user) };
}

async function register({ name, email, password, teamId }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    const error = new Error('Email already registered');
    error.statusCode = 409;
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await User.create({ name, email, passwordHash, teamId: teamId || null, role: 'user' });
  return issueTokens(user);
}

async function login({ email, password }) {
  const user = await User.findOne({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) {
    const error = new Error('Invalid email or password');
    error.statusCode = 401;
    throw error;
  }
  return issueTokens(user);
}

async function refresh(refreshToken) {
  if (!refreshToken) {
    const error = new Error('Missing refresh token');
    error.statusCode = 401;
    throw error;
  }
  const payload = jwt.verify(refreshToken, env.refreshTokenSecret);
  const user = await User.findByPk(payload.sub);
  if (!user || user.refreshTokenHash !== hashToken(refreshToken)) {
    const error = new Error('Invalid refresh token');
    error.statusCode = 401;
    throw error;
  }
  return issueTokens(user);
}

async function logout(user) {
  await user.update({ refreshTokenHash: null });
}

module.exports = { register, login, refresh, logout };
