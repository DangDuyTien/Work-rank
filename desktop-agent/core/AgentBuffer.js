'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const https = require('https');

const MAX_OFFLINE_EVENTS = 10000;
const WORKRANK_DIR = path.join(os.homedir(), '.workrank');
const OFFLINE_QUEUE_FILE = path.join(WORKRANK_DIR, 'offline_queue.json');

class AgentBuffer {
  constructor(options = {}) {
    this.batchIntervalSeconds = options.batchIntervalSeconds || 5;
    this.backendUrl = options.backendUrl || 'http://localhost:5001';
    this.getToken = options.getToken || (() => null);
    this.getRefreshToken = options.getRefreshToken || (() => null);
    this.onTokenRefreshed = options.onTokenRefreshed || (() => {});
    this.devicePlatform = options.devicePlatform || (process.platform === 'darwin' ? 'macos' : 'windows');

    this.pendingEvents = [];
    this.currentBatch = {
      activeSeconds: 0,
      idleSeconds: 0,
      mouseClicks: 0,
      keyboardCount: 0,
      appTime: {}, // { appName: seconds }
      appCategory: {}, // { appName: category }
      currentState: 'ACTIVE',
    };
    this.lastSampleTime = Date.now();
    this.isFlushing = false;
    this._refreshingToken = false;

    this._ensureWorkRankDir();
  }

  _ensureWorkRankDir() {
    try {
      if (!fs.existsSync(WORKRANK_DIR)) {
        fs.mkdirSync(WORKRANK_DIR, { recursive: true });
      }
    } catch (err) {
      console.error('[AgentBuffer] Failed to create workrank dir:', err.message);
    }
  }

