'use strict';

/**
 * outboxDispatcher.worker.js
 *
 * Background worker that polls event_outbox for PENDING rows and dispatches
 * them into competition_events (the Event Store).
 *
 * Design:
 *   - Polling interval: configurable via OUTBOX_POLL_INTERVAL_MS (default 2000ms)
 *   - Batch size: configurable via OUTBOX_BATCH_SIZE (default 50)
 *   - On duplicate idempotency_key in Event Store → silently ACK (mark DISPATCHED)
 *   - On error → mark outbox row FAILED, log, continue (do NOT crash worker)
 *   - Graceful shutdown on SIGTERM / SIGINT
 *
 * Usage (from server.js):
 *   const outboxDispatcher = require('./workers/outboxDispatcher.worker');
 *   outboxDispatcher.start();
 */

const outboxService = require('../services/competition/outbox.service');
const eventStoreService = require('../services/competition/eventStore.service');

const POLL_INTERVAL_MS = Number(process.env.OUTBOX_POLL_INTERVAL_MS ?? 2000);
const BATCH_SIZE = Number(process.env.OUTBOX_BATCH_SIZE ?? 50);

let running = false;
let timerId = null;

/**
 * Process one batch of pending outbox rows.
 */
async function processBatch() {
  const rows = await outboxService.fetchPendingBatch(BATCH_SIZE);
  if (rows.length === 0) return;

  for (const row of rows) {
    try {
      const { isDuplicate } = await eventStoreService.ingestFromOutbox(row);

      if (isDuplicate) {
        // Event already in store — idempotent ACK, mark dispatched to stop retrying
        await outboxService.markDispatched(row.id);
        continue;
      }

      await outboxService.markDispatched(row.id);
    } catch (err) {
      // Non-fatal: log and mark failed; worker continues with next row
      console.error('[OutboxDispatcher] Error dispatching outbox row', row.id, err.message);
      await outboxService.markFailed(row.id, err.message).catch(() => {});
    }
  }
}

/**
 * Schedule the next poll.
 */
function scheduleNext() {
  if (!running) return;
  timerId = setTimeout(async () => {
    try {
      await processBatch();
    } catch (err) {
      console.error('[OutboxDispatcher] Unexpected error in processBatch', err.message);
    } finally {
      scheduleNext();
    }
  }, POLL_INTERVAL_MS);
}

/**
 * Start the dispatcher.
 */
function start() {
  if (running) return;
  running = true;
  console.log(`[OutboxDispatcher] Started (interval=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE})`);
  scheduleNext();
}

/**
 * Graceful shutdown — waits for current batch to finish.
 */
async function stop() {
  running = false;
  if (timerId) {
    clearTimeout(timerId);
    timerId = null;
  }
  console.log('[OutboxDispatcher] Stopped');
}

// Expose processBatch for testing
module.exports = { start, stop, processBatch };
