const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { Op } = require('sequelize');
const env = require('../config/env');
const { sequelize, User, GoogleAuthTicket } = require('../models');
const authService = require('./auth.service');
const { hashToken } = require('../utils/token');

const TICKET_TTL_MS = 5 * 60 * 1000;
const FALLBACK_RETURN_TO = '/dashboard';

function httpError(message, statusCode = 401, code) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (code) error.code = code;
  return error;
}

function isConfigured() {
  return Boolean(env.googleClientId && env.googleClientSecret && env.googleRedirectUri);
}

function getOAuthClient() {
  if (!isConfigured()) {
    throw httpError('Đăng nhập Google chưa được cấu hình.', 503, 'GOOGLE_NOT_CONFIGURED');
  }
  return new OAuth2Client(env.googleClientId, env.googleClientSecret, env.googleRedirectUri);
}

function safeInternalPath(value, fallback = FALLBACK_RETURN_TO) {
  if (typeof value !== 'string' || !value || value.length > 2048) return fallback;
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f]/.test(value)) {
    return fallback;
  }
  try {
    const parsed = new URL(value, 'https://workrank.invalid');
    if (parsed.origin !== 'https://workrank.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function createAuthRequest(returnTo) {
  const state = crypto.randomBytes(32).toString('base64url');
  const nonce = crypto.randomBytes(32).toString('base64url');
  const url = getOAuthClient().generateAuthUrl({
    response_type: 'code',
    scope: ['openid', 'email', 'profile'],
    state,
    nonce,
    prompt: 'select_account',
  });
  return { state, nonce, returnTo: safeInternalPath(returnTo), url };
}

async function verifyGoogleCode(code, expectedNonce) {
  if (!code || typeof code !== 'string' || code.length > 4096) {
    throw httpError('Google không trả về mã xác thực hợp lệ.', 401, 'GOOGLE_INVALID_CODE');
  }

  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw httpError('Google không trả về thông tin đăng nhập hợp lệ.', 401, 'GOOGLE_INVALID_TOKEN');
  }

  const verified = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.googleClientId });
  const payload = verified.getPayload();
  if (!payload || payload.nonce !== expectedNonce || !payload.sub || !payload.email || payload.email_verified !== true) {
    throw httpError('Không xác minh được tài khoản Google. Vui lòng thử lại.', 401, 'GOOGLE_IDENTITY_UNVERIFIED');
  }

  return {
    sub: String(payload.sub),
    email: String(payload.email).trim().toLowerCase(),
    name: String(payload.name || payload.given_name || payload.email).trim().slice(0, 120),
    picture: safeGooglePicture(payload.picture),
  };
}

function safeGooglePicture(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const picture = new URL(value);
    if (picture.protocol !== 'https:' || !/(^|\.)googleusercontent\.com$/i.test(picture.hostname)) return null;
    return picture.toString();
  } catch {
    return null;
  }
}

async function createTicket({ purpose, user, profile, returnTo }, transaction) {
  await GoogleAuthTicket.destroy({ where: { expiresAt: { [Op.lte]: new Date() } }, transaction });
  const ticket = crypto.randomBytes(32).toString('base64url');
  await GoogleAuthTicket.create({
    tokenHash: hashToken(ticket),
    purpose,
    userId: user.id,
    googleSub: profile.sub,
    googleEmail: profile.email,
    googleName: profile.name,
    googlePicture: profile.picture,
    returnTo: safeInternalPath(returnTo),
    expiresAt: new Date(Date.now() + TICKET_TTL_MS),
  }, transaction ? { transaction } : {});
  return ticket;
}

function isUniqueConstraintError(error) {
  return error?.name === 'SequelizeUniqueConstraintError' || error?.original?.code === 'SQLITE_CONSTRAINT_UNIQUE';
}

async function issueTicketForExistingUser(profile, returnTo, user) {
  if (user.status !== 'active') throw httpError(authService.ACCOUNT_LOCKED_MESSAGE, 403, 'ACCOUNT_LOCKED');
  const purpose = user.googleSub === profile.sub ? 'login' : 'link';
  const ticket = await createTicket({ purpose, user, profile, returnTo });
  return { ticket };
}

async function beginVerifiedGoogleLogin(profile, returnTo = FALLBACK_RETURN_TO) {
  if (!profile?.sub || !profile?.email) {
    throw httpError('Thông tin Google không đầy đủ.', 401, 'GOOGLE_IDENTITY_UNVERIFIED');
  }
  const normalizedProfile = {
    sub: String(profile.sub),
    email: String(profile.email).trim().toLowerCase(),
    name: String(profile.name || profile.email).trim().slice(0, 120),
    picture: safeGooglePicture(profile.picture),
  };
  const safeReturnToPath = safeInternalPath(returnTo);

  let user = await User.unscoped().findOne({ where: { googleSub: normalizedProfile.sub } });
  if (user) return issueTicketForExistingUser(normalizedProfile, safeReturnToPath, user);

  user = await User.findOne({ where: { email: normalizedProfile.email } });
  if (user) return issueTicketForExistingUser(normalizedProfile, safeReturnToPath, user);

  const randomPassword = crypto.randomBytes(48).toString('base64url');
  const passwordHash = await bcrypt.hash(randomPassword, env.bcryptRounds);
  try {
    user = await User.create({
      name: normalizedProfile.name || normalizedProfile.email.split('@')[0],
      email: normalizedProfile.email,
      passwordHash,
      googleSub: normalizedProfile.sub,
      avatarUrl: normalizedProfile.picture,
      jobTitle: null,
       department: null,
       profileStatus: 'incomplete',
       role: 'user',
    });
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // The unique Google subject and email constraints select one winner for simultaneous first sign-ins.
    user = await User.unscoped().findOne({ where: { googleSub: normalizedProfile.sub } });
    if (!user) user = await User.findOne({ where: { email: normalizedProfile.email } });
    if (!user) throw error;
  }

  return issueTicketForExistingUser(normalizedProfile, safeReturnToPath, user);
}

