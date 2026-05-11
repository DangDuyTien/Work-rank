require('dotenv').config();
const { app, BrowserWindow, ipcMain, systemPreferences, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { uIOhook } = require('uiohook-napi');

const API = process.env.API_URL || 'http://localhost:5001';
const LOGIN_EMAIL = process.env.WORKRANK_EMAIL || 'admin@workrank.local';
const LOGIN_PASSWORD = process.env.WORKRANK_PASSWORD || 'Admin@123456';
const DEVICE_UUID = process.env.WORKRANK_DEVICE_UUID || `${process.platform}-${require('os').hostname()}`;
const DEVICE_NAME = process.env.WORKRANK_DEVICE_NAME || require('os').hostname();
const PLATFORM_MAP = { darwin: 'macos', win32: 'windows', linux: 'linux' };
const PLATFORM = PLATFORM_MAP[process.platform] || 'macos';
const PING_INTERVAL = Number(process.env.PING_INTERVAL || 5000);

let mainWindow = null;
let tracking = false;
let keystrokes = 0;
let clicks = 0;
let mouseMoves = 0;
let interval = null;
let lastActivity = Date.now();
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

async function apiRequest(pathname, options = {}) {
  const res = await fetch(`${API}${pathname}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}), ...(options.headers || {}) },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(body?.message || body?.error || `${res.status} ${pathname}`);
  return body;
}

async function ensureAuth() {
  if (accessToken) return;
  const state = loadSecureState();
  accessToken = state.accessToken || null;
  refreshToken = state.refreshToken || null;
  deviceSecret = state.deviceSecret || null;
  sequence = Number(state.sequence || 0);
  if (accessToken) return;
  const login = await apiRequest('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD }) });
  accessToken = login.accessToken;
  refreshToken = login.refreshToken;
  saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });
}

async function ensureSession() {
  await ensureAuth();
  if (sessionId) return;
  const session = await apiRequest('/api/activity/session/start', {
    method: 'POST',
    body: JSON.stringify({ deviceUuid: DEVICE_UUID, deviceName: DEVICE_NAME, platform: PLATFORM, deviceSecret }),
  });
  sessionId = session.session.id;
  if (session.deviceSecret) deviceSecret = session.deviceSecret;
  const state = loadSecureState();
  saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });
}

function emitPingResult(data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('ping-result', data);
}

async function sendPing() {
  if (!tracking) return;
  const now = Date.now();
  const elapsed = Math.floor((now - lastActivity) / 1000);
  const isIdle = elapsed > 15;
  const activeSeconds = isIdle ? 0 : Math.max(1, Math.min(Math.floor(PING_INTERVAL / 1000), 15));
  const idleSeconds = isIdle ? Math.min(elapsed, 300) : 0;
  const event = {
    timestamp: new Date().toISOString(),
    activeSeconds,
    idleSeconds,
    keystrokeCount: keystrokes || 0,
    mouseClickCount: clicks || 0,
    mouseMoveCount: mouseMoves || 0,
    sequence: sequence + 1,
  };
  if (!event.keystrokeCount && !event.mouseClickCount && !event.mouseMoveCount && !idleSeconds) return;

  try {
    await ensureSession();
    const payload = { deviceUuid: DEVICE_UUID, deviceName: DEVICE_NAME, platform: PLATFORM, deviceSecret, sessionId, events: [event] };
    const signed = JSON.parse(JSON.stringify(payload));
    delete signed.deviceSecret;
    payload.signature = signPayload(deviceSecret, signed);
    const result = await apiRequest('/api/activity/batch', { method: 'POST', body: JSON.stringify(payload) });
    sequence = event.sequence;
    const state = loadSecureState();
    saveSecureState({ ...state, accessToken, refreshToken, deviceSecret, sequence });
    totalKeystrokes += event.keystrokeCount;
    totalClicks += event.mouseClickCount;
    score = Math.max(0, score + event.keystrokeCount + event.mouseClickCount - result.flaggedCount * 10);
    emitPingResult({ keystrokes: totalKeystrokes, mouse_clicks: totalClicks, score, connected: true, flaggedCount: result.flaggedCount });
    keystrokes = 0;
    clicks = 0;
    mouseMoves = 0;
  } catch (error) {
    emitPingResult({ connected: false, error: error.message });
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
  lastActivity = Date.now();
}

function onMouseMove() {
  if (!tracking) return;
  mouseMoves++;
  lastActivity = Date.now();
}

async function startTracking() {
  if (tracking) return;
  tracking = true;
  keystrokes = 0;
  clicks = 0;
  mouseMoves = 0;
  lastKeyTimes = {};
  pressedKeys = new Set();
  lastActivity = Date.now();

  try {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(false)) {
      systemPreferences.isTrustedAccessibilityClient(true);
      emitPingResult({ connected: false, error: 'Cần cấp Accessibility' });
      tracking = false;
      return;
    }

    await ensureSession();
    uIOhook.removeAllListeners('keydown');
    uIOhook.removeAllListeners('keyup');
    uIOhook.removeAllListeners('mousedown');
    uIOhook.removeAllListeners('mousemove');
    uIOhook.on('keydown', onKeyDown);
    uIOhook.on('keyup', onKeyUp);
    uIOhook.on('mousedown', onMouseDown);
    uIOhook.on('mousemove', onMouseMove);
    uIOhook.start();

    interval = setInterval(sendPing, PING_INTERVAL);
    emitPingResult({ connected: true });
  } catch (err) {
    tracking = false;
    emitPingResult({ connected: false, error: err.message });
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
  } catch {}
}

app.whenReady().then(() => {
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
  setTimeout(startTracking, 1000);
});

app.on('before-quit', () => { stopTracking(); });
ipcMain.on('minimize', () => mainWindow?.minimize());
ipcMain.on('close', () => mainWindow?.close());
ipcMain.on('logout', () => mainWindow?.close());
ipcMain.handle('toggle', async () => {
  if (tracking) await stopTracking();
  else await startTracking();
  return { tracking };
});
ipcMain.handle('get-status', () => ({ tracking, keystrokes: totalKeystrokes, mouse_clicks: totalClicks, score }));
