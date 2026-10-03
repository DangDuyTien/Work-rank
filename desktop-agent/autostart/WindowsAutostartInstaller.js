'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class WindowsAutostartInstaller {
  static getStartupDir() {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
  }

  static getVbsLauncherPath() {
    return path.join(this.getStartupDir(), 'WorkRankAgent.vbs');
  }

  static generateVbsContent(nodeExe, scriptPath) {
    const scriptDir = path.dirname(scriptPath);
    // 0 = hide window completely (runs silently in background)
    return `Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "${scriptDir.replace(/"/g, '""')}"
WshShell.Run """${nodeExe}"" ""${scriptPath}"" --daemon", 0, False
Set WshShell = Nothing
`;
  }

  static install() {
    if (process.platform !== 'win32') {
      return { success: false, message: 'WindowsAutostartInstaller is only for Windows OS.' };
    }

    try {
      const startupDir = this.getStartupDir();
      if (!fs.existsSync(startupDir)) {
        fs.mkdirSync(startupDir, { recursive: true });
      }

      const nodeExe = process.execPath;
      const scriptPath = path.resolve(__dirname, '..', 'index.js');
      const vbsPath = this.getVbsLauncherPath();
      const content = this.generateVbsContent(nodeExe, scriptPath);

      fs.writeFileSync(vbsPath, content, 'utf8');

      // Also register in Windows Registry for resilience
      try {
        const regCmd = `reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WorkRankAgent" /t REG_SZ /d "wscript.exe \\"${vbsPath}\\"" /f`;
        execSync(regCmd, { stdio: 'ignore' });
      } catch (e) {
        // Ignored if registry write lacks permissions
      }

      return {
        success: true,
        launcherPath: vbsPath,
        message: 'Windows Autostart registered successfully (silent background mode).',
      };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  static uninstall() {
    if (process.platform !== 'win32') {
      return { success: false, message: 'Only for Windows OS.' };
    }

    try {
      const vbsPath = this.getVbsLauncherPath();
      if (fs.existsSync(vbsPath)) {
        fs.unlinkSync(vbsPath);
      }

      try {
        execSync('reg delete "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "WorkRankAgent" /f', { stdio: 'ignore' });
      } catch (e) {
        // Ignored
      }

      return { success: true, message: 'Windows Autostart removed successfully.' };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }

  static status() {
    if (process.platform !== 'win32') {
      return { installed: false, platform: process.platform };
    }
    const vbsPath = this.getVbsLauncherPath();
    const installed = fs.existsSync(vbsPath);
    return { installed, launcherPath: vbsPath, platform: 'win32' };
  }
}

module.exports = WindowsAutostartInstaller;