function validateTicketInput(ticket) {
  if (typeof ticket !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
    throw httpError('Phiên xác thực Google không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.', 401, 'GOOGLE_TICKET_INVALID');
  }
}

async function exchangeTicket(ticketValue) {
  validateTicketInput(ticketValue);
  const ticketHash = hashToken(ticketValue);
  let linkRequired = null;
  let login = null;

  await sequelize.transaction(async (transaction) => {
    const ticket = await GoogleAuthTicket.findOne({
      where: { tokenHash: ticketHash, expiresAt: { [Op.gt]: new Date() } },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ticket) throw httpError('Phiên xác thực Google đã hết hạn. Vui lòng đăng nhập lại.', 401, 'GOOGLE_TICKET_EXPIRED');

    if (ticket.purpose === 'link') {
      linkRequired = { linkRequired: true, linkTicket: ticketValue, email: ticket.googleEmail };
      return;
    }
    if (ticket.purpose !== 'login') throw httpError('Phiên xác thực Google không hợp lệ.', 401, 'GOOGLE_TICKET_INVALID');

    const user = await User.unscoped().findByPk(ticket.userId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!user || user.googleSub !== ticket.googleSub) {
      throw httpError('Không tìm thấy tài khoản WorkRank cho phiên Google này.', 401, 'GOOGLE_ACCOUNT_NOT_FOUND');
    }
    if (user.status !== 'active') throw httpError(authService.ACCOUNT_LOCKED_MESSAGE, 403, 'ACCOUNT_LOCKED');

    login = { user, redirectTo: safeInternalPath(ticket.returnTo) };
    await ticket.destroy({ transaction });
  });

  if (linkRequired) return linkRequired;
  return { ...await authService.issueTokens(login.user), redirectTo: login.redirectTo };
}

async function completeAccountLink(ticketValue, password) {
  validateTicketInput(ticketValue);
  if (typeof password !== 'string' || !password || password.length > 128) {
    throw httpError('Nhập mật khẩu hiện tại của tài khoản WorkRank để xác minh.', 400, 'WORKRANK_PASSWORD_REQUIRED');
  }

  let linked = null;
  try {
    await sequelize.transaction(async (transaction) => {
      const ticket = await GoogleAuthTicket.findOne({
        where: { tokenHash: hashToken(ticketValue), purpose: 'link', expiresAt: { [Op.gt]: new Date() } },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!ticket) throw httpError('Yêu cầu liên kết đã hết hạn. Hãy bắt đầu lại bằng Google.', 401, 'GOOGLE_LINK_EXPIRED');

      const user = await User.unscoped().findByPk(ticket.userId, { transaction, lock: transaction.LOCK.UPDATE });
      if (!user || String(user.email).toLowerCase() !== ticket.googleEmail) {
        throw httpError('Email tài khoản đã thay đổi. Hãy đăng nhập lại để liên kết Google.', 409, 'GOOGLE_LINK_EMAIL_CHANGED');
      }
      if (user.status !== 'active') throw httpError(authService.ACCOUNT_LOCKED_MESSAGE, 403, 'ACCOUNT_LOCKED');
      if (user.googleSub && user.googleSub !== ticket.googleSub) {
        throw httpError('Tài khoản WorkRank này đã liên kết với một tài khoản Google khác.', 409, 'GOOGLE_ACCOUNT_ALREADY_LINKED');
      }
      const validPassword = await bcrypt.compare(password, user.passwordHash);
      if (!validPassword) throw httpError('Mật khẩu tài khoản WorkRank không chính xác.', 401, 'WORKRANK_PASSWORD_INVALID');

      if (!user.googleSub) {
        try {
          await user.update({ googleSub: ticket.googleSub }, { transaction });
        } catch (error) {
          if (isUniqueConstraintError(error)) {
            throw httpError('Tài khoản Google này đã liên kết với một tài khoản WorkRank khác.', 409, 'GOOGLE_ACCOUNT_ALREADY_LINKED');
          }
          throw error;
        }
      }
      linked = { user, redirectTo: safeInternalPath(ticket.returnTo) };
      await ticket.destroy({ transaction });
    });
  } catch (error) {
    throw error;
  }

  return { ...await authService.issueTokens(linked.user), redirectTo: linked.redirectTo };
}

module.exports = {
  isConfigured,
  createAuthRequest,
  verifyGoogleCode,
  beginVerifiedGoogleLogin,
  exchangeTicket,
  completeAccountLink,
  safeInternalPath,
};
