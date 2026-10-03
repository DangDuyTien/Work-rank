import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { computerActivityApi, desktopAgentIpc, refreshSession } from '../services/api';
import { getSocket } from '../services/socket';
import { isWithinWorkingSchedule, computeTrackingState, getVietnamTimeParts, TIMEZONE } from '../utils/schedule';

const SESSION_KEY = 'workrank:telemetry_session_id';
const PENDING_EVENTS_KEY = 'workrank:pending_activity_events';
const SERVER_SNAPSHOT_KEY = 'workrank:server_activity_snapshot';
const LEADER_TAB_KEY = 'workrank:tracker_leader_tab';
const LEADER_HEARTBEAT_KEY = 'workrank:tracker_leader_heartbeat';

const FLUSH_INTERVAL_MS = 4000; // Flush batch every 4 seconds
const HEARTBEAT_INTERVAL_MS = 8000;
const MAX_QUEUE_SIZE = 500;
const FAST_FLUSH_THRESHOLD = 8;

// Generate unique tab ID for multi-tab coordination
const TAB_ID = 'tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();

// Broadcast Channel for multi-tab coordination
let tabChannel = null;
try {
  if (typeof BroadcastChannel !== 'undefined') {
    tabChannel = new BroadcastChannel('workrank_tab_coordination');
  }
} catch {}

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

function getInitialState() {
  const hasToken = typeof localStorage !== 'undefined' && Boolean(localStorage.getItem('token'));
  return computeTrackingState({ isAuthenticated: hasToken, isWebOpen: true });
}

// Module-level reactive store for computer & web activity telemetry
const telemetryStore = {
  // 1. CANONICAL 4-STATE TRACKING MACHINE
  // 'TRACKING_ACTIVE' | 'TRACKING_OUTSIDE_SCHEDULE' | 'TRACKING_WEB_CLOSED' | 'TRACKING_LOGGED_OUT'
  trackingState: getInitialState(),
  isScheduleOpen: isWithinWorkingSchedule(),
  isLeaderTab: false,

  // 2. CANONICAL SERVER STATE (from DB via API/Socket/ACK)
  serverPts: initialSnapshot.serverPts || 0,
  serverClicks: initialSnapshot.serverClicks || 0,
  serverKeys: initialSnapshot.serverKeys || 0,
  serverActiveMinutes: initialSnapshot.serverActiveMinutes || 0,
  serverRank: initialSnapshot.serverRank || null,
  topApp: initialSnapshot.topApp || null,

  // 3. LOCAL PENDING BUFFER (Un-ACKed deltas)
  pendingQueue: initialQueue,
  pendingPts: initialPendingPts,
  pendingClicks: initialPendingClicks,
  pendingKeys: initialPendingKeys,
  pendingActiveSeconds: 0,

  // 4. INSTANT DISPLAY STATE: DISPLAY_PTS = SERVER_PTS + PENDING_PTS
  displayPts: (initialSnapshot.serverPts || 0) + initialPendingPts,
  displayClicks: (initialSnapshot.serverClicks || 0) + initialPendingClicks,
  displayKeys: (initialSnapshot.serverKeys || 0) + initialPendingKeys,
  displayActiveMinutes: initialSnapshot.serverActiveMinutes || 0,

  // Diagnostics & Status
  syncStatus: initialQueue.length > 0 ? 'PENDING_RETRY' : 'SYNCED', // 'SYNCED' | 'SYNCING' | 'PENDING_RETRY'
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

  telemetryStore.displayPts = Number(telemetryStore.serverPts || 0) + pendingPts;
  telemetryStore.displayClicks = Number(telemetryStore.serverClicks || 0) + pendingClicks;
  telemetryStore.displayKeys = Number(telemetryStore.serverKeys || 0) + pendingKeys;

  const extraMins = Math.floor(telemetryStore.pendingActiveSeconds / 60);
  telemetryStore.displayActiveMinutes = Number(telemetryStore.serverActiveMinutes || 0) + extraMins;

  const totalMins = telemetryStore.displayActiveMinutes;
  const score = telemetryStore.displayPts;
  if (totalMins >= 1 && score > 0) {
    telemetryStore.ptsPerHour = Math.round((score / totalMins) * 60);
    telemetryStore.avgApm = Math.round(score / totalMins);
  } else if (score > 0) {
    telemetryStore.ptsPerHour = score * 60;
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

    // Update canonical Server state from ACK
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

    // Remove ONLY accepted events from pending queue
    telemetryStore.pendingQueue = telemetryStore.pendingQueue.filter((e) => !acceptedIds.has(e.eventId));
    telemetryStore.pendingActiveSeconds = 0;

    telemetryStore.syncStatus = telemetryStore.pendingQueue.length > 0 ? 'SYNCING' : 'SYNCED';
    telemetryStore.lastFlushTime = new Date().toISOString();
    telemetryStore.lastSyncTime = telemetryStore.lastFlushTime;
    telemetryStore.lastFlushStatus = 'SUCCESS';

    saveServerSnapshot();
    recomputeTotals();
  } catch (err) {
    telemetryStore.syncStatus = 'PENDING_RETRY';
    telemetryStore.lastFlushStatus = 'ERROR';
    emitStoreUpdate();
  } finally {
    isFlushing = false;
  }
}

