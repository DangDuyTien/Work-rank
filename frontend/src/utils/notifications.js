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
let lastPipAction = '';
let lastPipActionAt = 0;
const PIP_TICK_KEY = 'workrank:pomodoro-state';
const PIP_COMMAND_KEY = 'workrank:pip-command';
const PIP_COMMAND_EVENT = 'workrank:pip-command';
const PIP_HISTORY_KEY = 'workrank:pomodoro-history';
const PIP_HISTORY_MAX = 300;
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

function buildPipCommand(action) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    command: action,
    ts: Date.now(),
  };
}

function loadPipState() {
  try {
    const raw = localStorage.getItem(PIP_TICK_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function savePipState(state) {
  try {
    localStorage.setItem(PIP_TICK_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

function pushPipHistory(entry) {
  try {
    const raw = localStorage.getItem(PIP_HISTORY_KEY);
    const history = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) return;
    history.push(entry);
    if (history.length > PIP_HISTORY_MAX) history.splice(0, history.length - PIP_HISTORY_MAX);
    localStorage.setItem(PIP_HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

function completePipStep(state) {
  const preset = getPipPreset(state.presetKey);
  const mode = state.mode || 'focus';
  const completedFocusCount = mode === 'focus'
    ? Number(state.completedFocusCount || 0) + 1
    : Number(state.completedFocusCount || 0);
  const nextMode = mode === 'focus'
    ? (completedFocusCount % 4 === 0 ? 'longBreak' : 'shortBreak')
    : 'focus';
  const totalSeconds = getPipModeSeconds(preset, mode);
  const elapsedSeconds = totalSeconds - Math.max(0, Number(state.remainingSeconds || 0));
  if (elapsedSeconds >= 10) {
    pushPipHistory({
      at: Date.now(),
      mode,
      elapsed: elapsedSeconds,
      total: totalSeconds,
      preset: state.presetKey || 'classic',
    });
  }
  return {
    ...state,
    mode: nextMode,
    remainingSeconds: getPipModeSeconds(preset, nextMode),
    running: false,
    completedFocusCount,
    completedAt: Date.now(),
    startedOnce: false,
    endsAt: null,
    notified: true,
  };
}

function applyPipActionToState(action) {
  const state = loadPipState();
  if (!state) return false;
  const mode = state.mode || 'focus';
  const preset = getPipPreset(state.presetKey);
  const totalSeconds = getPipModeSeconds(preset, mode);
  const remainingSeconds = state.running && state.endsAt
    ? Math.max(0, Math.ceil((Number(state.endsAt || 0) - Date.now()) / 1000))
    : Math.max(0, Math.min(totalSeconds, Number(state.remainingSeconds || totalSeconds)));

  if (action === 'pause') {
    return savePipState({
      ...state,
      remainingSeconds,
      running: false,
      endsAt: null,
      startedOnce: true,
      completedAt: 0,
      notified: false,
    });
  }

  if (action === 'start') {
    const safeRemaining = Math.max(1, remainingSeconds || totalSeconds);
    return savePipState({
      ...state,
      mode,
      remainingSeconds: safeRemaining,
      running: true,
      endsAt: Date.now() + safeRemaining * 1000,
      startedOnce: true,
      completedAt: 0,
      notified: false,
    });
  }

  if (action === 'skip') {
    return savePipState(completePipStep({
      ...state,
      mode,
      remainingSeconds,
      running: false,
      endsAt: null,
    }));
  }

  return false;
}

function broadcastPipCommand(action, stateApplied = false) {
  const payload = buildPipCommand(action);
  payload.stateApplied = stateApplied;
  try {
    const bc = new BroadcastChannel('workrank-pip');
    bc.postMessage(payload);
    bc.close();
  } catch {}
  try {
    localStorage.setItem(PIP_COMMAND_KEY, JSON.stringify(payload));
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent(PIP_COMMAND_EVENT, { detail: payload }));
  } catch {}
}

function pipHandleAction(action) {
  if (!action) return;
  const now = Date.now();
  if (now - lastPipActionAt < 260) return;
  lastPipAction = action;
  lastPipActionAt = now;
  const stateApplied = applyPipActionToState(action);
  broadcastPipCommand(action, stateApplied);
  if (action === 'start') {
    pipDone = false;
  }
  if (action === 'skip') {
    pipDone = false;
  }
  if (stateApplied) {
    pipTick();
  }
}

function pipBodyActionHandler(e) {
  if (e.__workrankPipHandled) return;
  const target = e.target?.closest ? e.target : e.target?.parentElement;
  const btn = target?.closest?.('[data-pip-action]');
  if (btn) {
    e.__workrankPipHandled = true;
    e.preventDefault?.();
    e.stopPropagation?.();
    pipHandleAction(btn.dataset.pipAction);
  }
}

function attachPipHandlers(win = pipWindow) {
  try {
    if (!win || win.closed || !win.document?.body) return;
    win.__workrankPipAction = (action) => pipHandleAction(action);
    win.document.body.onpointerdown = null;
    win.document.body.onmousedown = null;
    win.document.body.ontouchstart = null;
    win.document.body.onclick = null;
    win.document.querySelectorAll('[data-pip-action]').forEach((button) => {
      button.onpointerdown = null;
      button.onpointerup = null;
      button.onmousedown = null;
      button.ontouchstart = null;
      button.onclick = null;
    });
    ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'click'].forEach((eventName) => {
      win.document.removeEventListener(eventName, pipBodyActionHandler, true);
    });
    if (win.PointerEvent) win.document.addEventListener('pointerup', pipBodyActionHandler, true);
    win.document.addEventListener('click', pipBodyActionHandler, true);
  } catch {}
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
function clockHTML(mm, ss) { return '<span id="time">' + mm + ':' + ss + '</span>'; }

function pipActionAttrs(action) {
  return 'type="button" data-pip-action="' + action + '"';
}

const PIP_CTRL_SVG_PAUSE = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
const PIP_CTRL_SVG_PLAY = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="7 4 19 12 7 20 7 4"/></svg>';
const PIP_CTRL_SVG_SKIP = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 20"/><line x1="19" y1="5" x2="19" y2="19"/></svg>';

const PIP_HEAD = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@600;800;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{height:100vh;overflow:hidden;user-select:none;display:flex;align-items:stretch;justify-content:center;padding:6px;font-family:'JetBrains Mono',monospace;background:transparent;color:#0f172a;transition:background .35s cubic-bezier(.4,0,.2,1)}
body.focus{--pip-color:#06b6d4;--pip-strong:#0e7490;--pip-soft:rgba(6,182,212,.13);--pip-border:rgba(6,182,212,.36);--pip-panel-bg:linear-gradient(135deg,rgba(236,254,255,.98) 0%,#ffffff 55%,rgba(207,250,254,.96) 100%)}
body.shortBreak{--pip-color:#22c55e;--pip-strong:#15803d;--pip-soft:rgba(34,197,94,.14);--pip-border:rgba(34,197,94,.36);--pip-panel-bg:linear-gradient(135deg,rgba(240,253,244,.98) 0%,#ffffff 55%,rgba(220,252,231,.96) 100%)}
body.longBreak{--pip-color:#f59e0b;--pip-strong:#b45309;--pip-soft:rgba(245,158,11,.16);--pip-border:rgba(245,158,11,.38);--pip-panel-bg:linear-gradient(135deg,rgba(255,247,237,.98) 0%,#ffffff 55%,rgba(255,237,213,.96) 100%)}
button{font-family:inherit}
@keyframes shimmer{0%{transform:translateX(-110%)}100%{transform:translateX(120%)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
@keyframes urgencyPulse{0%,100%{box-shadow:0 0 0 1px rgba(239,68,68,.22),0 10px 24px rgba(248,113,113,.16)}50%{box-shadow:0 0 0 1px rgba(239,68,68,.42),0 10px 28px rgba(248,113,113,.3)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}
#app{width:100%;height:100%;display:grid;grid-template-rows:auto 1fr 4px;align-items:center;text-align:center;gap:4px;position:relative;border:1px solid var(--pip-border);border-radius:10px;background:var(--pip-panel-bg,#fff);padding:7px 9px 8px;box-shadow:0 10px 24px color-mix(in srgb,var(--pip-color) 18%,rgba(15,23,42,.1));overflow:hidden}
#app::before{content:'';position:absolute;inset:0 0 auto 0;height:2px;background:linear-gradient(90deg,var(--pip-color),var(--pip-strong));opacity:.95}
#top{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px}
#header{min-width:0;font-size:11px;font-weight:900;letter-spacing:0;color:var(--pip-strong);line-height:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#cycle{font-size:10px;color:var(--pip-strong);font-weight:900;letter-spacing:0;padding:4px 6px;border:1px solid var(--pip-border);background:var(--pip-soft);border-radius:999px;white-space:nowrap}
#status{display:none}
#clock{width:100%;display:flex;align-items:center;justify-content:center;min-height:42px}
#time{font-family:'JetBrains Mono',monospace;font-size:40px;font-weight:900;color:color-mix(in srgb,var(--pip-strong) 82%,#0f172a);line-height:1;letter-spacing:0;font-variant-numeric:tabular-nums}
.tile,#col,#nextinfo,#controls,.pip-ctrl{display:none}
#bar{width:100%;height:4px;background:rgba(15,23,42,.08);border-radius:999px;overflow:hidden;position:relative}
#fill{height:100%;border-radius:999px;background:linear-gradient(90deg,var(--pip-color),var(--pip-strong));position:relative;overflow:hidden;transition:width .25s ease}
#fill::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:shimmer 2.2s ease-in-out infinite}
.urgency{animation:urgencyPulse 1s ease-in-out infinite,shake .3s ease-in-out infinite}
.urgency #time{color:#dc2626;animation:pulse .65s ease-in-out infinite}
.urgency #cycle{border-color:rgba(248,113,113,.45);background:rgba(254,242,242,.85);color:#dc2626}
.urgency #bar{background:rgba(248,113,113,.18)}
.urgency #fill{background:#ef4444}
</style></head><body>`;

function pipBodyHTML(d) {
  const cls = (d.mode || 'focus') + (d.urgency ? ' urgency' : '');
  const cycleText = d.cycle ? 'Phi\u00EAn ' + d.cycle + '/4' : '';
  const nextText = d.nextMode ? 'Ti\u1EBFp: ' + d.nextMode : '';
  const primaryAction = d.running ? 'pause' : 'start';
  const primaryIcon = d.running ? PIP_CTRL_SVG_PAUSE : PIP_CTRL_SVG_PLAY;
  const primaryLabel = d.running ? 'T\u1EA1m d\u1EEBng' : 'B\u1EAFt \u0111\u1EA7u';
  return '<div id="app" class="' + cls + '">' +
    '<div id="top"><div id="header">' + d.label + '</div><div id="cycle">' + cycleText + '</div></div>' +
    '<div id="status">' + d.label + '</div>' +
    '<div id="clock">' + clockHTML(d.mm, d.ss) + '</div>' +
    '<div id="nextinfo">' + nextText + '</div>' +
    '<div id="controls">' +
      '<button ' + pipActionAttrs(primaryAction) + ' class="pip-ctrl primary" title="' + primaryLabel + '">' + primaryIcon + '<span>' + primaryLabel + '</span></button>' +
      '<button ' + pipActionAttrs('skip') + ' class="pip-ctrl secondary" title="Chuy\u1EC3n phi\u00EAn">' + PIP_CTRL_SVG_SKIP + '<span>Chuy\u1EC3n</span></button>' +
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
    const app = pw.document.getElementById('app');
    if (!app) {
      pw.document.body.innerHTML = pipBodyHTML(data);
      attachPipHandlers(pw);
      return;
    }
    app.className = modeClass + (data.urgency ? ' urgency' : '');
    const cycle = pw.document.getElementById('cycle');
    if (cycle) cycle.textContent = data.cycle ? 'Phiên ' + data.cycle + '/4' : '';
    const header = pw.document.getElementById('header');
    if (header) header.textContent = data.label;
    const status = pw.document.getElementById('status');
    if (status) status.textContent = data.label;
    const nextInfo = pw.document.getElementById('nextinfo');
    if (nextInfo) nextInfo.textContent = data.nextMode ? 'Tiếp: ' + data.nextMode : '';
    const digits = [data.mm?.[0] || '0', data.mm?.[1] || '0', data.ss?.[0] || '0', data.ss?.[1] || '0'];
    pw.document.querySelectorAll('.tile span').forEach((node, index) => {
      const digit = digits[index] || '0';
      if (node.textContent !== digit) node.textContent = digit;
    });
    const time = pw.document.getElementById('time');
    if (time) {
      const value = (data.mm || '00') + ':' + (data.ss || '00');
      if (time.textContent !== value) time.textContent = value;
    }
    const fill = pw.document.getElementById('fill');
    if (fill) fill.style.width = data.pct + '%';
    const primaryAction = data.running ? 'pause' : 'start';
    const primaryLabel = data.running ? 'Tạm dừng' : 'Bắt đầu';
    const primaryIcon = data.running ? PIP_CTRL_SVG_PAUSE : PIP_CTRL_SVG_PLAY;
    const primaryButton = pw.document.querySelector('.pip-ctrl.primary');
    if (primaryButton && primaryButton.dataset.pipAction !== primaryAction) {
      primaryButton.dataset.pipAction = primaryAction;
      primaryButton.setAttribute('title', primaryLabel);
      primaryButton.innerHTML = primaryIcon + '<span>' + primaryLabel + '</span>';
    }
    attachPipHandlers(pw);
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
          pw.document.body.innerHTML = '<style>@keyframes pipCelebScale{0%{transform:scale(0.5);opacity:0}100%{transform:scale(1);opacity:1}}#c{height:100%;display:grid;grid-template-columns:auto 1fr;align-items:center;gap:10px;padding:10px 14px;overflow:hidden}#c .check{font-size:30px;font-weight:900;color:#fff;font-family:JetBrains Mono,monospace;animation:pipCelebScale .28s ease-out both}#c .label{font-size:14px;font-weight:900;color:#fff;font-family:JetBrains Mono,monospace;letter-spacing:0;line-height:1}#c .sub{font-size:10px;font-weight:800;color:rgba(255,255,255,.78);font-family:JetBrains Mono,monospace;margin-top:4px;letter-spacing:0}.hint,.confetti{display:none}</style><div id="c"><div class="check">✓</div><div><div class="label">Xong phiên</div><div class="sub">Chạm để tiếp tục</div></div></div>';
          pw.document.body.onpointerdown = handlePipContinue;
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
  pipInterval = setInterval(pipTick, 500);
}

function stopPipInterval() {
  if (pipInterval) { clearInterval(pipInterval); pipInterval = null; }
}

export function openPipWindow() {
  if (!('documentPictureInPicture' in window)) return false;
  pipDone = false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); startPipInterval(); return true; }
  const token = ++pipToken;
  window.documentPictureInPicture.requestWindow({ width: 240, height: 92 }).then((win) => {
    if (token !== pipToken) { try { win.close(); } catch {} return; }
    pipWindow = win;
    const initBody = pipBodyHTML({ mm: '00', ss: '00', label: 'Tập trung', mode: 'focus', cycle: 1, nextMode: 'Nghỉ ngắn', pct: 0, urgency: false, running: false });
    win.document.write(PIP_HEAD + initBody + '</body></html>');
    win.document.close();
    win.document.body.className = 'focus';
    attachPipHandlers(win);
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
