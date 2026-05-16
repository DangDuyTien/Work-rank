let audioContext = null;

export function getAudioContext() {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch(() => {});
  }
  return audioContext;
}

export function playPomodoroChime(volume = 0.12) {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    const vol = Math.max(0, Math.min(1, volume));
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    gain.connect(ctx.destination);
    [660, 880].forEach((frequency, index) => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(frequency, ctx.currentTime + index * 0.12);
      o.connect(gain);
      o.start(ctx.currentTime + index * 0.12);
      o.stop(ctx.currentTime + 0.45 + index * 0.12);
    });
  } catch {
    /* audio unavailable */
  }
}

export function requestNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('denied');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

export function sendBrowserNotification(title, options = {}) {
  if (!('Notification' in window)) return null;
  if (Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, {
      icon: '/workrank-mark.svg',
      badge: '/workrank-mark.svg',
      ...options,
    });
  } catch {
    return null;
  }
}

export function vibrateDevice(pattern = [200, 100, 200]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

let pipWindow = null;
const POMODORO_STORAGE_KEY = 'workrank:pomodoro-state';
const MODE_LABELS = { focus: 'Tập trung', shortBreak: 'Nghỉ ngắn', longBreak: 'Nghỉ dài' };

function updatePipContent() {
  if (!pipWindow || pipWindow.closed) return;
  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) { closePipWindow(); return; }
    const parsed = JSON.parse(raw);
    if (!parsed.running) { closePipWindow(); return; }
    const endsAt = Number(parsed.endsAt || 0);
    if (!endsAt) { closePipWindow(); return; }
    const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (remaining <= 0) { closePipWindow(); return; }
    const m = String(Math.floor(remaining / 60)).padStart(2, '0');
    const s = String(remaining % 60).padStart(2, '0');
    const mode = parsed.mode || 'focus';
    const doc = pipWindow.document;
    const timeEl = doc.getElementById('pip-time');
    const labelEl = doc.getElementById('pip-label');
    if (timeEl) timeEl.textContent = m + ':' + s;
    if (labelEl) labelEl.textContent = MODE_LABELS[mode] || 'Tập trung';
  } catch { closePipWindow(); }
}

export function openPipWindow() {
  if (!('documentPictureInPicture' in window)) return false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return true; }
  window.documentPictureInPicture.requestWindow({ width: 240, height: 150 }).then((win) => {
    pipWindow = win;
    win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0f172a;color:#fff;font-family:'JetBrains Mono','SF Mono',monospace;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;user-select:none}
#pip-label{font-size:13px;color:#38bdf8;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
#pip-time{font-size:56px;font-weight:900;line-height:1;margin-top:6px;letter-spacing:-1px}
#pip-sub{font-size:11px;color:#64748b;margin-top:4px;font-weight:600}
</style></head>
<body>
<div id="pip-label">Tập trung</div>
<div id="pip-time">25:00</div>
<div id="pip-sub">Pomodoro · Nhấp để đóng</div>
<script>document.body.onclick=()=>window.close()</script>
</body></html>`);
    win.document.close();
    win.addEventListener('pagehide', () => { pipWindow = null; });
    updatePipContent();
  }).catch(() => {});
  return true;
}

export function closePipWindow() {
  if (pipWindow && !pipWindow.closed) {
    try { pipWindow.close(); } catch {}
  }
  pipWindow = null;
}

export function isPipOpen() {
  return pipWindow !== null && !pipWindow.closed;
}

export function tickPip() {
  updatePipContent();
}
