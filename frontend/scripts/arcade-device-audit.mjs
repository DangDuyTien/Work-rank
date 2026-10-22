import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const web = process.env.ARCADE_DEVICE_WEB || 'http://127.0.0.1:5278';
const api = process.env.ARCADE_DEVICE_API || 'http://127.0.0.1:5108';
for (const url of [web, api]) assert.equal(new URL(url).hostname, '127.0.0.1');
const dir = path.resolve('../docs/audit/2026-10-21/arcade');
const report = { checks: [], errors: [], startedAt: new Date().toISOString() };
await fs.mkdir(dir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const check = (name, evidence) => { console.log('PASS', name); report.checks.push({ name, status: 'PASS', evidence }); };
async function session(suffix, mobile = false) {
  const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1080 }, isMobile: mobile, hasTouch: mobile });
  const r = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${suffix}@audit.test`, password: 'ArcadeAuditTest123!' } });
  assert.ok(r.ok()); const auth = await r.json();
  await context.addInitScript(({ access, refresh }) => { localStorage.setItem('token', access); localStorage.setItem('refreshToken', refresh); }, { access: auth.accessToken, refresh: auth.refreshToken });
  const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
  const request = async (route, data) => {
    const r = await context.request[data === undefined ? 'get' : 'post'](api + '/api/games/arcade' + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(r.ok(), `${route}: ${r.status()} ${await r.text()}`); return r.json();
  };
  const active = await request('/active');
  if (active) await request(`/rooms/${active.room.id}/leave`, {});
  return { context, page, request, userId: auth.user.id };
}
async function start(s, game, difficulty) {
  await s.page.goto(`${web}/games/arcade/${game}`);
  if (difficulty) await s.page.locator('.arcade-start-row select').selectOption(difficulty);
  await s.page.getByRole('button', { name: 'Vào chơi ngay' }).click();
  await s.page.waitForURL('**/room/**');
  return s.page.url().split('/').at(-1);
}
async function leave(s) { await s.page.getByRole('button', { name: 'Rời phòng' }).click(); await s.page.waitForURL(/\/games\/arcade\/[^/]+$/); }
async function overflow(page) {
  return page.evaluate(() => {
    const page = document.querySelector('.arcade-page');
    return { page: page.scrollWidth - page.clientWidth, document: document.documentElement.scrollWidth - window.innerWidth };
  });
}
try {
  const a = await session('a', true), b = await session('b');
  for (const width of [1920, 1440, 1280, 1024, 768, 430, 390]) {
    await a.page.setViewportSize({ width, height: width < 600 ? 844 : 1080 });
    for (const game of ['computer_rush', 'direction_rush', 'memory_flash']) {
      await a.page.goto(`${web}/games/arcade/${game}`);
      await a.page.locator('.arcade-menu').waitFor();
      const o = await overflow(a.page); assert.ok(o.page <= 1 && o.document <= 1, `${game} width ${width}: ${JSON.stringify(o)}`);
      if ([1440, 390].includes(width)) await a.page.screenshot({ path: path.join(dir, `${game}-menu-${width}.png`) });
    }
    check(`Menu responsive ${width}px: all three games, no horizontal overflow`);
  }
  await a.page.goto(web + '/games');
  await a.page.getByRole('heading', { name: 'Computer Rush', exact: true }).waitFor();
  for (const name of ['Computer Rush', 'Direction Rush', 'Memory Flash']) assert.equal(await a.page.getByRole('heading', { name, exact: true }).count(), 1);
  for (const name of ['UNO', 'Sâm', 'Guess Image']) assert.equal(await a.page.getByRole('heading', { name, exact: true }).count(), 0);
  await a.page.screenshot({ path: path.join(dir, 'game-center-390.png'), fullPage: true });
  check('Game Center contains the three arcade cards without retired games');

  const computerId = await start(a, 'computer_rush', 'vietnamese');
  const input = a.page.locator('#arcade-word-input'); await input.waitFor(); await input.focus();
  await a.page.keyboard.type('early'); assert.equal(await input.inputValue(), '');
  await a.page.locator('.arcade-countdown').waitFor({ state: 'hidden' });
  const first = await a.page.locator('[data-testid="challenge-word"]').textContent();
  await a.page.keyboard.type('x'); await a.page.keyboard.press('Backspace'); assert.equal(await input.inputValue(), '');
  await a.page.waitForTimeout(700);
  await a.page.keyboard.insertText(first.toLowerCase().normalize('NFD'));
  await a.page.waitForTimeout(100);
  assert.equal(await input.inputValue(), '');
  await a.context.setOffline(true);
  const second = await a.page.locator('[data-testid="challenge-word"]').textContent();
  await a.page.waitForTimeout(700); await a.page.keyboard.insertText(second.toLowerCase());
  await a.page.waitForTimeout(1200);
  assert.equal(await input.inputValue(), '');
  await a.context.setOffline(false); await a.page.waitForTimeout(1600);
  const beforeReload = await a.request('/rooms/' + computerId);
  assert.equal(beforeReload.players[0].events.length, 2);
  await a.page.reload(); await input.waitFor();
  const third = await a.page.locator('[data-testid="challenge-word"]').textContent();
  await input.focus();
  await input.dispatchEvent('compositionstart', { data: '' });
  await a.page.keyboard.insertText(third.toLowerCase());
  assert.notEqual(await input.inputValue(), '');
  await input.dispatchEvent('compositionend', { data: third.toLowerCase() });
  await a.page.waitForTimeout(1300);
  const recovered = await a.request('/rooms/' + computerId);
  assert.equal(recovered.players[0].events.length, 3);
  await a.page.screenshot({ path: path.join(dir, 'computer-mobile-unicode-390.png') });
  check('Computer: early input blocked, Backspace, native NFD/NFC, simulated composition, offline input and reload recovery', { events: 3, accuracy: recovered.players[0].metrics.accuracy, realOsUniKey: 'Not available in headless Chromium; manual validation required' });
  await leave(a);

  const directionId = await start(a, 'direction_rush');
  await a.page.locator('.arcade-direction-arena').waitFor();
  await a.page.locator('.arcade-countdown').waitFor({ state: 'hidden' });
  const arena = a.page.locator('.arcade-direction-arena'); await arena.scrollIntoViewIfNeeded();
  const cdp = await a.context.newCDPSession(a.page);
  const swipeDirection = await a.page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
  const box = await arena.boundingBox();
  const origin = { x: box.x + box.width / 2, y: box.y + 100 };
  const delta = ({ UP: [0, -50], DOWN: [0, 50], LEFT: [-50, 0], RIGHT: [50, 0] })[swipeDirection];
  await a.page.waitForTimeout(250);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...origin, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: origin.x + delta[0], y: origin.y + delta[1], id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await a.page.waitForTimeout(150);
  const nextDir = await a.page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
  await a.page.getByRole('button', { name: `Đi ${nextDir}`, exact: true }).click();
  await a.page.waitForTimeout(1000);
  let state = await a.request('/rooms/' + directionId); assert.ok(state.players[0].metrics.correct >= 2);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await arena.focus();
  await a.page.evaluate(() => {
    window.__arcadeLatency = [];
    document.addEventListener('keydown', (e) => { if (!e.key.startsWith('Arrow')) return; const start = performance.now(); requestAnimationFrame(() => window.__arcadeLatency.push(performance.now() - start)); }, true);
  });
  for (let i = 0; i < 20; i++) {
    await a.page.waitForTimeout(150);
    const d = await a.page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
    await a.page.keyboard.press(({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' })[d]);
  }
  const latency = await a.page.evaluate(() => window.__arcadeLatency);
  latency.sort((x, y) => x - y);
  await a.page.waitForTimeout(1000);
  state = await a.request('/rooms/' + directionId);
  assert.ok(state.players[0].metrics.correct >= 20);
  assert.ok(latency.at(Math.floor(latency.length * .95)) < 150);
  await a.page.screenshot({ path: path.join(dir, 'direction-mobile-390.png') });
  check('Direction: real CDP touch swipe, accessible buttons and CPU 4x keyboard input', { correct: state.players[0].metrics.correct, inputToNextFrameP50Ms: latency[Math.floor(latency.length / 2)], inputToNextFrameP95Ms: latency[Math.floor(latency.length * .95)] });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await leave(a);

  // A disconnected waiting seat must disappear while another user keeps playing.
  const stale = await b.request('/rooms', { gameType: 'memory_flash', mode: 'DUO' });
  const memoryId = await start(a, 'memory_flash');
  await a.page.locator('.arcade-memory-board').waitFor();
  await a.page.locator('.arcade-countdown').waitFor({ state: 'hidden' });
  const sizes = new Set();
  for (let index = 0; index < 22; index++) {
    await a.page.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor({ timeout: 12000 });
    const count = await a.page.locator('.arcade-memory-tile').count(); sizes.add(Math.sqrt(count));
    const target = await a.page.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((el) => el.getAttribute('data-cell')));
    const rect = await a.page.locator('.arcade-memory-tile').first().boundingBox(); assert.ok(rect.width >= 44 && rect.height >= 44);
    const o = await overflow(a.page); assert.ok(o.page <= 1 && o.document <= 1);
    if ([0, 9, 21].includes(index)) await a.page.screenshot({ path: path.join(dir, `memory-${Math.sqrt(count)}x${Math.sqrt(count)}-390.png`) });
    await a.page.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
    for (const cell of target) await a.page.locator(`[data-cell="${cell}"]`).click({ force: true });
    await a.page.waitForTimeout(280);
  }
  await a.page.waitForTimeout(1000);
  state = await a.request('/rooms/' + memoryId);
  assert.deepEqual([...sizes], [3, 4, 5]); assert.equal(state.players[0].metrics.correct, 22);
  check('Memory: real 22 rounds through 3×3 → 4×4 → 5×5 on mobile; tiles >=44px; no overflow', { sizes: [...sizes], correct: state.players[0].metrics.correct });
  assert.ok(!(await b.request('/rooms?gameType=memory_flash&mode=DUO')).rooms.some((r) => r.id === stale.room.id));
  check('Ghost room prevention: waiting user with no heartbeats removed after grace');
  await a.page.evaluate(() => document.documentElement.setAttribute('data-workrank-reduce-motion', 'true'));
  assert.equal(await a.page.locator('.arcade-memory-tile').first().evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  check('Reduced motion setting disables new transitions');
  await leave(a);
  for (const s of [a, b]) await s.context.close();
} catch (error) {
  report.errors.push(error.stack); console.error(error); process.exitCode = 1;
  for (const [i, context] of browser.contexts().entries()) for (const [j, page] of context.pages().entries()) await page.screenshot({ path: path.join(dir, `device-failure-${i}-${j}.png`) }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(dir, 'device-results.json'), JSON.stringify(report, null, 2)); await browser.close();
}
