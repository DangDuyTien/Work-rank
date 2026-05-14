import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { activity as activityApi } from '../services/api';

const TrackingContext = createContext(null);
const DESKTOP_PROTOCOL = 'workrank';

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
    setTimeout(() => {
      const frame = document.createElement('iframe');
      frame.style.display = 'none';
      frame.src = url;
      document.body.appendChild(frame);
      setTimeout(() => frame.remove(), 1500);
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
  
  const [tracking, setTracking] = useState(() => {
    return localStorage.getItem('workrank_tracking_active') === 'true';
  });
  const [seconds, setSeconds] = useState(0);
  const [totalKeys, setTotalKeys] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [score, setScore] = useState(0);
  const [connected, setConnected] = useState(true);
  const [desktopLaunchStatus, setDesktopLaunchStatus] = useState('');
  const [scoreHistory, setScoreHistory] = useState([3, 5, 4, 7, 6, 8]);

  // Desktop status state
  const [desktopOnline, setDesktopOnline] = useState(false);
  const [desktopTracking, setDesktopTracking] = useState(false);
  const [desktopInfo, setDesktopInfo] = useState(null);

  const timerRef = useRef(null);
  const desktopOnlineRef = useRef(false);
  const desktopLaunchAttemptRef = useRef(0);

  const clearLocalTimers = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const syncTrackingState = useCallback((active) => {
    setTracking(active);
    localStorage.setItem('workrank_tracking_active', active ? 'true' : 'false');
    if (!active) clearLocalTimers();
  }, [clearLocalTimers]);

  const applyTotals = useCallback((totals = {}) => {
    setTotalKeys(Number(totals.keystrokeCount || totals.total_keystrokes || 0));
    setTotalClicks(Number(totals.mouseClickCount || totals.total_mouse_clicks || 0));
    setSeconds(Number(totals.activeSeconds || totals.total_active_seconds || 0));
    setScore(Number(totals.focusScore || totals.score || 0));
    setScoreHistory((history) => {
      const next = Number(totals.focusScore || totals.score || 0);
      return [...history.slice(-5), Math.min(10, Math.max(1, Math.round(next / 10)))];
    });
  }, []);

  // Fetch initial totals on mount (these already include data from ALL devices for this user)
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await activityApi.today();
        if (res.data) applyTotals(res.data);
      } catch (err) { console.error('Failed to fetch initial activity:', err); }
    };
    fetchInitial();
  }, [applyTotals]);

  // Check desktop status on mount via HTTP
  useEffect(() => {
    const checkDesktopStatus = async () => {
      try {
        const res = await activityApi.desktopStatus();
        const data = res.data || res;
        setDesktopOnline(!!data.online);
        setDesktopTracking(!!data.tracking);
        desktopOnlineRef.current = !!data.online;
        if (data.online) {
          syncTrackingState(!!data.tracking);
          setDesktopInfo({
            deviceName: data.deviceName,
            platform: data.platform,
            lastHeartbeat: data.lastHeartbeat,
            error: data.error,
          });
          if (data.error) {
            setDesktopLaunchStatus(`❌ ${data.error}`);
          }
        }
      } catch (err) {
        console.warn('Could not check desktop status:', err.message);
      }
    };
    checkDesktopStatus();
    // Poll every 15s as fallback
    const interval = setInterval(checkDesktopStatus, 15_000);
    return () => clearInterval(interval);
  }, [syncTrackingState]);

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

  // Listen for desktop status updates via socket
  useEffect(() => {
    if (!socket) return undefined;

    const handleDesktopStatus = (payload) => {
      const wasOnline = desktopOnlineRef.current;
      const isOnline = !!payload.online;
      setDesktopOnline(isOnline);
      setDesktopTracking(!!payload.tracking);
      desktopOnlineRef.current = isOnline;
      if (isOnline) {
        syncTrackingState(!!payload.tracking);
        setDesktopInfo({
          deviceName: payload.deviceName,
          platform: payload.platform,
          lastHeartbeat: payload.lastHeartbeat,
          error: payload.error,
        });
        if (payload.error) {
          setDesktopLaunchStatus(`❌ ${payload.error}`);
        } else if (!wasOnline) {
          setDesktopLaunchStatus('✅ Desktop Tracker đang online.');
        }
      } else {
        setDesktopInfo(null);
      }
    };

    socket.on('desktop:status', handleDesktopStatus);

    // Desktop is the only activity source; web just refreshes the totals it emits.
    const handleActivityUpdate = (payload) => {
      if (payload?.totals) {
        applyTotals(payload.totals);
      }
    };
    socket.on('activity:user:update', handleActivityUpdate);

    return () => {
      socket.off('desktop:status', handleDesktopStatus);
      socket.off('activity:user:update', handleActivityUpdate);
    };
  }, [socket, applyTotals, syncTrackingState]);

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

  const idleTimeoutRef = useRef(null);

  // Send command to desktop tracker via socket
  const sendDesktopCommand = useCallback((action) => {
    const currentSocket = latestSocketRef.current;
    if (!currentSocket?.connected) return false;

    currentSocket.emit('desktop:command', { action }, (ack) => {
      if (ack?.ok) {
        console.log(`Desktop command '${action}' sent successfully`);
      } else {
        console.warn(`Desktop command '${action}' failed:`, ack?.error);
      }
    });
    return true;
  }, []);

  const startTrack = useCallback((options = {}) => {
    const { launchDesktop = true } = options;
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = null;
    }
    
    syncTrackingState(true);
    clearLocalTimers();

    if (launchDesktop) {
      void launchDesktopTracker('start');
      desktopLaunchAttemptRef.current = Date.now();
      if (desktopOnlineRef.current) {
        // Desktop is online — send start command via socket
        sendDesktopCommand('start');
        setDesktopLaunchStatus('✅ Desktop Tracker đang online. Đã gửi lệnh bắt đầu.');
      } else {
        // Desktop is offline — try to launch via custom protocol
        setDesktopLaunchStatus('⚠️ Desktop Tracker chưa online. Đang thử mở app...');
        // Check again after 5s
        setTimeout(async () => {
          try {
            const res = await activityApi.desktopStatus();
            const data = res.data || res;
            if (data.online) {
              setDesktopOnline(true);
              setDesktopTracking(!!data.tracking);
              desktopOnlineRef.current = true;
              if (data.error) {
                setDesktopLaunchStatus(`❌ ${data.error}`);
              } else {
                setDesktopLaunchStatus(data.tracking ? '✅ Desktop Tracker đã kết nối thành công!' : '✅ Desktop Tracker đã online.');
              }
            } else {
              syncTrackingState(false);
              setDesktopLaunchStatus('❌ Desktop Tracker chưa phản hồi. Web không tự đếm nữa, hãy mở Desktop Tracker và cấp quyền Accessibility.');
            }
          } catch {
            syncTrackingState(false);
            setDesktopLaunchStatus('❌ Không thể kiểm tra Desktop Tracker.');
          }
        }, 5000);
      }
    }

    // Notify dashboard immediately
    const currentSocket = latestSocketRef.current;
    if (currentSocket?.connected) {
      currentSocket.emit('user:status', { status: 'active' });
    }
    
    if (!timerRef.current) timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
  }, [clearLocalTimers, sendDesktopCommand, syncTrackingState]);

  useEffect(() => {
    if (!tracking || desktopOnline) return undefined;
    const now = Date.now();
    if (now - desktopLaunchAttemptRef.current < 10_000) return undefined;
    desktopLaunchAttemptRef.current = now;
    void launchDesktopTracker('start');
    setDesktopLaunchStatus('⚠️ Web đang bật nhưng Desktop Tracker offline. Đang thử mở Desktop Tracker...');
    return undefined;
  }, [tracking, desktopOnline]);

  const stopTrack = useCallback((options = {}) => {
    const { stopDesktop = true } = options;
    syncTrackingState(false);

    if (stopDesktop) {
      void launchDesktopTracker('stop');
      if (desktopOnlineRef.current) {
        // Desktop is online — send stop command via socket
        sendDesktopCommand('stop');
        setDesktopLaunchStatus('Đã gửi lệnh dừng Desktop Tracker.');
      } else {
        setDesktopLaunchStatus('Đã gửi lệnh dừng Desktop Tracker.');
      }
    }

    // Notify dashboard of idle status
    const currentSocket = latestSocketRef.current;
    if (currentSocket?.connected) {
      idleTimeoutRef.current = setTimeout(() => {
        currentSocket.emit('user:status', { status: 'idle' });
      }, 100); // Small delay to ensure heartbeat is processed first
    }

    clearLocalTimers();
  }, [clearLocalTimers, sendDesktopCommand, syncTrackingState]);

  const toggle = useCallback(() => {
    if (tracking) void stopTrack();
    else void startTrack();
  }, [tracking, startTrack, stopTrack]);

  // Resume tracking or emit idle on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (tracking) {
        void startTrack({ launchDesktop: true });
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
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const value = {
    tracking,
    seconds,
    totalKeys,
    totalClicks,
    score,
    connected,
    desktopLaunchStatus,
    scoreHistory,
    // Desktop status
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
