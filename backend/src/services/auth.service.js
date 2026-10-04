const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { User, UserProfilePreference } = require('../models');
const { signAccessToken, signRefreshToken } = require('../utils/token');
const sanitizeUser = require('../utils/sanitizeUser');

const ACCOUNT_LOCKED_MESSAGE = 'Tài khoản đã bị khóa. Inbox Facebook để được mở nếu đây là lỗi.';

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
  const normalizedIdentifier = String(email || '').trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalizedIdentifier } });
  if (existing) {
    const error = new Error('Tài khoản hoặc email này đã tồn tại');
    error.statusCode = 409;
    throw error;
  }
  const passwordHash = await bcrypt.hash(password, env.bcryptRounds);
  const user = await User.create({ name, email: normalizedIdentifier, passwordHash, teamId: teamId || null, role: 'user' });
  return issueTokens(user);
}

async function login({ email, password }) {
  const loginKey = String(email || '').trim().toLowerCase();
  const user = await User.findOne({
    where: {
      [Op.or]: [
        { email: loginKey },
        { email: { [Op.like]: `${loginKey}@%` } },
        { name: loginKey },
      ],
    },
  });

  if (user && user.status !== 'active') {
    const error = new Error(ACCOUNT_LOCKED_MESSAGE);
    error.statusCode = 403;
    throw error;
  }
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!valid) {
    const error = new Error('Tài khoản hoặc mật khẩu không chính xác');
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
    if (!user) {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }
    if (user.status !== 'active') {
      const error = new Error(ACCOUNT_LOCKED_MESSAGE);
      error.statusCode = 403;
      throw error;
    }
    return issueTokens(user);
  } catch (err) {
    if (err.statusCode === 403) throw err;
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
    const error = new Error('Mật khẩu hiện tại không chính xác');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  await user.update({ passwordHash, lastSeenAt: new Date() });
  return { ok: true, message: 'Đổi mật khẩu thành công.' };
}

async function changeEmail(user, { newEmail, currentPassword }) {
  if (!currentPassword) {
    const error = new Error('Vui lòng nhập mật khẩu hiện tại để xác thực đổi email');
    error.statusCode = 400;
    throw error;
  }
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const error = new Error('Mật khẩu hiện tại không chính xác');
    error.statusCode = 400;
    throw error;
  }

  const normalizedNewEmail = String(newEmail || '').trim().toLowerCase();
  if (!normalizedNewEmail) {
    const error = new Error('Email mới không được để trống');
    error.statusCode = 400;
    throw error;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalizedNewEmail)) {
    const error = new Error('Định dạng email mới không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  const currentEmail = String(user.email || '').trim().toLowerCase();
  if (normalizedNewEmail === currentEmail) {
    const error = new Error('Email mới không được trùng với email hiện tại');
    error.statusCode = 400;
    throw error;
  }

  const existing = await User.findOne({
    where: {
      email: normalizedNewEmail,
      id: { [Op.ne]: user.id },
    },
  });
  if (existing) {
    const error = new Error('Email này đã được sử dụng bởi một tài khoản khác');
    error.statusCode = 409;
    throw error;
  }

  try {
    await user.update({
      email: normalizedNewEmail,
      lastSeenAt: new Date(),
    });
  } catch (dbErr) {
    if (dbErr.name === 'SequelizeUniqueConstraintError') {
      const error = new Error('Email này đã được sử dụng bởi một tài khoản khác');
      error.statusCode = 409;
      throw error;
    }
    throw dbErr;
  }

  const tokens = await issueTokens(user);
  return {
    success: true,
    message: 'Đổi email thành công.',
    ...tokens,
  };
}

module.exports = { register, login, refresh, logout, updateProfile, changePassword, changeEmail, userPayload };
