import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.UX_WEB || 'http://127.0.0.1:5277';
const api = process.env.UX_API || 'http://127.0.0.1:5107';
const out = path.resolve(process.env.UX_OUTPUT || '../docs/audit/2026-10-21/arcade-ux/final');
await fs.mkdir(out, { recursive: true });
const report = { startedAt: new Date().toISOString(), checks: [], errors: [], performance: [] };
const browser = await chromium.launch();
const games = ['computer_rush', 'direction_rush', 'memory_flash'];
const keys = { UP: 'ArrowUp', LEFT: 'ArrowLeft', DOWN: 'ArrowDown', RIGHT: 'ArrowRight' };
const wasd = { UP: 'w', LEFT: 'a', DOWN: 's', RIGHT: 'd' };
const opposite = { UP: 'DOWN', DOWN: 'UP', LEFT: 'RIGHT', RIGHT: 'LEFT' };
const check = (game, name, evidence) => { report.checks.push({ game, name, status: 'PASS', evidence }); console.log('PASS', game, name); };
const shot = (p, game, name, fullPage = false) => p.screenshot({ path: path.join(out, `${game}-${name}.png`), fullPage });
async function noOverflow(p) {
  const diff = await p.evaluate(() => ({ document: document.documentElement.scrollWidth - innerWidth, arcade: document.querySelector('.arcade-page').scrollWidth - document.querySelector('.arcade-page').clientWidth }));
  assert.ok(diff.document <= 1 && diff.arcade <= 1, JSON.stringify(diff));
  return diff;
}
async function setup(game, suffix) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const response = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${suffix}@audit.test`, password: 'ArcadeAuditTest123!' } });
  const auth = await response.json(); assert.ok(auth.accessToken);
  await context.addInitScript((token) => {
    localStorage.setItem('token', token); window.__commits=0;
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__={renderers:new Map(),supportsFiber:true,inject(r){this.renderers.set(1,r);return 1;},onCommitFiberRoot(){window.__commits++;},onCommitFiberUnmount(){},onPostCommitFiberRoot(){},checkDependencies(){}};
  }, auth.accessToken);
  const request = async (route, data) => {
    const r = await context.request[data === undefined ? 'get' : 'post'](api + '/api/games/arcade' + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(r.ok(), `${route}: ${await r.text()}`); return r.json();
  };
  const old = await request('/active'); if (old) await request(`/rooms/${old.room.id}/leave`, {});
  const p = await context.newPage(); p.on('pageerror', (e) => report.errors.push(e.message));
  for (const width of [390, 430, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    await p.goto(`${web}/games/arcade/${game}`); await p.locator('.arcade-menu').waitFor();
    if (width === 390) {
      assert.equal(await p.locator('.arcade-tutorial-toggle').getAttribute('aria-expanded'), 'true');
      await p.waitForTimeout(2150);
      assert.equal(await p.locator('.arcade-tutorial-demo').getAttribute('data-step'), '2');
      await p.locator('.arcade-tutorial').scrollIntoViewIfNeeded(); await shot(p, game, 'tutorial-390');
      await p.getByRole('button', { name: 'Đã hiểu · sẵn sàng chơi ✓' }).click();
      await p.reload(); await p.locator('.arcade-menu').waitFor();
      assert.equal(await p.locator('.arcade-tutorial-toggle').getAttribute('aria-expanded'), 'false');
      check(game, 'Tutorial minh họa 3 bước, bỏ qua và nhớ lựa chọn sau reload');
      await p.emulateMedia({ reducedMotion: 'reduce' }); await p.locator('.arcade-tutorial-toggle').click();
      const still = await p.locator('.arcade-tutorial-demo').getAttribute('data-step'); await p.waitForTimeout(1150);
      assert.equal(await p.locator('.arcade-tutorial-demo').getAttribute('data-step'), still);
      check(game, 'Tutorial tĩnh khi hệ điều hành yêu cầu giảm chuyển động');
      await p.locator('.arcade-tutorial-toggle').click(); await p.emulateMedia({ reducedMotion: 'no-preference' });
    }
    for (const mode of ['DUO', 'TRIO', 'SOLO']) await p.locator('.arcade-mode-select').getByRole('button').filter({ hasText: mode }).click();
    assert.equal(await p.locator('.arcade-mode-select button[aria-pressed="true"]').count(), 1);
    await noOverflow(p); await shot(p, game, `menu-${width}`, true);
  }
  await p.setViewportSize({ width: 390, height: 844 });
  await p.locator('.arcade-start-row').getByRole('button', { name: 'Vào chơi ngay' }).click();
  await p.waitForURL('**/room/**'); const id = p.url().split('/').at(-1);
  const initial = await request(`/rooms/${id}`); assert.equal(initial.room.durationSeconds, 60);
  await p.locator('.arcade-world').waitFor(); await p.locator('.arcade-countdown').waitFor({ state: 'hidden' });
  const events = () => p.evaluate(({ id, uid }) => JSON.parse(sessionStorage.getItem(`wr:arcade:v1:${id}:${uid}`) || '[]'), { id, uid: auth.user.id });
  const s = { context, p, request, id, initial, events, game };
  return s;
}
async function typeWord(s, delay = 45) {
  await s.p.locator('.arcade-word-wrap[data-transition="complete"]').waitFor({ state: 'hidden' });
  const input = s.p.locator('#arcade-word-input'); const target = await s.p.getByTestId('challenge-word').textContent();
  const before = (await s.events()).length;
  await input.focus(); await s.p.keyboard.type(target.toLowerCase(), { delay });
  await s.p.waitForFunction(({ id, uid, before }) => JSON.parse(sessionStorage.getItem(`wr:arcade:v1:${id}:${uid}`) || '[]').length > before, { id: s.id, uid: s.initial.players[0].userId, before });
}
async function sendDirection(s, method = 'key') {
  const p = s.p; await p.locator('.arcade-arrow-object.is-entering').waitFor({ state: 'hidden' });
  const d = await p.getByTestId('challenge-direction').getAttribute('data-expected');
  if (method === 'touch') {
    await p.locator('.arcade-direction-arena').scrollIntoViewIfNeeded();
    const b = await p.locator('.arcade-arrow-object').boundingBox(), x = b.x + b.width / 2, y = b.y + b.height / 2;
    const [dx, dy] = ({ UP: [0, -45], DOWN: [0, 45], LEFT: [-45, 0], RIGHT: [45, 0] })[d];
    const cdp = await s.context.newCDPSession(p);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await cdp.detach();
  } else if (method === 'button') await p.getByRole('button', { name: `Đi ${d}`, exact: true }).click();
  else { await p.locator('.arcade-direction-arena').focus(); await p.keyboard.press(method === 'wasd' ? wasd[d] : keys[d]); }
}
async function memoryRound(s, { wrong = false, deselect = false, screenshot } = {}) {
  const p = s.p;
  await p.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor({ timeout: 10000 });
  const size = Math.sqrt(await p.locator('.arcade-memory-tile').count());
  const targets = await p.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((e) => e.dataset.cell));
  if (screenshot) await shot(p, s.game, `${screenshot}-memorize-${size}x${size}`);
  await p.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
  const hiddenColors = await p.locator('.arcade-memory-tile').evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
  assert.equal(hiddenColors.length, 1, 'Pattern leaked through CSS');
  const tile = await p.locator('.arcade-memory-tile').first().boundingBox(); assert.ok(tile.width >= 44 && tile.height >= 44);
  const board = await p.locator('.arcade-memory-board').boundingBox(), actor = await p.locator('.arcade-memory-companion .arcade-player').boundingBox();
  const overlaps = board.x < actor.x + actor.width && board.x + board.width > actor.x && board.y < actor.y + actor.height && board.y + board.height > actor.y;
  assert.equal(overlaps, false, 'Character overlaps memory tiles');
  if (deselect) {
    const first = p.locator(`[data-cell="${targets[0]}"]`); await first.click({ force: true }); assert.equal(await first.getAttribute('aria-pressed'), 'true');
    await first.click({ force: true }); assert.equal(await first.getAttribute('aria-pressed'), 'false');
  }
  const selected = wrong ? [String(Array.from({ length: size * size }, (_, i) => i).find((i) => !targets.includes(String(i)))), ...targets.slice(1)] : targets;
  for (const cell of selected) await p.locator(`[data-cell="${cell}"]`).click({ force: true });
  await p.locator('.arcade-memory-board[data-phase="REVIEW"]').waitFor();
  if (wrong) for (const state of ['correct', 'incorrect', 'missed']) assert.ok(await p.locator(`[data-cell-state="${state}"]`).count());
  if (screenshot) await shot(p, s.game, `${screenshot}-${wrong ? 'wrong' : 'correct'}-${size}x${size}`);
  return { size, targets: targets.length, tile: tile.width, hiddenColors, characterOverlap: overlaps };
}
async function performanceStart(s) {
  const cdp = await s.context.newCDPSession(s.p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await s.p.evaluate(() => {
  const data = window.__uxPerf = { frames: [], inputNextFrame: [], cls: 0, shiftDetails: [], longTasks: [], active: true, commitsStart: window.__commits, domNodes: document.querySelectorAll('*').length };
    let last;
    const tick = (t) => { if (!data.active) return; if (last) data.frames.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
    for (const type of ['keydown', 'click', 'input']) document.querySelector('.arcade-world').addEventListener(type, () => { if (!data.active) return; const t = performance.now(); requestAnimationFrame(() => data.inputNextFrame.push(performance.now() - t)); }, true);
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (!e.hadRecentInput && data.active) { data.cls += e.value; data.shiftDetails.push({ value: e.value, sources: e.sources.map((x) => ({ node: x.node?.className, previous: x.previousRect.toJSON(), current: x.currentRect.toJSON() })) }); } }).observe({ type: 'layout-shift', buffered: false });
    new PerformanceObserver((list) => { for (const e of list.getEntries()) if (data.active) data.longTasks.push(e.duration); }).observe({ type: 'longtask', buffered: false });
  });
  return cdp;
}
async function performanceEnd(s, cdp) {
  const raw = await s.p.evaluate(() => { window.__uxPerf.active = false; return {...window.__uxPerf, reactCommits: window.__commits-window.__uxPerf.commitsStart}; });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 }); await cdp.detach();
  const percentile = (a, p) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] || 0;
  const perf = { game: s.game, cpuThrottle: 4, reactCommits: raw.reactCommits, domNodes: raw.domNodes, fpsMean: 1000/(raw.frames.reduce((a,b)=>a+b,0)/raw.frames.length), frameSamples: raw.frames.length, frameP50Ms: percentile(raw.frames, .5), frameP95Ms: percentile(raw.frames, .95), inputSamples: raw.inputNextFrame.length, inputToNextFrameP50Ms: percentile(raw.inputNextFrame, .5), inputToNextFrameP95Ms: percentile(raw.inputNextFrame, .95), gameplayCls: raw.cls, shiftDetails: raw.shiftDetails, longTaskCount: raw.longTasks.length, longestTaskMs: Math.max(0, ...raw.longTasks) };
  report.performance.push(perf);
  assert.ok(perf.inputSamples >= 10); const targetMs=s.game==='direction_rush'?20:25;
  assert.ok(perf.inputToNextFrameP95Ms <= targetMs, JSON.stringify(perf));
  assert.ok(perf.gameplayCls < .1, JSON.stringify({ ...perf, shiftDetails: `${perf.shiftDetails.length} entries in JSON evidence` }));
  check(s.game, 'Input/RAF/CLS sau polish với CPU 4x', perf);
}
async function audit(game, i) {
  const s = await setup(game, ['a', 'd', 'g'][i]), { p } = s;
  for (const width of [390, 430, 768, 1024, 1440]) {
    await p.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    if (game === 'computer_rush') {
      await p.locator('#arcade-word-input').focus(); await p.keyboard.type('z'); assert.ok(await p.locator('[data-char-state="wrong"]').count());
      await p.keyboard.press('Backspace'); await typeWord(s);
    } else if (game === 'direction_rush') {
      await p.waitForTimeout(150); await sendDirection(s, width === 390 ? 'touch' : width === 430 ? 'button' : 'wasd');
    } else {
      const evidence = await memoryRound(s, { wrong: width === 390, deselect: width === 430, screenshot: String(width) });
      check(game, `Memory chơi ${width}px, feedback / không lộ pattern / nhân vật không đè bảng`, evidence);
    }
    await noOverflow(p); await shot(p, game, `gameplay-${width}`);
    check(game, `Chơi tương tác tại ${width}px`, { width, events: (await s.events()).length });
  }
  if (game === 'computer_rush') {
    await p.locator('#arcade-word-input').focus(); await p.setViewportSize({ width: 390, height: 430 }); await p.waitForTimeout(200);
    const visible = await p.evaluate(() => {
      const input = document.querySelector('#arcade-word-input').getBoundingClientRect(), target = document.querySelector('[data-testid="challenge-word"]').getBoundingClientRect();
      return { inputTop: input.top, inputBottom: input.bottom, targetTop: target.top, targetBottom: target.bottom, viewport: innerHeight };
    });
    assert.ok(visible.targetTop >= 0 && visible.inputBottom <= visible.viewport, JSON.stringify(visible));
    await typeWord(s); await shot(p, game, 'short-viewport-390x430');
    check(game, 'Target và input cùng nhìn thấy khi viewport còn 390×430', visible);
    await p.setViewportSize({ width: 1440, height: 1000 });
  }
  if (game === 'memory_flash') await p.setViewportSize({ width: 390, height: 844 });
  const cdp = await performanceStart(s);
  if (game === 'computer_rush') {
    for (let n = 0; n < 20; n++) { await typeWord(s, 40); if ([4, 9, 14].includes(n)) await shot(p, game, `combo-${n + 6}`); }
  } else if (game === 'direction_rush') {
    const before = (await s.events()).length;
    for (let n = 0; n < 24; n++) { await p.waitForTimeout(160); await sendDirection(s); }
    const after = (await s.events()).length; assert.equal(after - before, 24, 'Dropped keyboard direction input');
    check(game, '24 phím liên tiếp dưới CPU 4x không mất input', { before, after });
  } else {
    const sizes = new Set([3]);
    while ((await s.events()).length < 19) {
      const n = (await s.events()).length;
      const evidence = await memoryRound(s, { screenshot: [6, 18].includes(n) ? 'deep' : undefined }); sizes.add(evidence.size);
    }
    assert.deepEqual([...sizes], [3, 4, 5]); check(game, 'Chơi tới 5×5, tăng từng biến độ khó', { sizes: [...sizes], rounds: (await s.events()).length });
  }
  await performanceEnd(s, cdp);
  if (game === 'direction_rush') {
    const stages = new Set(); let wrongCaptured = false, entranceGuard = false, warningCaptured = false;
    while (await p.locator('.arcade-world').count()) {
      if (await p.locator('.arcade-end-message').count()) break;
      const stage = await p.locator('.arcade-direction-arena').getAttribute('data-stage'); stages.add(stage);
      if(!warningCaptured && await p.getByText(/SẮP ĐẢO CHIỀU/).count()) { await shot(p,game,'opposite-warning'); warningCaptured=true; }
      if (stage === 'entrance' && !entranceGuard && await p.locator('.is-entering').count()) {
        const n = (await s.events()).length; await p.locator('.arcade-direction-arena').focus(); await p.keyboard.press('ArrowUp');
        assert.equal((await s.events()).length, n); entranceGuard = true;
      }
      if (stage === 'opposite') {
        const shown = await p.getByTestId('challenge-direction').getAttribute('data-direction'), expected = await p.getByTestId('challenge-direction').getAttribute('data-expected');
        assert.equal(expected, opposite[shown]); assert.ok(await p.locator('.is-opposite').count());
        if (!wrongCaptured) {
          await p.locator('.arcade-direction-arena').focus(); await p.keyboard.press(keys[shown]);
          await p.getByText('CẦN', { exact: false }).first().waitFor(); await shot(p, game, 'opposite-wrong'); wrongCaptured = true;
        }
        await shot(p, game, 'opposite');
      }
      await p.waitForTimeout(190); if (await p.locator('.arcade-world').count() && !(await p.locator('.arcade-end-message').count())) await sendDirection(s);
      if (stage === 'final') { await shot(p, game, 'final-pace'); break; }
    }
    assert.ok(stages.has('entrance') && stages.has('opposite') && stages.has('final'), [...stages].join(','));
    check(game, 'Ván 60s: xoay trước input, biển đảo chiều muộn, đáp án ngược và trở lại luật thường', { stages: [...stages], entranceGuard, wrongCaptured, warningCaptured });
  }
  await p.evaluate(() => document.documentElement.dataset.workrankReduceMotion = 'true');
  const reduced = await p.locator('.arcade-player .arcade-actor').first().evaluate((e) => ({ animation: getComputedStyle(e).animationName, transition: getComputedStyle(e).transitionDuration }));
  assert.equal(reduced.animation, 'none'); check(game, 'Cài đặt giảm chuyển động', reduced);
  await p.locator('.arcade-result').waitFor({ timeout: 65000 });
  await p.locator('.arcade-result').getByRole('button', { name: /Chơi lại|Vào ván tiếp theo/ }).waitFor();
  const result = await s.request(`/rooms/${s.id}`); assert.equal(result.room.status, 'FINISHED'); assert.ok(result.players[0].result.correct > 0);
  await p.setViewportSize({ width: 390, height: 844 }); await shot(p, game, 'result-390', true);
  await p.locator('.arcade-result').getByRole('button', { name: /Chơi lại|Vào ván tiếp theo/ }).click();
  await p.waitForURL((url) => url.pathname.includes('/room/') && !url.pathname.endsWith(s.id));
  const nextId = p.url().split('/').at(-1); await p.locator('.arcade-world').waitFor();
  check(game, 'Mặc định 60s → kết quả có PB thật → một chạm chơi lại', { result: result.players[0].result, newRoom: nextId });
  await s.request(`/rooms/${nextId}/leave`, {}); await s.context.close();
}
try { const results = await Promise.allSettled(games.filter((g) => !process.env.UX_GAME || g === process.env.UX_GAME).map((g) => audit(g, games.indexOf(g)))); for (const r of results) if (r.status === 'rejected') throw r.reason; }
catch (e) {
  report.errors.push(e.stack); console.error(e); process.exitCode = 1;
  for (const [i, c] of browser.contexts().entries()) for (const p of c.pages()) await p.screenshot({ path: path.join(out, `failure-${i}.png`), fullPage: true }).catch(() => {});
} finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(out, 'device-performance-results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
