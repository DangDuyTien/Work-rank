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
let pipToken = 0;
let pipInterval = null;
const PIP_TICK_KEY = 'workrank:pomodoro-state';
const PIP_PRESETS = { classic: [25, 5, 15], deep: [50, 10, 25], sprint: [15, 3, 10] };

function tile(d) {
  return '<div class="tile"><span>' + d + '</span></div>';
}
function clockHTML(mm, ss) { return tile(mm[0]) + tile(mm[1]) + '<span id="col">:</span>' + tile(ss[0]) + tile(ss[1]); }

const PIP_HEAD = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url(\'https://fonts.googleapis.com/css2?family=Inter:wght@400;900&display=swap\');*{margin:0;padding:0;box-sizing:border-box}body{background:#0f0f0f;height:100vh;overflow:hidden;user-select:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px 16px;font-family:\'Inter\',ui-sans-serif,sans-serif}#app{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}#status{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;line-height:1;margin-bottom:14px;transition:color .3s ease}#clock{display:flex;align-items:center;gap:4px}.tile{width:56px;height:56px;background:#1e293b;display:flex;align-items:center;justify-content:center;border-radius:2px}.tile span{font-family:\'Inter\',ui-sans-serif,sans-serif;font-size:44px;font-weight:900;color:#fff;line-height:1}#col{font-size:28px;font-weight:900;color:#fff;line-height:1;padding-bottom:4px;animation:blink 1s step-end infinite;width:10px;text-align:center}@keyframes blink{0%,100%{opacity:1}50%{opacity:.08}}#bar{width:100%;height:3px;background:#18181b;margin-top:14px;border-radius:2px;overflow:hidden}#fill{height:100%;border-radius:2px;transition:width .3s ease;width:0%}</style></head><body>';

function pipBodyHTML(d) {
  return '<div id="app"><div id="status" style="color:' + d.col + '">' + d.label + '</div><div id="clock">' + clockHTML(d.mm, d.ss) + '</div><div id="bar"><div id="fill" style="width:' + d.pct + '%;background:' + d.col + '"></div></div></div>';
}

function updatePipDOM(data) {
  const pw = pipWindow;
  if (!pw || pw.closed) return;
  try {
    pw.document.body.innerHTML = pipBodyHTML(data);
    pw.document.body.onclick = function(){ try{pw.close()}catch{} };
  } catch {}
}

function pipTick() {
  if (!pipWindow || pipWindow.closed) { stopPipInterval(); return; }
  try {
    const raw = localStorage.getItem(PIP_TICK_KEY);
    if (!raw) { try { closePipWindow(); } catch {} return; }
    const p = JSON.parse(raw);
    if (!p || !p.running) { try { closePipWindow(); } catch {} return; }
    const endsAt = Number(p.endsAt || 0);
    if (!endsAt) { try { closePipWindow(); } catch {} return; }
    const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (rem <= 0) {
      const newFocusCount = (p.mode || 'focus') === 'focus'
        ? Number(p.completedFocusCount || 0) + 1
        : Number(p.completedFocusCount || 0);
      const nextMode = (p.mode || 'focus') === 'focus'
        ? (newFocusCount % 4 === 0 ? 'longBreak' : 'shortBreak')
        : 'focus';
      const nextPreset = PIP_PRESETS[p.presetKey] || PIP_PRESETS.classic;
      const nextTotal = (nextMode === 'focus' ? nextPreset[0] : nextMode === 'shortBreak' ? nextPreset[1] : nextPreset[2]) * 60;
      const completed = {
        presetKey: p.presetKey,
        mode: nextMode,
        remainingSeconds: nextTotal,
        running: false,
        completedFocusCount: newFocusCount,
        completedAt: Date.now(),
        startedOnce: false,
        endsAt: null,
        notified: true,
      };
      localStorage.setItem(PIP_TICK_KEY, JSON.stringify(completed));
      try {
        const settingsRaw = localStorage.getItem('workrank:app-settings');
        const appSettings = settingsRaw ? JSON.parse(settingsRaw) : {};
        const sound = appSettings.notifications?.sound !== false;
        const notif = appSettings.notifications?.pomodoro !== false;
        const volume = Number(appSettings.pomodoro?.volume) || 0.12;
        if (sound) playPomodoroChime(volume);
        if (notif && document.hidden && Notification.permission === 'granted') {
          const label = nextMode === 'focus' ? 'Tập trung' : nextMode === 'shortBreak' ? 'Nghỉ ngắn' : 'Nghỉ dài';
          sendBrowserNotification('Pomodoro kết thúc', {
            body: 'Đã chuyển sang: ' + label,
            tag: 'pomodoro-completed',
            data: { url: '/pomodoro' },
          });
        }
        vibrateDevice([200, 100, 200]);
      } catch {}
      try { closePipWindow(); } catch {}
      return;
    }

    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    const mode = p.mode || 'focus';
    const preset = PIP_PRESETS[p.presetKey] || PIP_PRESETS.classic;
    const total = (mode === 'focus' ? preset[0] : mode === 'shortBreak' ? preset[1] : preset[2]) * 60;
    const col = mode === 'focus' ? '#06b6d4' : mode === 'shortBreak' ? '#16a34a' : '#d97706';
    const label = mode === 'focus' ? 'Tập trung' : mode === 'shortBreak' ? 'Nghỉ ngắn' : 'Nghỉ dài';
    const pct = total > 0 ? ((total - rem) / total) * 100 : 0;

    updatePipDOM({
      mm: mm, ss: ss, label: label, col: col, pct: Math.round(pct * 10) / 10,
    });
  } catch {}
}

function startPipInterval() {
  if (pipInterval) return;
  pipTick();
  pipInterval = setInterval(pipTick, 200);
}

function stopPipInterval() {
  if (pipInterval) { clearInterval(pipInterval); pipInterval = null; }
}

export function openPipWindow() {
  if (!('documentPictureInPicture' in window)) return false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); startPipInterval(); return true; }
  const token = ++pipToken;
  window.documentPictureInPicture.requestWindow({ width: 270, height: 280 }).then((win) => {
    if (token !== pipToken) { try { win.close(); } catch {} return; }
    pipWindow = win;
    const initBody = pipBodyHTML({ mm: '00', ss: '00', label: 'Tập trung', col: '#06b6d4', pct: 0 });
    win.document.write(PIP_HEAD + initBody + '</body></html>');
    win.document.close();
    win.document.body.onclick = function(){ try{win.close()}catch{} };
    startPipInterval();
    win.addEventListener('pagehide', () => {
      if (pipWindow === win) { pipWindow = null; stopPipInterval(); }
    });
  }).catch(() => {});
  return true;
}

export function closePipWindow() {
  pipToken++;
  stopPipInterval();
  if (pipWindow && !pipWindow.closed) {
    try { pipWindow.close(); } catch {}
  }
  pipWindow = null;
}

export function isPipOpen() {
  return pipWindow !== null && !pipWindow.closed;
}
