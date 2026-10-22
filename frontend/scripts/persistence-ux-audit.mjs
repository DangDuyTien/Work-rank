import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { challenge, OPPOSITE } from '../../shared/arcade/engine.mjs';

const web='http://127.0.0.1:5283',api='http://127.0.0.1:5113';
const out=path.resolve('../docs/audit/2026-10-22/ux');await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch();
const report={startedAt:new Date().toISOString(),checks:[],errors:[],performance:[]};
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS',name);};
const shot=(p,name)=>p.screenshot({path:path.join(out,name+'.png'),fullPage:true});
const keys={UP:'ArrowUp',DOWN:'ArrowDown',LEFT:'ArrowLeft',RIGHT:'ArrowRight'};
async function session(suffix,width=1440){
 const context=await browser.newContext({viewport:{width,height:width<600?844:1000},hasTouch:true});
 const r=await context.request.post(api+'/api/auth/login',{data:{email:`persistence-${suffix}@audit.test`,password:'PersistenceAuditTest123!'}});assert.ok(r.ok(),await r.text());const auth=await r.json();
 await context.addInitScript(()=>{window.__commits=0;window.__REACT_DEVTOOLS_GLOBAL_HOOK__={renderers:new Map(),supportsFiber:true,inject(r){this.renderers.set(1,r);return 1;},onCommitFiberRoot(){window.__commits++;},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},checkDependencies(){}};});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(web+'/login');await p.evaluate(t=>localStorage.setItem('token',t),auth.accessToken);
 const raw=(route,data,method)=>context.request[method||(data===undefined?'get':'post')](api+route,{headers:{Authorization:`Bearer ${auth.accessToken}`},...(data===undefined?{}:{data})});
 const request=async(route,data,method)=>{const r=await raw(route,data,method);assert.ok(r.ok(),`${route}: ${await r.text()}`);return r.json();};
 return {context,p,request,raw,auth};
}
async function clearActive(s){const active=await s.request('/api/games/arcade/active');if(active)await s.request(`/api/games/arcade/rooms/${active.room.id}/leave`,{});}
async function startDirection(mode,suffixes){
 const group=[];for(const suffix of suffixes){const s=await session(suffix);await clearActive(s);group.push(s);}
 const host=group[0];const snap=await host.request('/api/games/arcade/rooms',{gameType:'direction_rush',mode});const id=snap.room.id;assert.equal(snap.room.rulesVersion,3);
 for(const s of group.slice(1))await s.request(`/api/games/arcade/rooms/${id}/join`,{});
 for(const s of group){s.id=id;s.snap=snap;await s.p.goto(`${web}/games/arcade/direction_rush/room/${id}`);}
 if(mode!=='SOLO'){for(const s of group)await s.p.getByRole('button',{name:'Tôi đã sẵn sàng',exact:true}).click();await host.p.getByRole('button',{name:'Bắt đầu',exact:true}).click();}
 for(const s of group){await s.p.locator('.arcade-world').waitFor();await s.p.locator('.arcade-countdown').waitFor({state:'hidden'});}
 return group;
}
const count=p=>p.locator('.arcade-world').getAttribute('data-attempts').then(Number);
async function correct(s){await s.p.locator('[data-stumbling="true"]').waitFor({state:'hidden'});await s.p.waitForTimeout(75);const d=await s.p.getByTestId('challenge-direction').getAttribute('data-expected');await s.p.locator('.arcade-direction-arena').focus();await s.p.keyboard.press(keys[d]);}
async function perfStart(s,selector){const cdp=await s.context.newCDPSession(s.p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await s.p.evaluate(selector=>{
 const data=window.__uxPerf={frames:[],inputs:[],longTasks:[],cls:0,active:true,commits:window.__commits};let previous;
 const tick=t=>{if(!data.active)return;if(previous)data.frames.push(t-previous);previous=t;requestAnimationFrame(tick);};requestAnimationFrame(tick);
 for(const type of ['keydown','input','pointerdown','pointermove','click'])document.querySelector(selector).addEventListener(type,()=>{if(!data.active)return;const at=performance.now();requestAnimationFrame(()=>data.inputs.push(performance.now()-at));},true);
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(data.active)data.longTasks.push(e.duration);}).observe({type:'longtask'});
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(data.active&&!e.hadRecentInput)data.cls+=e.value;}).observe({type:'layout-shift'});
 },selector);return cdp;}
