'use strict';

const path = require('path');
const { spawn, exec } = require('child_process');
const ComputerActivityProvider = require('./ComputerActivityProvider');
const { categorizeApp } = require('./MacOSProvider');

// Map raw Windows process names (exe without extension) to friendly names
const WINDOWS_PROCESS_MAP = {
  chrome: 'Google Chrome',
  msedge: 'Microsoft Edge',
  brave: 'Brave Browser',
  firefox: 'Mozilla Firefox',
  opera: 'Opera',
  code: 'Visual Studio Code',
  devenv: 'Visual Studio',
  idea64: 'IntelliJ IDEA',
  pycharm64: 'PyCharm',
  webstorm64: 'WebStorm',
  cursor: 'Cursor',
  sublime_text: 'Sublime Text',
  adobepremierepro: 'Adobe Premiere Pro',
  premiere: 'Adobe Premiere Pro',
  photoshop: 'Adobe Photoshop',
  afterfx: 'Adobe After Effects',
  illustrator: 'Adobe Illustrator',
  figma: 'Figma',
  blender: 'Blender',
  capcut: 'CapCut',
  winword: 'Microsoft Word',
  excel: 'Microsoft Excel',
  powerpnt: 'Microsoft PowerPoint',
  slack: 'Slack',
  discord: 'Discord',
  telegram: 'Telegram',
  zalo: 'Zalo',
  teams: 'Microsoft Teams',
  notion: 'Notion',
  obsidian: 'Obsidian',
  windowsterminal: 'Windows Terminal',
  cmd: 'Command Prompt',
  powershell: 'PowerShell',
  explorer: 'Windows Explorer',
};

function normalizeWindowsApp(procName) {
  if (!procName) return 'Desktop';
  const clean = procName.trim().replace(/\.exe$/i, '');
  const lower = clean.toLowerCase();
  if (WINDOWS_PROCESS_MAP[lower]) {
    return WINDOWS_PROCESS_MAP[lower];
  }
  return clean;
}

class WindowsProvider extends ComputerActivityProvider {
  constructor(options = {}) {
    super(options);
    this.platform = 'windows';
    this.lastIdleCheck = 0;
    this.lastApp = 'Windows Explorer';
    this.lastCategory = 'SYSTEM';
    this.currentState = 'ACTIVE';

    this.psProcess = null;
    this.lineBuffer = '';
    this.isStopping = false;
  }

  async start() {
    this.isStopping = false;
    this._startPowerShellStream();
  }

  async stop() {
    this.isStopping = true;
    if (this.psProcess) {
      try {
        this.psProcess.kill('SIGTERM');
      } catch (err) {
        // Ignored
      }
      this.psProcess = null;
    }
  }

  /**
   * Spawns persistent powershell process running windows-tracker.ps1
   */
  _startPowerShellStream() {
    if (this.isStopping) return;

    const scriptPath = path.resolve(__dirname, 'windows-tracker.ps1');
    const args = [
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
    ];

    try {
      this.psProcess = spawn('powershell.exe', args, {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      this.psProcess.stdout.on('data', (data) => {
        this.lineBuffer += data.toString('utf8');
        const lines = this.lineBuffer.split(/\r?\n/);
        this.lineBuffer = lines.pop(); // Keep incomplete tail

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          this._processStreamLine(trimmed);
        }
      });

      this.psProcess.stderr.on('data', () => {
        // Silently swallow powershell startup logs
      });

      this.psProcess.on('exit', () => {
        this.psProcess = null;
        if (!this.isStopping) {
          // Restart after 2 seconds if exited unexpectedly
          setTimeout(() => this._startPowerShellStream(), 2000);
        }
      });

      this.psProcess.on('error', (err) => {
        console.warn('[WindowsProvider] PowerShell spawn error:', err.message);
        this.psProcess = null;
      });
    } catch (err) {
      console.warn('[WindowsProvider] Failed to spawn PowerShell tracker:', err.message);
    }
  }

  _processStreamLine(line) {
    const parts = line.split('|');
    if (parts.length >= 2) {
      const idleSecs = parseInt(parts[0], 10);
      const rawProc = parts[1];

      if (!isNaN(idleSecs)) {
        this.lastIdleCheck = Math.max(0, idleSecs);
        this.currentState = this.lastIdleCheck >= this.idleThresholdSeconds ? 'IDLE' : 'ACTIVE';
      }

      const friendlyName = normalizeWindowsApp(rawProc);
      this.lastApp = friendlyName;
      this.lastCategory = categorizeApp(friendlyName);
    }
  }

  /**
   * Take periodic sample
   */
  async sample() {
    return {
      state: this.currentState,
      idleSecondsCurrent: this.lastIdleCheck,
      activeApp: this.lastApp,
      appCategory: this.lastCategory,
      timestamp: new Date(),
    };
  }
}

module.exports = WindowsProvider;
module.exports.normalizeWindowsApp = normalizeWindowsApp;
