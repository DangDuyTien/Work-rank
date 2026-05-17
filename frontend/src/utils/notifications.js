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
let pipDone = false;
let pipContinueTimeout = null;
const PIP_TICK_KEY = 'workrank:pomodoro-state';
const PIP_PRESETS = { classic: [25, 5, 15], deep: [50, 10, 25], sprint: [15, 3, 10] };

function broadcastPipCommand(action) {
  try {
    const bc = new BroadcastChannel('workrank-pip');
    bc.postMessage(JSON.stringify({ command: action }));
    bc.close();
  } catch {}
}

function pipHandleAction(action) {
  broadcastPipCommand(action);
  closePipWindow();
}

function pipBodyClickHandler(e) {
  const btn = e.target?.closest?.('[data-pip-action]');
  if (btn) {
    pipHandleAction(btn.dataset.pipAction);
    return;
  }
  try { if (pipWindow && !pipWindow.closed) pipWindow.close(); } catch {}
}

function broadcastPipContinue() {
  try {
    const bc = new BroadcastChannel('workrank-pip');
    bc.postMessage('continue');
    bc.close();
  } catch {}
}

function handlePipContinue() {
  if (pipContinueTimeout) { clearTimeout(pipContinueTimeout); pipContinueTimeout = null; }
  try {
    const raw = localStorage.getItem(PIP_TICK_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && !s.running && s.remainingSeconds > 0) {
        s.running = true;
        s.endsAt = Date.now() + Number(s.remainingSeconds) * 1000;
        s.startedOnce = true;
        s.notified = false;
        s.completedAt = 0;
        localStorage.setItem(PIP_TICK_KEY, JSON.stringify(s));
        broadcastPipContinue();
      }
    }
  } catch {}
  closePipWindow();
}

function tile(d) {
  return '<div class="tile"><span>' + d + '</span></div>';
}
function clockHTML(mm, ss) { return tile(mm[0]) + tile(mm[1]) + '<span id="col">:</span>' + tile(ss[0]) + tile(ss[1]); }

const PIP_CTRL_SVG_PAUSE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const PIP_CTRL_SVG_SKIP = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>';

