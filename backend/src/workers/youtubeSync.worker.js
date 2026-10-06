'use strict';

const youtubeSyncService = require('../services/youtube/youtubeSync.service');

let timer = null;
let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

const DEFAULT_INTERVAL_MS = 60 * 60 * 1000; // 1 hour (60 minutes)

async function runSyncCycle() {
  try {
    console.log('[YouTubeSyncWorker] Starting scheduled 1-hour YouTube synchronization...');
    const results = await youtubeSyncService.syncAllChannels();
    console.log(`[YouTubeSyncWorker] Sync complete: ${results.success}/${results.total} channels synced successfully.`);
    if (ioInstance) {
      ioInstance.emit('youtube:metrics_updated', {
        timestamp: new Date().toISOString(),
        totalChannels: results.total,
        successCount: results.success,
      });
    }
    return results;
  } catch (error) {
    console.error('[YouTubeSyncWorker] Scheduled sync error:', error.message);
    return null;
  }
}

function startPeriodicSync(customIntervalMs) {
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  const intervalMs = customIntervalMs
    || Number(process.env.YOUTUBE_SYNC_INTERVAL_MS)
    || (Number(process.env.YOUTUBE_SYNC_INTERVAL_MINUTES) * 60 * 1000)
    || DEFAULT_INTERVAL_MS;

  if (timer) {
    clearInterval(timer);
  }

  console.log(`[YouTubeSyncWorker] Initialized periodic YouTube sync every ${(intervalMs / (60 * 1000)).toFixed(0)} minutes.`);
  timer = setInterval(runSyncCycle, intervalMs);
}

function stopPeriodicSync() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = {
  startPeriodicSync,
  stopPeriodicSync,
  runSyncCycle,
  setIo,
};