async function perfEnd(s,cdp,game){const d=await s.p.evaluate(()=>{window.__uxPerf.active=false;return {...window.__uxPerf,commits:window.__commits-window.__uxPerf.commits};});await cdp.send('Emulation.setCPUThrottlingRate',{rate:1});await cdp.detach();
 const q=(a,p)=>[...a].sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(a.length*p))]||0;
 const perf={game,cpuThrottle:4,inputSamples:d.inputs.length,inputToNextFrameP50Ms:q(d.inputs,.5),inputToNextFrameP95Ms:q(d.inputs,.95),frameP95Ms:q(d.frames,.95),frameSamples:d.frames.length,cls:d.cls,longTasks:d.longTasks.length,longestTaskMs:Math.max(0,...d.longTasks),reactCommits:d.commits};report.performance.push(perf);assert.ok(perf.inputSamples>=10);assert.ok(perf.inputToNextFrameP95Ms<=(game==='direction_rush'?20:30),JSON.stringify(perf));assert.ok(perf.cls<.1,JSON.stringify(perf));check(game+' input/frame CPU 4x',perf);}
async function direction(){
 const [s]=await startDirection('SOLO',['g']);const {p}=s;
 assert.equal(await p.getByTestId('queued-direction').count(),3);
 const queue=await p.getByTestId('queued-direction').evaluateAll(es=>es.map(e=>({index:Number(e.dataset.queueIndex),direction:e.dataset.direction,opacity:getComputedStyle(e.firstChild).opacity,transform:getComputedStyle(e.firstChild).transform})));
 for(const q of queue)assert.equal(q.direction,challenge('direction_rush',s.snap.room.seed,q.index,'mixed',{rulesVersion:3}).direction);
 assert.deepEqual(queue.map(x=>x.opacity),['0.72','0.52','0.32']);
 const before=await count(p),d=await p.getByTestId('challenge-direction').getAttribute('data-expected'),next=queue[0].direction;
 await p.locator('.arcade-direction-arena').focus();await p.keyboard.press(keys[d]);await p.keyboard.press(keys[next]);for(let n=0;n<4;n++)await p.keyboard.press(keys[next]);await p.waitForTimeout(100);
 assert.equal(await count(p),before+2,'Only one queued key, never whole sequence spam');
 assert.equal(await p.getByTestId('challenge-direction').getAttribute('data-direction'),queue[1].direction);check('Direction current +3, promotion and single-slot rapid input buffer',{queue,before,after:await count(p)});
 const wrong=OPPOSITE[await p.getByTestId('challenge-direction').getAttribute('data-expected')];await p.waitForTimeout(70);await p.keyboard.press(keys[wrong]);
 await p.locator('[data-stumbling="true"]').waitFor();const at=Date.now(),n=await count(p);assert.match(await p.locator('.arcade-direction-feedback').textContent(),/KHỰNG.*CẦN.*BẠN/);await shot(p,'direction-stumble');
 for(let i=0;i<6;i++)await p.keyboard.press('ArrowUp');await p.waitForTimeout(Math.max(0,300-(Date.now()-at)));assert.equal(await count(p),n);
 await p.locator('[data-stumbling="true"]').waitFor({state:'hidden'});const penaltyObserved=Date.now()-at;assert.ok(penaltyObserved>=300&&penaltyObserved<700,penaltyObserved);await correct(s);assert.equal(await count(p),n+1);check('Direction wrong freezes input, then resumes clearly',{penaltyObserved,configuredMs:450});
 for(const width of [390,430,768]){await p.setViewportSize({width,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);await shot(p,'direction-queue-'+width);}
 const cdp=await perfStart(s,'.arcade-world');for(let n=0;n<40;n++)await correct(s);await perfEnd(s,cdp,'direction_rush');
 const stages=new Set();let oppositeChecked=false;
 while(await p.locator('.arcade-world').count()&&!await p.locator('.arcade-end-message').count()){
  const stage=await p.locator('.arcade-direction-arena').getAttribute('data-stage');stages.add(stage);
  const current=await p.getByTestId('challenge-direction').getAttribute('data-direction'),expected=await p.getByTestId('challenge-direction').getAttribute('data-expected');
  if(stage==='opposite'){assert.equal(expected,OPPOSITE[current]);assert.match(await p.locator('.arcade-direction-rule').textContent(),/ĐẢO CHIỀU/);if(!oppositeChecked){await shot(p,'direction-opposite');oppositeChecked=true;}}
  await correct(s);
  if(stages.has('final'))break;
 }
 assert.ok(stages.has('entrance')&&stages.has('opposite')&&stages.has('final'),JSON.stringify([...stages]));check('Direction trick stages preserve raw queue semantics',{stages:[...stages],oppositeChecked});
 await p.locator('.arcade-result').waitFor({timeout:30000});const done=await s.request(`/api/games/arcade/rooms/${s.id}`);assert.ok(done.players[0].result.score>0);assert.equal(done.players[0].result.rank,1);await shot(p,'direction-result');
 await p.getByRole('button',{name:'Lịch sử đã lưu',exact:true}).click();await p.locator('.saved-history-list').waitFor();await shot(p,'direction-db-history');check('Direction history UI reads committed v3 and legacy results');await s.context.close();
 for(const mode of ['DUO','TRIO']){
  const group=await startDirection(mode,mode==='DUO'?['g','h']:['g','h','i']);const [leader,rival]=group;
  await correct(leader);await leader.p.waitForTimeout(75);const d=await leader.p.getByTestId('challenge-direction').getAttribute('data-expected');await leader.p.keyboard.press(keys[OPPOSITE[d]]);
  await leader.p.locator('[data-stumbling="true"]').waitFor();await correct(rival);await correct(rival);if(group[2])await correct(group[2]);
  await leader.p.waitForTimeout(1200);const snap=await leader.request(`/api/games/arcade/rooms/${leader.id}`);const mine=snap.players.find(x=>x.userId===leader.auth.user.id),other=snap.players.find(x=>x.userId===rival.auth.user.id);assert.ok(other.metrics.score>mine.metrics.score,JSON.stringify(snap.players));await shot(leader.p,'direction-'+mode.toLowerCase()+'-overtake');
  check('Direction '+mode+' rival overtakes after real stumble, no boost',{mine:mine.metrics,other:other.metrics});
  for(const x of group){await x.request(`/api/games/arcade/rooms/${x.id}/leave`,{});await x.context.close();}
 }
}
async function drawing(){const s=await session('native',390),{p}=s;await p.goto(web+'/games/drawing');await p.locator('.drawing-save-hud').filter({hasText:/Nháp|khôi phục/}).waitFor();
 const canvas=p.locator('canvas.drawing-canvas');await canvas.scrollIntoViewIfNeeded();const b=await canvas.boundingBox();const viewport=await p.locator('.drawing-viewport').boundingBox();assert.ok(b.width<=viewport.width&&b.height<=viewport.height,JSON.stringify({b,viewport}));
 const draw=async()=>{const b=await canvas.boundingBox();await p.mouse.move(b.x+b.width*.2,b.y+b.height*.4);await p.mouse.down();for(let n=0;n<25;n++)await p.mouse.move(b.x+b.width*(.2+n*.02),b.y+b.height*(.4+Math.sin(n/3)*.15));await p.mouse.up();};
 const cdp=await perfStart(s,'.drawing-game-shell');await draw();await perfEnd(s,cdp,'drawing');const pixels=await canvas.evaluate(c=>c.toDataURL());
 await p.getByRole('button',{name:/Hoàn tác/}).click();assert.notEqual(await canvas.evaluate(c=>c.toDataURL()),pixels);await p.getByRole('button',{name:/Làm lại/}).click();assert.equal(await canvas.evaluate(c=>c.toDataURL()),pixels);
 await p.locator('.drawing-save-hud[data-state="saved"]').waitFor();await shot(p,'drawing-mobile-draft');await p.reload();await p.locator('.drawing-save-hud').filter({hasText:/khôi phục|Nháp/}).waitFor();await p.waitForTimeout(500);assert.equal(await canvas.evaluate(c=>c.toDataURL()),pixels);check('Drawing mobile fit, undo/redo and IndexedDB draft reload');
 for(const width of [430,768,1440]){await p.setViewportSize({width,height:1000});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);await shot(p,'drawing-'+width);}
 await p.getByRole('button',{name:'Hoàn thành tác phẩm',exact:true}).click();const title='Drawing recovery UX '+Date.now();await p.locator('#artwork-title').fill(title);
 if(process.env.DRAWING_OUTAGE==='1'){
  await fs.writeFile('/tmp/workrank-drawing-outage-ready','ready');console.log('READY FOR STORAGE OUTAGE');
  for(let n=0;n<300;n++){try{await fs.access('/tmp/workrank-drawing-outage-stopped');break;}catch{}await p.waitForTimeout(200);}
  const response=p.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/drawings');await p.getByRole('button',{name:'Lưu & Hoàn thành tác phẩm',exact:true}).click();const failed=await response;assert.equal(failed.status(),502,await failed.text());await p.getByText(/Không thể tải ảnh lên kho lưu trữ/).first().waitFor();assert.equal(await canvas.evaluate(c=>c.toDataURL()),pixels);await shot(p,'drawing-storage-failure');
  const db=await s.request('/api/__persistence-audit'),pending=db.drawings.filter(d=>d.metadata?.uploadState==='PENDING'&&d.userId===s.auth.user.id);assert.equal(pending.length,1);await fs.writeFile(path.join(out,'drawing-pending-during-outage.json'),JSON.stringify(pending,null,2));await fs.writeFile('/tmp/workrank-drawing-outage-failed','ready');
  console.log('READY FOR STORAGE RESTART');for(let n=0;n<300;n++){try{await fs.access('/tmp/workrank-drawing-outage-restored');break;}catch{}await p.waitForTimeout(200);}
 }
 const response=p.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/drawings');await p.getByRole('button',{name:'Lưu & Hoàn thành tác phẩm',exact:true}).click();const saved=await response;assert.equal(saved.status(),201,await saved.text());const {drawing}=await saved.json();await p.getByRole('heading',{name:'Đã lưu lên hệ thống!',exact:true}).waitFor();assert.match(await p.locator('.publish-preview-img').getAttribute('src'),/^http/);await shot(p,'drawing-confirmed-publish');
 const rows=(await s.request('/api/__persistence-audit')).drawings.filter(x=>x.metadata?.publicationId===drawing.metadata.publicationId);assert.equal(rows.length,1);assert.equal(rows[0].status,'ACTIVE');
 await p.getByRole('button',{name:'Xem trong Thư Viện Tranh',exact:true}).click();await p.getByText(title,{exact:true}).first().waitFor();check('Drawing confirmed remote image, stable retry identity, one row and gallery',{id:drawing.id,key:drawing.storageKey});await fs.writeFile(path.join(out,'drawing-recovery-result.json'),JSON.stringify(drawing,null,2));await s.context.close();}
try{if(!process.env.UX_ONLY||process.env.UX_ONLY==='direction')await direction();if(!process.env.UX_ONLY||process.env.UX_ONLY==='drawing')await drawing();}
catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;for(const [i,c]of browser.contexts().entries())for(const p of c.pages())await shot(p,'failure-'+i).catch(()=>{});}
finally{report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,(process.env.UX_ONLY||'combined')+'-results.json'),JSON.stringify(report,null,2));await browser.close();}
