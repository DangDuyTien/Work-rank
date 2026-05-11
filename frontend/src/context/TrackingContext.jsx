import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';
import { activity as activityApi } from '../services/api';

const TrackingContext = createContext(null);

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within TrackingProvider');
  return ctx;
}

export function TrackingProvider({ children }) {
  const { socket } = useAuth();
  
  const [tracking, setTracking] = useState(() => {
    return localStorage.getItem('workrank_tracking_active') === 'true';
  });
  const [seconds, setSeconds] = useState(0);
  const [localKeys, setLocalKeys] = useState(0);
  const [localClicks, setLocalClicks] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [score, setScore] = useState(0);
  const [connected, setConnected] = useState(true);
  const [scoreHistory, setScoreHistory] = useState([3, 5, 4, 7, 6, 8]);

  const keysRef = useRef(0);
  const clicksRef = useRef(0);
  const timerRef = useRef(null);
  const pingRef = useRef(null);
  const lastKeyTimes = useRef({});
  const keyHandlerRef = useRef(null);
  const clickHandlerRef = useRef(null);

  // Fetch initial totals on mount
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await activityApi.today();
        if (res.data) {
          setTotalKeys(Number(res.data.keystrokeCount || 0));
          setTotalClicks(Number(res.data.mouseClickCount || 0));
          setSeconds(Number(res.data.activeSeconds || 0));
          setScore(Number(res.data.focusScore || 0));
        }
      } catch (err) { console.error('Failed to fetch initial activity:', err); }
    };
    fetchInitial();
  }, []);

  const formatNum = useCallback((n) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  }, []);

  const formatTime = useCallback((s) => {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }, []);

  const latestSocketRef = useRef(socket);

  // Keep latestSocketRef updated
  useEffect(() => {
    latestSocketRef.current = socket;
  }, [socket]);

  const doPing = useCallback(() => {
    const k = keysRef.current;
    const c = clicksRef.current;
    const currentSocket = latestSocketRef.current;
    
    // Send to server via socket
    if (currentSocket?.connected) {
      currentSocket.emit('activity:heartbeat', {
        keystrokes: k,
        clicks: c,
        activeSeconds: 2.5, // ping interval
      });
    }

    if (k > 0 || c > 0) {
      keysRef.current = 0;
      clicksRef.current = 0;
      setConnected(true);
      setScore(prev => {
        const next = Math.min(100, prev + k + c);
        setScoreHistory(history => [...history.slice(-5), Math.min(10, Math.max(1, Math.round(next / 10)))]);
        return next;
      });
    }
  }, []);

  const idleTimeoutRef = useRef(null);

  const startTrack = useCallback(() => {
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    
    setTracking(true);
    localStorage.setItem('workrank_tracking_active', 'true');

    // Notify dashboard immediately
    const currentSocket = latestSocketRef.current;
    if (currentSocket?.connected) {
      currentSocket.emit('user:status', { status: 'active' });
    }
    
    // Setup event handlers if not already setup
    if (!keyHandlerRef.current) {
      const keyHandler = (event) => {
        if (event.repeat || event.isComposing) return;
        if (event.target?.closest?.('[data-no-track]')) return;
        const keyId = event.code || event.key || 'unknown';
        const now = Date.now();
        const last = lastKeyTimes.current[keyId] || 0;
        if (now - last < 120) return;
        lastKeyTimes.current[keyId] = now;
        keysRef.current++;
        setLocalKeys(p => p + 1);
      };
      const clickHandler = (event) => {
        if (event.target?.closest?.('[data-no-track]')) return;
        clicksRef.current++;
        setLocalClicks(p => p + 1);
      };
      keyHandlerRef.current = keyHandler;
      clickHandlerRef.current = clickHandler;
      window.addEventListener('keydown', keyHandler, true);
      document.addEventListener('mousedown', clickHandler, true);
    }

    if (!timerRef.current) timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    if (!pingRef.current) pingRef.current = setInterval(doPing, 2500);
    
    doPing();
  }, [doPing]);

  const stopTrack = useCallback(() => {
    setTracking(false);
    localStorage.setItem('workrank_tracking_active', 'false');

    // Final ping before stopping
    doPing();

    // Notify dashboard of idle status
    const currentSocket = latestSocketRef.current;
    if (currentSocket?.connected) {
      idleTimeoutRef.current = setTimeout(() => {
        currentSocket.emit('user:status', { status: 'idle' });
      }, 100); // Small delay to ensure heartbeat is processed first
    }

    if (keyHandlerRef.current) {
      window.removeEventListener('keydown', keyHandlerRef.current, true);
      keyHandlerRef.current = null;
    }
    if (clickHandlerRef.current) {
      document.removeEventListener('mousedown', clickHandlerRef.current, true);
      clickHandlerRef.current = null;
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }

  }, [doPing]);

  const toggle = useCallback(() => {
    if (tracking) stopTrack();
    else startTrack();
  }, [tracking, startTrack, stopTrack]);

  // Resume tracking or emit idle on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (tracking) {
        startTrack();
      } else {
        const currentSocket = latestSocketRef.current;
        if (currentSocket?.connected) {
          currentSocket.emit('user:status', { status: 'idle' });
        }
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, []);

  // Cleanup on unmount (app close)
  useEffect(() => {
    return () => {
      if (keyHandlerRef.current) window.removeEventListener('keydown', keyHandlerRef.current, true);
      if (clickHandlerRef.current) document.removeEventListener('mousedown', clickHandlerRef.current, true);
      if (timerRef.current) clearInterval(timerRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  const value = {
    tracking,
    seconds,
    localKeys,
    localClicks,
    totalKeys,
    totalClicks,
    score,
    connected,
    scoreHistory,
    formatNum,
    formatTime,
    startTrack,
    stopTrack,
    toggle,
  };

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}