/**
 * Multi-Tab Leader Election & Coordination
 */
function checkLeaderStatus() {
  const currentLeader = localStorage.getItem(LEADER_TAB_KEY);
  const lastHeartbeat = Number(localStorage.getItem(LEADER_HEARTBEAT_KEY) || 0);
  const now = Date.now();

  // If no leader or leader heartbeat expired (> 12s), this tab claims leadership
  if (!currentLeader || currentLeader === TAB_ID || now - lastHeartbeat > 12000) {
    localStorage.setItem(LEADER_TAB_KEY, TAB_ID);
    localStorage.setItem(LEADER_HEARTBEAT_KEY, String(now));
    telemetryStore.isLeaderTab = true;
  } else {
    telemetryStore.isLeaderTab = false;
  }
  emitStoreUpdate();
}

/**
 * Hook to consume live activity telemetry stats (Read-Only)
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

  const flushQueue = useCallback(() => flushPendingQueueGlobal(), []);
  const updateServerSummary = useCallback((summary) => setServerSummary(summary), []);

  return {
    ...stats,
    // Backward compatibility helper flags (computed from 4-state machine)
    isTrackingActive: stats.trackingState === 'TRACKING_ACTIVE',
    isOutsideSchedule: stats.trackingState === 'TRACKING_OUTSIDE_SCHEDULE',
    isWebClosed: stats.trackingState === 'TRACKING_WEB_CLOSED',
    isLoggedOut: stats.trackingState === 'TRACKING_LOGGED_OUT',
    flushQueue,
    updateServerSummary,
  };
}

/**
 * Central Activity Tracker Hook (Autonomous Lifecycle & Schedule Enforcement).
 *
 * Requirements:
 * 1. ZERO user toggle buttons (always active when logged in during 08:00 - 17:30).
 * 2. 4 Canonical States: TRACKING_ACTIVE, TRACKING_OUTSIDE_SCHEDULE, TRACKING_WEB_CLOSED, TRACKING_LOGGED_OUT.
 * 3. Schedule 08:00 - 17:30 Asia/Ho_Chi_Minh.
 * 4. Multi-tab coordination: single leader tab sends heartbeat to Agent.
 * 5. Full Desktop & Web activity capture without surveillance.
 */
