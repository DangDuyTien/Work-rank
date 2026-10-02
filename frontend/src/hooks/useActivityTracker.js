import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { activityApi, computerActivityApi, desktopAgentIpc } from '../services/api';

const SESSION_KEY = 'workrank:telemetry_session_id';
const TRACKING_ENABLED_KEY = 'workrank:tracking_enabled';
const FLUSH_INTERVAL_MS = 15000;
const HEARTBEAT_INTERVAL_MS = 10000;
const MAX_QUEUE_SIZE = 200;
const BATCH_TRIGGER_SIZE = 25;

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

// Module-level reactive store for computer & web activity telemetry
const telemetryStore = {
  isTrackingActive: getInitialTrackingState(),
  clicks: 0,
  keyboard: 0,
  activeSeconds: 0,
  idleSeconds: 0,
  agentStatus: { running: false, paired: false, trackingActive: false },
  lastEventTime: null,
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

/**
 * Global control functions
 */
export async function startTrackingGlobal(userData = {}) {
  try {
    sessionStorage.setItem(TRACKING_ENABLED_KEY, 'true');
  } catch {}
  telemetryStore.isTrackingActive = true;
  emitStoreUpdate();

  // 1. Notify Desktop Agent if running locally
  const token = localStorage.getItem('token');
  const backendUrl = window.location.port === '5173' ? 'http://localhost:5001' : window.location.origin;
  await desktopAgentIpc.startTracking({ token, user: userData, backendUrl });

  // Update agent status
  const status = await desktopAgentIpc.checkStatus();
  telemetryStore.agentStatus = status;
  emitStoreUpdate();
}

export async function stopTrackingGlobal() {
  try {
    sessionStorage.removeItem(TRACKING_ENABLED_KEY);
  } catch {}
  telemetryStore.isTrackingActive = false;
  emitStoreUpdate();

  // 1. Notify Desktop Agent to stop immediately
  await desktopAgentIpc.stopTracking();

  const status = await desktopAgentIpc.checkStatus();
  telemetryStore.agentStatus = status;
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

  return {
    ...stats,
    startTracking,
    stopTracking,
    toggleTracking,
  };
}

/**
 * Central Activity Tracker Hook.
 * Controls life-cycle of Computer & Web activity:
 * - Starts when user clicks BẬT on web.
 * - Automatically stops when web is closed (beforeunload, pagehide, tab closed).
 * - Periodically sends heartbeat to Desktop Agent.
 * - Runs fallback in-browser activity recorder if Desktop Agent is not running.
 * - STRICTLY NO keylogger, NO raw text capture, NO anti-cheat penalties.
 */
export function useActivityTracker() {
  const location = useLocation();
  const queueRef = useRef([]);
  const heartbeatTimerRef = useRef(null);
  const flushTimerRef = useRef(null);
  const activeSecondTimerRef = useRef(null);
  const lastInteractionTimeRef = useRef(Date.now());

  // 1. Check Desktop Agent status periodically
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
    const interval = setInterval(checkAgent, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Desktop Agent Heartbeat & Watchdog
  useEffect(() => {
    if (!telemetryStore.isTrackingActive) {
      if (heartbeatTimerRef.current) {
        clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = null;
      }
      return;
    }

    // Ping agent immediately when active
    desktopAgentIpc.sendHeartbeat();

    // Heartbeat every 10s to keep agent active
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
  }, [telemetryStore.isTrackingActive]);

  // 3. Fallback Web Batch Sender (Used when Desktop Agent is not running)
  const flushWebQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return;

    // If Desktop Agent is already running, let agent handle full computer activity to avoid double count
    if (telemetryStore.agentStatus?.running && telemetryStore.agentStatus?.trackingActive) {
      queueRef.current = [];
      return;
    }

    const eventsToSend = queueRef.current.splice(0, BATCH_TRIGGER_SIZE * 2);
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await computerActivityApi.recordBatch({
        sessionId: telemetryStore.sessionId,
        devicePlatform: 'web',
        events: eventsToSend,
      });
    } catch {
      // Silently ignore network failures without interfering with user
    }
  }, []);

  // 4. Auto-stop when web closes ("tắt web thì sẽ tự ngắt")
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 1. Immediately signal Desktop Agent to stop
      desktopAgentIpc.stopTracking();

      // 2. If fallback web events exist, flush with keepalive
      if (queueRef.current.length > 0 && !telemetryStore.agentStatus?.running) {
        try {
          const payload = JSON.stringify({
            sessionId: telemetryStore.sessionId,
            devicePlatform: 'web',
            events: queueRef.current,
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

  // 5. Active/Idle timer & interaction listeners (Only active when isTrackingActive is true)
  useEffect(() => {
    if (!telemetryStore.isTrackingActive) {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (activeSecondTimerRef.current) clearInterval(activeSecondTimerRef.current);
      return;
    }

    // 1-second interval to calculate active vs idle seconds
    activeSecondTimerRef.current = setInterval(() => {
      const now = Date.now();
      const isCurrentlyIdle = now - lastInteractionTimeRef.current > 60000; // 60s idle

      if (isCurrentlyIdle) {
        telemetryStore.idleSeconds += 1;
      } else {
        telemetryStore.activeSeconds += 1;
      }
    }, 1000);

    const recordInteraction = (type) => {
      lastInteractionTimeRef.current = Date.now();
      telemetryStore.lastEventTime = Date.now();

      if (type === 'click') {
        telemetryStore.clicks += 1;
      } else if (type === 'key') {
        telemetryStore.keyboard += 1;
      }
      emitStoreUpdate();

      // Queue event for fallback web sync if desktop agent not running
      if (!telemetryStore.agentStatus?.running) {
        if (queueRef.current.length >= MAX_QUEUE_SIZE) {
          queueRef.current.shift();
        }
        queueRef.current.push({
          state: 'ACTIVE',
          activeApp: 'WorkRank Web',
          appCategory: 'BROWSER',
          context: 'WEB',
          activeSeconds: 1,
          idleSeconds: 0,
          mouseClicks: type === 'click' ? 1 : 0,
          keyboardCount: type === 'key' ? 1 : 0,
          occurredAt: new Date().toISOString(),
        });
      }
    };

    const handleClick = () => recordInteraction('click');
    const handleKeyDown = () => recordInteraction('key');

    window.addEventListener('click', handleClick, { passive: true, capture: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true, capture: true });

    // Periodic flush
    flushTimerRef.current = setInterval(() => {
      flushWebQueue();
    }, FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      if (activeSecondTimerRef.current) clearInterval(activeSecondTimerRef.current);
      flushWebQueue();
    };
  }, [telemetryStore.isTrackingActive, flushWebQueue, location.pathname]);
}
