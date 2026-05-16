const dashboardService = require('./dashboard.service');

const DEFAULT_FLUSH_MS = 1000;
const FLUSH_MS = Math.min(5000, Math.max(250, Number(process.env.REALTIME_BATCH_FLUSH_MS || DEFAULT_FLUSH_MS)));

let pendingByUser = new Map();
let flushTimer = null;
let ioRef = null;

function sumDelta(a = {}, b = {}) {
  return {
    activeSeconds: Number(a.activeSeconds || 0) + Number(b.activeSeconds || 0),
    idleSeconds: Number(a.idleSeconds || 0) + Number(b.idleSeconds || 0),
    keystrokeCount: Number(a.keystrokeCount || 0) + Number(b.keystrokeCount || 0),
    mouseClickCount: Number(a.mouseClickCount || 0) + Number(b.mouseClickCount || 0),
    mouseMoveCount: Number(a.mouseMoveCount || 0) + Number(b.mouseMoveCount || 0),
  };
}

function latestIso(a, b) {
  const at = a ? new Date(a).getTime() : 0;
  const bt = b ? new Date(b).getTime() : 0;
  if (!at && !bt) return null;
  return new Date(Math.max(at, bt)).toISOString();
}

function mergePayload(previous = {}, next = {}) {
  return {
    ...previous,
    ...next,
    delta: sumDelta(previous.delta, next.delta),
    totals: next.totals || previous.totals || null,
    flaggedCount: Number(previous.flaggedCount || 0) + Number(next.flaggedCount || 0),
    lastEventAt: latestIso(previous.lastEventAt, next.lastEventAt),
  };
}

function emitActivity(io, payload) {
  let target = io.to('dashboard').to(`user:${payload.userId}`);
  if (payload.teamId) target = target.to(`team:${payload.teamId}`);
  target.emit('activity:user:update', payload);
}

async function flush() {
  const io = ioRef;
  const batch = pendingByUser;
  pendingByUser = new Map();
  flushTimer = null;
  if (!io || batch.size === 0) return;

  for (const payload of batch.values()) {
    emitActivity(io, payload);
  }

  try {
    io.to('dashboard').emit('dashboard:overview:update', await dashboardService.overview({ range: 'today' }));
  } catch (error) {
    console.warn('Failed to emit batched dashboard overview:', error.message);
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flush().catch((error) => {
      console.warn('Failed to flush realtime batch:', error.message);
    });
  }, FLUSH_MS);
  flushTimer.unref?.();
}

function queueActivityUpdate(io, payload) {
  if (!io || !payload?.userId) return;
  ioRef = io;
  const key = String(payload.userId);
  pendingByUser.set(key, mergePayload(pendingByUser.get(key), payload));
  scheduleFlush();
}

module.exports = { queueActivityUpdate, flush };
