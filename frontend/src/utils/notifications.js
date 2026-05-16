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

function cell(d) { return '<div class="c"><div class="h t"><span class="n">' + d + '</span></div><div class="h b"><span class="n">' + d + '</span></div></div>'; }
function clockHTML(mm, ss) { return cell(mm[0]) + cell(mm[1]) + '<span class="sep">:</span>' + cell(ss[0]) + cell(ss[1]); }

function updatePipDOM(data) {
  const pw = pipWindow;
  if (!pw || pw.closed) return;
  if (pw.__upd) pw.__upd(clockHTML(data.mm, data.ss), data.label, data.foot, data.ring);
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
    const focusCount = Number(p.completedFocusCount || 0);
    const preset = PIP_PRESETS[p.presetKey] || PIP_PRESETS.classic;
    const total = (mode === 'focus' ? preset[0] : mode === 'shortBreak' ? preset[1] : preset[2]) * 60;
    const col = mode === 'focus' ? '#38bdf8' : mode === 'shortBreak' ? '#16a34a' : '#d97706';
    const done = mode === 'longBreak' ? 4 : focusCount % 4;
    var steps = '';
    for (var i = 0; i < 4; i++) {
      var sc = i < done ? '#22c55e' : (mode === 'focus' && i === (focusCount % 4) ? col : 'rgba(255,255,255,0.07)');
      steps += '<span class="d" style="background:' + sc + '"></span>';
    }
    const label = mode === 'focus' ? 'Tập trung' : mode === 'shortBreak' ? 'Nghỉ ngắn' : 'Nghỉ dài';
    const deg = (rem / (total || 1)) * 360;
    const footHTML = '<span>' + (focusCount % 4 + 1) + '/4</span>' + steps + '<span>' + Math.floor(rem / 60) + 'p</span>';

    updatePipDOM({
      mm: mm,
      ss: ss,
      label: label,
      foot: footHTML,
      ring: 'conic-gradient(' + col + ' ' + deg + 'deg, rgba(255,255,255,0.05) 0deg)',
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
  window.documentPictureInPicture.requestWindow({ width: 310, height: 240 }).then((win) => {
    if (token !== pipToken) { try { win.close(); } catch {} return; }
    pipWindow = win;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{
  background:#0f172a;height:100vh;overflow:hidden;user-select:none;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  border:1px solid rgba(56,189,248,0.12);
  font-family:'JetBrains Mono',monospace;
}
#ring{
  width:188px;height:188px;padding:7px;display:flex;
  align-items:center;justify-content:center;
}
#inner{
  width:100%;height:100%;background:#0f172a;
  border:1px solid rgba(56,189,248,0.06);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
}
#label{
  font-size:9px;font-weight:900;color:#38bdf8;
  text-transform:uppercase;letter-spacing:.14em;line-height:1;
}
#clock{display:flex;align-items:center;gap:0;margin-top:2px}
.c{
  position:relative;width:40px;height:58px;overflow:hidden;
  display:flex;flex-direction:column;background:rgba(30,41,59,1);
}
.c+.c{border-left:1px solid rgba(15,23,42,0.6)}
.h{height:50%;display:flex;justify-content:center;overflow:hidden}
.t{align-items:flex-start;background:rgba(30,41,59,1)}
.b{align-items:flex-end;background:rgba(26,35,51,1)}
.c .n{font-family:'Montserrat',sans-serif;font-size:52px;font-weight:900;line-height:58px;color:#fff;display:block;height:58px}
.c:after{
  content:'';position:absolute;top:50%;left:0;right:0;
  height:1px;background:#0f172a;z-index:2;transform:translateY(-50%)
}
.sep{
  font-family:'Montserrat',sans-serif;font-size:38px;font-weight:900;
  color:rgba(255,255,255,0.5);margin:0 1px;line-height:1;padding-bottom:4px
}
#foot{display:flex;gap:8px;align-items:center;margin-top:2px}
#foot>span{font-size:8px;font-weight:800;color:#64748b;line-height:1}
#foot .d{width:20px;height:4px;display:block}
</style></head>
<body>
<div id="ring"><div id="inner">
<div id="label">Tập trung</div>
<div id="clock"><div class="c"><div class="h t"><span class="n">0</span></div><div class="h b"><span class="n">0</span></div></div><div class="c"><div class="h t"><span class="n">0</span></div><div class="h b"><span class="n">0</span></div></div><span class="sep">:</span><div class="c"><div class="h t"><span class="n">0</span></div><div class="h b"><span class="n">0</span></div></div><div class="c"><div class="h t"><span class="n">0</span></div><div class="h b"><span class="n">0</span></div></div></div>
<div id="foot"><span>1/4</span><span class="d" style="background:rgba(255,255,255,0.07)"></span><span class="d" style="background:rgba(255,255,255,0.07)"></span><span class="d" style="background:rgba(255,255,255,0.07)"></span><span class="d" style="background:rgba(255,255,255,0.07)"></span><span>0p</span></div>
</div></div>
<script>
window.__upd=function(h,l,f,r){
  var e;
  e=document.getElementById('clock');if(e)e.innerHTML=h
  e=document.getElementById('label');if(e)e.textContent=l
  e=document.getElementById('foot');if(e)e.innerHTML=f
  e=document.getElementById('ring');if(e)e.style.background=r
}
document.body.onclick=function(){window.close()}
</script>
</body></html>`);
    win.document.close();
    setTimeout(startPipInterval, 50);
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
