import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const api='http://127.0.0.1:5113',web='http://127.0.0.1:5283',out=path.resolve('../docs/audit/2026-10-22/ux');
const drawing=JSON.parse(await fs.readFile(path.join(out,'drawing-recovery-result.json')));
const browser=await chromium.launch(),context=await browser.newContext(),p=await context.newPage();const checks=[];
async function login(suffix){const r=await context.request.post(api+'/api/auth/login',{data:{email:`persistence-${suffix}@audit.test`,password:'PersistenceAuditTest123!'}});assert.ok(r.ok());return(await r.json()).accessToken;}
const owner=await login('native'),other=await login('g');
const get=async()=>{const r=await context.request.get(api+'/api/__persistence-audit');return(await r.json()).drawings.find(x=>x.id===drawing.id);};
const wait=async file=>{for(let n=0;n<900;n++){try{await fs.access(file);return;}catch{}await p.waitForTimeout(200);}throw new Error('Missing operator handshake '+file);};
const remove=token=>context.request.delete(api+`/api/drawings/${drawing.id}`,{headers:{Authorization:`Bearer ${token}`}});
try{
 let pending;
 if(process.env.DELETE_PHASE==='verify'){pending=JSON.parse(await fs.readFile(path.join(out,'drawing-delete-pending.json')));checks.push('Resumed verification of captured real storage outage and durable deletion intent');}
 else {
 assert.equal((await remove(other)).status(),403);assert.equal((await get()).status,'ACTIVE');checks.push('Non-owner DELETE 403, object/record retained');
 await fs.writeFile('/tmp/workrank-drawing-delete-ready','ready');console.log('READY DELETE OUTAGE');await wait('/tmp/workrank-drawing-delete-stopped');
 const failed=await remove(owner);assert.equal(failed.status(),502,await failed.text());pending=await get();assert.equal(pending.status,'HIDDEN');assert.equal(pending.metadata.deletionPending,true);checks.push('Storage outage leaves durable HIDDEN deletion intent');
 await p.goto(web+'/login');await p.evaluate(t=>localStorage.setItem('token',t),owner);await p.goto(web+'/creative-corner');assert.equal(await p.getByText(drawing.title,{exact:true}).count(),0);await p.screenshot({path:path.join(out,'drawing-hidden-during-delete-retry.png'),fullPage:true});
 await fs.writeFile(path.join(out,'drawing-delete-pending.json'),JSON.stringify(pending,null,2));await fs.writeFile('/tmp/workrank-drawing-delete-failed','ready');console.log('READY DELETE RECONCILIATION');await wait('/tmp/workrank-drawing-delete-restored');
 }
 const deleted=await get();assert.equal(deleted.status,'DELETED');assert.equal(deleted.metadata.deletionPending,false);assert.equal((await context.request.get(drawing.imageUrl)).status(),404);
 const again=await remove(owner);assert.ok(again.ok(),await again.text());assert.equal((await get()).status,'DELETED');checks.push('Backend startup retries intent; object 404, DB DELETED, repeated delete succeeds');
 await fs.writeFile(path.join(out,'drawing-delete-resilience.json'),JSON.stringify({checks,status:'PASS',before:pending,after:deleted},null,2));console.log('PASS',checks);
}catch(e){console.error(e);process.exitCode=1;await fs.writeFile(path.join(out,'drawing-delete-resilience.json'),JSON.stringify({checks,status:'FAIL',error:e.stack},null,2));}
finally{await browser.close();}
