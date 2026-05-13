require('dotenv').config();
const { app, BrowserWindow, ipcMain, systemPreferences, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uIOhook } = require('uiohook-napi');
const { io: ioClient } = require('socket.io-client');

const API = process.env.API_URL || 'http://localhost:5001';
const LOGIN_EMAIL = process.env.WORKRANK_EMAIL || 'admin@workrank.local';
const LOGIN_PASSWORD = process.env.WORKRANK_PASSWORD || 'Admin@123456';
const DEVICE_UUID = process.env.WORKRANK_DEVICE_UUID || `${process.platform}-${require('os').hostname()}`;
const DEVICE_NAME = process.env.WORKRANK_DEVICE_NAME || require('os').hostname();
const PLATFORM_MAP = { darwin: 'macos', win32: 'windows', linux: 'linux' };
const PLATFORM = PLATFORM_MAP[process.platform] || 'macos';
const PING_INTERVAL = Number(process.env.PING_INTERVAL || 5000);
const HEARTBEAT_INTERVAL = 10_000; // send heartbeat every 10s
const PROTOCOL = 'workrank';
const ACCESSIBILITY_ERROR = 'Cần cấp quyền Accessibility để bắt phím ngoài trình duyệt';
const DEBUG = process.env.WORKRANK_DEBUG === 'true';

let mainWindow = null;
let tracking = false;
let keystrokes = 0;
let clicks = 0;
let mouseMoves = 0;
let interval = null;
let lastActivity = Date.now();
let lastFlushAt = Date.now();
let lastKeyTimes = {};
let pressedKeys = new Set();
let totalKeystrokes = 0;
let totalClicks = 0;
let score = 0;
let accessToken = null;
let refreshToken = null;
let sessionId = null;
let deviceSecret = null;
let sequence = 0;
let shouldAutoStart = true;
const pendingProtocolUrls = [];

// Socket.IO connection to backend
let desktopSocket = null;
let heartbeatInterval = null;

function debugLog(...args) {
  if (DEBUG) console.log('[workrank-debug]', ...args);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) app.quit();

function registerProtocolClient() {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

function getProtocolAction(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname || parsed.pathname.replace(/^\/+/, '');
  } catch {
    return '';
  }
}

function queueProtocolUrl(url) {
  const action = getProtocolAction(url);
  if (action === 'stop') shouldAutoStart = false;
  pendingProtocolUrls.push(url);
}

for (const arg of process.argv) {
  if (arg.startsWith(`${PROTOCOL}://`)) queueProtocolUrl(arg);
}

function statePath() {
  return path.join(app.getPath('userData'), 'secure-state.bin');
}

function loadSecureState() {
  try {
    const encrypted = fs.readFileSync(statePath());
    const decrypted = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(encrypted) : encrypted.toString('utf8');
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

function saveSecureState(state) {
  const payload = JSON.stringify(state);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(payload) : Buffer.from(payload, 'utf8');
  fs.mkdirSync(path.dirname(statePath()), { recursive: true });
  fs.writeFileSync(statePath(), data, { mode: 0o600 });
}

function clearSecureAuthState() {
  const state = loadSecureState();
  saveSecureState({
    deviceSecret: state.deviceSecret || deviceSecret || null,
    sequence: Number(state.sequence || sequence || 0),
  });
  accessToken = null;
  refreshToken = null;
  sessionId = null;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function signPayload(secret, payload) {
  return crypto.createHmac('sha256', secret).update(canonicalJson(payload)).digest('hex');
}

function emitStatus(extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status', {
      tracking,
      connected: extra.connected,
      keystrokes: totalKeystrokes,
      mouse_clicks: totalClicks,
      score,
      ...extra,
    });
  }
}

// ─── Socket.IO connection to backend ──────────────────────────────────────────

