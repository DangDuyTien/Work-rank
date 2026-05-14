import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { activity as activityApi } from '../services/api';

const TrackingContext = createContext(null);
const DESKTOP_PROTOCOL = 'workrank';
const COMMAND_CONFIRM_TIMEOUT_MS = 8_000;

function buildDesktopTrackerUrl(action) {
  const params = new URLSearchParams();
  const token = localStorage.getItem('token');
  const refreshToken = localStorage.getItem('refreshToken');
  if (token) params.set('token', token);
  if (refreshToken) params.set('refreshToken', refreshToken);
  params.set('ts', String(Date.now()));
  return `${DESKTOP_PROTOCOL}://${action}?${params.toString()}`;
}

function triggerDesktopTracker(action) {
  try {
    const url = buildDesktopTrackerUrl(action);
    const link = document.createElement('a');
    link.href = url;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
      const frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.src = url;
      document.body.appendChild(frame);
      window.setTimeout(() => frame.remove(), 1500);
    }, 150);
  } catch (err) {
    console.warn('Could not launch desktop tracker:', err);
  }
}

async function launchDesktopTracker(action) {
  triggerDesktopTracker(action);
  try {
    await activityApi.desktopLaunch(action);
  } catch (err) {
    console.warn('Could not launch desktop tracker via backend fallback:', err.message);
  }
}

export function useTracking() {
  const ctx = useContext(TrackingContext);
  if (!ctx) throw new Error('useTracking must be used within TrackingProvider');
  return ctx;
}

