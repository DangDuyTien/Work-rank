const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { User, UserProfilePreference } = require('../models');
const { signAccessToken, signRefreshToken } = require('../utils/token');
const sanitizeUser = require('../utils/sanitizeUser');

async function userPayload(user) {
  const payload = sanitizeUser(user);
  const preference = await UserProfilePreference.findByPk(user.id);
  return {
    ...payload,
    avatarData: preference?.avatarData || null,
  };
}

async function issueTokens(user) {
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  await user.update({ lastSeenAt: new Date() });
  return { accessToken, refreshToken, user: await userPayload(user) };
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
  try {
    const payload = jwt.verify(refreshToken, env.refreshTokenSecret);
    const user = await User.findByPk(payload.sub);
    if (!user || user.status !== 'active') {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }
    return issueTokens(user);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }
}

async function logout(user) {
  // To implement true global logout, we would bump a tokenVersion here.
  // For now, removing the token from the client is sufficient for standard logout.
  await user.update({ lastSeenAt: new Date() });
}

async function updateProfile(user, payload = {}) {
  const updates = {};
  const name = String(payload.name || '').trim();
  const email = String(payload.email || '').trim().toLowerCase();

  if (name) updates.name = name;
  if (email && email !== String(user.email || '').toLowerCase()) {
    const existing = await User.findOne({
      where: {
        email,
        id: { [Op.ne]: user.id },
      },
    });
    if (existing) {
      const error = new Error('Email already registered');
      error.statusCode = 409;
      throw error;
    }
    updates.email = email;
  }

  if (!Object.keys(updates).length) return { user: await userPayload(user) };
  await user.update(updates);
  return { user: await userPayload(user) };
}

async function changePassword(user, { currentPassword, newPassword }) {
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const error = new Error('Current password is incorrect');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await user.update({ passwordHash, lastSeenAt: new Date() });
  return { ok: true };
}

module.exports = { register, login, refresh, logout, updateProfile, changePassword, userPayload };