export function useActivityTracker() {
  const location = useLocation();
  const { trackingState, isTrackingActive, agentStatus } = useActivityStats();

  const heartbeatTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const activeSecondTimerRef = useRef(null);
  const scheduleCheckTimerRef = useRef(null);
  const debounceFlushTimerRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());

  // 1. Multi-Tab Leader Election & Channel Listener
  useEffect(() => {
    checkLeaderStatus();
    const leaderInterval = setInterval(checkLeaderStatus, 6000);

    const handleStorage = (e) => {
      if (e.key === LEADER_TAB_KEY || e.key === LEADER_HEARTBEAT_KEY) {
        checkLeaderStatus();
      }
    };
    window.addEventListener('storage', handleStorage);

    if (tabChannel) {
      tabChannel.onmessage = (msg) => {
        if (msg.data?.type === 'LEADER_RESIGN') {
          checkLeaderStatus();
        }
      };
    }

    return () => {
      clearInterval(leaderInterval);
      window.removeEventListener('storage', handleStorage);
      if (localStorage.getItem(LEADER_TAB_KEY) === TAB_ID) {
        localStorage.removeItem(LEADER_TAB_KEY);
        localStorage.removeItem(LEADER_HEARTBEAT_KEY);
        try {
          tabChannel?.postMessage({ type: 'LEADER_RESIGN', tabId: TAB_ID });
        } catch {}
      }
    };
  }, []);

  // 2. Autonomous Schedule & Auth State Watcher (08:00 - 17:30 Asia/Ho_Chi_Minh)
  useEffect(() => {
    const updateScheduleAndState = () => {
      const hasToken = Boolean(localStorage.getItem('token'));
      const inSchedule = isWithinWorkingSchedule();
      const newState = computeTrackingState({ isAuthenticated: hasToken, isWebOpen: true });

      telemetryStore.isScheduleOpen = inSchedule;
      if (telemetryStore.trackingState !== newState) {
        console.log(`[ActivityTracker] State transition: ${telemetryStore.trackingState} -> ${newState}`);
        telemetryStore.trackingState = newState;
        emitStoreUpdate();

        // If transition to OUTSIDE_SCHEDULE, flush pending queue before locking
        if (newState === 'TRACKING_OUTSIDE_SCHEDULE') {
          flushPendingQueueGlobal();
        }
      }
    };

    updateScheduleAndState();
    // Re-verify schedule and auth every 2 seconds
    scheduleCheckTimerRef.current = setInterval(updateScheduleAndState, 2000);

    // Also update on visibilitychange (laptop sleep/wake)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updateScheduleAndState();
        checkLeaderStatus();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (scheduleCheckTimerRef.current) clearInterval(scheduleCheckTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // 3. Desktop Companion Agent Heartbeat & Connection (Leader Tab Only)
  useEffect(() => {
    let mounted = true;

    const syncWithDesktopAgent = async () => {
      if (!mounted) return;
      const inSchedule = isWithinWorkingSchedule();
      const hasToken = Boolean(localStorage.getItem('token'));

      try {
        const status = await desktopAgentIpc.checkStatus();
        if (mounted) {
          telemetryStore.agentStatus = status;
          emitStoreUpdate();
        }

        // Leader Tab maintains active session with Desktop Agent
        if (telemetryStore.isLeaderTab && hasToken && inSchedule) {
          let token = localStorage.getItem('token');
          let refreshToken = localStorage.getItem('refreshToken');
          const backendUrl = window.location.port === '5173' ? 'http://localhost:5001' : window.location.origin;

          // Start or maintain heartbeat with agent
          if (!status.trackingActive) {
            await desktopAgentIpc.startTracking({ token, refreshToken, backendUrl });
          } else {
            await desktopAgentIpc.sendHeartbeat({ token, refreshToken });
          }
        }
      } catch {}
    };

    syncWithDesktopAgent();
    heartbeatTimerRef.current = setInterval(syncWithDesktopAgent, HEARTBEAT_INTERVAL_MS);

    return () => {
      mounted = false;
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
    };
  }, []);

  // 4. Auto-flush on page unload / web close
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Flush remaining events via sendBeacon
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

  // 5. Network Reconnection Handler
  useEffect(() => {
    const handleOnline = () => {
      if (telemetryStore.pendingQueue.length > 0 && isWithinWorkingSchedule()) {
        flushPendingQueueGlobal();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // 5b. Real-time Socket & Window Focus Sync with Server Summary
  useEffect(() => {
    const syncSummary = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;
      try {
        const res = await computerActivityApi.getMySummary();
        const data = res?.data || res;
        if (data) setServerSummary(data);
      } catch {}
    };

    syncSummary();

    const handleFocus = () => {
      syncSummary();
    };
    window.addEventListener('focus', handleFocus);

    let socketCleanup = null;
    const setupSocket = () => {
      const s = getSocket();
      if (!s) return;
      const handlePts = (data) => {
        if (!data) return;
        const userRaw = localStorage.getItem('user');
        let myId = null;
        try { myId = JSON.parse(userRaw)?.id; } catch {}
        if (myId && Number(data.userId) === Number(myId)) {
          setServerSummary({
            activityScore: data.activityScore !== undefined ? data.activityScore : data.serverPts,
            serverPts: data.serverPts !== undefined ? data.serverPts : data.activityScore,
            activeMinutes: data.activeMinutes,
            mouseClicks: data.mouseClicks,
            keyboardCount: data.keyboardCount,
            rank: data.rank,
            topApp: data.topApp,
          });
        }
      };
      s.on('activity:pts:updated', handlePts);
      socketCleanup = () => s.off('activity:pts:updated', handlePts);
    };

    setupSocket();
    const sockInterval = setInterval(() => {
      if (!socketCleanup && getSocket()) {
        setupSocket();
      }
    }, 3000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(sockInterval);
      if (socketCleanup) socketCleanup();
    };
  }, []);

  // 6. Active/Idle timer & interaction listeners (Active ONLY in schedule 08:00 - 17:30)
  useEffect(() => {
    if (trackingState !== 'TRACKING_ACTIVE') {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (activeSecondTimerRef.current) clearInterval(activeSecondTimerRef.current);
      if (debounceFlushTimerRef.current) clearTimeout(debounceFlushTimerRef.current);
      return;
    }

    // 1-second interval to calculate active vs idle seconds
    activeSecondTimerRef.current = setInterval(() => {
      const now = Date.now();
      const isCurrentlyIdle = now - lastInteractionTimeRef.current > 60000; // 60s idle

      if (!isCurrentlyIdle && isWithinWorkingSchedule()) {
        telemetryStore.pendingActiveSeconds += 1;
        recomputeTotals();
      }
    }, 1000);

    const recordInteraction = (type) => {
      // Strict schedule guard: No events created outside 08:00 - 17:30
      if (!isWithinWorkingSchedule()) {
        return;
      }

      const now = Date.now();
      lastInteractionTimeRef.current = now;
      telemetryStore.lastEventTime = now;

      // If desktop agent is actively tracking the entire computer, let the desktop agent
      // record system activity to prevent double counting browser clicks and keys
      if (telemetryStore.agentStatus?.trackingActive) {
        return;
      }

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

      if (telemetryStore.pendingQueue.length >= MAX_QUEUE_SIZE) {
        telemetryStore.pendingQueue.shift();
      }
      telemetryStore.pendingQueue.push(newEvent);

      // 2. INSTANT OPTIMISTIC SCORE UPDATE (< 1ms UI response)
      recomputeTotals();

      // 3. Fast flush if accumulated >= threshold, else debounced flush
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
  }, [trackingState, location.pathname]);
}