const PIP_HEAD = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>@import url(\'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;900&display=swap\');*{margin:0;padding:0;box-sizing:border-box}body{height:100vh;overflow:hidden;user-select:none;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px 20px;font-family:\'JetBrains Mono\',monospace;background:#0f0f0f;transition:background .5s cubic-bezier(.4,0,.2,1)}body.focus{background:linear-gradient(160deg,#082f49 0%,#0c4a6e 100%)}body.shortBreak{background:linear-gradient(160deg,#052e16 0%,#166534 100%)}body.longBreak{background:linear-gradient(160deg,#451a03 0%,#78350f 100%)}@keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}@keyframes urgencyPulse{0%,100%{box-shadow:0 0 20px rgba(239,68,68,.4)}50%{box-shadow:0 0 40px rgba(239,68,68,.6)}}@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}#app{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;position:relative}#header{font-size:10px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.45);margin-bottom:6px;line-height:1;order:0}#cycle{font-size:9px;color:rgba(255,255,255,.35);font-weight:600;margin-bottom:14px;order:1;letter-spacing:.06em}#status{font-size:12px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#fff;margin-bottom:18px;line-height:1;order:2;text-shadow:0 2px 12px rgba(0,0,0,.3)}#clock{display:flex;align-items:center;gap:6px;margin-bottom:18px;order:3}.tile{width:64px;height:64px;background:rgba(255,255,255,.08);display:flex;align-items:center;justify-content:center;border-radius:8px;backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,.12);transition:background .3s,border-color .3s,box-shadow .3s}.tile span{font-family:\'JetBrains Mono\',monospace;font-size:44px;font-weight:900;color:#fff;line-height:1;letter-spacing:-1px;text-shadow:0 2px 8px rgba(0,0,0,.3)}#col{font-size:30px;font-weight:900;color:#fff;line-height:1;padding-bottom:4px;width:10px;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .15s}##controls{order:4;display:flex;gap:10px;margin-top:6px}.pip-ctrl{width:36px;height:30px;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.06);color:#fff;display:flex;align-items:center;justify-content:center;border-radius:4px;cursor:pointer;transition:all .15s;user-select:none;-webkit-user-select:none}.pip-ctrl:hover{background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.25)}.pip-ctrl:active{background:rgba(255,255,255,0.03)}nextinfo{font-size:10px;color:rgba(255,255,255,.5);font-weight:600;margin-bottom:16px;order:5;letter-spacing:.04em}#bar{width:100%;height:3px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden;order:6;position:relative}#fill{height:100%;border-radius:2px;background:rgba(255,255,255,.6);position:relative;overflow:hidden}#fill::after{content:\'\';position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);animation:shimmer 2s ease-in-out infinite}.urgency .tile{background:rgba(239,68,68,.25);border-color:rgba(239,68,68,.5);animation:urgencyPulse 1s ease-in-out infinite,shake .3s ease-in-out infinite}.urgency #status{animation:pulse .6s ease-in-out infinite}.urgency .tile span{text-shadow:0 2px 16px rgba(239,68,68,.4)}.urgency #col{opacity:.9}.urgency #bar{background:rgba(239,68,68,.2)}.urgency #fill{background:rgba(239,68,68,.8)}</style></head><body>';

function pipBodyHTML(d) {
  const cls = (d.mode || 'focus') + (d.urgency ? ' urgency' : '');
  const cycleText = d.cycle ? 'Chu k\u1EF3 ' + d.cycle + '/4' : '';
  const nextText = d.nextMode ? 'Ti\u1EBFp: ' + d.nextMode : '';
  return '<div id="app" class="' + cls + '">' +
    '<div id="header">POMODORO</div>' +
    '<div id="cycle">' + cycleText + '</div>' +
    '<div id="status">' + d.label + '</div>' +
    '<div id="clock">' + clockHTML(d.mm, d.ss) + '</div>' +
    '<div id="controls">' +
      '<button data-pip-action="pause" class="pip-ctrl">' + PIP_CTRL_SVG_PAUSE + '</button>' +
      '<button data-pip-action="skip" class="pip-ctrl">' + PIP_CTRL_SVG_SKIP + '</button>' +
    '</div>' +
    '<div id="nextinfo">' + nextText + '</div>' +
    '<div id="bar"><div id="fill" style="width:' + d.pct + '%"></div></div></div>';
}

function updatePipDOM(data) {
  const pw = pipWindow;
  if (!pw || pw.closed) return;
  try {
    const modeClass = (data.mode || 'focus');
    pw.document.body.className = modeClass;
    pw.document.body.innerHTML = pipBodyHTML(data);
    pw.document.body.onclick = pipBodyClickHandler;
  } catch {}
}

function pipTick() {
  if (!pipWindow || pipWindow.closed) { stopPipInterval(); return; }
  if (pipDone) return;
  try {
    const raw = localStorage.getItem(PIP_TICK_KEY);
    if (!raw) { try { closePipWindow(); } catch {} return; }
    const p = JSON.parse(raw);
    if (!p || !p.running) { try { closePipWindow(); } catch {} return; }
    const endsAt = Number(p.endsAt || 0);
    if (!endsAt) { try { closePipWindow(); } catch {} return; }
    const rem = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    if (rem <= 0) {
      pipDone = true;
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
        const pw = pipWindow;
        if (pw && !pw.closed) {
          pw.document.body.classList.remove('focus', 'shortBreak', 'longBreak');
          pw.document.body.style.background = 'linear-gradient(135deg,#059669 0%,#10b981 50%,#34d399 100%)';
          pw.document.body.innerHTML = '<style>@keyframes pipCelebScale{0%{transform:scale(0.3);opacity:0}50%{transform:scale(1.2)}100%{transform:scale(1);opacity:1}}@keyframes pipCelebFade{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:translateY(0)}}@keyframes pipConfetti{0%{transform:translateY(0) rotate(0deg);opacity:1}100%{transform:translateY(-60px) rotate(720deg);opacity:0}}@keyframes pipGlow{0%,100%{text-shadow:0 0 20px rgba(255,255,255,0.4)}50%{text-shadow:0 0 40px rgba(255,255,255,0.8)}}#c{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden}#c .check{font-size:42px;font-weight:900;color:#fff;font-family:JetBrains Mono,monospace;animation:pipCelebScale 0.5s cubic-bezier(.34,1.56,.64,1) forwards,pipGlow 1.5s ease-in-out infinite;margin-bottom:8px}#c .label{font-size:13px;font-weight:900;color:#fff;font-family:JetBrains Mono,monospace;text-transform:uppercase;letter-spacing:.12em;animation:pipCelebFade 0.4s 0.15s both;text-shadow:0 2px 8px rgba(0,0,0,.3)}#c .sub{font-size:10px;font-weight:600;color:rgba(255,255,255,0.8);font-family:JetBrains Mono,monospace;animation:pipCelebFade 0.4s 0.3s both;margin-top:6px}#c .hint{font-size:9px;font-weight:700;color:rgba(255,255,255,0.55);font-family:JetBrains Mono,monospace;animation:pipCelebFade 0.4s 0.45s both;margin-top:14px;letter-spacing:.04em}.confetti{position:absolute;width:6px;height:6px;border-radius:50%;animation:pipConfetti 1s ease-out forwards}.c1{background:#fbbf24;top:35%;left:20%;animation-delay:0.1s}.c2{background:#38bdf8;top:40%;right:25%;animation-delay:0.2s}.c3{background:#a78bfa;top:30%;right:30%;animation-delay:0.15s}.c4{background:#22c55e;top:45%;left:30%;animation-delay:0.25s}.c5{background:#f472b6;top:35%;right:20%;animation-delay:0.3s}</style><div id="c"><div class="check">✓</div><div class="label">HOÀN THÀNH</div><div class="sub">Tuyệt vời!</div><div class="hint">Ch\u1EA1m \u0111\u1EC3 ti\u1EBFp t\u1EE5c</div><div class="confetti c1"></div><div class="confetti c2"></div><div class="confetti c3"></div><div class="confetti c4"></div><div class="confetti c5"></div></div>';
          pw.document.body.onclick = handlePipContinue;
        }
      } catch {}
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
      pipContinueTimeout = setTimeout(() => handlePipContinue(), 3000);
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
    
    const completedFocusCount = Number(p.completedFocusCount || 0);
    const cycle = mode === 'focus' ? (completedFocusCount % 4) + 1 : (completedFocusCount % 4) + 1;
    const nextModeName = mode === 'focus'
      ? (completedFocusCount % 4 === 3 ? 'Nghỉ dài' : 'Nghỉ ngắn')
      : 'Tập trung';

    updatePipDOM({
      mm: mm, ss: ss, label: label, mode: mode, cycle: cycle, nextMode: nextModeName, pct: Math.round(pct * 10) / 10,
      urgency: rem <= 10,
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
  pipDone = false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); startPipInterval(); return true; }
  const token = ++pipToken;
  window.documentPictureInPicture.requestWindow({ width: 330, height: 380 }).then((win) => {
    if (token !== pipToken) { try { win.close(); } catch {} return; }
    pipWindow = win;
    const initBody = pipBodyHTML({ mm: '00', ss: '00', label: 'Tập trung', mode: 'focus', cycle: 1, nextMode: 'Nghỉ ngắn', pct: 0, urgency: false });
    win.document.write(PIP_HEAD + initBody + '</body></html>');
    win.document.close();
    win.document.body.className = 'focus';
    win.document.body.onclick = pipBodyClickHandler;
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
