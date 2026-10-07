'use strict';

const http = require('http');
const https = require('https');

let keepAliveInterval = null;
let customTargetUrl = null;

/**
 * Dynamically set or update target public URL (e.g. captured from first incoming request)
 * @param {string} url
 */
function setTargetUrl(url) {
  if (url && !customTargetUrl) {
    customTargetUrl = url.trim().replace(/\/+$/, '');
    console.log(`[KeepAlive Worker] Target public URL set to: ${customTargetUrl}`);
  }
}

/**
 * Self-ping Keep-Alive Worker
 * Automatically prevents cloud servers (Render, Koyeb, Glitch, etc.) from sleeping
 * by sending a periodic lightweight HTTP ping every 10-12 minutes.
 */
function startKeepAlive() {
  // If already running or in test environment, skip
  if (keepAliveInterval || process.env.NODE_ENV === 'test') {
    return;
  }

  // Detect target public URL from environment variables or use default Render live URL
  const targetUrl =
    customTargetUrl ||
    process.env.APP_URL ||
    process.env.BACKEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    process.env.SERVER_URL ||
    'https://work3winmedia-c94e.onrender.com';

  // Interval in minutes (default 12 minutes, before Render's 15-minute sleep limit)
  const intervalMinutes = Number(process.env.KEEP_ALIVE_INTERVAL_MINUTES || 12);
  const intervalMs = Math.max(1, intervalMinutes) * 60 * 1000;

  console.log(`[KeepAlive Worker] Active: Sending keep-alive pings to ${targetUrl}/health every ${intervalMinutes} minutes.`);

  const ping = () => {
    try {
      const fullUrl = targetUrl.endsWith('/') ? `${targetUrl}health` : `${targetUrl}/health`;
      const parsedUrl = new URL(fullUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: 'GET',
        headers: {
          'User-Agent': 'WorkRank-KeepAlive-Worker/1.0',
          'Accept': 'application/json',
          'Connection': 'close',
        },
        timeout: 15000,
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            console.log(`[KeepAlive Worker] Self-ping successful: ${fullUrl} [${res.statusCode}] at ${new Date().toLocaleTimeString('vi-VN')}`);
          } else {
            console.warn(`[KeepAlive Worker] Self-ping status ${res.statusCode}: ${body.slice(0, 100)}`);
          }
        });
      });

      req.on('timeout', () => {
        req.destroy(new Error('KeepAlive ping request timed out'));
      });

      req.on('error', (err) => {
        console.warn(`[KeepAlive Worker] Self-ping warning: ${err.message}`);
      });

      req.end();
    } catch (err) {
      console.warn(`[KeepAlive Worker] Ping error: ${err.message}`);
    }
  };

  // First ping after 45 seconds of initial server uptime, then every 12 minutes
  setTimeout(ping, 45 * 1000);
  keepAliveInterval = setInterval(ping, intervalMs);

  if (keepAliveInterval.unref) {
    keepAliveInterval.unref();
  }
}

function stopKeepAlive() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
    console.log('[KeepAlive Worker] Stopped.');
  }
}

module.exports = {
  startKeepAlive,
  stopKeepAlive,
  setTargetUrl,
};
