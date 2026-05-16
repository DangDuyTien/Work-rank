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

export function playTickSound(volume = 0.12) {
  try {
    const ctx = getAudioContext();
    const gain = ctx.createGain();
    const vol = Math.max(0, Math.min(1, volume)) * 0.18;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    gain.connect(ctx.destination);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1200, now);
    o.frequency.exponentialRampToValueAtTime(800, now + 0.05);
    o.connect(gain);
    o.start(now);
    o.stop(now + 0.06);
  } catch {}
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

export function openPipWindow() {
  if (!('documentPictureInPicture' in window)) return false;
  if (pipWindow && !pipWindow.closed) { pipWindow.focus(); return true; }
  window.documentPictureInPicture.requestWindow({ width: 310, height: 240 }).then((win) => {
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
var KEY='workrank:pomodoro-state';
var PRESETS={classic:[25,5,15],deep:[50,10,25],sprint:[15,3,10]};
function cell(d){return '<div class="c"><div class="h t"><span class="n">'+d+'</span></div><div class="h b"><span class="n">'+d+'</span></div></div>'}
function clock(mm,ss){return cell(mm[0])+cell(mm[1])+'<span class="sep">:</span>'+cell(ss[0])+cell(ss[1])}
function tick(){
  try{
    var raw=localStorage.getItem(KEY);
    if(!raw)return;
    var p=JSON.parse(raw);
    if(!p||!p.running){window.close();return}
    var e=Number(p.endsAt||0);
    if(!e){window.close();return}
    var r=Math.max(0,Math.ceil((e-Date.now())/1000));
    if(r<=0){window.close();return}
    var mm=String(Math.floor(r/60)).padStart(2,'0');
    var ss=String(r%60).padStart(2,'0');
    var c=p.mode==='focus'?'#38bdf8':p.mode==='shortBreak'?'#16a34a':'#d97706';
    var cl=document.getElementById('clock');if(cl)cl.innerHTML=clock(mm,ss);
    var lb=document.getElementById('label');if(lb)lb.textContent=p.mode==='focus'?'Tập trung':p.mode==='shortBreak'?'Nghỉ ngắn':'Nghỉ dài';
    var focusCount=Number(p.completedFocusCount||0);
    var done=p.mode==='longBreak'?4:focusCount%4;
    var steps='';
    for(var i=0;i<4;i++){
      var sc=i<done?'#22c55e':(p.mode==='focus'&&i===(focusCount%4)?c:'rgba(255,255,255,0.07)');
      steps+='<span class="d" style="background:'+sc+'"></span>';
    }
    var ft=document.getElementById('foot');if(ft)ft.innerHTML='<span>'+(focusCount%4+1)+'/4</span>'+steps+'<span>'+Math.floor(r/60)+'p</span>';
    var preset=PRESETS[p.presetKey]||PRESETS.classic;
    var total=(p.mode==='focus'?preset[0]:p.mode==='shortBreak'?preset[1]:preset[2])*60;
    var deg=(r/total)*360;
    var rg=document.getElementById('ring');if(rg)rg.style.background='conic-gradient('+c+' '+deg+'deg, rgba(255,255,255,0.05) 0deg)';
  }catch(err){console.warn('pip:',err)}
}
tick();
setInterval(tick,200);
document.body.onclick=function(){window.close()};
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
