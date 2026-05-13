const { uIOhook, UiohookKeyboardEvent, UiohookMouseEvent } = require('uiohook-napi');

class InputTracker {
  constructor(apiService, onStatusChange) {
    this.api = apiService;
    this.onStatusChange = onStatusChange;
    this.tracking = false;
    this.interval = null;
    this.keystrokes = 0;
    this.mouseClicks = 0;
    this.lastActivity = Date.now();
  }

  async start() {
    if (this.tracking) return;
    this.tracking = true;
    this.keystrokes = 0;
    this.mouseClicks = 0;
    this.lastActivity = Date.now();

    this.keyHandler = (e) => {
      if (!this.tracking) return;
      if (e.type === 'keydown') {
        this.keystrokes++;
        this.lastActivity = Date.now();
        this.updateStatus();
      }
    };

    this.mouseHandler = (e) => {
      if (!this.tracking) return;
      if (e.type === 'mousedown') {
        this.mouseClicks++;
        this.lastActivity = Date.now();
        this.updateStatus();
      }
    };

    uIOhook.on('keydown', this.keyHandler);
    uIOhook.on('mousedown', this.mouseHandler);
    uIOhook.start();

    this.interval = setInterval(() => this.sendPing(), 2500);
    this.sendPing();
  }

  stop() {
    this.tracking = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    try {
      uIOhook.off('keydown', this.keyHandler);
      uIOhook.off('mousedown', this.mouseHandler);
      uIOhook.stop();
    } catch (err) {
      this.updateStatus({ connected: false, error: err.message });
    }
    this.updateStatus();
  }

  async sendPing() {
    if (!this.api || !this.tracking) return;
    try {
      const now = Date.now();
      const elapsed = Math.floor((now - this.lastActivity) / 1000);
      const isIdle = elapsed > 10;

      await this.api.ping({
        keystrokes: this.keystrokes || 0,
        mouse_clicks: this.mouseClicks || 0,
        active_seconds: isIdle ? 0 : Math.min(elapsed, 10),
        idle_seconds: isIdle ? elapsed : 0,
      });

      this.keystrokes = 0;
      this.mouseClicks = 0;
    } catch (err) {
      this.updateStatus({ connected: false });
    }
  }

  getStatus() {
    return {
      connected: this.api ? true : false,
      tracking: this.tracking,
      keystrokes: this.keystrokes,
      mouseClicks: this.mouseClicks,
    };
  }

  updateStatus(extra = {}) {
    if (this.onStatusChange) {
      this.onStatusChange({ ...this.getStatus(), ...extra });
    }
  }
}

module.exports = { InputTracker };
