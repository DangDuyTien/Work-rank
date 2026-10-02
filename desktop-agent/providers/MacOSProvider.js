'use strict';

const { exec } = require('child_process');
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
  }

  /**
   * Run a shell command returning a Promise
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
   * Get system idle time in seconds from macOS IOHIDSystem
   */
  async getSystemIdleSeconds() {
    const output = await this._execCmd(
      "ioreg -c IOHIDSystem | awk '/HIDIdleTime/ {print int($NF/1000000000)}'"
    );
    const secs = parseInt(output, 10);
    return isNaN(secs) ? 0 : secs;
  }

  /**
   * Get current frontmost application process name
   */
  async getFrontmostApp() {
    const script = "osascript -e 'tell application \"System Events\" to get name of first application process whose frontmost is true'";
    const appName = await this._execCmd(script);
    return appName || 'Finder';
  }

  /**
   * Take a periodic sample (e.g. 1-second interval)
   */
  async sample() {
    const idleSeconds = await this.getSystemIdleSeconds();
    const isIdle = idleSeconds >= this.idleThresholdSeconds;
    this.currentState = isIdle ? 'IDLE' : 'ACTIVE';

    const activeApp = await this.getFrontmostApp();
    const appCategory = categorizeApp(activeApp);

    this.lastIdleCheck = idleSeconds;
    this.lastApp = activeApp;
    this.lastCategory = appCategory;

    return {
      state: this.currentState,
      idleSecondsCurrent: idleSeconds,
      activeApp,
      appCategory,
      timestamp: new Date(),
    };
  }

  async start() {
    // Warmup sample
    await this.sample();
  }

  async stop() {
    // Cleanup if needed
  }
}

module.exports = MacOSProvider;
module.exports.categorizeApp = categorizeApp;