function connectSocket() {
  if (desktopSocket?.connected) return;
  if (!accessToken) return;

  debugLog('Connecting desktop socket to backend...');
  desktopSocket = ioClient(API, {
    auth: {
      token: accessToken,
      clientType: 'desktop', // identifies this as desktop client
    },
    reconnection: true,
    reconnectionDelay: 3000,
    reconnectionAttempts: Infinity,
  });

  desktopSocket.on('connect', () => {
    debugLog('Desktop socket connected:', desktopSocket.id);
    // Start sending heartbeats
    startHeartbeat();
    // Send initial status
    sendHeartbeat();
  });

  desktopSocket.on('disconnect', (reason) => {
    debugLog('Desktop socket disconnected:', reason);
    stopHeartbeat();
  });

  desktopSocket.on('connect_error', (err) => {
    debugLog('Desktop socket connection error:', err.message);
  });

  // Listen for commands from the web frontend
  desktopSocket.on('desktop:command', async (payload) => {
    debugLog('Received desktop command from web:', payload);
    const action = payload?.action;
    if (action === 'start') {
      await startTracking();
    } else if (action === 'stop') {
      await stopTracking();
    } else if (action === 'toggle') {
      if (tracking) await stopTracking();
      else await startTracking();
    }
    // Immediately send updated status back
    sendHeartbeat();
  });
}

function disconnectSocket() {
  stopHeartbeat();
  if (desktopSocket) {
    desktopSocket.disconnect();
    desktopSocket = null;
  }
}

function sendHeartbeat() {
  if (!desktopSocket?.connected) return;
  desktopSocket.emit('desktop:heartbeat', {
    tracking,
    deviceUuid: DEVICE_UUID,
    deviceName: DEVICE_NAME,
    platform: PLATFORM,
    appVersion: 'desktop',
    keystrokes: totalKeystrokes,
    clicks: totalClicks,
    score,
  });
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

// Also send heartbeat via HTTP as fallback
async function sendHttpHeartbeat() {
  if (!accessToken) return;
  try {
    await fetch(`${API}/api/activity/desktop-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        tracking,
        deviceUuid: DEVICE_UUID,
        deviceName: DEVICE_NAME,
        platform: PLATFORM,
        appVersion: 'desktop',
      }),
    });
  } catch (err) {
    debugLog('HTTP heartbeat failed:', err.message);
  }
}

// ─── Auth & API ────────────────────────────────────────────────────────────────

async function refreshAccessToken() {
  if (!refreshToken) {
    const error = new Error('Missing refresh token');
    error.statusCode = 401;
    throw error;
  }

  const res = await fetch(`${API}/api/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.message || body?.error || `${res.status} /api/auth/refresh-token`);

  accessToken = body.accessToken;
  refreshToken = body.refreshToken;
  const state = loadSecureState();
  saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });

  // Reconnect socket with new token
  disconnectSocket();
  connectSocket();

  return body;
}

async function apiRequest(pathname, options = {}, retryAuth = true) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(options.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (res.status === 401 && retryAuth && refreshToken && pathname !== '/api/auth/login' && pathname !== '/api/auth/refresh-token') {
    await refreshAccessToken();
    return apiRequest(pathname, options, false);
  }
  if (!res.ok) throw new Error(body?.message || body?.error || `${res.status} ${pathname}`);
  return body;
}

async function ensureAuth() {
  if (accessToken) return;
  const state = loadSecureState();
  const sameLogin = !state.loginEmail || state.loginEmail === LOGIN_EMAIL;
  accessToken = sameLogin ? state.accessToken || null : null;
  refreshToken = sameLogin ? state.refreshToken || null : null;
  deviceSecret = sameLogin ? state.deviceSecret || null : null;
  sequence = sameLogin ? Number(state.sequence || 0) : 0;
  if (accessToken) {
    connectSocket();
    return;
  }
  const login = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }) });
  accessToken = login.accessToken;
  refreshToken = login.refreshToken;
  saveSecureState({ ...state, loginEmail: LOGIN_EMAIL, accessToken, refreshToken, deviceSecret, sequence });
  connectSocket();
}

async function ensureSession() {
  await ensureAuth();
  if (sessionId) return;
  const body = { deviceUuid: DEVICE_UUID, deviceName: DEVICE_NAME, platform: PLATFORM };
  if (deviceSecret) body.deviceSecret = deviceSecret;
  const session = await apiRequest('/api/activity/session/start', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  sessionId = session.session.id;
  if (session.deviceSecret) deviceSecret = session.deviceSecret;
  sequence = Math.max(sequence, Number(session.lastSequence || session.device?.lastSequence || 0));
  const state = loadSecureState();
  saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });
}

