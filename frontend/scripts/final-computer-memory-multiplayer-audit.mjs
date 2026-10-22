import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const api='http://127.0.0.1:5113',web='http://127.0.0.1:5283';
const out=path.resolve('../docs/audit/2026-10-22/final-gameplay-polish/multiplayer');
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch(),report={checks:[],attempts:[],errors:[]};
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS',name);};
async function session(suffix){
 const c=await browser.newContext({viewport:{width:430,height:932},hasTouch:true});
 const login=await c.request.post(api+'/api/auth/login',{data:{email:`persistence-${suffix}@audit.test`,password:'PersistenceAuditTest123!'}});
 assert.ok(login.ok());const auth=await login.json(),p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(web+'/login');await p.evaluate(t=>localStorage.setItem('token',t),auth.accessToken);
 const req=async(route,data)=>{const r=await c.request[data===undefined?'get':'post'](api+route,{headers:{Authorization:`Bearer ${auth.accessToken}`},...(data===undefined?{}:{data})});assert.ok(r.ok(),route+': '+await r.text());return r.json();};
 const active=await req('/api/games/arcade/active');if(active)await req(`/api/games/arcade/rooms/${active.room.id}/leave`,{});
 return{c,p,req,auth,suffix};
}
async function word(s,wrong=false){
 await s.p.waitForFunction(()=>document.querySelectorAll('[data-testid="challenge-word"]').length===1);
 await s.p.waitForTimeout(65);
 const before=Number(await s.p.locator('.arcade-world').getAttribute('data-attempts'));
 const target=await s.p.getByTestId('challenge-word').textContent();
 await s.p.locator('#arcade-word-input').focus();
 if(wrong){await s.p.keyboard.type(target[0].toLowerCase()==='z'?'x':'z');await s.p.keyboard.press('Enter');}
 else await s.p.keyboard.type(target.toLowerCase(),{delay:45});
 await s.p.waitForFunction(n=>Number(document.querySelector('.arcade-world')?.dataset.attempts)>n,before);
}
async function memory(s,wrong=false){
 const p=s.p;const index=Number(await p.locator('.arcade-world').getAttribute('data-attempts'));
 await p.waitForFunction(i=>window.__memoryPatterns?.[i]?.length,index);
 const cells=await p.evaluate(i=>window.__memoryPatterns[i],index);
 const count=await p.locator('.arcade-memory-tile').count();
 await p.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
 const selection=wrong?[String(Array.from({length:count},(_,i)=>i).find(i=>!cells.includes(String(i)))),...cells.slice(1)]:cells;
 for(const cell of selection)await p.locator(`[data-cell="${cell}"]`).click({force:true});
 await p.locator('.arcade-memory-board[data-phase="REVIEW"]').waitFor();
 if(wrong)assert.ok(await p.locator('[data-cell-state="incorrect"]').count());
}
async function match(game,mode,suffixes){
 const group=[];for(const suffix of suffixes)group.push(await session(suffix));const host=group[0];
 const created=await host.req('/api/games/arcade/rooms',{gameType:game,mode});const id=created.room.id;assert.equal(created.room.durationSeconds,60);
 for(const s of group.slice(1))await s.req(`/api/games/arcade/rooms/${id}/join`,{});
 for(const s of group)await s.p.goto(`${web}/games/arcade/${game}/room/${id}`);
 for(const s of group)await s.p.getByRole('button',{name:'Tôi đã sẵn sàng',exact:true}).click();
 if(game==='memory_flash')for(const s of group)await s.p.evaluate(()=>{window.__memoryPatterns={};new MutationObserver(()=>{const b=document.querySelector('.arcade-memory-board[data-phase="FLASH"]');if(b){const i=Number(document.querySelector('.arcade-world').dataset.attempts);window.__memoryPatterns[i]=[...b.querySelectorAll('[data-cell-state="lit"]')].map(e=>e.dataset.cell);}}).observe(document.body,{subtree:true,childList:true,attributes:true});});
 await host.p.getByRole('button',{name:'Bắt đầu',exact:true}).click();
 for(const s of group){await s.p.locator('.arcade-world').waitFor();await s.p.locator('.arcade-countdown').waitFor({state:'hidden'});}
 if(game==='computer_rush'){
  await word(host);await word(host,true);
  for(const s of group.slice(1)){await word(s);await word(s);await word(s);}
 }else await Promise.all(group.map((s,i)=>memory(s,i===0)));
 // Socket snapshots carry real score changes; no score or rank is injected.
 await host.p.waitForTimeout(600);
 const live=await host.req(`/api/games/arcade/rooms/${id}`),mine=live.players.find(x=>x.userId===host.auth.user.id);
 assert.ok(live.players.some(x=>x.id!==mine.id&&x.metrics.score>mine.metrics.score));
 assert.ok(await host.p.locator('.arcade-race-status').textContent());
 await host.p.screenshot({path:path.join(out,`${game}-${mode}-overtake.png`),fullPage:true});
 check(`${game} ${mode} wrong action/combo reset/rival overtake`,{roomId:id,rankText:await host.p.locator('.arcade-race-status').textContent(),players:live.players.map(x=>({id:x.id,score:x.metrics.score,combo:x.metrics.combo}))});
 if(game==='computer_rush')await Promise.all(group.map(async(s,i)=>{for(let n=0;n<5+i;n++)await word(s);}));
 else for(let n=0;n<3;n++)await Promise.all(group.map(s=>memory(s)));
 await Promise.all(group.map(s=>s.p.locator('.arcade-result').waitFor({timeout:70000})));
 const done=await host.req(`/api/games/arcade/rooms/${id}`);assert.equal(done.room.status,'FINISHED');
 assert.deepEqual(done.players.map(p=>p.result.rank).sort(),suffixes.map((_,i)=>i+1));
 for(const s of group){
  const row=done.players.find(x=>x.userId===s.auth.user.id);assert.ok(row.result.correct>0&&row.result.validatedAt);
  for(let n=0;n<2;n++)await s.req(`/api/games/arcade/rooms/${id}/finish`,{attemptId:id,seed:done.room.seed,revision:row.revision,events:row.events});
  const fresh=await s.req(`/api/games/arcade/rooms/${id}`);assert.deepEqual(fresh.players.find(x=>x.id===row.id).result,row.result);
  const history=await s.req(`/api/games/arcade/history?gameType=${game}`);assert.ok(history.attempts.some(x=>x.roomId===id));
  report.attempts.push({game,mode,id,suffix:s.suffix,playerId:row.id,result:row.result});
 }
 await host.p.screenshot({path:path.join(out,`${game}-${mode}-result.png`),fullPage:true});
 await host.p.getByRole('button',{name:/Chơi lại|Vào ván tiếp theo/}).click();
 await host.p.waitForURL(u=>u.pathname.includes('/room/')&&!u.pathname.endsWith(id));
 const next=host.p.url().split('/').at(-1);await host.req(`/api/games/arcade/rooms/${next}/leave`,{});
 check(`${game} ${mode} 60s finish/rank/DB history/duplicate finalize/replay`,{roomId:id,newRoom:next,ranks:done.players.map(x=>x.result.rank)});
 for(const s of group)await s.c.close();
}
try{
 const jobs=[['computer_rush','DUO',['a','b']],['computer_rush','TRIO',['c','d','e']],['memory_flash','DUO',['f','g']],['memory_flash','TRIO',['h','i','native']]];
 if(process.env.UX_MULTI_VERIFY_ONLY==='1'){const previous=JSON.parse(await fs.readFile(path.join(out,'results.json')));await fs.writeFile(path.join(out,'pre-ledger-assertion-fix.json'),JSON.stringify(previous,null,2));report.checks=previous.checks;report.attempts=previous.attempts;assert.equal(report.attempts.length,10);}else{
 const settled=await Promise.allSettled(jobs.map(async args=>{try{return await match(...args);}catch(e){console.error(args.slice(0,2).join(' '),e);throw e;}}));for(const r of settled)if(r.status==='rejected')throw r.reason;}
 const c=await browser.newContext(),db=await c.request.get(api+'/api/__persistence-audit').then(r=>r.json());
 for(const a of report.attempts){assert.ok(db.arcade.some(x=>x.id===a.playerId&&x.result.score===a.result.score));assert.equal(db.ledger.filter(x=>x.idempotencyKey===`arcade:${a.playerId}`).length,a.result.awardedXp>0?1:0);}
 await c.close();check('10 player results; exactly one ledger if XP awarded, zero for ineligible results',{players:report.attempts.length,withXp:report.attempts.filter(x=>x.result.awardedXp>0).length,withoutXp:report.attempts.filter(x=>!x.result.awardedXp).length});
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;}
finally{await fs.writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();}
