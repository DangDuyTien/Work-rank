import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:900}});
const r=await context.request.post('http://127.0.0.1:5101/api/auth/login',{data:{email:'typing-a@audit.test',password:'TypingAuditTest123!'}});assert.equal(r.status(),200);const c=await r.json();
await context.addInitScript(({a,b})=>{localStorage.setItem('token',a);localStorage.setItem('refreshToken',b)},{a:c.accessToken,b:c.refreshToken});
const rooms=await (await context.request.get('http://127.0.0.1:5101/api/games/typing/rooms?status=FINISHED',{headers:{Authorization:'Bearer '+c.accessToken}})).json();
const room=rooms.rooms.find(x=>x.title==='Real typing acceptance');assert.ok(room);
const page=await context.newPage();const report={checks:[]};
try{
 await page.goto(`http://127.0.0.1:5273/games/typing/room/${room.id}`);await page.getByRole('columnheader',{name:'ĐIỂM WORKRANK',exact:true}).waitFor();
 for(const width of [390,430,768]){
  await page.setViewportSize({width,height:900});
  const layout=await page.locator('div[style*="grid-template-columns: repeat(4, 1fr)"]').evaluateAll(xs=>xs.map(grid=>({right:grid.getBoundingClientRect().right,children:[...grid.children].map(x=>({left:x.getBoundingClientRect().left,right:x.getBoundingClientRect().right}))})));
  report.checks.push({width,layout});
  assert.ok(layout.every(g=>g.children.every(x=>x.left>=0&&x.right<=width)), 'Final metric cards must fit the visible mobile viewport');
  await page.screenshot({path:`../docs/audit/2026-10-19/typing/final-${width}.png`});
 }
 report.status='PASS';
}catch(e){report.status='FAIL';report.failure=e.message;process.exitCode=1;console.error(e);}
finally{await fs.writeFile('../docs/audit/2026-10-19/typing/mobile-result-results.json',JSON.stringify(report,null,2));await browser.close();console.log(JSON.stringify(report));}