function emitPingResult(data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ping-result', data);
}

async function sendPing() {
  if (!tracking) return;
  const now = Date.now();
  const windowSeconds = Math.max(0, Math.floor((now - lastFlushAt) / 1000));
  const idleForSeconds = Math.floor((now - lastActivity) / 1000);
  const isIdle = idleForSeconds > 15;
  const activeSeconds = isIdle ? 0 : Math.max(1, Math.min(windowSeconds || Math.floor(PING_INTERVAL / 1000), 15));
  const idleSeconds = isIdle ? Math.max(1, Math.min(windowSeconds || Math.floor(PING_INTERVAL / 1000), 300)) : 0;
  const event = {
    timestamp: new Date().toISOString(),
    activeSeconds,
    idleSeconds,
    keystrokeCount: keystrokes || 0,
    mouseClickCount: clicks || 0,
    mouseMoveCount: mouseMoves || 0,
    sequence: sequence + 1,
  };
  debugLog('flush tick', event);
  if (!event.keystrokeCount && !event.mouseClickCount && !event.mouseMoveCount && !idleSeconds) {
    lastFlushAt = now;
    debugLog('flush skipped: no delta');
    return;
  }

  try {
    await ensureSession();
    const payload = { deviceUuid: DEVICE_UUID, deviceName: DEVICE_NAME, platform: PLATFORM, deviceSecret, sessionId, events: [event] };
    const signed = JSON.parse(JSON.stringify(payload));
    delete signed.deviceSecret;
    payload.signature = signPayload(deviceSecret, signed);
    const result = await apiRequest('/api/activity/batch', { method: 'POST', body: JSON.stringify(payload) });
    debugLog('flush ok', { sequence: event.sequence, flaggedCount: result.flaggedCount });
    sequence = event.sequence;
    lastFlushAt = now;
    const state = loadSecureState();
    saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });
    totalKeystrokes += event.keystrokeCount;
    totalClicks += event.mouseClickCount;
    score = Math.max(0, score + event.keystrokeCount + event.mouseClickCount - result.flaggedCount * 10);
    emitPingResult({ keystrokes: totalKeystrokes, mouse_clicks: totalClicks, score, connected: true, flaggedCount: result.flaggedCount });
    emitStatus({ connected: true });
    keystrokes = 0;
    clicks = 0;
    mouseMoves = 0;
    // Send heartbeat after successful ping so web gets updated status
    sendHeartbeat();
  } catch (error) {
    debugLog('flush failed', error.message);
    emitPingResult({ connected: false, error: error.message });
    emitStatus({ connected: false, error: error.message });
  }
}

function countKey(rawcode) {
  if (!tracking) return;
  const keyId = rawcode || 'unknown';
  const now = Date.now();
  const last = lastKeyTimes[keyId] || 0;
  if (now - last < 120) return;
  lastKeyTimes[keyId] = now;
  keystrokes++;
  debugLog('key counted', { keyId, keystrokes });
  lastActivity = now;
}

function onKeyDown(e) {
  const keyId = e.rawcode || e.keycode || e.key || 'unknown';
  if (pressedKeys.has(keyId)) return;
  pressedKeys.add(keyId);
  countKey(keyId);
}

function onKeyUp(e) {
  const keyId = e.rawcode || e.keycode || e.key || 'unknown';
  pressedKeys.delete(keyId);
}

function onMouseDown() {
  if (!tracking) return;
  clicks++;
  debugLog('click counted', { clicks });
  lastActivity = Date.now();
}

function onMouseMove() {
  if (!tracking) return;
  mouseMoves++;
  if (mouseMoves === 1 || mouseMoves % 100 === 0) debugLog('mouse moves', { mouseMoves });
  lastActivity = Date.now();
}

