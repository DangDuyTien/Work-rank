'use strict';

const path = require('path');
const os = require('os');
const MacOSProvider = require('./providers/MacOSProvider');
const WindowsProvider = require('./providers/WindowsProvider');
const AgentBuffer = require('./core/AgentBuffer');
const LocalIpcServer = require('./core/LocalIpcServer');
const LaunchAgentInstaller = require('./autostart/LaunchAgentInstaller');
const WindowsAutostartInstaller = require('./autostart/WindowsAutostartInstaller');

const { isWithinWorkingSchedule, getVietnamTimeParts } = require('./utils/schedule');

const AutostartInstaller = process.platform === 'win32' ? WindowsAutostartInstaller : LaunchAgentInstaller;

// Choose platform provider
function getProvider() {
  if (process.platform === 'darwin') {
    return new MacOSProvider({ idleThresholdSeconds: 120 });
  }
  return new WindowsProvider({ idleThresholdSeconds: 120 });
}

class DesktopAgent {
  constructor() {
    this.provider = getProvider();
    this.lastHeartbeat = 0;

    this.ipcServer = new LocalIpcServer({
      port: 43124,
      getStatusData: () => {
        const isScheduleOpen = isWithinWorkingSchedule();
        const isWebActive = Boolean(this.lastHeartbeat && (Date.now() - this.lastHeartbeat <= 60000));
        const cfg = this.ipcServer.loadConfig();
        const isAuthenticated = Boolean(cfg?.token);

        let trackingState = 'TRACKING_ACTIVE';
        if (!isAuthenticated) {
          trackingState = 'TRACKING_LOGGED_OUT';
        } else if (!isScheduleOpen) {
          trackingState = 'TRACKING_OUTSIDE_SCHEDULE';
        }

        return {
          trackingActive: this.trackingActive,
          trackingState,
          isScheduleOpen,
          isWebActive,
          isAuthenticated,
          platform: process.platform === 'darwin' ? 'macos' : 'windows',
          currentState: this.trackingActive ? this.provider.currentState : 'PAUSED',
          currentApp: this.trackingActive ? this.provider.lastApp : null,
          currentCategory: this.trackingActive ? this.provider.lastCategory : null,
          lastIdleSeconds: this.provider.lastIdleCheck,
          lastHeartbeat: this.lastHeartbeat,
        };
      },
      onPair: (cfg) => {
        console.log(`[DesktopAgent] Paired with user: ${cfg.user?.username || cfg.user?.id}`);
        this.buffer.backendUrl = cfg.backendUrl || this.buffer.backendUrl;
        if (isWithinWorkingSchedule() && cfg.token) {
          this.trackingActive = true;
          console.log('[DesktopAgent] Active in working hours (08:00 - 17:30). Tracking ACTIVE.');
        }
      },
      onLogout: () => {
        console.log('[DesktopAgent] Unpaired / logged out');
        this.stopTracking();
      },
      onStartTracking: () => {
        return this.startTracking();
      },
      onHeartbeat: () => {
        return this.renewHeartbeat();
      },
      onStopTracking: () => {
        return this.stopTracking();
      },
    });

    const initialConfig = this.ipcServer.loadConfig();
    const isPaired = Boolean(initialConfig?.token);
    const inSchedule = isWithinWorkingSchedule();
    this.trackingActive = isPaired && inSchedule;

    this.buffer = new AgentBuffer({
      batchIntervalSeconds: 5,
      backendUrl: initialConfig.backendUrl || 'http://localhost:5001',
      getToken: () => this.ipcServer.loadConfig().token,
      getRefreshToken: () => this.ipcServer.loadConfig().refreshToken,
      onTokenRefreshed: (newToken, newRefreshToken) => {
        // Persist the refreshed access and refresh token back to config file
        try {
          const cfg = this.ipcServer.loadConfig();
          const updated = { ...cfg, token: newToken };
          if (newRefreshToken) updated.refreshToken = newRefreshToken;
          this.ipcServer.saveConfig(updated);
          console.log('[DesktopAgent] Persisted refreshed access token to config');
        } catch (err) {
          console.warn('[DesktopAgent] Failed to persist refreshed token:', err.message);
        }
      },
      devicePlatform: process.platform === 'darwin' ? 'macos' : 'windows',
    });

    this.sampleTimer = null;
    this.flushTimer = null;
    this.isRunning = false;
  }

  startTracking() {
    this.lastHeartbeat = Date.now();
    const isScheduleOpen = isWithinWorkingSchedule();
    const cfg = this.ipcServer.loadConfig();
    const isPaired = Boolean(cfg?.token);

    if (isScheduleOpen && isPaired) {
      this.trackingActive = true;
      console.log('[DesktopAgent] Paired user in working hours (08:00 - 17:30). Tracking ACTIVE.');
    } else if (!isScheduleOpen) {
      this.trackingActive = false;
      console.log('[DesktopAgent] Web active but OUTSIDE working hours (08:00 - 17:30). Tracking STANDBY.');
    } else {
      this.trackingActive = false;
      console.log('[DesktopAgent] Not paired / logged out. Tracking STANDBY.');
    }
    return { trackingActive: this.trackingActive, isScheduleOpen };
  }