  /**
   * Load offline queue from disk
   */
  _loadOfflineQueue() {
    try {
      if (fs.existsSync(OFFLINE_QUEUE_FILE)) {
        const raw = fs.readFileSync(OFFLINE_QUEUE_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('[AgentBuffer] Error loading offline queue:', err.message);
    }
    return [];
  }

  /**
   * Save events to offline queue file
   */
  _saveOfflineQueue(events) {
    try {
      this._ensureWorkRankDir();
      const trimmed = events.slice(-MAX_OFFLINE_EVENTS);
      fs.writeFileSync(OFFLINE_QUEUE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
    } catch (err) {
      console.error('[AgentBuffer] Failed to save offline queue:', err.message);
    }
  }

  /**
   * Check if a JWT token is expired (with 60s buffer before actual expiry)
   */
  _isTokenExpired(token) {
    if (!token) return true;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return true;
      const padded = parts[1] + '='.repeat((4 - (parts[1].length % 4)) % 4);
      const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
      const exp = payload.exp || 0;
      // Consider expired 60 seconds before actual expiry to avoid race conditions
      return Math.floor(Date.now() / 1000) >= (exp - 60);
    } catch {
      return true;
    }
  }

  /**
   * Refresh access token using refresh token via backend
   * Returns new access token or null on failure
   */
  async _refreshAccessToken() {
    if (this._refreshingToken) return null; // Prevent concurrent refreshes
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      console.warn('[AgentBuffer] No refresh token available, cannot refresh access token');
      return null;
    }

    this._refreshingToken = true;
    try {
      const result = await this._sendPostRaw(
        `${this.backendUrl}/api/auth/refresh-token`,
        null, // No auth header for refresh
        { refreshToken }
      );
      const parsed = JSON.parse(result.body);
      // Backend /api/auth/refresh-token returns { accessToken, refreshToken, user }
      const newToken = parsed.accessToken || parsed.data?.token || parsed.token;
      if (newToken) {
        console.log('[AgentBuffer] Access token refreshed successfully');
        this.onTokenRefreshed(newToken);
        return newToken;
      }
      console.warn('[AgentBuffer] Refresh response missing token field');
      return null;
    } catch (err) {
      console.warn('[AgentBuffer] Token refresh failed:', err.message);
      return null;
    } finally {
      this._refreshingToken = false;
    }
  }

  /**
   * Send HTTP POST — raw version (no auth header required)
   */
  _sendPostRaw(urlStr, token, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const body = JSON.stringify(data);
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers,
        timeout: 8000,
      };

      const req = client.request(options, (res) => {
        let respData = '';
        res.on('data', (chunk) => {
          respData += chunk;
        });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: respData });
          } else {
            const err = new Error(`Server returned HTTP ${res.statusCode}: ${respData}`);
            err.statusCode = res.statusCode;
            reject(err);
          }
        });
      });

      req.on('error', (err) => reject(err));
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timed out'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Send HTTP POST to backend with automatic token refresh on 401
   */
  async _sendPost(urlStr, token, data) {
    try {
      return await this._sendPostRaw(urlStr, token, data);
    } catch (err) {
      // If 401, try to refresh token and retry once
      if (err.statusCode === 401) {
        console.warn('[AgentBuffer] Got 401, attempting token refresh...');
        const newToken = await this._refreshAccessToken();
        if (newToken) {
          return await this._sendPostRaw(urlStr, newToken, data);
        }
      }
      throw err;
    }
  }

  /**
   * Ingest a 1-second sample from Provider
   */
  addSample(sample) {
    const { state, activeApp, appCategory, mouseClicks = 0, keyboardCount = 0 } = sample;

    this.currentBatch.currentState = state;
    this.currentBatch.mouseClicks = (this.currentBatch.mouseClicks || 0) + (Number(mouseClicks) || 0);
    this.currentBatch.keyboardCount = (this.currentBatch.keyboardCount || 0) + (Number(keyboardCount) || 0);

    if (state === 'ACTIVE') {
      this.currentBatch.activeSeconds += 1;
      const app = activeApp || 'Unknown';
      this.currentBatch.appTime[app] = (this.currentBatch.appTime[app] || 0) + 1;
      this.currentBatch.appCategory[app] = appCategory || 'OTHER';
    } else {
      this.currentBatch.idleSeconds += 1;
    }

    const elapsed = this.currentBatch.activeSeconds + this.currentBatch.idleSeconds;
    if (elapsed >= this.batchIntervalSeconds) {
      this.commitCurrentBatch();
    }
  }

  /**
   * Commit current window into an event
   */
  commitCurrentBatch() {
    if (
      this.currentBatch.activeSeconds === 0 &&
      this.currentBatch.idleSeconds === 0 &&
      this.currentBatch.mouseClicks === 0 &&
      this.currentBatch.keyboardCount === 0
    ) {
      return;
    }

    // Find dominant app during this window
    let dominantApp = 'Finder';
    let maxSeconds = -1;
    for (const [app, secs] of Object.entries(this.currentBatch.appTime)) {
      if (secs > maxSeconds) {
        maxSeconds = secs;
        dominantApp = app;
      }
    }

    const dominantCategory = this.currentBatch.appCategory[dominantApp] || 'OTHER';

    const event = {
      eventId: 'agt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      state: this.currentBatch.currentState,
      activeApp: dominantApp,
      appCategory: dominantCategory,
      context: 'COMPUTER',
      activeSeconds: this.currentBatch.activeSeconds,
      idleSeconds: this.currentBatch.idleSeconds,
      mouseClicks: this.currentBatch.mouseClicks || 0,
      keyboardCount: this.currentBatch.keyboardCount || 0,
      occurredAt: new Date().toISOString(),
    };

    this.pendingEvents.push(event);

    // Reset current batch
    this.currentBatch = {
      activeSeconds: 0,
      idleSeconds: 0,
      mouseClicks: 0,
      keyboardCount: 0,
      appTime: {},
      appCategory: {},
      currentState: this.currentBatch.currentState,
    };
  }

  /**
   * Flush pending events to backend
   */
  async flush() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      this.commitCurrentBatch();

      let token = this.getToken();

      // Auto-refresh token if expired BEFORE attempting flush
      if (this._isTokenExpired(token)) {
        console.log('[AgentBuffer] Access token expired, refreshing before flush...');
        const newToken = await this._refreshAccessToken();
        if (newToken) {
          token = newToken;
        } else {
          // Cannot refresh — save to offline, retry later
          if (this.pendingEvents.length > 0) {
            const offline = this._loadOfflineQueue();
            offline.push(...this.pendingEvents);
            this._saveOfflineQueue(offline);
            this.pendingEvents = [];
          }
          console.warn('[AgentBuffer] Token refresh failed, events saved to offline queue');
          return;
        }
      }

      if (!token) {
        // Not paired/logged in yet
        if (this.pendingEvents.length > 0) {
          const offline = this._loadOfflineQueue();
          offline.push(...this.pendingEvents);
          this._saveOfflineQueue(offline);
          this.pendingEvents = [];
        }
        return;
      }

      // Check if there are offline events to flush
      let eventsToSend = [];
      const offline = this._loadOfflineQueue();
      if (offline.length > 0) {
        eventsToSend = offline.splice(0, 100); // Send in chunks of 100 max
      }

      if (this.pendingEvents.length > 0) {
        eventsToSend.push(...this.pendingEvents.splice(0, 50));
      }

      if (eventsToSend.length === 0) {
        return;
      }

      const payload = {
        sessionId: `agent-${Date.now()}`,
        devicePlatform: this.devicePlatform,
        events: eventsToSend,
      };

      const targetUrl = `${this.backendUrl}/api/activity/computer/batch`;
      const result = await this._sendPost(targetUrl, token, payload);

      // Log success with event count for diagnostics
      try {
        const parsed = JSON.parse(result.body);
        console.log(`[AgentBuffer] Flushed ${eventsToSend.length} events → PTS: ${parsed.activityScore ?? '?'} (clicks: ${parsed.mouseClicks ?? '?'}, keys: ${parsed.keyboardCount ?? '?'})`);
      } catch {
        console.log(`[AgentBuffer] Flushed ${eventsToSend.length} events OK`);
      }

      // Successfully sent! Update remaining offline queue if any
      this._saveOfflineQueue(offline);
    } catch (err) {
      console.warn('[AgentBuffer] Flush failed (will buffer offline):', err.message);
      // Re-queue events to offline queue
      if (this.pendingEvents.length > 0) {
        const offline = this._loadOfflineQueue();
        offline.push(...this.pendingEvents);
        this._saveOfflineQueue(offline);
        this.pendingEvents = [];
      }
    } finally {
      this.isFlushing = false;
    }
  }
}

module.exports = AgentBuffer;
