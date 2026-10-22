import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const web='http://127.0.0.1:5283',api='http://127.0.0.1:5113';
const phase=process.env.PERSIST_PHASE||'create';const out=path.resolve(process.env.PERSIST_OUTPUT||'../docs/audit/2026-10-22/persistence');await fs.mkdir(out,{recursive:true});
for(let n=0;n<100;n++){try{if((await fetch(api+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
const browser=await chromium.launch();const report={phase,checks:[],errors:[]};
const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS',name);};
const stateFile=path.join(out,'attempt-mementos.json');
async function session(suffix,form=false){
 const context=await browser.newContext({viewport:{width:1440,height:1000},hasTouch:true});const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 const email=`persistence-${suffix}@audit.test`;let token;
 const r=await context.request.post(api+'/api/auth/login',{data:{email,password:'PersistenceAuditTest123!'}});assert.ok(r.ok(),await r.text());const auth=await r.json();token=auth.accessToken;
 await p.goto(web+'/login');await p.evaluate(t=>localStorage.setItem('token',t),token);

 const req=async(route,data)=>{const r=await context.request[data===undefined?'get':'post'](api+route,{headers:{Authorization:`Bearer ${token}`},...(data===undefined?{}:{data})});assert.ok(r.ok(),route+': '+await r.text());return r.json();};return{context,p,req,suffix,email};
}
const screenshot=(s,label)=>s.p.screenshot({path:path.join(out,`${phase}-${label}.png`)});
async function arcade(game,suffix){
 const s=await session(suffix);await s.p.goto(web+'/games/arcade/'+game);await s.p.locator('.arcade-menu').waitFor();await s.p.getByRole('button',{name:'Vào chơi ngay',exact:true}).click();await s.p.waitForURL('**/room/**');const id=s.p.url().split('/').at(-1);
 await s.p.locator('.arcade-world').waitFor();await s.p.locator('.arcade-countdown').waitFor({state:'hidden'});
 if(game==='computer_rush')for(let n=0;n<14;n++){await s.p.locator('.arcade-word-wrap[data-transition="complete"]').waitFor({state:'hidden'});const word=await s.p.getByTestId('challenge-word').textContent();await s.p.locator('#arcade-word-input').focus();await s.p.keyboard.type(word.toLowerCase(),{delay:45});await s.p.waitForTimeout(220);}
 else if(game==='direction_rush')for(let n=0;await s.p.locator('.arcade-world').count()&&Number.parseInt(await s.p.locator('[role=timer]').textContent())>2;n++){await s.p.waitForTimeout(170);await s.p.locator('[data-stumbling="true"]').waitFor({state:'hidden'});const d=await s.p.getByTestId('challenge-direction').getAttribute('data-expected');await s.p.getByRole('button',{name:`Đi ${d}`,exact:true}).click();if(n===19)await screenshot(s,game+'-gameplay');}
 else for(let n=0;await s.p.locator('.arcade-world').count()&&Number.parseInt(await s.p.locator('[role=timer]').textContent())>4;n++){await s.p.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor();const cells=await s.p.locator('[data-cell-state="lit"]').evaluateAll(es=>es.map(e=>e.dataset.cell));await s.p.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();for(const cell of cells)await s.p.locator(`[data-cell="${cell}"]`).click();await s.p.locator('.arcade-memory-board[data-phase="REVIEW"]').waitFor();await s.p.waitForTimeout(350);if(n===3)await screenshot(s,game+'-gameplay');}
 if(game==='computer_rush')await screenshot(s,game+'-gameplay');await s.p.locator('.arcade-result').waitFor({timeout:75000});
 const result=await s.req(`/api/games/arcade/rooms/${id}`);assert.equal(result.room.status,'FINISHED');const mine=result.players[0];assert.ok(mine.result.score>0&&mine.result.awardedXp>0,JSON.stringify(mine.result));assert.ok(mine.result.validatedAt);assert.equal(mine.result.rank,1);
 const board=await s.req(`/api/games/arcade/leaderboard?gameType=${game}&mode=SOLO&period=all`);assert.ok(board.personal);assert.ok(board.personal.score>=mine.result.score);
 const history=await s.req(`/api/games/arcade/history?gameType=${game}`);assert.ok(history.attempts.some(a=>a.roomId===id));
 for(let i=0;i<2;i++)await s.req(`/api/games/arcade/rooms/${id}/finish`,{attemptId:id,seed:result.room.seed,revision:mine.revision,events:mine.events});
 await screenshot(s,game+'-result');check(game+' DB result/BXH/history after actual play and finalize retry',{id,score:mine.result.score});
 await s.context.close();return{kind:'arcade',game,suffix,id,result:mine.result,personal:board.personal};
}
async function typing(){
 const group=await Promise.all(['d','e','f'].map(x=>session(x)));const host=group[0];
 await host.p.goto(web+'/games/typing');await host.p.getByRole('button',{name:'Duo / Trio',exact:true}).click();await host.p.getByRole('button',{name:/TRIO.*Trio/}).click();await host.p.getByLabel('Thời lượng Typing Race').selectOption('30');await host.p.getByRole('button',{name:'Mở đường đua',exact:true}).click();await host.p.waitForURL('**/room/**');const id=host.p.url().split('/').at(-1);
 for(const s of group.slice(1)){await s.req(`/api/games/typing/rooms/${id}/join`,{});await s.p.goto(`${web}/games/typing/room/${id}`);}
 for(const s of group)await s.p.getByRole('button',{name:'Tôi đã sẵn sàng',exact:true}).click();
 let snap;for(let i=0;i<40;i++){snap=await host.req(`/api/games/typing/rooms/${id}`);if(snap.room.status==='PLAYING')break;await host.p.waitForTimeout(200);}assert.equal(snap.room.status,'PLAYING');
 await Promise.all(group.map(async(s,i)=>{const input=s.p.getByRole('textbox',{name:'Nội dung đang gõ'});await input.focus();for(const ch of Array.from(snap.room.challengeText.normalize('NFC')).slice(0,160-i*20)){await s.p.keyboard.insertText(ch);await s.p.waitForTimeout(45+i*5);}}));
 await screenshot(host,'typing-trio-gameplay');await host.p.locator('.typing-finish').waitFor({timeout:40000});
 const done=await host.req(`/api/games/typing/rooms/${id}`);assert.equal(done.room.status,'FINISHED');assert.equal(done.result.mode,'TRIO');assert.equal(done.result.results.length,3);
 const board=await host.req('/api/games/typing/leaderboard?limit=50');const history=await host.req('/api/games/typing/history');assert.ok(history.attempts.some(a=>String(a.roomId)===id));
 for(const s of group)await s.req(`/api/games/typing/rooms/${id}/finish`,{typedText:'retry must not change committed result',inputRevision:999});
 await screenshot(host,'typing-trio-result');check('Typing TRIO finalized into real MySQL enum/result/history',{id,results:done.result.results});
 for(const s of group)await s.context.close();return{kind:'typing',game:'typing_battle',suffix:'d',id,result:done.result.results,board};
}
async function drawing(){
 const s=await session('native');await s.p.goto(web+'/games/drawing');const canvas=s.p.locator('canvas.drawing-canvas');await canvas.waitFor();const b=await canvas.boundingBox();await s.p.mouse.move(b.x+b.width*.3,b.y+b.height*.4);await s.p.mouse.down();for(let i=0;i<25;i++)await s.p.mouse.move(b.x+b.width*(.3+i*.012),b.y+b.height*(.4+Math.sin(i/3)*.12));await s.p.mouse.up();
 await s.p.getByRole('button',{name:'Hoàn thành tác phẩm',exact:true}).click();const title=`Persistent drawing ${Date.now()}`;await s.p.locator('#artwork-title').fill(title);
 const response=s.p.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname==='/api/drawings');await s.p.getByRole('button',{name:'Lưu & Hoàn thành tác phẩm',exact:true}).click();const r=await response;assert.equal(r.status(),201,await r.text());const {drawing}=await r.json();assert.equal(drawing.storageProvider,'s3');
 const again=await s.req(`/api/drawings/${drawing.id}`);assert.equal(again.drawing.id,drawing.id);assert.equal(again.drawing.metadata.uploadState,'CONFIRMED');
 const img=await s.context.request.get(drawing.imageUrl);assert.equal(img.status(),200);assert.match(img.headers()['content-type'],/image\/png/);const hash=crypto.createHash('sha256').update(await img.body()).digest('hex');assert.equal(hash,again.drawing.metadata.checksum);
 await s.p.getByRole('button',{name:'Xem trong Thư Viện Tranh',exact:true}).click();await s.p.getByText(title,{exact:true}).first().waitFor();await screenshot(s,'drawing-gallery');check('Drawing canvas → S3 bytes → DB → read-back/gallery',{id:drawing.id,hash});await s.context.close();return{kind:'drawing',game:'drawing',suffix:'native',id:drawing.id,title,url:drawing.imageUrl,hash};
}
async function read(m){
 const s=await session(m.suffix,true);
 const verify=async()=>{
  if(m.kind==='arcade'){const d=await s.req(`/api/games/arcade/rooms/${m.id}`);assert.deepEqual(d.players[0].result,m.result);const b=await s.req(`/api/games/arcade/leaderboard?gameType=${m.game}&mode=SOLO&period=all`);assert.equal(b.personal.score,m.personal.score);const history=await s.req(`/api/games/arcade/history?gameType=${m.game}`);assert.ok(history.attempts.some(a=>a.roomId===m.id&&a.score===m.result.score));await s.p.goto(`${web}/games/arcade/${m.game}/room/${m.id}`);await s.p.locator('.arcade-result').waitFor();await s.p.getByRole('button',{name:'Lịch sử đã lưu',exact:true}).click();await s.p.locator('.saved-history-list').waitFor();await s.p.screenshot({path:path.join(out,`read-${m.game}-db-history.png`)});await s.p.getByRole('button',{name:'Lịch sử đã lưu',exact:true}).click();await s.p.locator('.arcade-result').waitFor();}
  else if(m.kind==='typing'){const d=await s.req(`/api/games/typing/rooms/${m.id}`);assert.deepEqual(d.result.results,m.result);await s.p.goto(`${web}/games/typing/room/${m.id}`);await s.p.locator('.typing-finish').waitFor();const b=await s.req('/api/games/typing/leaderboard?limit=50');assert.deepEqual(b.leaderboard,m.board.leaderboard);const history=await s.req('/api/games/typing/history');assert.ok(history.attempts.some(a=>String(a.roomId)===m.id));await s.p.goto(web+'/games/typing?tab=history');await s.p.locator('.saved-history-list').waitFor();await s.p.screenshot({path:path.join(out,'read-typing-db-history.png')});await s.p.goto(`${web}/games/typing/room/${m.id}`);await s.p.locator('.typing-finish').waitFor();}
  else{const d=await s.req(`/api/drawings/${m.id}`);assert.equal(d.drawing.metadata.uploadState,'CONFIRMED');const img=await s.context.request.get(d.drawing.imageUrl);assert.equal(img.status(),200);assert.equal(crypto.createHash('sha256').update(await img.body()).digest('hex'),m.hash);await s.p.goto(web+'/creative-corner');await s.p.getByText(m.title,{exact:true}).first().waitFor();}
 };
 await verify();check(m.game+' fresh Browser B same DB result/content');
 await s.context.request.post(api+'/api/auth/logout');await s.context.clearCookies();const cdp=await s.context.newCDPSession(s.p);await cdp.send('Network.clearBrowserCache');await cdp.send('Storage.clearDataForOrigin',{origin:web,storageTypes:'all'});await s.p.evaluate(async()=>{localStorage.clear();sessionStorage.clear();for(const d of await indexedDB.databases())indexedDB.deleteDatabase(d.name);});await cdp.detach();await s.p.reload();await s.p.goto(web+'/login');await s.p.getByRole('button',{name:'Tiếp tục với Google',exact:true}).waitFor();
 const login=await s.context.request.post(api+'/api/auth/login',{data:{email:s.email,password:'PersistenceAuditTest123!'}});assert.ok(login.ok());const nextAuth=await login.json();await s.p.evaluate(t=>localStorage.setItem('token',t),nextAuth.accessToken);
 // Requests after fresh login must use the new identity, never old browser storage.
 const token=await s.p.evaluate(()=>localStorage.getItem('token'));s.req=async route=>{const r=await s.context.request.get(api+route,{headers:{Authorization:`Bearer ${token}`}});assert.ok(r.ok(),await r.text());return r.json();};
 await verify();await screenshot(s,m.game+'-storage-cleared');check(m.game+' logout/login + local/session/IndexedDB/cookie/cache clear survives');await s.context.close();
}
try{
 if(phase==='create'){
  const outcomes=await Promise.allSettled([arcade('computer_rush','a'),arcade('direction_rush','b'),arcade('memory_flash','c'),typing(),...(process.env.PERSIST_GAMES_ONLY==='1'?[]:[drawing()])]);
  for(const x of outcomes)if(x.status==='rejected')throw x.reason;const m=outcomes.map(x=>x.value);
  const db=await browser.newContext().then(async c=>{const d=await c.request.get(api+'/api/__persistence-audit').then(r=>r.json());await c.close();return d;});
  for(const item of m.filter(x=>x.kind==='arcade')){const row=db.arcade.find(p=>p.roomId===item.id);assert.ok(row&&row.finishedAt&&row.result.validatedAt);assert.equal(db.ledger.filter(x=>x.idempotencyKey===`arcade:${row.id}`).length,1);}
  assert.equal(db.typing.filter(x=>String(x.roomId)===m.find(x=>x.kind==='typing').id).length,1);assert.ok(db.stats.every(x=>x.totalMatches>=1));
  await fs.writeFile(stateFile,JSON.stringify({attempts:m,ledger:db.ledger},null,2));await fs.writeFile(path.join(out,'database-after-writes.json'),JSON.stringify(db,null,2));check('Direct DB read confirms rows/stats and exactly-once arcade ledger');
 }else{
  const m=JSON.parse(await fs.readFile(stateFile));for(const item of m.attempts)await read(item);
  const db=await browser.newContext().then(async c=>{const d=await c.request.get(api+'/api/__persistence-audit').then(r=>r.json());await c.close();return d;});assert.deepEqual(db.ledger,m.ledger);check('Ledger unchanged after frontend/backend/object-store restart and all browser clears',{entries:db.ledger.length});await fs.writeFile(path.join(out,'database-after-restart.json'),JSON.stringify(db,null,2));
 }
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;for(const [i,c]of browser.contexts().entries())for(const p of c.pages())await p.screenshot({path:path.join(out,`${phase}-failure-${i}.png`)}).catch(()=>{});}
finally{await fs.writeFile(path.join(out,`${phase}-browser-results.json`),JSON.stringify(report,null,2));await browser.close();}
