'use strict';

/**
 * ComputerActivityProvider base interface
 * Defines abstraction for cross-platform OS activity tracking.
 */
class ComputerActivityProvider {
  constructor(options = {}) {
    this.options = options;
    this.idleThresholdSeconds = options.idleThresholdSeconds || 120; // 2 minutes default
  }

  async start() {
    throw new Error('start() must be implemented by provider');
  }

  async stop() {
    throw new Error('stop() must be implemented by provider');
  }

  async getSnapshot() {
    throw new Error('getSnapshot() must be implemented by provider');
  }
}

module.exports = ComputerActivityProvider;
