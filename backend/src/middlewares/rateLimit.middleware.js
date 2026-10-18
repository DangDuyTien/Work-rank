const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: true, legacyHeaders: false });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10000, standardHeaders: true, legacyHeaders: false });
const googleLinkLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({ message: 'Bạn đã thử liên kết quá nhiều lần. Vui lòng đợi 15 phút rồi thử lại.' });
  },
});

module.exports = { authLimiter, apiLimiter, googleLinkLimiter };
