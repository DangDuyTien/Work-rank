'use strict';

const env = require('../config/env');

function getConfiguredOrigins(clientUrlStr = env.clientUrl) {
  if (!clientUrlStr) return [];
  return clientUrlStr
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

function isAllowedOrigin(origin, options = {}) {
  // Allow requests with no origin (like mobile apps, curl, or server-to-server)
  if (!origin) return true;

  const nodeEnv = options.nodeEnv || env.nodeEnv;
  const configured = options.configuredOrigins || getConfiguredOrigins(options.clientUrl || env.clientUrl);
  const normalizedOrigin = String(origin).trim().replace(/\/+$/, '');

  // 1. Explicitly configured origins (from CLIENT_URL)
  if (configured.includes(normalizedOrigin)) {
    return true;
  }

  // 2. In development or test environments only: allow localhost / 127.0.0.1
  const isDevOrTest = nodeEnv === 'development' || nodeEnv === 'test';
  if (isDevOrTest) {
    try {
      const url = new URL(normalizedOrigin);
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
        return true;
      }
    } catch {
      // Invalid URL format
    }
  }

  return false;
}

module.exports = {
  isAllowedOrigin,
  getConfiguredOrigins,
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS origin not allowed'));
  },
  credentials: true,
};
