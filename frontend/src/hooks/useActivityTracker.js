import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { activityApi } from '../services/api';

const SESSION_KEY = 'workrank:telemetry_session_id';
const FLUSH_INTERVAL_MS = 8000;
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

// Module-level reactive store for live activity telemetry counters
const telemetryStore = {
  clicks: 0,
  keyboard: 0,
  mouseTrackingEnabled: true,
  keyboardTrackingEnabled: true,
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
 * Hook to consume live activity telemetry stats in any component (header, game hud, dashboard)
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

  return stats;
}

/**
 * Pure Telemetry Activity Tracker Hook.
 * Records CLICK and KEYBOARD_ACTIVITY.
 * STRICTLY NO anti-cheat, NO suspicious flags, NO user scoring, NO capturing of typed content/passwords.
 */
export function useActivityTracker() {
  const location = useLocation();
  const queueRef = useRef([]);
  const settingsRef = useRef({ mouseTrackingEnabled: true, keyboardTrackingEnabled: true });
  const sessionIdRef = useRef(telemetryStore.sessionId);
  const timerRef = useRef(null);

  // 1. Fetch system tracking settings periodically
  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      try {
        const settings = await activityApi.getSettings();
        if (mounted && settings) {
          const mEnabled = settings.mouseTrackingEnabled !== false;
          const kEnabled = settings.keyboardTrackingEnabled !== false;
          settingsRef.current = {
            mouseTrackingEnabled: mEnabled,
            keyboardTrackingEnabled: kEnabled,
          };
          telemetryStore.mouseTrackingEnabled = mEnabled;
          telemetryStore.keyboardTrackingEnabled = kEnabled;
          emitStoreUpdate();
        }
      } catch {
        // Fallback to active by default
      }
    };

    fetchSettings();
    const interval = setInterval(fetchSettings, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Batch Sender
  const flushQueue = useRef(() => {
    if (queueRef.current.length === 0) return;

    const eventsToSend = queueRef.current.splice(0, BATCH_TRIGGER_SIZE * 2);
    const token = localStorage.getItem('token');

    try {
      // Use standard API call
      activityApi.sendBatch(eventsToSend).catch(() => {
        // Silently ignore network failures without interfering with user
      });
    } catch {
      // Ignore
    }
  });

  // 3. Listeners setup
  useEffect(() => {
    const pushEvent = (eventType, metadata = null) => {
      if (queueRef.current.length >= MAX_QUEUE_SIZE) {
        queueRef.current.shift(); // Drop oldest to avoid memory leak
      }

      queueRef.current.push({
        eventType,
        route: window.location.pathname,
        sessionId: sessionIdRef.current,
        occurredAt: new Date().toISOString(),
        metadata,
      });

      if (queueRef.current.length >= BATCH_TRIGGER_SIZE) {
        flushQueue.current();
      }
    };

    // Click handler
    const handleClick = (e) => {
      if (!settingsRef.current.mouseTrackingEnabled) return;

      let targetIdentifier = null;
      let tagName = null;

      if (e.target) {
        tagName = e.target.tagName ? e.target.tagName.toLowerCase() : null;
        targetIdentifier =
          e.target.getAttribute?.('data-action') ||
          e.target.getAttribute?.('id') ||
          e.target.getAttribute?.('name') ||
          (tagName === 'button' ? e.target.innerText?.slice(0, 30) : null) ||
          tagName;
      }

      pushEvent('CLICK', {
        target: targetIdentifier ? String(targetIdentifier).slice(0, 60) : undefined,
        tag: tagName ? String(tagName).slice(0, 20) : undefined,
      });

      telemetryStore.clicks += 1;
      telemetryStore.lastEventTime = Date.now();
      emitStoreUpdate();
    };

    // Keyboard handler - strictly records existence of keyboard activity, NO typed characters/values
    const handleKeyDown = () => {
      if (!settingsRef.current.keyboardTrackingEnabled) return;

      pushEvent('KEYBOARD_ACTIVITY', {
        event: 'keypress',
      });

      telemetryStore.keyboard += 1;
      telemetryStore.lastEventTime = Date.now();
      emitStoreUpdate();
    };

    // Flush on page unload or visibility change
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushQueue.current();
      }
    };

    window.addEventListener('click', handleClick, { passive: true, capture: true });
    window.addEventListener('keydown', handleKeyDown, { passive: true, capture: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handleVisibilityChange);

    // Periodic flush timer
    timerRef.current = setInterval(() => {
      flushQueue.current();
    }, FLUSH_INTERVAL_MS);

    return () => {
      window.removeEventListener('click', handleClick, { capture: true });
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handleVisibilityChange);
      if (timerRef.current) clearInterval(timerRef.current);
      flushQueue.current();
    };
  }, [location.pathname]);
}
