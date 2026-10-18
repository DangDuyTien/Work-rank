const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { User, UserProfilePreference } = require('../models');
const competitionRealtime = require('./competition/competitionRealtime.service');
const { signAccessToken, signRefreshToken } = require('../utils/token');
const sanitizeUser = require('../utils/sanitizeUser');
const { normalizeJobTitle, normalizeDepartment } = require('../config/employeeProfile');

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
  const sessionId = require('crypto').randomUUID();
  const accessToken = signAccessToken(user, sessionId);
  const refreshToken = signRefreshToken(user, sessionId);
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
    const tokenVersion = Number(payload.tokenVersion ?? 0);
    const currentVersion = Number(user.tokenVersion ?? 0);
    if (tokenVersion !== currentVersion) {
      const error = new Error('Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi.');
      error.statusCode = 401;
      throw error;
    }
    return issueTokens(user);
  } catch (err) {
    if (err.statusCode === 403) throw err;
    if (err.statusCode === 401) throw err;
    const error = new Error('Invalid or expired refresh token');
    error.statusCode = 401;
    throw error;
  }
}

async function logout(user) {
  const nextTokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.update({ tokenVersion: nextTokenVersion, lastSeenAt: new Date() });
  user.tokenVersion = nextTokenVersion;
  try {
    const io = competitionRealtime.getIo();
    if (io) {
      const registerSockets = require('../sockets');
      if (typeof registerSockets.evictUserSockets === 'function') {
        registerSockets.evictUserSockets(io, user.id, 'Đã đăng xuất.');
      } else {
        io.to(`user:${user.id}`).emit('auth:revoked', { message: 'Đã đăng xuất.' });
      }
    }
  } catch (ioErr) {
    // Sockets might not be initialized in test environment
  }
}

async function updateProfile(user, payload = {}) {
  const updates = {};
  const name = String(payload.name || '').trim();
  if (name) updates.name = name;
  if (payload.jobTitle !== undefined) {
    const jobTitle = normalizeJobTitle(payload.jobTitle);
    if (!jobTitle) { const error = new Error('Chức danh không hợp lệ'); error.statusCode = 400; throw error; }
    updates.jobTitle = jobTitle;
  }
  if (payload.department !== undefined) {
    const department = normalizeDepartment(payload.department);
    if (!department) { const error = new Error('Phòng ban không hợp lệ'); error.statusCode = 400; throw error; }
    updates.department = department;
  }
  const hasEmployeeFields = updates.jobTitle !== undefined || updates.department !== undefined;
  if (hasEmployeeFields) {
    if (user.profileStatus === 'complete') {
      const error = new Error('Hồ sơ đã hoàn tất. Chức danh và phòng ban do Admin quản lý.');
      error.statusCode = 403;
      throw error;
    }
    if (!updates.jobTitle || !updates.department) {
      const error = new Error('Vui lòng chọn đầy đủ chức danh và phòng ban.');
      error.statusCode = 400;
      throw error;
    }
    updates.profileStatus = 'complete';
  }

  if (!Object.keys(updates).length) return { user: await userPayload(user) };
  await user.update(updates);
  return { user: await userPayload(user) };
}

async function changePassword(user, { currentPassword, newPassword }, { sessionId } = {}) {
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    const error = new Error('Mật khẩu hiện tại không chính xác');
    error.statusCode = 400;
    throw error;
  }

  const passwordHash = await bcrypt.hash(newPassword, env.bcryptRounds);
  const nextTokenVersion = Number(user.tokenVersion || 0) + 1;
  await user.update({
    passwordHash,
    tokenVersion: nextTokenVersion,
    lastSeenAt: new Date(),
  });
  user.tokenVersion = nextTokenVersion;

  try {
    const io = competitionRealtime.getIo();
    if (io) {
      const registerSockets = require('../sockets');
      if (typeof registerSockets.evictUserSockets === 'function') {
        registerSockets.evictUserSockets(io, user.id, 'Mật khẩu đã được thay đổi.', { excludeSessionId: sessionId });
      } else {
        const registerSockets = require('../sockets');
      if (typeof registerSockets.evictUserSockets === 'function') {
        registerSockets.evictUserSockets(io, user.id, 'Mật khẩu đã được thay đổi.', { excludeSessionId: sessionId });
      } else {
        io.to(`user:${user.id}`).emit('auth:revoked', { message: 'Mật khẩu đã được thay đổi.' });
      }
      }
    }
  } catch (ioErr) {
    // Sockets might not be initialized in test environment
  }

  const tokens = await issueTokens(user);
  return { ok: true, message: 'Đổi mật khẩu thành công.', ...tokens };
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

module.exports = {
  register,
  login,
  refresh,
  logout,
  updateProfile,
  changePassword,
  changeEmail,
  userPayload,
  issueTokens,
  ACCOUNT_LOCKED_MESSAGE,
};
