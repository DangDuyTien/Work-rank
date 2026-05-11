const env = require('../config/env');

const origins = env.clientUrl.split(',').map((origin) => origin.trim()).filter(Boolean);

module.exports = {
  origin(origin, callback) {
    if (!origin || origins.includes(origin)) return callback(null, true);
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};
