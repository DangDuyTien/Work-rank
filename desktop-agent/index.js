'use strict';

const path = require('path');
const os = require('os');
const MacOSProvider = require('./providers/MacOSProvider');
const WindowsProvider = require('./providers/WindowsProvider');
const AgentBuffer = require('./core/AgentBuffer');
const LocalIpcServer = require('./core/LocalIpcServer');
const LaunchAgentInstaller = require('./autostart/LaunchAgentInstaller');
const WindowsAutostartInstaller = require('./autostart/WindowsAutostartInstaller');

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
    this.trackingActive = false; // INACTIVE BY DEFAULT: Must be turned on via Web UI
    this.lastHeartbeat = 0;
    this.heartbeatTimeoutMs = 25000; // Auto-stop if web tab closed or crashed

    this.ipcServer = new LocalIpcServer({
      port: 43124,
      getStatusData: () => ({
        trackingActive: this.trackingActive,
        currentState: this.trackingActive ? this.provider.currentState : 'PAUSED',
        currentApp: this.trackingActive ? this.provider.lastApp : null,
        currentCategory: this.trackingActive ? this.provider.lastCategory : null,
        lastIdleSeconds: this.provider.lastIdleCheck,
        lastHeartbeat: this.lastHeartbeat,
      }),
      onPair: (cfg) => {
        console.log(`[DesktopAgent] Paired with user: ${cfg.user?.username || cfg.user?.id}`);
        this.buffer.backendUrl = cfg.backendUrl || this.buffer.backendUrl;
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

    this.buffer = new AgentBuffer({
      batchIntervalSeconds: 5,
      backendUrl: initialConfig.backendUrl || 'http://localhost:5001',
      getToken: () => this.ipcServer.loadConfig().token,
      devicePlatform: process.platform === 'darwin' ? 'macos' : 'windows',
    });

    this.sampleTimer = null;
    this.flushTimer = null;
    this.isRunning = false;
  }

  startTracking() {
    console.log('[DesktopAgent] Web requested START tracking. Beginning activity capture...');
    this.trackingActive = true;
    this.lastHeartbeat = Date.now();
    return { trackingActive: true };
  }

  renewHeartbeat() {
    this.trackingActive = true;
    this.lastHeartbeat = Date.now();
    return { trackingActive: true };
  }

  stopTracking() {
    if (this.trackingActive) {
      console.log('[DesktopAgent] Web requested STOP tracking or web closed. Pausing activity capture...');
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

    // 1. Sample OS idle & frontmost app every 1000ms ONLY WHEN TRACKING IS ACTIVE
    this.sampleTimer = setInterval(async () => {
      if (!this.trackingActive) {
        return; // Standby: 0 CPU, 0 sampling
      }

      // Watchdog: If Web tab was closed without sending stop, heartbeat expires in 25s
      if (Date.now() - this.lastHeartbeat > this.heartbeatTimeoutMs) {
        console.log('[DesktopAgent] Web heartbeat expired (Web tab/browser closed). Auto-stopping tracking.');
        this.stopTracking();
        return;
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

    console.log('[DesktopAgent] Agent is ready on http://127.0.0.1:43124 (Standby, waiting for Web toggle).');
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
