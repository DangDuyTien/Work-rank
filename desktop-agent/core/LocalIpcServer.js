'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const WORKRANK_DIR = path.join(os.homedir(), '.workrank');
const CONFIG_FILE = path.join(WORKRANK_DIR, 'config.json');

class LocalIpcServer {
  constructor(options = {}) {
    this.port = options.port || 43124;
    this.getStatusData = options.getStatusData || (() => ({}));
    this.onPair = options.onPair || (() => {});
    this.onLogout = options.onLogout || (() => {});
    this.onStartTracking = options.onStartTracking || (() => ({}));
    this.onHeartbeat = options.onHeartbeat || (() => ({}));
    this.onStopTracking = options.onStopTracking || (() => ({}));
    this.server = null;

    this._ensureWorkRankDir();
  }

  _ensureWorkRankDir() {
    try {
      if (!fs.existsSync(WORKRANK_DIR)) {
        fs.mkdirSync(WORKRANK_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[LocalIpcServer] Failed to create workrank dir:', err.message);
    }
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[LocalIpcServer] Error reading config:', err.message);
    }
    return {};
  }

  saveConfig(data) {
    try {
      this._ensureWorkRankDir();
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[LocalIpcServer] Error writing config:', err.message);
    }
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        // Handle CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
          res.writeHead(204);
          res.end();
          return;
        }

        const url = new URL(req.url, `http://127.0.0.1:${this.port}`);

        if (req.method === 'GET' && url.pathname === '/status') {
          const cfg = this.loadConfig();
          const extra = this.getStatusData();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              success: true,
              running: true,
              paired: Boolean(cfg.token),
              user: cfg.user || null,
              backendUrl: cfg.backendUrl || 'http://localhost:5001',
              platform: process.platform,
              ...extra,
            })
          );
          return;
        }

        if (req.method === 'POST' && url.pathname === '/pair') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            try {
              const data = JSON.parse(body || '{}');
              const { token, user, backendUrl } = data;
              if (!token) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Token is required' }));
                return;
              }

              const existing = this.loadConfig();
              const updated = {
                ...existing,
                token,
                user: user || existing.user,
                backendUrl: backendUrl || existing.backendUrl || 'http://localhost:5001',
                pairedAt: new Date().toISOString(),
              };
              this.saveConfig(updated);
              this.onPair(updated);

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: true, message: 'Paired successfully', user: updated.user }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, message: 'Invalid JSON' }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/logout') {
          const cfg = this.loadConfig();
          delete cfg.token;
          delete cfg.user;
          this.saveConfig(cfg);
          this.onLogout();

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: 'Unpaired successfully' }));
          return;
        }

        // Tracking session management from Web UI
        if (req.method === 'POST' && (url.pathname === '/tracking/start' || url.pathname === '/session/start')) {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              if (body) {
                const data = JSON.parse(body);
                if (data.token) {
                  const existing = this.loadConfig();
                  this.saveConfig({
                    ...existing,
                    token: data.token,
                    user: data.user || existing.user,
                    backendUrl: data.backendUrl || existing.backendUrl,
                  });
                }
              }
            } catch {}
            const resData = this.onStartTracking() || {};
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, tracking: true, ...resData }));
          });
          return;
        }

        if (req.method === 'POST' && (url.pathname === '/tracking/heartbeat' || url.pathname === '/session/heartbeat')) {
          const resData = this.onHeartbeat() || {};
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tracking: true, ...resData }));
          return;
        }

        if (req.method === 'POST' && (url.pathname === '/tracking/stop' || url.pathname === '/session/stop')) {
          const resData = this.onStopTracking() || {};
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, tracking: false, ...resData }));
          return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
      });

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`[LocalIpcServer] Port ${this.port} is already in use.`);
        }
        reject(err);
      });

      this.server.listen(this.port, '127.0.0.1', () => {
        console.log(`[LocalIpcServer] Listening on http://127.0.0.1:${this.port}`);
        resolve();
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = LocalIpcServer;
