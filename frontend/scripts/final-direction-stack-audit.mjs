import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { challenge, OPPOSITE } from '../../shared/arcade/engine.mjs';

const web='http://127.0.0.1:5283',api='http://127.0.0.1:5113';
const out=path.resolve('../docs/audit/2026-10-22/final-gameplay-polish/direction');await fs.mkdir(out,{recursive:true});
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
 for(const s of group){await s.p.locator('.arcade-world').waitFor();await s.p.locator('.arcade-direction-arena').focus();if(await s.p.locator('.arcade-countdown').count()){await s.p.keyboard.press('ArrowUp');assert.equal(Number(await s.p.locator('.arcade-world').getAttribute('data-attempts')),0,'Countdown input locked');}await s.p.locator('.arcade-countdown').waitFor({state:'hidden'});}
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
const attempts=[];
const geometry=p=>p.locator('.direction-stack-card').evaluateAll(es=>es.filter(e=>Number(e.dataset.depth)>=0).map(e=>{const f=e.firstChild,r=f.getBoundingClientRect(),c=getComputedStyle(f);return{index:Number(e.dataset.flipId),depth:Number(e.dataset.depth),opacity:Number(c.opacity),transform:c.transform,hint:f.textContent,bounds:{x:r.x,y:r.y,width:r.width,height:r.height}};}));
async function solo(){
 const [s]=await startDirection('SOLO',['g']),{p}=s;const stack=await geometry(p);assert.deepEqual(stack.map(x=>x.opacity),[1,.64,.32,.18]);assert.equal(stack[3].hint,'◇');
 for(const c of stack.slice(1)){const a=stack[c.depth-1].bounds,b=c.bounds,area=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));assert.ok(area/(b.width*b.height)>.35,JSON.stringify(c));}
 const next=await p.getByTestId('queued-direction').first().getAttribute('data-direction'),d=await p.getByTestId('challenge-direction').getAttribute('data-expected');await p.keyboard.press(keys[d]);await p.keyboard.press(keys[next]);for(let i=0;i<4;i++)await p.keyboard.press(keys[next]);await p.waitForTimeout(220);assert.equal(await count(p),2);check('Overlapping stack, silhouette tail and one-key rapid buffer',{stack});
 const before=await geometry(p),expected=await p.getByTestId('challenge-direction').getAttribute('data-expected');await p.keyboard.press(keys[OPPOSITE[expected]]);await p.locator('[data-stumbling="true"]').waitFor();const at=Date.now(),n=await count(p);assert.equal(await p.locator('.direction-stack').getAttribute('data-visible-index'),String(before[0].index));assert.equal(await p.getByTestId('challenge-direction').getAttribute('data-expected'),expected);
 await shot(p,'wrong-frozen-stack');for(let i=0;i<4;i++)await p.keyboard.press('ArrowUp');await p.waitForTimeout(Math.max(0,290-(Date.now()-at)));assert.equal(await count(p),n);assert.deepEqual((await geometry(p)).map(c=>c.index),before.map(c=>c.index));await p.locator('[data-stumbling="true"]').waitFor({state:'hidden'});assert.ok(Date.now()-at<700);await correct(s);check('Wrong freezes cue/queue, rejects penalty keys',{observedMs:Date.now()-at});
 for(const width of [390,430,768,1024,1440]){await p.setViewportSize({width,height:width<600?844:1000});await p.waitForTimeout(190);assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth)<=1);const b=await p.getByRole('button',{name:'Đi UP',exact:true}).boundingBox();assert.ok(b.width>=44&&b.height>=44);await shot(p,'stack-'+width);const d=await p.getByTestId('challenge-direction').getAttribute('data-expected');
  if(width===390){const b=await p.getByTestId('challenge-direction').boundingBox(),x=b.x+b.width/2,y=b.y+b.height/2,[dx,dy]=({UP:[0,-48],DOWN:[0,48],LEFT:[-48,0],RIGHT:[48,0]})[d];const c=await s.context.newCDPSession(p);await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx,y:y+dy,id:1}]});await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await c.detach();}
  else if(width===430)await p.getByRole('button',{name:`Đi ${d}`,exact:true}).click();else{await p.locator('.arcade-direction-arena').focus();await p.keyboard.press(({UP:'w',DOWN:'s',LEFT:'a',RIGHT:'d'})[d]);}}
 check('390/430/768/1024/1440, buttons/WASD/swipe, 44px touch targets');
 const cdp=await perfStart(s,'.arcade-world'),start=await count(p);for(let i=0;i<40;i++)await correct(s);assert.equal(await count(p),start+40);await perfEnd(s,cdp,'direction_rush');
 await p.evaluate(()=>{const d=window.__endBeat={};new MutationObserver(()=>{if(document.querySelector('[data-testid="game-complete"]')&&!d.start)d.start=performance.now();if(document.querySelector('.arcade-result')&&d.start&&!d.end)d.end=performance.now();}).observe(document.body,{childList:true,subtree:true});});const stages=new Set();let opposite=false;
 while(await p.locator('.arcade-world').count()&&!await p.locator('.arcade-end-message').count()){const stage=await p.locator('.arcade-direction-arena').getAttribute('data-stage');stages.add(stage);if(stage==='opposite'){const raw=await p.getByTestId('challenge-direction').getAttribute('data-direction');assert.equal(await p.getByTestId('challenge-direction').getAttribute('data-expected'),OPPOSITE[raw]);if(!opposite){await shot(p,'opposite-stack');opposite=true;}}await correct(s);if(stage==='final')break;}
 assert.ok(stages.has('entrance')&&stages.has('opposite')&&stages.has('final'),JSON.stringify([...stages]));await p.emulateMedia({reducedMotion:'reduce'});const reduced=await p.locator('.direction-stack-face').first().evaluate(e=>({animation:getComputedStyle(e).animationName,transition:getComputedStyle(e).transitionDuration}));assert.equal(reduced.animation,'none');assert.equal(reduced.transition,'0s');await correct(s);await p.emulateMedia({reducedMotion:'no-preference'});check('Tricks/opposite and reduced motion preserve input timing',{stages:[...stages]});
 await p.locator('.arcade-result').waitFor({timeout:30000});const beat=await p.evaluate(()=>window.__endBeat);assert.ok(beat.end-beat.start>=300&&beat.end-beat.start<=700,JSON.stringify(beat));const done=await s.request(`/api/games/arcade/rooms/${s.id}`);assert.equal(done.room.status,'FINISHED');assert.ok(done.players[0].result.score>0);attempts.push({id:s.id,suffix:'g',result:done.players[0].result});await shot(p,'result');
 await p.getByRole('button',{name:/Chơi lại|Vào ván tiếp theo/}).click();await p.waitForURL(u=>u.pathname.includes('/room/')&&!u.pathname.endsWith(s.id));await s.request(`/api/games/arcade/rooms/${p.url().split('/').at(-1)}/leave`,{});check('340ms GAME COMPLETE, saved result, replay',{durationMs:beat.end-beat.start});await s.context.close();
}
async function multiplayer(mode,suffixes){const group=await startDirection(mode,suffixes),[a,b]=group;await correct(a);await a.p.waitForTimeout(75);const d=await a.p.getByTestId('challenge-direction').getAttribute('data-expected');await a.p.keyboard.press(keys[OPPOSITE[d]]);await a.p.locator('[data-stumbling="true"]').waitFor();await correct(b);await correct(b);if(group[2])await correct(group[2]);await a.p.waitForTimeout(1200);let snap=await a.request(`/api/games/arcade/rooms/${a.id}`);assert.ok(snap.players.find(x=>x.userId===b.auth.user.id).metrics.score>snap.players.find(x=>x.userId===a.auth.user.id).metrics.score);await shot(a.p,mode.toLowerCase()+'-overtake');check(mode+' real overtake after stumble, no boost');
 await Promise.all(group.map(async s=>{while(await s.p.locator('.arcade-world').count()&&!await s.p.locator('.arcade-end-message').count()){await correct(s);await s.p.waitForTimeout(80);}await s.p.locator('.arcade-result').waitFor({timeout:15000});}));snap=await a.request(`/api/games/arcade/rooms/${a.id}`);assert.equal(snap.room.status,'FINISHED');assert.deepEqual(snap.players.map(p=>p.result.rank).sort(),suffixes.map((_,i)=>i+1));await shot(a.p,mode.toLowerCase()+'-result');
 for(let i=0;i<group.length;i++){const s=group[i],own=snap.players.find(p=>p.userId===s.auth.user.id),fresh=await s.request(`/api/games/arcade/rooms/${a.id}`);assert.deepEqual(fresh.players.find(p=>p.userId===s.auth.user.id).result,own.result);attempts.push({id:a.id,suffix:suffixes[i],result:own.result});await s.context.close();}check(mode+' full round/ranks/results DB read-back',{id:a.id});}
try{await solo();await Promise.all([multiplayer('DUO',['g','h']),multiplayer('TRIO',['i','native','a'])]);}
catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;for(const [i,c]of browser.contexts().entries())for(const p of c.pages())await shot(p,'failure-'+i).catch(()=>{});}
finally{report.finishedAt=new Date().toISOString();await fs.writeFile(path.join(out,'results.json'),JSON.stringify({...report,attempts},null,2));await browser.close();}