export function TrackingProvider({ children }) {
  const { socket } = useAuth();

  const [trackingState, setTrackingStateState] = useState('idle');
  const [tracking, setTracking] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [activeSecondsToday, setActiveSecondsToday] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [score, setScore] = useState(0);
  const [connected, setConnected] = useState(true);
  const [desktopLaunchStatus, setDesktopLaunchStatus] = useState('');
  const [desktopLaunchStatusType, setDesktopLaunchStatusType] = useState('info');
  const [scoreHistory, setScoreHistory] = useState([3, 5, 4, 7, 6, 8]);
  const [desktopOnline, setDesktopOnline] = useState(false);
  const [desktopTracking, setDesktopTracking] = useState(false);
  const [desktopTrackingStartedAt, setDesktopTrackingStartedAt] = useState(null);
  const [desktopInfo, setDesktopInfo] = useState(null);

  const latestSocketRef = useRef(socket);
  const desktopOnlineRef = useRef(false);
  const desktopTrackingRef = useRef(false);
  const trackingStateRef = useRef('idle');
  const commandTimeoutRef = useRef(null);
  const idleTimeoutRef = useRef(null);

  const setTrackingState = useCallback((nextState) => {
    trackingStateRef.current = nextState;
    setTrackingStateState(nextState);
    setTracking(nextState === 'active');
  }, []);

  const clearCommandTimeout = useCallback(() => {
    if (commandTimeoutRef.current) {
      clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
  }, []);

  const updateDesktopLaunchStatus = useCallback((message, type = 'info') => {
    setDesktopLaunchStatus(message);
    setDesktopLaunchStatusType(type);
  }, []);

  const applyTotals = useCallback((totals = {}) => {
    setTotalKeys(Number(totals.keystrokeCount || totals.total_keystrokes || 0));
    setTotalClicks(Number(totals.mouseClickCount || totals.total_mouse_clicks || 0));
    setActiveSecondsToday(Number(totals.activeSeconds || totals.total_active_seconds || 0));
    setScore(Number(totals.focusScore || totals.score || 0));
    setScoreHistory((history) => {
      const next = Number(totals.focusScore || totals.score || 0);
      return [...history.slice(-5), Math.min(10, Math.max(1, Math.round(next / 10)))];
    });
  }, []);

  const applyDesktopStatus = useCallback((payload = {}) => {
    const isOnline = !!payload.online;
    const error = payload.error || '';
    const isTracking = isOnline && !!payload.tracking && !error;
    const previousState = trackingStateRef.current;

    setDesktopOnline(isOnline);
    setDesktopTracking(isTracking);
    desktopOnlineRef.current = isOnline;
    desktopTrackingRef.current = isTracking;

    if (isOnline) {
      setDesktopInfo({
        deviceName: payload.deviceName,
        platform: payload.platform,
        lastHeartbeat: payload.lastHeartbeat,
        trackingStartedAt: payload.trackingStartedAt,
        sessionId: payload.sessionId,
        error,
      });
    } else {
      setDesktopInfo(null);
    }

    if (error) {
      clearCommandTimeout();
      setDesktopTrackingStartedAt(null);
      setSeconds(0);
      setTrackingState('error');
      updateDesktopLaunchStatus(error, 'error');
      return;
    }

    if (!isOnline) {
      if (previousState === 'active' || previousState === 'stopping') {
        clearCommandTimeout();
        setDesktopTrackingStartedAt(null);
        setSeconds(0);
        setTrackingState('idle');
        updateDesktopLaunchStatus('Desktop Tracker đã offline. Web đã dừng trạng thái theo dõi.', 'warning');
      } else if (previousState !== 'starting') {
        setDesktopTrackingStartedAt(null);
        setSeconds(0);
        setTrackingState('idle');
      }
      return;
    }

    if (isTracking) {
      clearCommandTimeout();
      setDesktopTrackingStartedAt(payload.trackingStartedAt || null);
      setTrackingState('active');
      if (previousState === 'starting' || previousState === 'idle' || previousState === 'error') {
        updateDesktopLaunchStatus('Desktop Tracker đã xác nhận bắt đầu theo dõi.', 'success');
      }
      return;
    }

    if (previousState === 'stopping') {
      clearCommandTimeout();
      setDesktopTrackingStartedAt(null);
      setSeconds(0);
      setTrackingState('idle');
      updateDesktopLaunchStatus('Desktop Tracker đã xác nhận dừng theo dõi.', 'success');
      return;
    }

    if (previousState === 'starting') {
      updateDesktopLaunchStatus('Desktop Tracker đang online. Đang chờ app xác nhận bắt đầu...', 'info');
      return;
    }

    setDesktopTrackingStartedAt(null);
    setSeconds(0);
    setTrackingState('idle');
  }, [clearCommandTimeout, setTrackingState, updateDesktopLaunchStatus]);

  useEffect(() => {
    if (trackingState !== 'active' || !desktopTrackingStartedAt) {
      setSeconds(0);
      return undefined;
    }

    const updateSessionSeconds = () => {
      const startedMs = Date.parse(desktopTrackingStartedAt);
      if (!Number.isFinite(startedMs)) {
        setSeconds(0);
        return;
      }
      setSeconds(Math.max(0, Math.floor((Date.now() - startedMs) / 1000)));
    };

    updateSessionSeconds();
    const interval = window.setInterval(updateSessionSeconds, 1000);
    return () => window.clearInterval(interval);
  }, [trackingState, desktopTrackingStartedAt]);

  const fetchDesktopStatus = useCallback(async () => {
    const res = await activityApi.desktopStatus();
    const data = res.data || res;
    applyDesktopStatus(data);
    return data;
  }, [applyDesktopStatus]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await activityApi.today();
        if (res.data) applyTotals(res.data);
      } catch (err) {
        console.error('Failed to fetch initial activity:', err);
      }
    };
    fetchInitial();
  }, [applyTotals]);

  useEffect(() => {
    fetchDesktopStatus().catch((err) => {
      console.warn('Could not check desktop status:', err.message);
    });
    const interval = window.setInterval(() => {
      fetchDesktopStatus().catch((err) => {
        console.warn('Could not check desktop status:', err.message);
      });
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [fetchDesktopStatus]);

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

  useEffect(() => {
    latestSocketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleDesktopStatus = (payload) => {
      applyDesktopStatus(payload);
    };

    const handleActivityUpdate = (payload) => {
      if (payload?.totals) applyTotals(payload.totals);
    };

    socket.on('desktop:status', handleDesktopStatus);
    socket.on('activity:user:update', handleActivityUpdate);

    return () => {
      socket.off('desktop:status', handleDesktopStatus);
      socket.off('activity:user:update', handleActivityUpdate);
    };
  }, [socket, applyDesktopStatus, applyTotals]);

  useEffect(() => {
    if (!socket) {
      setConnected(false);
      return undefined;
    }

    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleConnectError = () => setConnected(false);

    setConnected(socket.connected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
    };
  }, [socket]);

  const sendDesktopCommand = useCallback((action) => new Promise((resolve) => {
    const currentSocket = latestSocketRef.current;
    if (!currentSocket?.connected) {
      resolve(false);
      return;
    }

    let done = false;
    const timer = window.setTimeout(() => {
      if (done) return;
      done = true;
      resolve(false);
    }, 2500);

    currentSocket.emit('desktop:command', { action }, (ack) => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      if (!ack?.ok) console.warn(`Desktop command '${action}' failed:`, ack?.error);
      resolve(!!ack?.ok);
    });
  }), []);

  const armCommandTimeout = useCallback((action) => {
    clearCommandTimeout();
    commandTimeoutRef.current = window.setTimeout(async () => {
      try {
        const status = await fetchDesktopStatus();
        const confirmed = action === 'start'
          ? status.online && status.tracking && !status.error
          : status.online && !status.tracking && !status.error;
        if (confirmed) return;
      } catch {
        // The status message below is clearer for users than the raw request error.
      }

      if (action === 'start') {
        setTrackingState('error');
        updateDesktopLaunchStatus('Desktop Tracker chưa phản hồi. Web không tự đếm nữa, hãy mở Desktop Tracker và cấp quyền Accessibility.', 'error');
      } else {
        setTrackingState('idle');
        updateDesktopLaunchStatus('Chưa nhận được xác nhận dừng từ Desktop Tracker. Web đã chuyển về trạng thái chờ.', 'warning');
      }
    }, COMMAND_CONFIRM_TIMEOUT_MS);
  }, [clearCommandTimeout, fetchDesktopStatus, setTrackingState, updateDesktopLaunchStatus]);

  const startTrack = useCallback(async (options = {}) => {
    const { launchDesktop = true } = options;
    const currentState = trackingStateRef.current;
    if (currentState === 'active' || currentState === 'starting') return false;

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }

    setTrackingState('starting');
    armCommandTimeout('start');

    if (launchDesktop) {
      void launchDesktopTracker('start');
    }

    if (desktopOnlineRef.current) {
      updateDesktopLaunchStatus('Đã gửi lệnh bắt đầu. Đang chờ Desktop Tracker xác nhận...', 'info');
      const delivered = await sendDesktopCommand('start');
      if (!delivered) {
        updateDesktopLaunchStatus('Desktop Tracker đang online nhưng chưa nhận lệnh. Hãy kiểm tra app Desktop.', 'warning');
      }
    } else {
      updateDesktopLaunchStatus('Desktop Tracker chưa online. Đang thử mở app và chờ phản hồi...', 'warning');
    }

    return true;
  }, [armCommandTimeout, sendDesktopCommand, setTrackingState, updateDesktopLaunchStatus]);

  const stopTrack = useCallback(async (options = {}) => {
    const { stopDesktop = true } = options;
    const currentState = trackingStateRef.current;
    if (currentState === 'idle' || currentState === 'stopping') return false;

    setTrackingState('stopping');
    armCommandTimeout('stop');

    if (stopDesktop) {
      void launchDesktopTracker('stop');
    }

    if (desktopOnlineRef.current) {
      updateDesktopLaunchStatus('Đã gửi lệnh dừng. Đang chờ Desktop Tracker xác nhận...', 'info');
      const delivered = await sendDesktopCommand('stop');
      if (!delivered) {
        updateDesktopLaunchStatus('Desktop Tracker đang online nhưng chưa nhận lệnh dừng.', 'warning');
      }
    } else {
      setTrackingState('idle');
      clearCommandTimeout();
      updateDesktopLaunchStatus('Desktop Tracker đang offline. Web đã chuyển về trạng thái chờ.', 'warning');
    }

    const currentSocket = latestSocketRef.current;
    if (currentSocket?.connected) {
      idleTimeoutRef.current = window.setTimeout(() => {
        currentSocket.emit('user:status', { status: 'idle' });
      }, 100);
    }

    return true;
  }, [armCommandTimeout, clearCommandTimeout, sendDesktopCommand, setTrackingState, updateDesktopLaunchStatus]);

  const toggle = useCallback(() => {
    const currentState = trackingStateRef.current;
    if (currentState === 'starting' || currentState === 'stopping') return;
    if (currentState === 'active') void stopTrack();
    else void startTrack();
  }, [startTrack, stopTrack]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const currentSocket = latestSocketRef.current;
      if (currentSocket?.connected && trackingStateRef.current !== 'active') {
        currentSocket.emit('user:status', { status: 'idle' });
      }
    }, 500);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => () => {
    clearCommandTimeout();
    if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
  }, [clearCommandTimeout]);

  const trackingPending = trackingState === 'starting' || trackingState === 'stopping';

  const value = {
    tracking,
    trackingState,
    trackingPending,
    seconds,
    activeSecondsToday,
    totalKeys,
    totalClicks,
    score,
    connected,
    desktopLaunchStatus,
    desktopLaunchStatusType,
    scoreHistory,
    desktopOnline,
    desktopTracking,
    desktopInfo,
    formatNum,
    formatTime,
    startTrack,
    stopTrack,
    toggle,
    sendDesktopCommand,
  };

  return (
    <TrackingContext.Provider value={value}>
      {children}
    </TrackingContext.Provider>
  );
}
