'use strict';

const path = require('path');
const { spawn, exec } = require('child_process');
const ComputerActivityProvider = require('./ComputerActivityProvider');

/**
 * Categorize applications by their OS process/bundle name
 */
function categorizeApp(appName) {
  if (!appName) return 'OTHER';
  const name = appName.toLowerCase();

  // Development
  if (
    name.includes('code') ||
    name.includes('cursor') ||
    name.includes('sublime') ||
    name.includes('intellij') ||
    name.includes('webstorm') ||
    name.includes('pycharm') ||
    name.includes('xcode') ||
    name.includes('terminal') ||
    name.includes('iterm') ||
    name.includes('warp') ||
    name.includes('alacritty') ||
    name.includes('ghostty') ||
    name.includes('docker') ||
    name.includes('gitkraken')
  ) {
    return 'DEVELOPMENT';
  }

  // Design & Video Editing
  if (
    name.includes('premiere') ||
    name.includes('after effects') ||
    name.includes('photoshop') ||
    name.includes('illustrator') ||
    name.includes('final cut') ||
    name.includes('davinci') ||
    name.includes('figma') ||
    name.includes('blender') ||
    name.includes('capcut') ||
    name.includes('lightroom')
  ) {
    return 'DESIGN_VIDEO';
  }

  // Browsers
  if (
    name.includes('chrome') ||
    name.includes('brave') ||
    name.includes('arc') ||
    name.includes('safari') ||
    name.includes('edge') ||
    name.includes('firefox') ||
    name.includes('opera') ||
    name.includes('vivaldi')
  ) {
    return 'BROWSER';
  }

  // Office & Productivity / Chat
  if (
    name.includes('word') ||
    name.includes('excel') ||
    name.includes('powerpoint') ||
    name.includes('pages') ||
    name.includes('numbers') ||
    name.includes('keynote') ||
    name.includes('notion') ||
    name.includes('obsidian') ||
    name.includes('slack') ||
    name.includes('discord') ||
    name.includes('telegram') ||
    name.includes('zalo') ||
    name.includes('teams') ||
    name.includes('mail') ||
    name.includes('outlook')
  ) {
    return 'OFFICE';
  }

  // System
  if (
    name.includes('finder') ||
    name.includes('system settings') ||
    name.includes('system preferences') ||
    name.includes('activity monitor')
  ) {
    return 'SYSTEM';
  }

  return 'OTHER';
}

class MacOSProvider extends ComputerActivityProvider {
  constructor(options = {}) {
    super(options);
    this.platform = 'macos';
    this.lastIdleCheck = 0;
    this.lastApp = 'Unknown';
    this.lastCategory = 'OTHER';
    this.currentState = 'ACTIVE';

    this.accumulatedClicks = 0;
    this.accumulatedKeys = 0;

    this.pythonProcess = null;
    this.lineBuffer = '';
    this.isStopping = false;
  }

  async start() {
    this.isStopping = false;
    this._startPythonStream();
  }

  async stop() {
    this.isStopping = true;
    if (this.pythonProcess) {
      try {
        this.pythonProcess.kill('SIGTERM');
      } catch {}
      this.pythonProcess = null;
    }
  }

  _startPythonStream() {
    if (this.isStopping) return;

    const scriptPath = path.resolve(__dirname, 'macos-tracker.py');
    try {
      this.pythonProcess = spawn('python3', ['-u', scriptPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.pythonProcess.stdout.on('data', (data) => {
        this.lineBuffer += data.toString('utf8');
        const lines = this.lineBuffer.split(/\r?\n/);
        this.lineBuffer = lines.pop(); // Keep incomplete tail

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this._processStreamLine(trimmed);
        }
      });

      this.pythonProcess.stderr.on('data', () => {
        // Silently swallow python logs
      });

      this.pythonProcess.on('exit', () => {
        this.pythonProcess = null;
        if (!this.isStopping) {
          setTimeout(() => this._startPythonStream(), 2000);
        }
      });

      this.pythonProcess.on('error', (err) => {
        console.warn('[MacOSProvider] Python tracker spawn error:', err.message);
        this.pythonProcess = null;
      });
    } catch (err) {
      console.warn('[MacOSProvider] Failed to spawn Python tracker:', err.message);
    }
  }

  _processStreamLine(line) {
    const parts = line.split('|');
    if (parts.length >= 2) {
      const idleSecs = parseInt(parts[0], 10);
      const rawApp = parts[1];
      const clicks = parts.length >= 3 ? parseInt(parts[2], 10) || 0 : 0;
      const keys = parts.length >= 4 ? parseInt(parts[3], 10) || 0 : 0;

      if (!isNaN(idleSecs)) {
        this.lastIdleCheck = Math.max(0, idleSecs);
        this.currentState = this.lastIdleCheck >= this.idleThresholdSeconds ? 'IDLE' : 'ACTIVE';
      }

      if (rawApp) {
        this.lastApp = rawApp;
        this.lastCategory = categorizeApp(rawApp);
      }

      this.accumulatedClicks += clicks;
      this.accumulatedKeys += keys;
    }
  }

  /**
   * Run a fallback shell command returning a Promise
   */
  _execCmd(cmd) {
    return new Promise((resolve) => {
      exec(cmd, { timeout: 2000 }, (error, stdout) => {
        if (error) {
          resolve('');
        } else {
          resolve(stdout ? stdout.trim() : '');
        }
      });
    });
  }

  /**
   * Fallback system idle query
   */
  async getSystemIdleSeconds() {
    const output = await this._execCmd(
      "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000)}'"
    );
    const secs = parseInt(output, 10);
    return isNaN(secs) ? 0 : secs;
  }

  /**
   * Take a periodic sample (1-second interval)
   */
  async sample() {
    // If stream is active, consume accumulated deltas
    const clicks = this.accumulatedClicks;
    const keys = this.accumulatedKeys;
    this.accumulatedClicks = 0;
    this.accumulatedKeys = 0;

    return {
      state: this.currentState,
      idleSecondsCurrent: this.lastIdleCheck,
      activeApp: this.lastApp,
      appCategory: this.lastCategory,
      mouseClicks: clicks,
      keyboardCount: keys,
      timestamp: new Date(),
    };
  }
}

module.exports = MacOSProvider;
module.exports.categorizeApp = categorizeApp;
