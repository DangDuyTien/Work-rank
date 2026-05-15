const env = require('../config/env');

const configuredOrigins = env.clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean);
const devOrigins = env.nodeEnv === 'development'
  ? [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
    ]
  : [];
const origins = new Set([...configuredOrigins, ...devOrigins]);

module.exports = {
  origin(origin, callback) {
    if (!origin || origins.has(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};
