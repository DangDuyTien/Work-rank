import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.TYPING_AUDIT_WEB || 'http://127.0.0.1:5273';
const api = process.env.TYPING_AUDIT_API || 'http://127.0.0.1:5101';
for (const url of [base, api]) assert.equal(new URL(url).hostname, '127.0.0.1', 'Only isolated loopback fixture servers are supported');
const dir = path.resolve('../docs/audit/2026-10-19/typing');
await fs.mkdir(dir, { recursive: true });
const report = { started: new Date().toISOString(), mockedRequests: 0, checks: [], performance: [], errors: [] };
const browser = await chromium.launch({ headless: true });
const input = 'input[style*="opacity: 0"]';
async function identity(suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const response = await context.request.post(api + '/api/auth/login', { data: { email: `typing-${suffix}@audit.test`, password: 'TypingAuditTest123!' } });
  assert.equal(response.status(), 200, 'Use the isolated typing-live-server fixture');
  const credential = await response.json();
  const headers = { Authorization: `Bearer ${credential.accessToken}` };
  await context.addInitScript(({ access, refresh }) => { localStorage.setItem('token', access); localStorage.setItem('refreshToken', refresh); }, { access: credential.accessToken, refresh: credential.refreshToken });
  const post = async (route, data) => {
    const response = await context.request.post(api + '/api/games/typing' + route, { headers, data });
    assert.ok(response.ok(), `${route}: HTTP ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const get = async (route) => { const r = await context.request.get(api + '/api/games/typing' + route, { headers }); assert.ok(r.ok()); return r.json(); };
  const page = await context.newPage();
  page.on('pageerror', e => report.errors.push(e.message));
  return { context, page, post, get, headers, userId: credential.user.id };
}
const check = (name, evidence) => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS:', name); };
try {
  const a = await identity('a'); const b = await identity('b');
  a.page.on('response',async r=>{if(r.url().endsWith('/practice/finish')){try{report.practiceResponse=await r.json();}catch{}}});
  await a.page.goto(base + '/games/typing');
  await a.page.locator('.typing-passage-viewport').waitFor();
  // Start a fresh server-issued 120-second attempt. No clock/metric mock.
  const attempt = await a.post('/practice/attempts', { durationLimitSeconds: 120, restart: true });
  await a.page.reload();
  await a.page.locator(input).waitFor({ state: 'attached' });
  await a.page.waitForFunction(s => !document.querySelector(s)?.disabled, input);
  await a.page.locator('.typing-passage-viewport').click();
  await a.page.keyboard.type('abxdef', { delay: 150 });
  assert.deepEqual(await a.page.locator('[data-char-index]').evaluateAll(xs => xs.slice(0, 6).map(x => x.dataset.state)), ['correct', 'correct', 'incorrect', 'correct', 'correct', 'correct']);
  await a.page.keyboard.press('Backspace'); await a.page.keyboard.press('Backspace'); await a.page.keyboard.press('Backspace'); await a.page.keyboard.press('Backspace');
  await a.page.keyboard.type('cdef', { delay: 100 });
  assert.equal(await a.page.locator('[data-state="incorrect"]').count(), 0);
  check('Positional typo and Backspace correction', 'abxdef marks only x; ab+cdef clears all red positions');
  const cdp = await a.context.newCDPSession(a.page);
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.start');
  await a.page.evaluate(() => {
    window.typingSamples = []; window.typingLongTasks = [];
    new PerformanceObserver(list => window.typingLongTasks.push(...list.getEntries().map(e => e.duration))).observe({ type: 'longtask', buffered: false });
    document.querySelector('input[style*="opacity: 0"]').addEventListener('input', () => {
      const start = performance.now(); const wanted = Array.from(document.querySelector('input[style*="opacity: 0"]').value.normalize('NFC')).length;
      const observer = new MutationObserver(() => {
        if (Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) !== wanted) return;
        observer.disconnect();
        const commit = performance.now() - start;
        requestAnimationFrame(() => requestAnimationFrame(() => window.typingSamples.push({ commit, paint: performance.now() - start, correctPosition: true })));
      });
      observer.observe(document.querySelector('.typing-passage'), {childList:true,subtree:true,attributes:true});
    });
  });
  const target = Array.from(attempt.challengeText);
  let cursor = 6;
  for (const wpm of [60, 100, 150, 210]) {
    await a.page.evaluate(() => { window.typingSamples = []; });
    const text = target.slice(cursor, cursor + 32).join('');
    const t0 = Date.now();
    for (let index = 0; index < Array.from(text).length; index++) {
      const due = t0 + index * 60000 / (wpm * 5);
      if (Date.now() < due) await new Promise(r => setTimeout(r, due - Date.now()));
      await a.page.keyboard.type(Array.from(text)[index]);
    }
    const scheduledEnd = t0 + 32 * 60000 / (wpm * 5);
    if (Date.now() < scheduledEnd) await new Promise(r => setTimeout(r, scheduledEnd - Date.now()));
    cursor += 32;
    await a.page.waitForFunction(n => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) === n, cursor);
    assert.equal((await a.page.locator(input).inputValue()).normalize('NFC'), target.slice(0, cursor).join(''));
    await a.page.waitForFunction(() => window.typingSamples.length >= 32);
    const values = await a.page.evaluate(() => window.typingSamples);
    assert.ok(values.every(x => x.correctPosition), 'Each input commit must retain its correct index');
    const percentile = (key, p) => [...values].sort((x, y) => x[key] - y[key])[Math.min(values.length - 1, Math.floor(values.length * p))]?.[key];
    const result = { targetWpm: wpm, observedWpm: Math.round((32 / 5) / ((Date.now() - t0) / 60000)), characters: 32, dropped: 0, p95CommitMs: percentile('commit', .95), maxCommitMs: Math.max(...values.map(x => x.commit)), p95TwoFramePaintMs: percentile('paint', .95) };
    report.performance.push(result); console.log('SPEED:', JSON.stringify(result));
  }
  report.longTasksDuringProfile = await a.page.evaluate(() => window.typingLongTasks);
  const profile = (await cdp.send('Profiler.stop')).profile;
  await fs.writeFile(path.join(dir, 'typing-cpu-profile.json'), JSON.stringify(profile));
  check('Vietnamese and paced typing 60/100/150/210 WPM', 'Exact NFC text and marker index checked after every pace');
  // IME goes through Chromium composition, not fabricated React events.
  await cdp.send('Input.imeSetComposition', { text: 'vị', selectionStart: 2, selectionEnd: 2 });
  await cdp.send('Input.insertText', { text: 'vị' });
  assert.ok((await a.page.locator(input).inputValue()).endsWith('vị'));
  await a.page.keyboard.press('Backspace'); await a.page.keyboard.press('Backspace');
  check('Vietnamese native composition', 'Chromium IME composition/commit retains native caret and editable text');
  // Long passage at human speed, no bulk paste. Verify scroll and geometry.
  await a.page.keyboard.type(target.slice(cursor, cursor + 400).join(''), { delay: 60 }); cursor += 400;
  const geometry = await a.page.locator('.typing-passage-viewport').evaluate(box => { const marker = box.querySelector('[data-state="current"]'); const b = box.getBoundingClientRect(); const m = marker.getBoundingClientRect(); return { scrollTop: box.scrollTop, visible: m.top >= b.top && m.bottom <= b.bottom, index: Number(marker.dataset.charIndex) }; });
  assert.ok(geometry.scrollTop > 0 && geometry.visible); assert.equal(geometry.index, cursor);
  await a.page.screenshot({ path: path.join(dir, 'after-desktop.png') });
  check('Long passage line tracking and auto-scroll', geometry);
  const saved = await a.page.locator(input).inputValue();
  await a.page.reload(); await a.page.locator('.typing-passage-viewport').waitFor();
  await a.page.waitForFunction(({ s, text }) => document.querySelector(s)?.value === text, { s: input, text: saved });
  check('Practice reload', { retainedCharacters: Array.from(saved).length });
  for (const width of [390, 430, 768]) {
    await a.page.setViewportSize({ width, height: 900 });
    const layout = await a.page.locator('.typing-passage-viewport').evaluate(box => { const m = box.querySelector('[data-state="current"]').getBoundingClientRect(); const b = box.getBoundingClientRect(); return { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, markerVisible: m.top >= b.top && m.bottom <= b.bottom && m.left >= 0 && m.right <= innerWidth && b.left >= 0 && b.right <= innerWidth, nativeWidth: document.querySelector('input[style*="opacity: 0"]').getBoundingClientRect().width }; });
    assert.equal(layout.clientWidth, layout.scrollWidth); assert.ok(layout.markerVisible && layout.nativeWidth > 100);
    await a.page.locator('.typing-passage-viewport').scrollIntoViewIfNeeded();
    await a.page.screenshot({ path: path.join(dir, `after-${width}.png`) }); check(`Responsive ${width}px`, layout);
  }
  await a.page.setViewportSize({ width: 1440, height: 1000 });
  // Real room + actual server countdown, independent of the practice tab.
  const room = (await a.post('/rooms', { title: 'Real typing acceptance', mode: '1V1', matchType: 'RANKED', durationLimitSeconds: 30 })).room;
  assert.equal(await a.page.locator('.typing-passage-viewport').count(), 1, 'Another room creation must not hijack practice');
  assert.equal(await a.page.locator(input).inputValue(), saved);
  check('Room broadcasts cannot hijack a parallel practice tab','Practice keeps its own text, attempt and screen when another room is created');
  const raceA = await a.context.newPage(); raceA.on('pageerror', e => report.errors.push(e.message));
  await raceA.goto(base + `/games/typing/room/${room.id}`);
  await b.page.goto(base + `/games/typing/room/${room.id}`);
  await b.page.getByRole('button', { name: /SẴN SÀNG/i }).click();
  await raceA.getByRole('button', { name: /SẴN SÀNG/i }).click();
  await raceA.locator('.typing-passage-viewport').waitFor({ timeout: 15000 });
  await raceA.locator('.typing-passage-viewport').click();
  await raceA.keyboard.type('a'); // first key as soon as the GO input is mounted
  assert.equal(await raceA.locator(input).inputValue(), 'a');
  const passage = Array.from((await a.get(`/rooms/${room.id}`)).room.challengeText);
  const low = passage.slice(1, 75).map((c, i) => i % 2 === 0 ? 'x' : c).join('');
  await Promise.all([raceA.keyboard.type(low, { delay: 60 }), (async () => { await b.page.locator('.typing-passage-viewport').click(); await b.page.keyboard.type(passage.slice(0, 55).join(''), { delay: 120 }); })()]);
  await b.page.waitForFunction(id => document.querySelector(`[data-live-user="${id}"]`)?.dataset.liveRank === '1', b.userId);
  await raceA.waitForFunction(id => document.querySelector(`[data-live-user="${id}"]`)?.dataset.liveRank === '1', b.userId);
  let server = await a.get(`/rooms/${room.id}`);
  assert.equal(server.players.find(x => x.userId === b.userId).liveRank, 1);
  check('Real socket live ranking prioritizes accurate B over faster inaccurate A', server.players.map(({userId, wpm, accuracy, liveRank}) => ({ userId, wpm, accuracy, liveRank })));
  await raceA.screenshot({ path: path.join(dir, 'live-ranking.png') });
  // Local typing while offline must survive reconnection and synchronize a newer revision.
  await b.context.setOffline(true);
  const offlinePrefix = await b.page.locator(input).inputValue();
  assert.equal(offlinePrefix.normalize('NFC'), passage.slice(0,55).join('')); // No delayed snapshot selection may move the caret.
  await b.page.keyboard.type(passage.slice(Array.from(offlinePrefix).length, Array.from(offlinePrefix).length + 12).join(''), { delay: 100 });
  const offlineText = await b.page.locator(input).inputValue();
  await b.context.setOffline(false);
  await b.page.waitForFunction(() => navigator.onLine);
  for (let n = 0; n < 30; n++) { server = await b.get(`/rooms/${room.id}`); if (server.players.find(p => p.userId === b.userId).inputText === offlineText) break; await new Promise(r => setTimeout(r, 200)); }
  assert.equal(server.players.find(p => p.userId === b.userId).inputText, offlineText);
  assert.equal(await b.page.locator(input).inputValue(), offlineText);
  await b.page.reload(); await b.page.locator('.typing-passage-viewport').waitFor();
  await b.page.waitForFunction(({s,text}) => document.querySelector(s)?.value === text, {s:input,text:offlineText});
  check('Room offline/reconnect/reload retains exact text', { characters: Array.from(offlineText).length });
  const spectator = await identity('spectator'); await spectator.page.goto(base + `/games/typing/spectate/${room.id}`);
  await spectator.page.locator('.typing-live-standings').waitFor(); assert.equal(await spectator.page.locator(input).count(), 0);
  check('Real spectator', 'Live server standings visible with no gameplay input');
  await raceA.getByRole('columnheader', { name: 'ĐIỂM WORKRANK', exact: true }).waitFor({ timeout: 40000 });
  const finished = await a.get(`/rooms/${room.id}`);
  assert.equal(finished.room.status, 'FINISHED'); assert.equal(finished.result.winnerUserId, b.userId);
  assert.equal(finished.result.results.find(x => x.userId === b.userId).individualRank, 1);
  assert.ok(finished.result.results.find(x => x.userId === b.userId).scoreDelta > 0);
  const statsBefore = await b.get('/my-stats');
  await Promise.all([b.post(`/rooms/${room.id}/finish`, {typedText: offlineText, inputRevision: 999, clientDurationMs: 1}), b.post(`/rooms/${room.id}/finish`, { typedText: offlineText, inputRevision: 999 })]);
  const statsAfter = await b.get('/my-stats'); assert.equal(statsAfter.totalMatches, statsBefore.totalMatches); assert.equal(statsAfter.totalWorkRankPointsEarned, statsBefore.totalWorkRankPointsEarned);
  await raceA.screenshot({ path: path.join(dir, 'final-ranking.png') });
  check('Timeout settles before winner; final rank/rewards/retry', finished.result.results.map(({userId, individualRank, wpm, accuracy, scoreDelta, isWinner}) => ({userId, individualRank, wpm, accuracy, scoreDelta, isWinner})));
  // The practice clock runs for the full real 120 seconds; no clock rewrites.
  await a.page.waitForFunction(() => document.body.innerText.includes('Máy chủ đã xác minh thành tích'), null, {timeout:130000});
  const pStats = await a.get('/my-stats');
  const [r1,r2] = await Promise.all([a.post('/practice/finish', {attemptId:attempt.attemptId,wpm:9999,accuracy:1,elapsedSeconds:1}),a.post('/practice/finish',{attemptId:attempt.attemptId,wpm:9999})]);
  assert.deepEqual(r1,r2); assert.equal(r1.recorded,true); assert.ok(r1.wpm < 100 && r1.accuracy === 100);
  const pStatsAfter = await a.get('/my-stats'); assert.equal(pStatsAfter.practiceMatches,pStats.practiceMatches); assert.equal(pStatsAfter.totalWorkRankPointsEarned,pStats.totalWorkRankPointsEarned);
  check('Real 120-second practice, forged metrics ignored, duplicate finish no XP', {wpm:r1.wpm,accuracy:r1.accuracy,awardedXp:r1.awardedXp,recorded:r1.recorded});
  await a.page.screenshot({path:path.join(dir,'practice-result.png')});
  // A continuous stream must not keep postponing the frontend countdown effect.
  await b.post('/practice/attempts', {durationLimitSeconds:30,restart:true});
  await b.page.goto(base+'/games/typing');
  await b.page.locator('.typing-passage-viewport').waitFor();
  await b.page.waitForFunction(s=>!document.querySelector(s)?.disabled,input);
  await b.page.locator('.typing-passage-viewport').click();
  const bAttempt=(await b.get('/practice/active')).attempt;
  const continuous=Array.from(bAttempt.challengeText); let n=0;
  const done=b.page.waitForResponse(r=>r.url().endsWith('/practice/finish')&&r.request().method()==='POST',{timeout:36000});
  const began=Date.now();
  while(Date.now()-began<34000 && !(await b.page.locator(input).isDisabled())) {
    await b.page.keyboard.type(continuous[n++],{delay:75});
  }
  const continuousResult=await (await done).json();
  assert.equal(continuousResult.recorded,false);assert.equal(continuousResult.awardedXp,0);
  assert.ok(Date.now()-began<34000 && n>100);
  check('Continuous typing cannot postpone the 30-second deadline', {characters:n,elapsedMs:Date.now()-began});
  // Native paste is blocked; burst correctness is separate from score validity.
  await b.post('/practice/attempts',{durationLimitSeconds:30,restart:true});
  await b.page.reload();await b.page.waitForFunction(s=>document.querySelector(s)&&!document.querySelector(s).disabled,input);
  await b.page.locator('.typing-passage-viewport').click();
  const burst='abcdef vị trí hiện';
  await b.page.keyboard.type(burst);assert.equal(await b.page.locator(input).inputValue(),burst);
  for(let i=0;i<5;i++)await b.page.keyboard.press('Backspace');
  assert.equal(Array.from(await b.page.locator(input).inputValue()).length,Array.from(burst).length-5);
  const beforePaste=await b.page.locator(input).inputValue();
  await b.context.grantPermissions(['clipboard-read','clipboard-write']);
  await b.page.evaluate(()=>navigator.clipboard.writeText('forbidden paste'));
  await b.page.keyboard.press('ControlOrMeta+V');
  assert.equal(await b.page.locator(input).inputValue(),beforePaste);
  check('Burst input, rapid Backspace and native paste blocking', 'No dropped Unicode; paste leaves text unchanged');
  const instantRoom=(await b.post('/rooms',{mode:'SOLO',durationLimitSeconds:30,matchType:'RANKED'})).room;
  const instantStart=await b.post(`/rooms/${instantRoom.id}/start`);
  const instant=await b.post(`/rooms/${instantRoom.id}/finish`,{typedText:Array.from(instantStart.room.challengeText).slice(0,20).join(''),inputRevision:1,clientDurationMs:1});
  assert.equal(instant.result.results[0].eligible,false);assert.equal(instant.result.results[0].scoreDelta,0);assert.equal(instant.result.winnerUserId,null);
  check('Instant real HTTP finish cannot turn 1ms into a rewardable run','20 copied characters before one second: no winner and no reward');
  const forged=await b.context.request.post(api+'/api/games/typing/practice/finish',{headers:b.headers,data:{wpm:9999,accuracy:100,elapsedSeconds:120}});
  assert.equal(forged.status(),400);
  check('Legacy metric-only practice request rejected by real server','HTTP 400 without server-issued attemptId');
  assert.deepEqual(report.errors, []); report.status = 'PASS';
} catch (e) { report.status = 'FAIL'; report.failure = e.stack; console.error(e); process.exitCode = 1; }
finally { report.finished = new Date().toISOString(); await fs.writeFile(path.join(dir, 'real-browser-results.json'), JSON.stringify(report,null,2)); await browser.close(); }
