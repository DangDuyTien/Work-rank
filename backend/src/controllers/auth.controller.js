const crypto = require('crypto');
const authService = require('../services/auth.service');
const googleAuthService = require('../services/googleAuth.service');
const userDeletionService = require('../services/userDeletion.service');
const env = require('../config/env');

const GOOGLE_STATE_COOKIE = 'workrank_google_state';
const GOOGLE_NONCE_COOKIE = 'workrank_google_nonce';
const GOOGLE_RETURN_COOKIE = 'workrank_google_return';

function callbackPath() {
  try {
    return new URL(env.googleRedirectUri).pathname;
  } catch {
    return '/api/auth/google/callback';
  }
}

function googleCookieOptions() {
  return {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    path: callbackPath(),
    maxAge: 5 * 60 * 1000,
  };
}

function readCookie(req, name) {
  const pair = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  if (!pair) return null;
  try {
    return decodeURIComponent(pair.slice(name.length + 1));
  } catch {
    return null;
  }
}

function clearGoogleCookies(res) {
  const options = googleCookieOptions();
  delete options.maxAge;
  res.clearCookie(GOOGLE_STATE_COOKIE, options);
  res.clearCookie(GOOGLE_NONCE_COOKIE, options);
  res.clearCookie(GOOGLE_RETURN_COOKIE, options);
}

function loginUrl(authError, returnTo) {
  const baseUrl = String(env.clientUrl || 'http://localhost:5173').split(',')[0].trim();
  const url = new URL('/login', baseUrl);
  url.searchParams.set('authError', authError);
  if (returnTo) url.searchParams.set('returnTo', googleAuthService.safeInternalPath(returnTo));
  return url.toString();
}

function safeEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function startGoogle(req, res) {
  try {
    const request = googleAuthService.createAuthRequest(req.query.returnTo);
    const cookieOptions = googleCookieOptions();
    res.cookie(GOOGLE_STATE_COOKIE, request.state, cookieOptions);
    res.cookie(GOOGLE_NONCE_COOKIE, request.nonce, cookieOptions);
    res.cookie(GOOGLE_RETURN_COOKIE, request.returnTo, cookieOptions);
    return res.redirect(302, request.url);
  } catch (error) {
    const returnTo = googleAuthService.safeInternalPath(req.query.returnTo);
    return res.redirect(302, loginUrl(error.code === 'GOOGLE_NOT_CONFIGURED' ? 'not_configured' : 'google_failed', returnTo));
  }
}

async function googleCallback(req, res) {
  res.set('Cache-Control', 'no-store');
  const stateCookie = readCookie(req, GOOGLE_STATE_COOKIE);
  const nonceCookie = readCookie(req, GOOGLE_NONCE_COOKIE);
  const returnTo = googleAuthService.safeInternalPath(readCookie(req, GOOGLE_RETURN_COOKIE));
  clearGoogleCookies(res);

  if (!safeEqual(req.query.state, stateCookie) || !nonceCookie) {
    return res.redirect(302, loginUrl('invalid_state', returnTo));
  }
  if (req.query.error) {
    return res.redirect(302, loginUrl(req.query.error === 'access_denied' ? 'cancelled' : 'google_failed', returnTo));
  }

  try {
    const profile = await googleAuthService.verifyGoogleCode(req.query.code, nonceCookie);
    const { ticket } = await googleAuthService.beginVerifiedGoogleLogin(profile, returnTo);
    const baseUrl = String(env.clientUrl || 'http://localhost:5173').split(',')[0].trim();
    const callbackUrl = new URL('/auth/google/callback', baseUrl);
    callbackUrl.hash = new URLSearchParams({ ticket }).toString();
    return res.redirect(303, callbackUrl.toString());
  } catch (error) {
    const authError = error.code === 'ACCOUNT_LOCKED' ? 'account_locked' : 'google_failed';
    return res.redirect(302, loginUrl(authError, returnTo));
  }
}

async function exchangeGoogleTicket(req, res) {
  const result = await googleAuthService.exchangeTicket(req.validated.body.ticket);
  res.json(result);
}

async function linkGoogleAccount(req, res) {
  const result = await googleAuthService.completeAccountLink(req.validated.body.ticket, req.validated.body.password);
  res.json(result);
}

async function register(req, res) {
  const result = await authService.register(req.validated.body);
  res.status(201).json(result);
}

async function login(req, res) {
  const result = await authService.login(req.validated.body);
  res.json(result);
}

async function refreshToken(req, res) {
  const result = await authService.refresh(req.validated.body.refreshToken);
  res.json(result);
}

async function logout(req, res) {
  await authService.logout(req.user);
  res.status(204).send();
}

async function me(req, res) {
  res.json({ user: await authService.userPayload(req.user) });
}

async function updateMe(req, res) {
  const result = await authService.updateProfile(req.user, req.validated.body);
  res.json(result);
}

async function changePassword(req, res) {
  const result = await authService.changePassword(req.user, req.validated.body);
  res.json(result);
}

async function changeEmail(req, res) {
  const result = await authService.changeEmail(req.user, req.validated.body);
  res.json(result);
}

async function deleteMe(req, res) {
  const password = req.validated?.body?.password || req.validated?.body?.currentPassword || req.body?.password || req.body?.currentPassword;
  const result = await userDeletionService.deleteUserAccount({
    targetUserId: req.user.id,
    actorUser: req.user,
    isSelfDelete: true,
    password,
    req,
  });
  res.json({ message: 'Tài khoản của bạn đã được xóa thành công.', ...result });
}

module.exports = {
  register,
  login,
  refreshToken,
  logout,
  me,
  updateMe,
  changePassword,
  changeEmail,
  deleteMe,
  startGoogle,
  googleCallback,
  exchangeGoogleTicket,
  linkGoogleAccount,
};
