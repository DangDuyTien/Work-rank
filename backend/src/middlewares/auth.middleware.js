const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

const ACCOUNT_LOCKED_MESSAGE = 'Tài khoản đã bị khóa. Inbox Facebook để được mở nếu đây là lỗi.';
const SESSION_REVOKED_MESSAGE = 'Phiên đăng nhập đã hết hạn hoặc đã bị thu hồi.';

function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.jwtSecret);
  if (payload.tokenType === 'refresh') {
    const error = new Error('Invalid access token');
    error.code = 'INVALID_ACCESS_TOKEN';
    throw error;
  }
  return payload;
}

async function findActiveUser(payload) {
  const user = await User.findByPk(payload.sub);
  if (!user) return { error: { status: 401, message: 'Invalid user' } };
  if (user.status !== 'active') return { error: { status: 403, message: ACCOUNT_LOCKED_MESSAGE } };
  if (payload.tokenVersion !== undefined && Number(payload.tokenVersion) !== Number(user.tokenVersion || 0)) {
    return { error: { status: 401, message: SESSION_REVOKED_MESSAGE } };
  }
  return { user };
}

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing access token' });

    const payload = verifyAccessToken(token);
    const result = await findActiveUser(payload);
    if (result.error) return res.status(result.error.status).json({ message: result.error.message });
    req.user = result.user;
    req.authToken = token;
    req.authPayload = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired access token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Forbidden' });
    return next();
  };
}

async function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next();

    const payload = verifyAccessToken(token);
    const result = await findActiveUser(payload);
    if (result.user) req.user = result.user;
    return next();
  } catch {
    return next();
  }
}

module.exports = { auth, requireRole, optionalAuth };
