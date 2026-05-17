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

function getPipPreset(presetKey) {
  return PIP_PRESETS[presetKey] || PIP_PRESETS.classic;
}

function getPipModeSeconds(preset, mode) {
  return (mode === 'focus' ? preset[0] : mode === 'shortBreak' ? preset[1] : preset[2]) * 60;
}

function getPipModeLabel(mode) {
  if (mode === 'shortBreak') return 'Nghỉ ngắn';
  if (mode === 'longBreak') return 'Nghỉ dài';
  return 'Tập trung';
}

function getPipNextModeName(mode, completedFocusCount) {
  return mode === 'focus'
    ? (Number(completedFocusCount || 0) % 4 === 3 ? 'Nghỉ dài' : 'Nghỉ ngắn')
    : 'Tập trung';
}

function broadcastPipCommand(action) {
  try {
    const bc = new BroadcastChannel('workrank-pip');
    bc.postMessage(JSON.stringify({ command: action }));
    bc.close();
  } catch {}
}

function pipHandleAction(action) {
  broadcastPipCommand(action);
  if (action === 'start') {
    pipDone = false;
  }
}

function pipBodyClickHandler(e) {
  const btn = e.target?.closest?.('[data-pip-action]');
  if (btn) {
    pipHandleAction(btn.dataset.pipAction);
  }
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
        pipDone = false;
        pipTick();
      }
    }
  } catch {}
}

function tile(d) {
  return '<div class="tile"><span>' + d + '</span></div>';
}
function clockHTML(mm, ss) { return tile(mm[0]) + tile(mm[1]) + '<span id="col">:</span>' + tile(ss[0]) + tile(ss[1]); }

const PIP_CTRL_SVG_PAUSE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const PIP_CTRL_SVG_PLAY = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"/></svg>';
const PIP_CTRL_SVG_SKIP = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>';