async function startTracking() {
  if (tracking) return;
  debugLog('start requested');
  tracking = true;
  emitStatus({ connected: true });
  keystrokes = 0;
  clicks = 0;
  mouseMoves = 0;
  lastKeyTimes = {};
  pressedKeys = new Set();
  lastActivity = Date.now();
  lastFlushAt = Date.now();

  try {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
      systemPreferences.isTrustedAccessibilityClient(true);
      console.warn(ACCESSIBILITY_ERROR);
      emitPingResult({ connected: false, error: ACCESSIBILITY_ERROR });
      tracking = false;
      emitStatus({ connected: false, error: ACCESSIBILITY_ERROR });
      sendHeartbeat(); // Report status change
      return;
    }

    await ensureSession();
    debugLog('session ensured', { sessionId });
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
    uIOhook.removeAllListeners('mousedown');
    uIOhook.removeAllListeners('mousemove');
    uIOhook.on('keydown', onKeyDown);
    uIOhook.on('keyup', onKeyUp);
    uIOhook.on('mousedown', onMouseDown);
    uIOhook.on('mousemove', onMouseMove);
    uIOhook.start();
    debugLog('uiohook started');

    interval = setInterval(sendPing, PING_INTERVAL);
    debugLog('flush interval started', { intervalMs: PING_INTERVAL });
    emitPingResult({ connected: true });
    emitStatus({ connected: true });
    sendHeartbeat(); // Report tracking started
  } catch (err) {
    console.error('Failed to start desktop tracking:', err.message);
    tracking = false;
    emitPingResult({ connected: false, error: err.message });
    emitStatus({ connected: false, error: err.message });
    sendHeartbeat(); // Report error
  }
}

async function stopTracking() {
  if (!tracking) return;
  await sendPing();
  tracking = false;
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
  try {
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
    uIOhook.removeAllListeners('mousedown');
    uIOhook.removeAllListeners('mousemove');
    uIOhook.stop();
  } catch (error) {
    console.warn('Failed to stop input hook:', error.message);
  }
  if (sessionId) {
    try {
      await apiRequest('/api/activity/session/end', { method: 'POST', body: JSON.stringify({ sessionId }) });
    } catch (error) {
      console.warn('Failed to end desktop session:', error.message);
    } finally {
      sessionId = null;
    }
  }
  emitStatus({ connected: true });
  sendHeartbeat(); // Report tracking stopped
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

async function handleProtocolUrl(rawUrl) {
  const action = getProtocolAction(rawUrl);
  if (!action) return;

  focusMainWindow();
  if (action === 'start') await startTracking();
  else if (action === 'stop') await stopTracking();
  else if (action === 'toggle') {
    if (tracking) await stopTracking();
    else await startTracking();
  }
}

async function logoutAndClose() {
  await stopTracking();
  disconnectSocket();
  if (accessToken) {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' }, false);
    } catch (error) {
      console.warn('Logout request failed:', error.message);
    }
  }
  clearSecureAuthState();
  emitStatus({ connected: false });
  mainWindow?.close();
}

app.on('second-instance', (_event, argv) => {
  const protocolUrl = argv.find((arg) => arg.startsWith(`${PROTOCOL}://`));
  if (protocolUrl) void handleProtocolUrl(protocolUrl);
  else focusMainWindow();
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  if (app.isReady()) void handleProtocolUrl(url);
  else queueProtocolUrl(url);
});

app.whenReady().then(() => {
  registerProtocolClient();
  mainWindow = new BrowserWindow({
    width: 400,
    height: 620,
    resizable: false,
    title: 'WorkRank Tracker',
    frame: false,
    transparent: false,
    backgroundColor: '#0b1326',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Start HTTP heartbeat as fallback (in case socket connection fails)
  setInterval(sendHttpHeartbeat, HEARTBEAT_INTERVAL);

  const startupUrls = pendingProtocolUrls.splice(0);
  if (startupUrls.length) {
    for (const url of startupUrls) void handleProtocolUrl(url);
  } else if (shouldAutoStart) {
    setTimeout(startTracking, 1000);
  }
});

app.on('before-quit', () => {
  stopTracking();
  disconnectSocket();
});
ipcMain.on('minimize', () => mainWindow?.minimize());
ipcMain.on('close', () => mainWindow?.close());
ipcMain.on('logout', () => { void logoutAndClose(); });
ipcMain.handle('toggle', async () => {
  if (tracking) await stopTracking();
  else await startTracking();
  emitStatus({ connected: true });
  return { tracking };
});
ipcMain.handle('get-status', () => ({ tracking, keystrokes: totalKeystrokes, mouse_clicks: totalClicks, score }));
