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

export function openPipWindow() {
  if (!('documentPictureInPicture' in window)) return false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return true; }
  window.documentPictureInPicture.requestWindow({ width: 300, height: 220 }).then((win) => {
    pipWindow = win;
    win.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
body{
  background:#0f172a;height:100vh;overflow:hidden;user-select:none;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  border:1px solid rgba(56,189,248,0.15);font-family:'JetBrains Mono',monospace;
}
.pip-ring{
  width:172px;height:172px;border-radius:0;
  padding:8px;display:flex;align-items:center;justify-content:center;
  transition:background .3s;
}
.pip-inner{
  width:100%;height:100%;border-radius:0;
  background:#0f172a;border:1px solid rgba(56,189,248,0.08);
  display:flex;flex-direction:column;align-items:center;justify-content:center;
}
#pip-label{
  font-size:10px;font-weight:900;color:#38bdf8;
  text-transform:uppercase;letter-spacing:.12em;line-height:1;
}
#pip-time{
  font-family:'Orbitron','JetBrains Mono',monospace;
  font-size:48px;font-weight:900;line-height:1;margin-top:10px;
  color:#ffffff;letter-spacing:1px;
  text-shadow:0 0 6px rgba(56,189,248,0.12);
}
.pip-footer{
  display:flex;gap:12px;margin-top:10px;align-items:center;
}
.pip-dot{
  width:16px;height:16px;border-radius:0;
  display:flex;align-items:center;justify-content:center;
  font-size:7px;font-weight:900;line-height:1;
}
#pip-bar{
  display:flex;gap:4px;align-items:center;
}
#pip-bar span{
  width:18px;height:5px;border-radius:0;display:block;
}
</style>
</head>
<body>
<div class="pip-ring" id="pip-ring">
<div class="pip-inner">
<div id="pip-label">Tập trung</div>
<div id="pip-time">25:00</div>
<div class="pip-footer">
<div class="pip-dot" id="pip-step">1</div>
<div class="pip-dot" id="pip-progress">0%</div>
</div>
</div>
</div>
<script>
var KEY='workrank:pomodoro-state';
var PRESETS={classic:1500,deep:3000,sprint:900};
var BREAKS={classic:300,deep:600,sprint:180};
var LONGS={classic:900,deep:1500,sprint:600};
var PCOLORS={focus:'#38bdf8',shortBreak:'#16a34a',longBreak:'#d97706'};
function tick(){
  try{
    var raw=localStorage.getItem(KEY);if(!raw){window.close();return}
    var p=JSON.parse(raw);if(!p.running){window.close();return}
    var e=Number(p.endsAt||0);if(!e){window.close();return}
    var r=Math.max(0,Math.ceil((e-Date.now())/1000));if(r<=0){window.close();return}
    var pk=p.presetKey||'classic'
    var total=p.mode==='longBreak'?LONGS[pk]:p.mode==='shortBreak'?BREAKS[pk]:PRESETS[pk]
    if(!total)total=1500
    var pct=Math.min(100,Math.round((total-r)/total*100))
    var mm=String(Math.floor(r/60)).padStart(2,'0')
    var ss=String(r%60).padStart(2,'0')
    var c=PCOLORS[p.mode]||'#38bdf8'
    document.getElementById('pip-time').textContent=mm+':'+ss
    document.getElementById('pip-label').textContent=(p.mode==='focus'?'Tập trung':p.mode==='shortBreak'?'Nghỉ ngắn':'Nghỉ dài')
    document.getElementById('pip-step').textContent=(p.completedFocusCount%4)+1+'/4'
    document.getElementById('pip-progress').textContent=pct+'%'
    document.getElementById('pip-ring').style.background='conic-gradient('+c+' '+pct*3.6+'deg, rgba(56,189,248,0.06) 0deg)'
    var bar=document.getElementById('pip-bar')
    if(!bar.innerHTML){
      var html='';for(var i=0;i<4;i++)html+='<span id="bs'+i+'"></span>'
      bar.innerHTML=html
    }
    var done=p.mode==='longBreak'?4:p.completedFocusCount%4
    for(var i=0;i<4;i++){
      var el=document.getElementById('bs'+i)
      if(el)el.style.background=i<done?'#22c55e':i===(done%4)&&p.mode==='focus'?c:'rgba(255,255,255,0.08)'
    }
  }catch(e){window.close()}
}
tick();setInterval(tick,1000);
document.body.onclick=function(){window.close()}
</script>
</body></html>`);
    win.document.close();
    win.addEventListener('pagehide', () => { pipWindow = null; });
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
  if (!pipWindow || pipWindow.closed) return;
  try { pipWindow.document.getElementById('pip-time'); } catch { pipWindow = null; }
}