const PIP_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;overflow:hidden;user-select:none;display:flex;align-items:stretch;justify-content:center;padding:18px;font-family:'JetBrains Mono',monospace;background:#0f172a;color:#fff;transition:background .35s cubic-bezier(.4,0,.2,1)}
body.focus{background:linear-gradient(155deg,#06283f 0%,#0c4a6e 56%,#075985 100%)}
body.shortBreak{background:linear-gradient(155deg,#052e16 0%,#166534 58%,#15803d 100%)}
body.longBreak{background:linear-gradient(155deg,#3b1702 0%,#78350f 58%,#b45309 100%)}
button{font-family:inherit}
@keyframes shimmer{0%{transform:translateX(-110%)}100%{transform:translateX(120%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes urgencyPulse{0%,100%{box-shadow:0 0 16px rgba(248,113,113,.35)}50%{box-shadow:0 0 28px rgba(248,113,113,.58)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
#app{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:13px;position:relative}
#top{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px}
#header{font-size:10px;font-weight:900;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,255,255,.56);line-height:1}
#cycle{font-size:9px;color:rgba(255,255,255,.66);font-weight:800;letter-spacing:.08em;padding:5px 7px;border:1px solid rgba(255,255,255,.13);background:rgba(255,255,255,.07);border-radius:999px;white-space:nowrap}
#status{font-size:16px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:#fff;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.28)}
#clock{display:grid;grid-template-columns:repeat(2,58px) 14px repeat(2,58px);align-items:center;justify-content:center;gap:6px;width:100%}
.tile{width:58px;height:62px;background:rgba(255,255,255,.12);display:flex;align-items:center;justify-content:center;border-radius:10px;backdrop-filter:blur(14px);border:1px solid rgba(255,255,255,.16);transition:background .25s,border-color .25s,box-shadow .25s}
.tile span{font-family:'JetBrains Mono',monospace;font-size:40px;font-weight:900;color:#fff;line-height:1;letter-spacing:0;text-shadow:0 2px 9px rgba(0,0,0,.32)}
#col{font-size:27px;font-weight:900;color:rgba(255,255,255,.92);line-height:1;text-align:center;text-shadow:0 2px 8px rgba(0,0,0,.3);transition:opacity .15s}
#nextinfo{max-width:100%;font-size:10px;color:rgba(255,255,255,.76);font-weight:800;letter-spacing:.06em;line-height:1.3;padding:7px 10px;border:1px solid rgba(255,255,255,.12);background:rgba(0,0,0,.12);border-radius:999px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#controls{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:8px}
.pip-ctrl{height:38px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.09);color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;border-radius:8px;cursor:pointer;transition:background .15s,border-color .15s,transform .15s;user-select:none;-webkit-user-select:none;font-size:10px;font-weight:900;letter-spacing:.04em;text-transform:uppercase}
.pip-ctrl svg{width:14px;height:14px;flex:0 0 auto}
.pip-ctrl:hover{background:rgba(255,255,255,.15);border-color:rgba(255,255,255,.28)}
.pip-ctrl:active{background:rgba(255,255,255,.07);transform:translateY(1px)}
#bar{width:100%;height:4px;background:rgba(255,255,255,.1);border-radius:999px;overflow:hidden;position:relative}
#fill{height:100%;border-radius:999px;background:rgba(255,255,255,.72);position:relative;overflow:hidden;transition:width .25s ease}
#fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:shimmer 2.2s ease-in-out infinite}
.urgency .tile{background:rgba(239,68,68,.24);border-color:rgba(248,113,113,.5);animation:urgencyPulse 1s ease-in-out infinite,shake .3s ease-in-out infinite}
.urgency #status{animation:pulse .65s ease-in-out infinite}
.urgency .tile span{text-shadow:0 2px 16px rgba(248,113,113,.45)}
.urgency #bar{background:rgba(248,113,113,.2)}
.urgency #fill{background:rgba(248,113,113,.86)}
</style></head><body>`;

function pipBodyHTML(d) {
  const cls = (d.mode || 'focus') + (d.urgency ? ' urgency' : '');
  const cycleText = d.cycle ? 'Chu k\u1EF3 ' + d.cycle + '/4' : '';
  const nextText = d.nextMode ? 'Ti\u1EBFp: ' + d.nextMode : '';
  const primaryAction = d.running ? 'pause' : 'start';
  const primaryIcon = d.running ? PIP_CTRL_SVG_PAUSE : PIP_CTRL_SVG_PLAY;
  const primaryLabel = d.running ? 'T\u1EA1m d\u1EEBng' : 'B\u1EAFt \u0111\u1EA7u';
  return '<div id="app" class="' + cls + '">' +
    '<div id="top"><div id="header">POMODORO</div><div id="cycle">' + cycleText + '</div></div>' +
    '<div id="status">' + d.label + '</div>' +
    '<div id="clock">' + clockHTML(d.mm, d.ss) + '</div>' +
    '<div id="nextinfo">' + nextText + '</div>' +
    '<div id="controls">' +
      '<button data-pip-action="' + primaryAction + '" class="pip-ctrl" title="' + primaryLabel + '">' + primaryIcon + '<span>' + primaryLabel + '</span></button>' +
      '<button data-pip-action="skip" class="pip-ctrl" title="Chuy\u1EC3n phi\u00EAn">' + PIP_CTRL_SVG_SKIP + '<span>Chuy\u1EC3n</span></button>' +
    '</div>' +
    '<div id="bar"><div id="fill" style="width:' + d.pct + '%"></div></div></div>';
}

function updatePipDOM(data) {
  const pw = pipWindow;
  if (!pw || pw.closed) return;
  try {
    const modeClass = (data.mode || 'focus');
    pw.document.body.className = modeClass;
    pw.document.body.style.background = '';
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
    if (!p) { try { closePipWindow(); } catch {} return; }

    const mode = p.mode || 'focus';
    const preset = getPipPreset(p.presetKey);
    const total = getPipModeSeconds(preset, mode);
    const running = Boolean(p.running);
    const endsAt = Number(p.endsAt || 0);
    const rem = running && endsAt
      ? Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      : Math.max(0, Math.min(total, Number(p.remainingSeconds || total)));

    if (running && !endsAt) { try { closePipWindow(); } catch {} return; }
    if (running && rem <= 0) {
      pipDone = true;
      const newFocusCount = mode === 'focus'
        ? Number(p.completedFocusCount || 0) + 1
        : Number(p.completedFocusCount || 0);
      const nextMode = mode === 'focus'
        ? (newFocusCount % 4 === 0 ? 'longBreak' : 'shortBreak')
        : 'focus';
      const nextTotal = getPipModeSeconds(preset, nextMode);
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
    const label = running ? getPipModeLabel(mode) : (p.startedOnce ? 'Tạm dừng' : 'Sẵn sàng');
    const pct = total > 0 ? ((total - rem) / total) * 100 : 0;
    
    const completedFocusCount = Number(p.completedFocusCount || 0);
    const cycle = mode === 'focus' ? (completedFocusCount % 4) + 1 : (completedFocusCount % 4) + 1;
    const nextModeName = running
      ? getPipNextModeName(mode, completedFocusCount)
      : getPipModeLabel(mode);

    updatePipDOM({
      mm: mm, ss: ss, label: label, mode: mode, cycle: cycle, nextMode: nextModeName, pct: Math.round(pct * 10) / 10,
      urgency: running && rem <= 10,
      running,
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
  window.documentPictureInPicture.requestWindow({ width: 360, height: 360 }).then((win) => {
    if (token !== pipToken) { try { win.close(); } catch {} return; }
    pipWindow = win;
    const initBody = pipBodyHTML({ mm: '00', ss: '00', label: 'Tập trung', mode: 'focus', cycle: 1, nextMode: 'Nghỉ ngắn', pct: 0, urgency: false, running: false });
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
