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
    this.ipcServer = new LocalIpcServer({
      port: 43124,
      getStatusData: () => ({
        currentState: this.provider.currentState,
        currentApp: this.provider.lastApp,
        currentCategory: this.provider.lastCategory,
        lastIdleSeconds: this.provider.lastIdleCheck,
      }),
      onPair: (cfg) => {
        console.log(`[DesktopAgent] Paired with user: ${cfg.user?.username || cfg.user?.id}`);
        this.buffer.backendUrl = cfg.backendUrl || this.buffer.backendUrl;
      },
      onLogout: () => {
        console.log('[DesktopAgent] Unpaired / logged out');
      },
    });

    const initialConfig = this.ipcServer.loadConfig();

    this.buffer = new AgentBuffer({
      batchIntervalSeconds: 15,
      backendUrl: initialConfig.backendUrl || 'http://localhost:5001',
      getToken: () => this.ipcServer.loadConfig().token,
      devicePlatform: process.platform === 'darwin' ? 'macos' : 'windows',
    });

    this.sampleTimer = null;
    this.flushTimer = null;
    this.isRunning = false;
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

    // 1. Sample OS idle & frontmost app every 1000ms
    this.sampleTimer = setInterval(async () => {
      try {
        const sample = await this.provider.sample();
        this.buffer.addSample(sample);
      } catch (err) {
        // Silently swallow sample errors to prevent crash
      }
    }, 1000);

    // 2. Periodic flush to backend every 15s
    this.flushTimer = setInterval(async () => {
      try {
        await this.buffer.flush();
      } catch (err) {
        // Flush errors logged in buffer
      }
    }, 15000);

    console.log('[DesktopAgent] Agent is active and running in background.');
  }

  async stop() {
    this.isRunning = false;
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
