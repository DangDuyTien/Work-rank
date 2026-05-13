import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { activity as activityApi } from '../services/api';

const TrackingContext = createContext(null);
const DEVICE_UUID_KEY = 'workrank_web_device_uuid';
const DEVICE_SECRET_KEY = 'workrank_web_device_secret';
const DEVICE_SEQUENCE_KEY = 'workrank_web_sequence';
const DESKTOP_PROTOCOL = 'workrank';

function getOrCreateDeviceUuid() {
  let value = localStorage.getItem(DEVICE_UUID_KEY);
  if (!value) {
    const random = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    value = `web-${random}`;
    localStorage.setItem(DEVICE_UUID_KEY, value);
  }
  return value;
}

function detectPlatform() {
  const platform = `${navigator.platform || ''} ${navigator.userAgent || ''}`.toLowerCase();
  if (platform.includes('win')) return 'windows';
  if (platform.includes('mac')) return 'macos';
  return 'linux';
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

async function signPayload(secret, payload) {
  const encoder = new TextEncoder();
  const key = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await window.crypto.subtle.sign('HMAC', key, encoder.encode(canonicalJson(payload)));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

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
    const link = document.createElement('a');
    link.href = buildDesktopTrackerUrl(action);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (err) {
    console.warn('Could not launch desktop tracker:', err);
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
  const [localKeys, setLocalKeys] = useState(0);
  const [localClicks, setLocalClicks] = useState(0);
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

  const keysRef = useRef(0);
  const clicksRef = useRef(0);
  const timerRef = useRef(null);
  const pingRef = useRef(null);
  const lastKeyTimes = useRef({});
  const keyHandlerRef = useRef(null);
  const clickHandlerRef = useRef(null);
  const flushingRef = useRef(false);
  const sessionIdRef = useRef(null);
  const lastFlushAtRef = useRef(Date.now());
  const lastActivityAtRef = useRef(Date.now());
  const deviceUuidRef = useRef(getOrCreateDeviceUuid());
  const deviceSecretRef = useRef(localStorage.getItem(DEVICE_SECRET_KEY) || '');
  const sequenceRef = useRef(Number(localStorage.getItem(DEVICE_SEQUENCE_KEY) || 0));
  const desktopOnlineRef = useRef(false);

  // Fetch initial totals on mount (these already include data from ALL devices for this user)
  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const res = await activityApi.today();
        if (res.data) {
          setTotalKeys(Number(res.data.keystrokeCount || res.data.total_keystrokes || 0));
          setTotalClicks(Number(res.data.mouseClickCount || res.data.total_mouse_clicks || 0));
          setSeconds(Number(res.data.activeSeconds || res.data.total_active_seconds || 0));
          setScore(Number(res.data.focusScore || res.data.score || 0));
        }
      } catch (err) { console.error('Failed to fetch initial activity:', err); }
    };
    fetchInitial();
  }, []);

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

    // Also listen for activity updates from desktop to refresh totals
    const handleActivityUpdate = (payload) => {
      if (payload?.totals) {
        setTotalKeys(Number(payload.totals.keystrokeCount || 0));
        setTotalClicks(Number(payload.totals.mouseClickCount || 0));
        setSeconds(Number(payload.totals.activeSeconds || 0));
        setScore(Number(payload.totals.focusScore || 0));
      }
    };
    socket.on('activity:user:update', handleActivityUpdate);

    return () => {
      socket.off('desktop:status', handleDesktopStatus);
      socket.off('activity:user:update', handleActivityUpdate);
    };
  }, [socket]);

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

  const ensureSession = useCallback(async () => {
    if (sessionIdRef.current && deviceSecretRef.current) return sessionIdRef.current;

    const res = await activityApi.startSession({
      deviceUuid: deviceUuidRef.current,
      deviceName: `${navigator.userAgent || 'Web browser'}`.slice(0, 120),
      platform: detectPlatform(),
      appVersion: 'web',
      ...(deviceSecretRef.current ? { deviceSecret: deviceSecretRef.current } : {}),
    });

    sessionIdRef.current = res.data.session.id;
    if (res.data.deviceSecret) {
      deviceSecretRef.current = res.data.deviceSecret;
      localStorage.setItem(DEVICE_SECRET_KEY, res.data.deviceSecret);
    }
    const serverSequence = Number(res.data.lastSequence || res.data.device?.lastSequence || 0);
    if (serverSequence > sequenceRef.current) {
      sequenceRef.current = serverSequence;
      localStorage.setItem(DEVICE_SEQUENCE_KEY, String(serverSequence));
    }
    return sessionIdRef.current;
  }, []);

  const doPing = useCallback(async () => {
    const k = keysRef.current;
    const c = clicksRef.current;
    const now = Date.now();

    if (flushingRef.current) return false;
    if (k <= 0 && c <= 0) {
      lastFlushAtRef.current = now;
      return false;
    }

    flushingRef.current = true;
    const sequence = sequenceRef.current + 1;
    const activeSeconds = Math.max(1, Math.min(3600, Math.floor((now - lastFlushAtRef.current) / 1000) || 1));
    const event = {
      timestamp: new Date(now).toISOString(),
      activeSeconds,
      idleSeconds: 0,
      keystrokeCount: k,
      mouseClickCount: c,
      mouseMoveCount: 0,
      sequence,
    };

    try {
      const sessionId = await ensureSession();
      const payload = {
        deviceUuid: deviceUuidRef.current,
        deviceName: `${navigator.userAgent || 'Web browser'}`.slice(0, 120),
        platform: detectPlatform(),
        appVersion: 'web',
        deviceSecret: deviceSecretRef.current,
        sessionId,
        events: [event],
      };
      const signed = JSON.parse(JSON.stringify(payload));
      delete signed.deviceSecret;
      payload.signature = await signPayload(deviceSecretRef.current, signed);

      const res = await activityApi.batch(payload);
      sequenceRef.current = sequence;
      localStorage.setItem(DEVICE_SEQUENCE_KEY, String(sequence));
      keysRef.current = Math.max(0, keysRef.current - k);
      clicksRef.current = Math.max(0, clicksRef.current - c);
      lastFlushAtRef.current = now;
      setConnected(true);

      // Update totals from server response (includes ALL devices for this user)
      if (res.data?.realtime?.totals) {
        const totals = res.data.realtime.totals;
        setTotalKeys(Number(totals.keystrokeCount || 0));
        setTotalClicks(Number(totals.mouseClickCount || 0));
        setSeconds(Number(totals.activeSeconds || 0));
        setScore(Number(totals.focusScore || 0));
        setScoreHistory(history => {
          const next = Number(totals.focusScore || 0);
          return [...history.slice(-5), Math.min(10, Math.max(1, Math.round(next / 10)))];
        });
        // Reset local counters since totals now include everything
        setLocalKeys(0);
        setLocalClicks(0);
      } else {
        setScore(prev => {
          const serverScore = res.data?.realtime?.totals?.focusScore;
          const next = Number.isFinite(Number(serverScore)) ? Number(serverScore) : Math.min(100, prev + k + c);
          setScoreHistory(history => [...history.slice(-5), Math.min(10, Math.max(1, Math.round(next / 10)))]);
          return next;
        });
      }
      return true;
    } catch (err) {
      console.error('Failed to flush activity batch:', err);
      setConnected(false);
      return false;
    } finally {
      flushingRef.current = false;
    }
  }, [ensureSession]);

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
    
    setTracking(true);
    localStorage.setItem('workrank_tracking_active', 'true');

    if (launchDesktop) {
      if (desktopOnlineRef.current) {
        // Desktop is online — send start command via socket
        sendDesktopCommand('start');
        setDesktopLaunchStatus('✅ Desktop Tracker đang online. Đã gửi lệnh bắt đầu.');
      } else {
        // Desktop is offline — try to launch via custom protocol
        triggerDesktopTracker('start');
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
              setDesktopLaunchStatus('❌ Desktop Tracker chưa phản hồi. Hãy mở Desktop Tracker và cấp quyền Accessibility.');
            }
          } catch {
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
        lastActivityAtRef.current = now;
        keysRef.current++;
        setLocalKeys(p => p + 1);
      };
      const clickHandler = (event) => {
        if (event.target?.closest?.('[data-no-track]')) return;
        lastActivityAtRef.current = Date.now();
        clicksRef.current++;
        setLocalClicks(p => p + 1);
      };
      keyHandlerRef.current = keyHandler;
      clickHandlerRef.current = clickHandler;
      window.addEventListener('keydown', keyHandler, true);
      document.addEventListener('mousedown', clickHandler, true);
    }

    if (!timerRef.current) timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    if (!pingRef.current) pingRef.current = setInterval(() => { void doPing(); }, 2500);
    
    lastFlushAtRef.current = Date.now();
    lastActivityAtRef.current = Date.now();
    void doPing();
  }, [doPing, sendDesktopCommand]);

  const stopTrack = useCallback(async (options = {}) => {
    const { stopDesktop = true } = options;
    setTracking(false);
    localStorage.setItem('workrank_tracking_active', 'false');

    if (stopDesktop) {
      if (desktopOnlineRef.current) {
        // Desktop is online — send stop command via socket
        sendDesktopCommand('stop');
        setDesktopLaunchStatus('Đã gửi lệnh dừng Desktop Tracker.');
      } else {
        triggerDesktopTracker('stop');
        setDesktopLaunchStatus('Đã gửi lệnh dừng Desktop Tracker.');
      }
    }

    // Final ping before stopping
    await doPing();

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

    const endedSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    if (endedSessionId) {
      activityApi.endSession(endedSessionId).catch((err) => console.error('Failed to end activity session:', err));
    }
  }, [doPing, sendDesktopCommand]);

  const toggle = useCallback(() => {
    if (tracking) void stopTrack();
    else void startTrack();
  }, [tracking, startTrack, stopTrack]);

  // Resume tracking or emit idle on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (tracking) {
        void startTrack({ launchDesktop: false });
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
