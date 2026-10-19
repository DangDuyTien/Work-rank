import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const api='http://127.0.0.1:5101/api/games/typing';
const web='http://127.0.0.1:5273';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const login=await context.request.post('http://127.0.0.1:5101/api/auth/login',{data:{email:'typing-spectator@audit.test',password:'TypingAuditTest123!'}});
assert.equal(login.status(),200);
const creds=await login.json(); const headers={Authorization:'Bearer '+creds.accessToken};
await context.addInitScript(({a,b})=>{localStorage.setItem('token',a);localStorage.setItem('refreshToken',b)},{a:creds.accessToken,b:creds.refreshToken});
const post=async(route,data)=>{const r=await context.request.post(api+route,{headers,data});assert.ok(r.ok(),await r.text());return r.json()};
const get=async(route)=>{const r=await context.request.get(api+route,{headers});assert.ok(r.ok());return r.json()};
const page=await context.newPage();const faults=[];page.on('pageerror',e=>faults.push(e.message));
const report={mockedRequests:0,checks:[]};const input='input[aria-label="Nội dung đang gõ"]';
try{
 await post('/practice/attempts',{durationLimitSeconds:30,restart:true});
 await page.goto(web+'/games/typing');await page.waitForFunction(s=>document.querySelector(s)&&!document.querySelector(s).disabled,input);await page.locator('.typing-passage-viewport').click();
 const cdp=await context.newCDPSession(page);
 await cdp.send('Input.imeSetComposition',{text:'vị trí hiện',selectionStart:11,selectionEnd:11});
 // Wait on authoritative state rather than modifying any clock.
 let active;for(let n=0;n<20;n++){active=(await get('/practice/active')).attempt;if(active.startedAt)break;await new Promise(r=>setTimeout(r,100));}
 assert.ok(active.startedAt);assert.equal(active.typedText,'');
 await new Promise(r=>setTimeout(r,1100));
 await cdp.send('Input.insertText',{text:'vị trí hiện'});
 for(let n=0;n<20;n++){active=(await get('/practice/active')).attempt;if(active.typedText==='vị trí hiện')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(active.typedText,'vị trí hiện');assert.ok(!active.result?.draftInvalidReason);
 assert.equal(await page.locator(input).evaluate(i=>i.selectionStart),11);
 report.checks.push({name:'First Vietnamese IME word starts server clock before commit and is not marked as paste',status:'PASS'});
 const room=(await post('/rooms',{mode:'SOLO',durationLimitSeconds:30,matchType:'RANKED'})).room;
 await post(`/rooms/${room.id}/start`);
 await page.evaluate(url=>{history.pushState({},'',url);window.dispatchEvent(new PopStateEvent('popstate'));},`/games/typing/room/${room.id}`);
 await page.waitForFunction(s=>document.querySelector(s)&&!document.querySelector(s).disabled&&document.querySelector(s).value==='',input);
 assert.equal(await page.locator('[data-state="current"]').getAttribute('data-char-index'),'0');
 await page.locator('.typing-passage-viewport').click();await page.keyboard.type('abcdef',{delay:180});
 let detail;for(let n=0;n<20;n++){detail=await get(`/rooms/${room.id}`);if(detail.players[0].inputText==='abcdef')break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(detail.players[0].inputText,'abcdef');
 report.checks.push({name:'SPA practice to active room resets clock/text/revision to the correct run',status:'PASS'});
 await post(`/rooms/${room.id}/finish`,{typedText:'abcdef',inputRevision:6});
 await page.getByRole('columnheader',{name:'ĐIỂM WORKRANK',exact:true}).waitFor();
 await post(`/rooms/${room.id}/reset`);await post(`/rooms/${room.id}/start`);
 await page.waitForFunction(s=>document.querySelector(s)&&!document.querySelector(s).disabled&&document.querySelector(s).value==='',input);
 assert.equal(await page.locator('[data-state="current"]').getAttribute('data-char-index'),'0');
 await post(`/rooms/${room.id}/finish`,{typedText:'',inputRevision:0});
 report.checks.push({name:'Same-room rematch does not restore a previous run draft',status:'PASS'});
 assert.deepEqual(faults,[]);report.status='PASS';
}catch(error){report.status='FAIL';report.failure=error.stack;process.exitCode=1;console.error(error);}
finally{await fs.writeFile('../docs/audit/2026-10-19/typing/navigation-results.json',JSON.stringify(report,null,2));await browser.close();console.log(report.status,report.checks);}
