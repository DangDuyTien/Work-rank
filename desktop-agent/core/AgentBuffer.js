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
   * Send HTTP POST to backend
   */
  _sendPost(urlStr, token, data) {
    return new Promise((resolve, reject) => {
      const url = new URL(urlStr);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const body = JSON.stringify(data);
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: `Bearer ${token}`,
        },
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
            reject(new Error(`Server returned HTTP ${res.statusCode}: ${respData}`));
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
   * Flush pending events to backend
   */
  async flush() {
    if (this.isFlushing) return;
    this.isFlushing = true;

    try {
      this.commitCurrentBatch();

      const token = this.getToken();
      if (!token) {
        // Not paired/logged in yet: save to offline buffer if needed, wait for pairing
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
      await this._sendPost(targetUrl, token, payload);

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
