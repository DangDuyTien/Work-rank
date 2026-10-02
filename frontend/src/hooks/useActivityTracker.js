import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { computerActivityApi, desktopAgentIpc, refreshSession } from '../services/api';

const SESSION_KEY = 'workrank:telemetry_session_id';
const TRACKING_ENABLED_KEY = 'workrank:tracking_enabled';
const PENDING_EVENTS_KEY = 'workrank:pending_activity_events';
const SERVER_SNAPSHOT_KEY = 'workrank:server_activity_snapshot';
const FLUSH_INTERVAL_MS = 4000; // Flush batch every 4 seconds
const HEARTBEAT_INTERVAL_MS = 10000;
const MAX_QUEUE_SIZE = 500;
const FAST_FLUSH_THRESHOLD = 8; // Auto-flush when accumulated 8 events

function getOrCreateSessionId() {
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = 'ses_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return 'ses_' + Date.now();
  }
}

function getInitialTrackingState() {
  try {
    return sessionStorage.getItem(TRACKING_ENABLED_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadInitialPendingQueue() {
  try {
    const raw = sessionStorage.getItem(PENDING_EVENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

function loadInitialServerSnapshot() {
  try {
    const raw = sessionStorage.getItem(SERVER_SNAPSHOT_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {
    serverPts: 0,
    serverClicks: 0,
    serverKeys: 0,
    serverActiveMinutes: 0,
    serverRank: null,
    topApp: null,
  };
}

const initialSnapshot = loadInitialServerSnapshot();
const initialQueue = loadInitialPendingQueue();

const initialPendingPts = initialQueue.reduce((sum, e) => sum + (Number(e.localPoints) || 0), 0);
const initialPendingClicks = initialQueue.reduce((sum, e) => sum + (Number(e.mouseClicks) || 0), 0);
const initialPendingKeys = initialQueue.reduce((sum, e) => sum + (Number(e.keyboardCount) || 0), 0);

// Module-level reactive store for computer & web activity telemetry (Optimistic Local + Server Persistence)
const telemetryStore = {
  isTrackingActive: getInitialTrackingState(),
  trackingStatus: getInitialTrackingState() ? 'RUNNING' : 'OFF', // 'OFF' | 'STARTING' | 'RUNNING' | 'STOPPING' | 'ERROR'

  // 1. Canonical Server State (Source of truth from database)
  serverPts: initialSnapshot.serverPts || 0,
  serverClicks: initialSnapshot.serverClicks || 0,
  serverKeys: initialSnapshot.serverKeys || 0,
  serverActiveMinutes: initialSnapshot.serverActiveMinutes || 0,
  serverRank: initialSnapshot.serverRank || null,
  topApp: initialSnapshot.topApp || null,

  // 2. Local Pending Buffer (Activity recorded locally, awaiting server ACK)
  pendingQueue: initialQueue,
  pendingPts: initialPendingPts,
  pendingClicks: initialPendingClicks,
  pendingKeys: initialPendingKeys,
  pendingActiveSeconds: 0,

  // 3. Instant Display State: DISPLAY_PTS = SERVER_PTS + PENDING_PTS
  displayPts: (initialSnapshot.serverPts || 0) + initialPendingPts,
  displayClicks: (initialSnapshot.serverClicks || 0) + initialPendingClicks,
  displayKeys: (initialSnapshot.serverKeys || 0) + initialPendingKeys,
  displayActiveMinutes: initialSnapshot.serverActiveMinutes || 0,

  // Diagnostics & Status
  syncStatus: initialQueue.length > 0 ? 'PENDING_RETRY' : 'SYNCED', // 'SYNCED' | 'SYNCING' | 'PENDING_RETRY' | 'OFFLINE'
  lastSyncTime: null,
  lastEventTime: null,
  lastFlushTime: null,
  lastFlushStatus: 'IDLE', // 'IDLE' | 'FLUSHING' | 'SUCCESS' | 'ERROR'
  queueLength: initialQueue.length,
  ptsPerHour: null,
  avgApm: null,

  // Desktop Agent companion IPC status
  agentStatus: { running: false, paired: false, trackingActive: false, platform: 'unknown' },
  sessionId: getOrCreateSessionId(),
};

const listeners = new Set();
let notifyScheduled = false;

function emitStoreUpdate() {
  if (notifyScheduled) return;
  notifyScheduled = true;
  requestAnimationFrame(() => {
    notifyScheduled = false;
    const snapshot = { ...telemetryStore };
    listeners.forEach((fn) => {
      try {
        fn(snapshot);
      } catch {}
    });
  });
}

function savePendingQueue() {
  try {
    sessionStorage.setItem(PENDING_EVENTS_KEY, JSON.stringify(telemetryStore.pendingQueue.slice(-MAX_QUEUE_SIZE)));
  } catch {}
}

function saveServerSnapshot() {
  try {
    sessionStorage.setItem(
      SERVER_SNAPSHOT_KEY,
      JSON.stringify({
        serverPts: telemetryStore.serverPts,
        serverClicks: telemetryStore.serverClicks,
        serverKeys: telemetryStore.serverKeys,
        serverActiveMinutes: telemetryStore.serverActiveMinutes,
        serverRank: telemetryStore.serverRank,
        topApp: telemetryStore.topApp,
      })
    );
  } catch {}
}

/**
 * Recomputes all pending deltas, display sums and realtime rates.
 * Guarantees DISPLAY_PTS = SERVER_PTS + PENDING_PTS with NO double counting.
 */
function recomputeTotals() {
  const pendingPts = telemetryStore.pendingQueue.reduce((acc, e) => acc + (Number(e.localPoints) || 0), 0);
  const pendingClicks = telemetryStore.pendingQueue.reduce((acc, e) => acc + (Number(e.mouseClicks) || 0), 0);
  const pendingKeys = telemetryStore.pendingQueue.reduce((acc, e) => acc + (Number(e.keyboardCount) || 0), 0);

  telemetryStore.pendingPts = pendingPts;
  telemetryStore.pendingClicks = pendingClicks;
  telemetryStore.pendingKeys = pendingKeys;
  telemetryStore.queueLength = telemetryStore.pendingQueue.length;

  // DISPLAY_PTS = SERVER_PTS + PENDING_PTS
  telemetryStore.displayPts = Number(telemetryStore.serverPts || 0) + pendingPts;
  telemetryStore.displayClicks = Number(telemetryStore.serverClicks || 0) + pendingClicks;
  telemetryStore.displayKeys = Number(telemetryStore.serverKeys || 0) + pendingKeys;

  const extraMins = Math.floor(telemetryStore.pendingActiveSeconds / 60);
  telemetryStore.displayActiveMinutes = Number(telemetryStore.serverActiveMinutes || 0) + extraMins;

  // Calculate live PTS/Hour & APM
  const totalMins = telemetryStore.displayActiveMinutes;
  const score = telemetryStore.displayPts;
  if (totalMins >= 1 && score > 0) {
    telemetryStore.ptsPerHour = Math.round((score / totalMins) * 60);
    telemetryStore.avgApm = Math.round(score / totalMins);
  } else if (score > 0) {
    telemetryStore.ptsPerHour = score * 60; // First minute projection
    telemetryStore.avgApm = score;
  } else {
    telemetryStore.ptsPerHour = null;
    telemetryStore.avgApm = null;
  }

  savePendingQueue();
  emitStoreUpdate();
}

/**
 * Synchronize canonical server summary (from /api/activity/my-summary or socket update)
 */
export function setServerSummary(summary = {}) {
  if (!summary) return;

  const rawScore = summary.activityScore !== undefined ? summary.activityScore : summary.serverPts;
  if (rawScore !== undefined && rawScore !== null) {
    telemetryStore.serverPts = Number(rawScore) || 0;
  }
  if (summary.mouseClicks !== undefined) {
    telemetryStore.serverClicks = Number(summary.mouseClicks) || 0;
  }
  if (summary.keyboardCount !== undefined) {
    telemetryStore.serverKeys = Number(summary.keyboardCount) || 0;
  }
  if (summary.activeMinutes !== undefined) {
    telemetryStore.serverActiveMinutes = Number(summary.activeMinutes) || 0;
  }
  if (summary.rank !== undefined) {
    telemetryStore.serverRank = summary.rank;
  }
  if (summary.topApp) {
    telemetryStore.topApp = summary.topApp;
  }

  saveServerSnapshot();
  recomputeTotals();
}

/**
 * Global Tracking Controls
 */
export async function startTrackingGlobal(userData = {}) {
  try {
    sessionStorage.setItem(TRACKING_ENABLED_KEY, 'true');
  } catch {}
  telemetryStore.isTrackingActive = true;
  telemetryStore.trackingStatus = 'STARTING';
  emitStoreUpdate();

  try {
    let token = localStorage.getItem('token');
    let refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await refreshSession();
        token = localStorage.getItem('token');
        refreshToken = localStorage.getItem('refreshToken');
      }
    } catch {}

    const backendUrl = window.location.port === '5173' ? 'http://localhost:5001' : window.location.origin;
    await desktopAgentIpc.startTracking({ token, refreshToken, user: userData, backendUrl });

    const status = await desktopAgentIpc.checkStatus();
    telemetryStore.agentStatus = status;
    telemetryStore.trackingStatus = 'RUNNING';
  } catch (err) {
    telemetryStore.trackingStatus = 'RUNNING'; // Fallback Web activity continues
  }
  emitStoreUpdate();
}

export async function stopTrackingGlobal() {
  try {
    sessionStorage.removeItem(TRACKING_ENABLED_KEY);
  } catch {}
  telemetryStore.isTrackingActive = false;
  telemetryStore.trackingStatus = 'STOPPING';
  emitStoreUpdate();

  try {
    // 1. Notify Desktop Agent to stop immediately
    await desktopAgentIpc.stopTracking();

    const status = await desktopAgentIpc.checkStatus();
    telemetryStore.agentStatus = status;
    telemetryStore.trackingStatus = 'OFF';
  } catch {
    telemetryStore.trackingStatus = 'OFF';
  }

  // Flush any remaining local pending events to server without losing score
  flushPendingQueueGlobal().catch(() => {});
  emitStoreUpdate();
}

export function toggleTrackingGlobal(userData = {}) {
  if (telemetryStore.isTrackingActive) {
    return stopTrackingGlobal();
  } else {
    return startTrackingGlobal(userData);
  }
}

/**
 * Flush pending queue to server and reconcile with ACK
 */
let isFlushing = false;
export async function flushPendingQueueGlobal() {
  if (isFlushing) return;
  if (telemetryStore.pendingQueue.length === 0) {
    telemetryStore.syncStatus = 'SYNCED';
    emitStoreUpdate();
    return;
  }

  isFlushing = true;
  telemetryStore.syncStatus = 'SYNCING';
  telemetryStore.lastFlushStatus = 'FLUSHING';
  emitStoreUpdate();

  const inflightEvents = [...telemetryStore.pendingQueue];

  const token = localStorage.getItem('token');
  if (!token) {
    isFlushing = false;
    telemetryStore.syncStatus = 'PENDING_RETRY';
    telemetryStore.lastFlushStatus = 'IDLE';
    emitStoreUpdate();
    return;
  }

  try {
    const response = await computerActivityApi.recordBatch({
      sessionId: telemetryStore.sessionId,
      devicePlatform: 'web',
      events: inflightEvents,
    });

    const data = response?.data || response || {};
    const acceptedIds = new Set(data.acceptedEventIds || inflightEvents.map((e) => e.eventId));

    // 1. Update canonical Server state from ACK
    if (data.activityScore !== undefined || data.serverPts !== undefined) {
      telemetryStore.serverPts = Number(data.activityScore ?? data.serverPts ?? telemetryStore.serverPts);
    }
    if (data.mouseClicks !== undefined) {
      telemetryStore.serverClicks = Number(data.mouseClicks);
    }
    if (data.keyboardCount !== undefined) {
      telemetryStore.serverKeys = Number(data.keyboardCount);
    }
    if (data.activeMinutes !== undefined) {
      telemetryStore.serverActiveMinutes = Number(data.activeMinutes);
    }
    if (data.rank !== undefined) {
      telemetryStore.serverRank = data.rank;
    }

    // 2. Remove ONLY accepted events from the pending queue (Partial ACK safe)
    telemetryStore.pendingQueue = telemetryStore.pendingQueue.filter((e) => !acceptedIds.has(e.eventId));
    telemetryStore.pendingActiveSeconds = 0;

    telemetryStore.syncStatus = telemetryStore.pendingQueue.length > 0 ? 'SYNCING' : 'SYNCED';
    telemetryStore.lastFlushTime = new Date().toISOString();
    telemetryStore.lastSyncTime = telemetryStore.lastFlushTime;
    telemetryStore.lastFlushStatus = 'SUCCESS';

    saveServerSnapshot();
    recomputeTotals();
  } catch (err) {
    // Network / server failure: DO NOT ROLLBACK DISPLAY PTS.
    // Retain events in pendingQueue for retry on next flush.
    telemetryStore.syncStatus = 'PENDING_RETRY';
    telemetryStore.lastFlushStatus = 'ERROR';
    emitStoreUpdate();
  } finally {
    isFlushing = false;
  }
}

/**
 * Hook to consume live activity telemetry stats and control tracking
 */
export function useActivityStats() {
  const [stats, setStats] = useState({ ...telemetryStore });

  useEffect(() => {
    listeners.add(setStats);
    setStats({ ...telemetryStore });
    return () => {
      listeners.delete(setStats);
    };
  }, []);

  const startTracking = useCallback((userData) => startTrackingGlobal(userData), []);
  const stopTracking = useCallback(() => stopTrackingGlobal(), []);
  const toggleTracking = useCallback((userData) => toggleTrackingGlobal(userData), []);
  const flushQueue = useCallback(() => flushPendingQueueGlobal(), []);
  const updateServerSummary = useCallback((summary) => setServerSummary(summary), []);

  return {
    ...stats,
    startTracking,
    stopTracking,
    toggleTracking,
    flushQueue,
    updateServerSummary,
  };
}

/**
 * Central Activity Tracker Hook.
 * Implements:
 * 1. Instant optimistic local PTS accumulation (< 100ms UI responsiveness).
 * 2. Background queue buffering & batch flushing to backend.
 * 3. Exact reconciliation upon Server ACK to prevent double counting.
 * 4. Zero PTS loss across reconnects, offline mode, and tracking toggle.
 */
export function useActivityTracker() {
  const location = useLocation();
  const { isTrackingActive, agentStatus } = useActivityStats();

  const heartbeatTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const activeSecondTimerRef = useRef(null);
  const debounceFlushTimerRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());

  // 1. Periodically check Desktop Companion Agent status
  useEffect(() => {
    let mounted = true;
    const checkAgent = async () => {
      try {
        const status = await desktopAgentIpc.checkStatus();
        if (mounted) {
          telemetryStore.agentStatus = status;
          emitStoreUpdate();
        }
      } catch {}
    };

    checkAgent();
    const interval = setInterval(checkAgent, 12000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Desktop Agent Heartbeat & Watchdog
  useEffect(() => {
    if (!isTrackingActive) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    // Ping agent immediately when active
    desktopAgentIpc.sendHeartbeat();

    heartbeatTimerRef.current = setInterval(() => {
      if (telemetryStore.isTrackingActive) {
        desktopAgentIpc.sendHeartbeat();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, [isTrackingActive]);

  // 3. Auto-flush on page unload / web close ("tắt web thì tự ngắt & flush")
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 1. Immediately signal Desktop Agent to stop
      desktopAgentIpc.stopTracking();

      // 2. If local pending events exist, flush via sendBeacon
      if (telemetryStore.pendingQueue.length > 0) {
        try {
          const payload = JSON.stringify({
            sessionId: telemetryStore.sessionId,
            devicePlatform: 'web',
            events: telemetryStore.pendingQueue,
          });
          const token = localStorage.getItem('token');
          if (token && navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            navigator.sendBeacon('/api/activity/computer/batch', blob);
          }
        } catch {}
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, []);

  // 4. Online / Offline network reconnection handler
  useEffect(() => {
    const handleOnline = () => {
      if (telemetryStore.pendingQueue.length > 0) {
        flushPendingQueueGlobal();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 5. Active/Idle timer & interaction listeners (Instant Optimistic Local Scoring)
  useEffect(() => {
    if (!isTrackingActive) {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (activeSecondTimerRef.current) clearInterval(activeSecondTimerRef.current);
      if (debounceFlushTimerRef.current) clearTimeout(debounceFlushTimerRef.current);
      return;
    }

    // 1-second interval to calculate active vs idle seconds
    activeSecondTimerRef.current = setInterval(() => {
      const now = Date.now();
      const isCurrentlyIdle = now - lastInteractionTimeRef.current > 60000; // 60s idle

      if (!isCurrentlyIdle) {
        telemetryStore.pendingActiveSeconds += 1;
        recomputeTotals();
      }
    }, 1000);

    const recordInteraction = (type) => {
      const now = Date.now();
      lastInteractionTimeRef.current = now;
      telemetryStore.lastEventTime = now;

      // 1. Create unique event
      const eventId = 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const isClick = type === 'click';
      const isKey = type === 'key';
      const localPts = (isClick ? 1 : 0) + (isKey ? 1 : 0);

      const newEvent = {
        eventId,
        state: 'ACTIVE',
        activeApp: 'WorkRank Web',
        appCategory: 'BROWSER',
        context: 'WEB',
        activeSeconds: 1,
        idleSeconds: 0,
        mouseClicks: isClick ? 1 : 0,
        keyboardCount: isKey ? 1 : 0,
        localPoints: localPts,
        occurredAt: new Date().toISOString(),
        status: 'PENDING',
      };

      // Queue limit safeguard
      if (telemetryStore.pendingQueue.length >= MAX_QUEUE_SIZE) {
        telemetryStore.pendingQueue.shift();
      }
      telemetryStore.pendingQueue.push(newEvent);

      // 2. INSTANT OPTIMISTIC SCORE UPDATE (< 1ms UI response)
      recomputeTotals();

      // 3. Trigger batch flush if queue hits fast threshold or schedule debounced flush
      if (telemetryStore.pendingQueue.length >= FAST_FLUSH_THRESHOLD) {
        if (debounceFlushTimerRef.current) clearTimeout(debounceFlushTimerRef.current);
        flushPendingQueueGlobal();
      } else {
        if (debounceFlushTimerRef.current) clearTimeout(debounceFlushTimerRef.current);
        debounceFlushTimerRef.current = setTimeout(() => {
          flushPendingQueueGlobal();
        }, 1500);
      }
    };

    const handleClick = () => recordInteraction('click');
    const handleKeyDown = () => recordInteraction('key');
    const handleTouch = () => recordInteraction('click');

    window.addEventListener('click', handleClick, { passive: true, capture: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true, capture: true });
    window.addEventListener('touchstart', handleTouch, { passive: true, capture: true });

    // Periodic flush timer (every 4 seconds)
    flushTimerRef.current = setInterval(() => {
      flushPendingQueueGlobal();
    }, FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      window.removeEventListener('touchstart', handleTouch, { capture: true });
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (activeSecondTimerRef.current) clearInterval(activeSecondTimerRef.current);
      if (debounceFlushTimerRef.current) clearTimeout(debounceFlushTimerRef.current);
      flushPendingQueueGlobal();
    };
  }, [isTrackingActive, location.pathname]);
}
