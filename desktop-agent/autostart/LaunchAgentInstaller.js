'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const PLIST_NAME = 'com.workrank.agent.plist';
const LAUNCH_AGENTS_DIR = path.join(os.homedir(), 'Library', 'LaunchAgents');
const TARGET_PLIST_PATH = path.join(LAUNCH_AGENTS_DIR, PLIST_NAME);

class LaunchAgentInstaller {
  static isMacOS() {
    return process.platform === 'darwin';
  }

  static generatePlistXml(nodePath, scriptPath) {
    const logDir = path.join(os.homedir(), '.workrank');
    const outLog = path.join(logDir, 'agent.out.log');
    const errLog = path.join(logDir, 'agent.err.log');

    return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.workrank.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${scriptPath}</string>
        <string>--daemon</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${outLog}</string>
    <key>StandardErrorPath</key>
    <string>${errLog}</string>
    <key>WorkingDirectory</key>
    <string>${path.dirname(scriptPath)}</string>
</dict>
</plist>
`;
  }

  static install() {
    if (!this.isMacOS()) {
      return { success: false, message: 'Autostart installer currently targets macOS launchd.' };
    }

    try {
      if (!fs.existsSync(LAUNCH_AGENTS_DIR)) {
        fs.mkdirSync(LAUNCH_AGENTS_DIR, { recursive: true });
      }

      const nodePath = process.execPath;
      const scriptPath = path.resolve(__dirname, '..', 'index.js');
      const xml = this.generatePlistXml(nodePath, scriptPath);

      fs.writeFileSync(TARGET_PLIST_PATH, xml, 'utf8');

      // Unload if already loaded, then load
      try {
        execSync(`launchctl unload "${TARGET_PLIST_PATH}" 2>/dev/null || true`);
        execSync(`launchctl load "${TARGET_PLIST_PATH}"`);
      } catch (e) {
        // Ignored
      }

      return {
        success: true,
        plistPath: TARGET_PLIST_PATH,
        message: 'LaunchAgent successfully installed and loaded.',
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  static uninstall() {
    if (!this.isMacOS()) {
      return { success: false, message: 'Autostart uninstaller targets macOS.' };
    }

    try {
      if (fs.existsSync(TARGET_PLIST_PATH)) {
        try {
          execSync(`launchctl unload "${TARGET_PLIST_PATH}" 2>/dev/null || true`);
        } catch (e) {
          // Ignored
        }
        fs.unlinkSync(TARGET_PLIST_PATH);
      }
      return { success: true, message: 'LaunchAgent uninstalled successfully.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  static status() {
    const installed = fs.existsSync(TARGET_PLIST_PATH);
    let loaded = false;
    if (installed) {
      try {
        const out = execSync('launchctl list | grep com.workrank.agent || true', { encoding: 'utf8' });
        loaded = out.includes('com.workrank.agent');
      } catch (e) {
        loaded = false;
      }
    }
    return { installed, loaded, plistPath: TARGET_PLIST_PATH };
  }
}

module.exports = LaunchAgentInstaller;
