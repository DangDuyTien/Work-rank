import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const phase = process.env.UX_PHASE || 'baseline';
const web = 'http://127.0.0.1:5282', api = 'http://127.0.0.1:5112';
const out = path.resolve(`../docs/audit/2026-10-21/four-games/${phase}`);
await fs.mkdir(out, { recursive: true });
const report = { phase, matches: [], errors: [] };
const browser = await chromium.launch();
const percentile = (a,p) => [...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))] || 0;
async function identity(suffix) {
 const c = await browser.newContext({ viewport: { width:1440,height:1000 }, hasTouch:true });
 const auth = await c.request.post(api+'/api/auth/login',{data:{email:`arcade-${suffix}@audit.test`,password:'ArcadeAuditTest123!'}}).then(r=>r.json());
 await c.addInitScript(token=>{
  localStorage.setItem('token',token);
  window.__commits=0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__={renderers:new Map(),supportsFiber:true,inject(r){this.renderers.set(1,r);return 1;},onCommitFiberRoot(){window.__commits++;},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},checkDependencies(){}};
 },auth.accessToken);
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 const req=async(route,data)=>{const r=await c.request[data===undefined?'get':'post'](api+'/api/games/typing'+route,{headers:{Authorization:`Bearer ${auth.accessToken}`},...(data===undefined?{}:{data})});assert.ok(r.ok(),`${route}: ${await r.text()}`);return r.json();};
 return {c,p,req,userId:auth.user.id};
}
const shot=(s,mode,label)=>s.p.screenshot({path:path.join(out,`typing-${mode}-${label}.png`)});
async function profile(s) {
 const cdp=await s.c.newCDPSession(s.p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await s.p.evaluate(()=>{
  const d=window.__perf={active:true,latencies:[],frames:[],longTasks:[],cls:0,commitsStart:window.__commits,nodes:document.querySelectorAll('*').length,sceneMutations:0};let last;
  const tick=t=>{if(!d.active)return;if(last)d.frames.push(t-last);last=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
  document.querySelector('input[aria-label="Nội dung đang gõ"]').addEventListener('input',()=>{if(!d.active)return;const t=performance.now();requestAnimationFrame(()=>d.latencies.push(performance.now()-t));},true);
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(d.active)d.longTasks.push(e.duration);}).observe({type:'longtask'});
  new PerformanceObserver(l=>{for(const e of l.getEntries())if(d.active&&!e.hadRecentInput)d.cls+=e.value;}).observe({type:'layout-shift'});
  const scene=document.querySelector('.typing-race-tracks');if(scene)new MutationObserver(l=>{if(d.active)d.sceneMutations+=l.length;}).observe(scene,{subtree:true,attributes:true,childList:true});
 });return cdp;
}
try {
 const sessions=await Promise.all(['native','b','c'].map(identity));
 const modes=process.env.UX_MODES?.split(',') || (phase==='baseline'?['SOLO']:['SOLO','1V1','TRIO']);
 for(const mode of modes){
  const group=sessions.slice(0,mode==='SOLO'?1:mode==='1V1'?2:3),host=group[0];
  const created=await host.req('/rooms',{title:`Typing Race ${phase}`,mode,matchType:'PRACTICE',durationLimitSeconds:30});const id=created.room.id;
  for(const s of group.slice(1))await s.req(`/rooms/${id}/join`,{});
  await Promise.all(group.map(s=>s.p.goto(`${web}/games/typing/room/${id}`)));
  await shot(host,mode,'lobby');
  for(const s of group)await s.p.getByRole('button',{name:/Tôi đã sẵn sàng|Bắt đầu đường đua/}).click();
  let state;for(let n=0;n<24;n++){state=await host.req(`/rooms/${id}`);if(state.room.status==='PLAYING')break;await host.p.waitForTimeout(300);}
  assert.equal(state.room.status,'PLAYING');
  const cpu=await profile(host);
  await Promise.all(group.map(async(s,i)=>{
   const input=s.p.getByRole('textbox',{name:'Nội dung đang gõ'});await input.waitFor();await input.focus();
   await s.p.keyboard.insertText('x');if(i===0)await shot(s,mode,'wrong');await s.p.keyboard.press('Backspace');
   const chars=Array.from(state.room.challengeText.normalize('NFC'));
   for(const ch of chars.slice(0,100-i*20)){await s.p.keyboard.insertText(ch);await s.p.waitForTimeout(45+i*10);}
   if(i===0)await shot(s,mode,'mid-game');
  }));
  const raw=await host.p.evaluate(()=>{window.__perf.active=false;return {...window.__perf,commits:window.__commits-window.__perf.commitsStart};});
  await cpu.send('Emulation.setCPUThrottlingRate',{rate:1});await cpu.detach();
  const perf={fpsMean:1000/(raw.frames.reduce((a,b)=>a+b,0)/raw.frames.length),inputP50:percentile(raw.latencies,.5),inputP95:percentile(raw.latencies,.95),frameP50:percentile(raw.frames,.5),frameP95:percentile(raw.frames,.95),longTasks:raw.longTasks.length,cls:raw.cls,reactCommits:raw.commits,domNodes:raw.nodes,sceneMutations:raw.sceneMutations,inputs:raw.latencies.length};
  assert.ok(perf.inputP95<=25,JSON.stringify(perf));
  for(const width of [390,430,768]){
   await host.p.setViewportSize({width,height:844});await inputAction(host,state.room.challengeText,5);await shot(host,mode,`mobile-${width}`);
   assert.ok(await host.p.evaluate(()=>document.documentElement.scrollWidth-innerWidth<=1));
  }
  await host.p.setViewportSize({width:390,height:430});await inputAction(host,state.room.challengeText,5);await shot(host,mode,'keyboard-viewport');
  await host.p.setViewportSize({width:1440,height:1000});
  for(let n=0;n<80;n++){state=await host.req(`/rooms/${id}`);if(state.room.status==='FINISHED')break;await host.p.waitForTimeout(500);}
  assert.equal(state.room.status,'FINISHED');await host.p.waitForTimeout(400);await shot(host,mode,'finish');
  if(phase!=='baseline'){
   const replay=host.p.getByRole('button',{name:/Chơi lại cùng nhóm|Chơi lại/}).first();await replay.click();
   await host.p.waitForTimeout(700);const reset=await host.req(`/rooms/${id}`);assert.equal(reset.room.status,mode==='SOLO'?'STARTING':'WAITING');assert.equal(reset.players.length,group.length);await shot(host,mode,'replay');
  }
  report.matches.push({mode,status:'PASS',roomId:id,players:group.length,perf,result:state.result});console.log('PASS Typing',phase,mode,JSON.stringify(perf));
  for(const s of group)await s.req(`/rooms/${id}/leave`,{});
 }
 for(const s of sessions)await s.c.close();
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;for(const [i,c]of browser.contexts().entries())for(const p of c.pages())await p.screenshot({path:path.join(out,`typing-failure-${i}.png`)}).catch(()=>{});}
finally{await fs.writeFile(path.join(out,'typing-results.json'),JSON.stringify(report,null,2));await browser.close();}
async function inputAction(s,target,n){const input=s.p.getByRole('textbox',{name:'Nội dung đang gõ'});await input.focus();const at=Array.from((await input.inputValue()).normalize('NFC')).length;for(const ch of Array.from(target.normalize('NFC')).slice(at,at+n)){await s.p.keyboard.insertText(ch);await s.p.waitForTimeout(55);}}
