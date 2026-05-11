const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false });
const activityLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5000, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10000, standardHeaders: true, legacyHeaders: false });

module.exports = { authLimiter, activityLimiter, apiLimiter };
