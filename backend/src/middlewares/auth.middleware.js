const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');

async function auth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Missing access token' });

    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findByPk(payload.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'Invalid user' });
    req.user = user;
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

module.exports = { auth, requireRole };