  renewHeartbeat() {
    this.lastHeartbeat = Date.now();
    const isScheduleOpen = isWithinWorkingSchedule();
    const cfg = this.ipcServer.loadConfig();
    const isPaired = Boolean(cfg?.token);

    if (isScheduleOpen && isPaired) {
      this.trackingActive = true;
    } else {
      this.trackingActive = false;
    }
    return { trackingActive: this.trackingActive, isScheduleOpen };
  }

  stopTracking() {
    if (this.trackingActive) {
      console.log('[DesktopAgent] Requested pause / logout. Pausing activity capture...');
    }
    this.trackingActive = false;
    this.lastHeartbeat = 0;
    // Flush buffered events collected so far before stopping
    this.buffer.flush().catch(() => {});
    return { trackingActive: false };
  }

  async start() {
    console.log(`[DesktopAgent] Starting WorkRank Computer Activity Companion on ${process.platform}...`);

    await this.provider.start();

    try {
      await this.ipcServer.start();
    } catch (err) {
      console.warn('[DesktopAgent] Local IPC server failed to start (may already be running):', err.message);
    }

    this.isRunning = true;

    // 1. Sample OS idle & frontmost app every 1000ms ONLY WHEN TRACKING IS ACTIVE & IN SCHEDULE
    this.sampleTimer = setInterval(async () => {
      const isScheduleOpen = isWithinWorkingSchedule();
      const cfg = this.ipcServer.loadConfig();
      const isAuthenticated = Boolean(cfg?.token);

      // Auth check: If user logged out, pause
      if (!isAuthenticated) {
        if (this.trackingActive) {
          console.log('[DesktopAgent] User logged out. Pausing tracking.');
          this.trackingActive = false;
          this.buffer.flush().catch(() => {});
        }
        return;
      }

      // Schedule check: If time has passed 17:30 or before 08:00, stop tracking immediately
      if (!isScheduleOpen) {
        if (this.trackingActive) {
          console.log('[DesktopAgent] Working hours ended (17:30) or outside schedule. Automatically pausing tracking.');
          this.trackingActive = false;
          this.buffer.flush().catch(() => {});
        }
        return;
      }

      // Auto-resume tracking if paired and in schedule
      if (!this.trackingActive) {
        this.trackingActive = true;
        console.log('[DesktopAgent] Work hours active (08:00 - 17:30) and user paired. Automatically starting tracking.');
      }

      try {
        const sample = await this.provider.sample();
        this.buffer.addSample(sample);
      } catch (err) {
        // Silently swallow sample errors to prevent crash
      }
    }, 1000);

    // 2. Periodic flush to backend every 5s ONLY WHEN SAMPLES EXIST
    this.flushTimer = setInterval(async () => {
      if (!this.trackingActive && this.buffer.pendingEvents.length === 0) {
        return;
      }
      try {
        await this.buffer.flush();
      } catch (err) {
        // Flush errors logged in buffer
      }
    }, 5000);

    console.log(`[DesktopAgent] Agent is ready on http://127.0.0.1:43124 (Status: ${this.trackingActive ? 'TRACKING_ACTIVE' : 'STANDBY'}).`);
  }

  async stop() {
    this.isRunning = false;
    this.trackingActive = false;
    if (this.sampleTimer) clearInterval(this.sampleTimer);
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.provider.stop();
    this.ipcServer.stop();
    await this.buffer.flush();
    console.log('[DesktopAgent] Agent stopped cleanly.');
  }
}

// CLI handler
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--status')) {
    const installerStatus = AutostartInstaller.status();
    const server = new LocalIpcServer();
    const config = server.loadConfig();
    const provider = getProvider();
    const sample = await provider.sample();

    console.log('--- WORKRANK DESKTOP COMPANION STATUS ---');
    console.log(`Platform: ${process.platform}`);
    console.log(`Autostart Installed: ${installerStatus.installed}`);
    console.log(`Autostart Loaded: ${Boolean(installerStatus.loaded || installerStatus.installed)}`);
    console.log(`Paired: ${Boolean(config.token)}`);
    console.log(`Paired User: ${config.user?.username || config.user?.id || 'None'}`);
    console.log(`Backend URL: ${config.backendUrl || 'http://localhost:5001'}`);
    console.log(`Current App: ${sample.activeApp} (${sample.appCategory})`);
    console.log(`Current State: ${sample.state} (Idle: ${sample.idleSecondsCurrent}s)`);
    process.exit(0);
  }

  if (args.includes('--install-autostart')) {
    const res = AutostartInstaller.install();
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }

  if (args.includes('--uninstall-autostart')) {
    const res = AutostartInstaller.uninstall();
    console.log(res.message);
    process.exit(res.success ? 0 : 1);
  }

  const agent = new DesktopAgent();
  await agent.start();

  process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT, shutting down...');
    await agent.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\nReceived SIGTERM, shutting down...');
    await agent.stop();
    process.exit(0);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal error in DesktopAgent:', err);
    process.exit(1);
  });
}

module.exports = DesktopAgent;
