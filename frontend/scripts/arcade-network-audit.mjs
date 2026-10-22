import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const web = 'http://127.0.0.1:5277', api = 'http://127.0.0.1:5107';
const dir = path.resolve('../docs/audit/2026-10-21/arcade');
const browser = await chromium.launch();
const report = { checks: [], errors: [] };
async function session(suffix) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const auth = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${suffix}@audit.test`, password: 'ArcadeAuditTest123!' } }).then((r) => r.json());
  await context.addInitScript((token) => localStorage.setItem('token', token), auth.accessToken);
  const request = async (route, data) => {
    const r = await context.request[data === undefined ? 'get' : 'post'](api + '/api/games/arcade' + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(r.ok(), await r.text()); return r.json();
  };
  const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
  return { context, page, request, userId: auth.user.id };
}
async function react(s, count) {
  await s.page.locator('.arcade-direction-arena').focus();
  for (let i = 0; i < count; i++) {
    await s.page.waitForTimeout(140);
    const direction = await s.page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
    await s.page.keyboard.press(({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' })[direction]);
  }
}
try {
  const players = await Promise.all(['a', 'b', 'c'].map(session)), [a, b, c] = players;
  const { room } = await a.request('/rooms', { gameType: 'direction_rush', mode: 'TRIO' });
  for (const p of [b, c]) await p.request(`/rooms/${room.id}/join`, {});
  for (const p of players) await p.request(`/rooms/${room.id}/ready`, { ready: true });
  await a.request(`/rooms/${room.id}/start`, {});
  await Promise.all(players.map(async (p) => { await p.page.goto(`${web}/games/arcade/direction_rush/room/${room.id}`); await p.page.locator('.arcade-direction-arena').waitFor(); await p.page.locator('.arcade-countdown').waitFor({ state: 'hidden' }); }));
  await Promise.all(players.map((p) => react(p, 4)));
  await a.context.setOffline(true);
  await Promise.all(players.map((p) => react(p, 12)));
  await a.context.setOffline(false);
  await a.page.waitForTimeout(1300);
  await b.page.reload(); await b.page.locator('.arcade-direction-arena').waitFor();
  await Promise.all(players.map((p) => react(p, 3)));
  const frames = await a.page.evaluate(() => new Promise((resolve) => {
    const start = performance.now(), gaps = []; let previous = start;
    const frame = (now) => { gaps.push(now - previous); previous = now; if (now - start < 2000) requestAnimationFrame(frame); else { gaps.sort((a, b) => a - b); resolve({ frames: gaps.length, averageFps: gaps.length / ((now - start) / 1000), p95FrameMs: gaps[Math.floor(gaps.length * .95)] }); } };
    requestAnimationFrame(frame);
  }));
  await Promise.all(players.map((p) => p.page.locator('.arcade-result').waitFor({ timeout: 20000 })));
  await a.page.waitForFunction(() => !document.querySelector('.arcade-result button')?.disabled);
  const results = await Promise.all(players.map((p) => p.request(`/rooms/${room.id}`)));
  for (const state of results) {
    assert.equal(state.room.status, 'FINISHED');
    for (const p of state.players) assert.ok(p.result.correct >= 18, JSON.stringify(p.result));
    assert.deepEqual(state.players.map((p) => [p.userId, p.rank, p.result.score]), results[0].players.map((p) => [p.userId, p.rank, p.result.score]));
    assert.equal(state.players.filter((p) => p.events).length, 1);
  }
  await a.page.screenshot({ path: path.join(dir, 'trio-reconnect-result.png') });
  report.checks.push({ name: 'TRIO offline local inputs + other clients continue + reconnect flush + another client reload + identical authoritative ranks', status: 'PASS', correct: results[0].players.map((p) => p.result.correct), frameSample: frames });
  const waiting = await a.request('/rooms', { gameType: 'computer_rush', mode: 'DUO' });
  await b.request(`/rooms/${waiting.room.id}/join`, {});
  await b.page.goto(`${web}/games/arcade/computer_rush/room/${waiting.room.id}`);
  await b.page.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
  await a.page.goto(`${web}/games/arcade/computer_rush/room/${waiting.room.id}`);
  await a.page.getByRole('button', { name: 'Rời phòng' }).click();
  await b.page.getByRole('button', { name: 'Tôi đã sẵn sàng' }).waitFor();
  const transferred = await b.request(`/rooms/${waiting.room.id}`);
  assert.equal(String(transferred.room.hostId), String(b.userId)); assert.equal(transferred.players[0].ready, false);
  await b.page.getByRole('button', { name: 'Rời phòng' }).click();
  assert.ok(!(await a.request('/rooms?gameType=computer_rush&mode=DUO')).rooms.some((r) => r.id === waiting.room.id));
  report.checks.push({ name: 'UI host intentional leave transfers host, clears ready; last UI leave removes public room', status: 'PASS' });
} catch (e) { report.errors.push(e.stack); console.error(e); process.exitCode = 1; }
finally { await fs.writeFile(path.join(dir, 'network-results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify(report));
