import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('../docs/audit/2026-10-21/four-games/final');await fs.mkdir(out,{recursive:true});
const report={checks:[],errors:[],limitations:['Chromium composition events and keyboard viewport emulation; no physical UniKey/OS keyboard session.']};
const browser=await chromium.launch();
const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
try{
 const auth=await c.request.post('http://127.0.0.1:5112/api/auth/login',{data:{email:'arcade-e@audit.test',password:'ArcadeAuditTest123!'}}).then(r=>r.json());
 await c.addInitScript(token=>{localStorage.setItem('token',token);window.__audioCreated=0;window.__audioBuffers=0;window.__audioSources=0;const Native=window.AudioContext;if(Native)window.AudioContext=class extends Native{constructor(...args){super(...args);window.__audioCreated++;window.__audioContext=this;}createBuffer(...args){window.__audioBuffers++;return super.createBuffer(...args);}createBufferSource(...args){window.__audioSources++;return super.createBufferSource(...args);}};},auth.accessToken);
 const p=await c.newPage();p.on('pageerror',e=>report.errors.push(e.message));
 const check=(name,evidence)=>{report.checks.push({name,status:'PASS',evidence});console.log('PASS',name);};
 await p.goto('http://127.0.0.1:5282/games/typing');
 const input=p.getByRole('textbox',{name:'Nội dung đang gõ'});await input.waitFor();await input.waitFor({state:'attached'});await p.waitForFunction(()=>!document.querySelector('input[aria-label="Nội dung đang gõ"]').disabled);
 await p.getByRole('button',{name:'Bài mới',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('input[aria-label="Nội dung đang gõ"]').disabled);await input.focus();
 await input.evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));const value='cùng'.normalize('NFD');el.value=value;el.setSelectionRange(value.length,value.length);el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:value,isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:value}));});
 await p.waitForTimeout(180);assert.equal((await input.inputValue()).normalize('NFC'),'cùng');
 const caret=await input.evaluate(e=>({value:e.value,start:e.selectionStart,end:e.selectionEnd}));assert.equal(caret.start,caret.value.length);check('Vietnamese NFD composition commits once, caret remains native',caret);
 await p.keyboard.press('Backspace');await p.keyboard.insertText('g');assert.equal((await input.inputValue()).normalize('NFC'),'cùng');check('Backspace correction after composition');
 const active=await c.request.get('http://127.0.0.1:5112/api/games/typing/practice/active',{headers:{Authorization:`Bearer ${auth.accessToken}`}}).then(r=>r.json());
 const target=active.attempt.challengeText.normalize('NFC');
 assert.ok(target.length>600);
 await input.focus();for(const ch of Array.from(target).slice(4,620)){await p.keyboard.insertText(ch);await p.waitForTimeout(28);}
 await p.waitForTimeout(100);
 const visible=await p.locator('.typing-passage-viewport').evaluate(el=>{const r=el.getBoundingClientRect(),m=el.querySelector('[data-state="current"]').getBoundingClientRect();return {top:r.top,bottom:r.bottom,markerTop:m.top,markerBottom:m.bottom,nodes:document.querySelectorAll('*').length,firstIndex:el.querySelector('[data-char-index]').dataset.charIndex};});
 assert.ok(visible.markerTop>=visible.top&&visible.markerBottom<=visible.bottom,JSON.stringify(visible));assert.ok(Number(visible.firstIndex)>0);check('620 native characters cross virtual word blocks, current line visible',visible);
 const played=await p.evaluate(()=>({contexts:window.__audioCreated,buffers:window.__audioBuffers,sources:window.__audioSources,state:window.__audioContext?.state}));assert.equal(played.contexts,1);assert.equal(played.buffers,6);assert.ok(played.sources>0,JSON.stringify(played));
 await p.screenshot({path:path.join(out,'typing-deep-window-390.png')});
 await c.setOffline(true);await p.keyboard.insertText(' offline');await p.waitForTimeout(1250);const draft=(await input.inputValue()).normalize('NFC');await c.setOffline(false);await p.reload();await input.waitFor();await p.waitForFunction(text=>document.querySelector('input[aria-label="Nội dung đang gõ"]')?.value===text,draft);
 assert.equal(await input.inputValue(),draft);check('Offline typing and reload restore full draft',{characters:draft.length});
 await p.setViewportSize({width:390,height:430});await input.focus();await p.waitForTimeout(180);
 const short=await p.evaluate(()=>{const r=document.querySelector('[data-state="current"]').getBoundingClientRect();return {top:r.top,bottom:r.bottom,viewport:visualViewport.height,compact:document.querySelector('.typing-page').classList.contains('typing-keyboard-compact'),laneTop:document.querySelector('.typing-race-lane.is-local').getBoundingClientRect().top,laneBottom:document.querySelector('.typing-race-lane.is-local').getBoundingClientRect().bottom,sceneScroll:document.querySelector('.typing-race-scene').scrollTop};});
 assert.ok(short.compact&&short.top>=64&&short.bottom<=short.viewport);assert.equal(short.sceneScroll,0);assert.ok(short.laneTop>=64&&short.laneBottom<=short.viewport,JSON.stringify(short));check('Keyboard viewport keeps current line and local mini race visible',short);await p.screenshot({path:path.join(out,'typing-keyboard-native-390x430.png')});
 await p.setViewportSize({width:390,height:844});await p.waitForTimeout(120);
 await p.emulateMedia({reducedMotion:'reduce'});const anim=await p.locator('.typing-runner-figure .arcade-actor').first().evaluate(el=>getComputedStyle(el).animationName);assert.equal(anim,'none');assert.ok(await p.locator('.typing-pulse').textContent());check('Reduced motion keeps text and color feedback',{animation:anim});
 const toggle=p.getByRole('button',{name:/Tắt âm thanh|Bật âm thanh/});await toggle.click();const pref=await p.evaluate(()=>localStorage.getItem('wr:arcade:sound:v1'));const audioBefore=await p.evaluate(()=>window.__audioCreated);const audio=await p.evaluate(()=>({buffers:window.__audioBuffers,sources:window.__audioSources}));assert.equal(audio.buffers,6);
 for(const game of ['computer_rush','direction_rush','memory_flash']){await p.evaluate(route=>{history.pushState({},'',route);window.dispatchEvent(new PopStateEvent('popstate'));},'/games/arcade/'+game);await p.locator('.arcade-menu').waitFor();assert.equal(await p.evaluate(()=>localStorage.getItem('wr:arcade:sound:v1')),pref);assert.equal(await p.evaluate(()=>window.__audioCreated),audioBefore);}
 assert.equal(audioBefore,1);check('Shared sound preference and one prewarmed AudioContext across four routes',{audioContexts:audioBefore,...audio,playedBeforeReload:played,preference:pref});
}catch(e){report.errors.push(e.stack);console.error(e);process.exitCode=1;for(const p of c.pages())await p.screenshot({path:path.join(out,'native-failure.png')}).catch(()=>{});}
finally{await fs.writeFile(path.join(out,'native-input-results.json'),JSON.stringify(report,null,2));await browser.close();}
