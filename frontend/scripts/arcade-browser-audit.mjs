import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.ARCADE_AUDIT_WEB || 'http://127.0.0.1:5277';
const api = process.env.ARCADE_AUDIT_API || 'http://127.0.0.1:5107';
for (const url of [web, api]) assert.equal(new URL(url).hostname, '127.0.0.1');
const output = path.resolve(process.env.ARCADE_AUDIT_OUTPUT || '../docs/audit/2026-10-21/arcade');
await fs.mkdir(output, { recursive: true });
const report = { checks: [], errors: [], startedAt: new Date().toISOString() };
const browser = await chromium.launch({ headless: true });
const pass = (name, evidence) => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS', name); };

async function identity(suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  const r = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${suffix}@audit.test`, password: 'ArcadeAuditTest123!' } });
  assert.equal(r.status(), 200);
  const auth = await r.json();
  await context.addInitScript(({ access, refresh }) => { localStorage.setItem('token', access); localStorage.setItem('refreshToken', refresh); }, { access: auth.accessToken, refresh: auth.refreshToken });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  const request = async (route, data) => {
    const response = await context.request[data === undefined ? 'get' : 'post'](api + '/api/games/arcade' + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(response.ok(), `${route}: ${response.status()} ${await response.text()}`);
    return response.json();
  };
  return { page, context, request, userId: auth.user.id };
}
async function waitGo(page) { await page.locator('.arcade-countdown').waitFor({ state: 'hidden' }); }
async function computer(page, rounds = 5) {
  const input = page.locator('#arcade-word-input');
  await input.waitFor(); await waitGo(page);
  for (let i = 0; i < rounds; i++) {
    const word = await page.locator('[data-testid="challenge-word"]').textContent();
    await input.focus();
    await page.keyboard.type(word.toLowerCase(), { delay: 65 });
    await page.waitForTimeout(90);
  }
}
async function direction(page, rounds = 55) {
  await page.locator('.arcade-direction-arena').waitFor(); await waitGo(page);
  await page.locator('.arcade-direction-arena').focus();
  for (let i = 0; i < rounds; i++) {
    await page.waitForTimeout(110);
    const dir = await page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
    await page.keyboard.press(i % 2 ? ({ UP: 'w', DOWN: 's', LEFT: 'a', RIGHT: 'd' })[dir] : ({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' })[dir]);
  }
}
async function memory(page, rounds = 3) {
  await page.locator('.arcade-memory-board').waitFor(); await waitGo(page);
  for (let i = 0; i < rounds; i++) {
    await page.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor();
    const cells = await page.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
    await page.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
    if (i === 0) { await page.locator(`[data-cell="${cells[0]}"]`).click(); await page.locator(`[data-cell="${cells[0]}"]`).click(); }
    for (const cell of cells) await page.locator(`[data-cell="${cell}"]`).click();
    await page.waitForTimeout(300);
  }
}
const play = { computer_rush: computer, direction_rush: direction, memory_flash: memory };
const games = process.env.ARCADE_AUDIT_GAME ? [process.env.ARCADE_AUDIT_GAME] : Object.keys(play);
try {
  const sessions = await Promise.all(['a', 'b', 'c'].map(identity));
  const crossGameRooms = await Promise.all([
    sessions[0].request('/rooms', { gameType: 'computer_rush', mode: 'DUO' }),
    sessions[1].request('/rooms', { gameType: 'direction_rush', mode: 'DUO' }),
    sessions[2].request('/rooms', { gameType: 'memory_flash', mode: 'TRIO' }),
  ]);
  for (const [index, gameType] of ['computer_rush', 'direction_rush', 'memory_flash'].entries()) {
    const mode = index === 2 ? 'TRIO' : 'DUO';
    const filtered = await sessions[index].request(`/rooms?gameType=${gameType}&mode=${mode}`);
    assert.ok(filtered.rooms.some((room) => room.id === crossGameRooms[index].room.id));
    const otherType = ['computer_rush', 'direction_rush', 'memory_flash'].find((candidate) => candidate !== gameType);
    const isolated = await sessions[index].request(`/rooms?gameType=${otherType}&mode=${mode}`);
    assert.ok(!isolated.rooms.some((room) => room.id === crossGameRooms[index].room.id));
  }
  for (let i = 0; i < crossGameRooms.length; i++) await sessions[i].request(`/rooms/${crossGameRooms[i].room.id}/leave`, {});
  pass('Concurrent Computer, Direction and Memory rooms stay isolated by canonical game type');

  for (const game of games) {
    for (const mode of ['SOLO', 'DUO', 'TRIO']) {
      const count = { SOLO: 1, DUO: 2, TRIO: 3 }[mode];
      const players = sessions.slice(0, count), a = players[0];
      await Promise.all(players.map(async (p) => {
        await p.page.goto(web + '/games/arcade/' + game);
        await p.page.getByRole('button', { name: mode + ' ', exact: false }).click();
      }));
      const createStartedAt = Date.now();
      await a.page.getByRole('button', { name: mode === 'SOLO' ? 'Vào chơi ngay' : `Tạo phòng ${mode}` }).click();
      await a.page.waitForURL('**/room/**');
      const roomId = a.page.url().split('/').at(-1);
      if (mode !== 'SOLO') {
        await players[1].page.locator('.arcade-room-list button').filter({ hasText: 'Lan' }).first().waitFor({ state: 'visible', timeout: 3000 });
        const discoveryMs = Date.now() - createStartedAt;
        assert.ok(discoveryMs < 3000, `room list realtime refresh took ${discoveryMs}ms`);
        pass(`${game} ${mode}: room reaches another browser lobby in ${discoveryMs}ms`);
      }
      for (const p of players.slice(1)) {
        await p.page.locator('.arcade-room-list button').filter({ hasText: 'Lan' }).first().click();
        await p.page.waitForURL('**/room/**');
      }
      if (game === 'computer_rush' && mode === 'DUO') {
        await players[1].page.goto(`${web}/games/arcade/memory_flash/room/${roomId}`);
        await players[1].page.waitForURL(`**/games/arcade/${game}/room/${roomId}`, { timeout: 5000 });
        pass('Room route redirects to its canonical game type');
      }
      if (mode !== 'SOLO') {
        for (const p of players) await p.page.getByRole('button', { name: 'Tôi đã sẵn sàng' }).click();
        await a.page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
      }
      const snapshots = await Promise.all(players.map((p) => p.request('/rooms/' + roomId)));
      assert.equal(new Set(snapshots.map((s) => s.room.seed)).size, 1);
      assert.equal(new Set(snapshots.map((s) => s.room.startedAt)).size, 1);
      await Promise.all(players.map((p, i) => play[game](p.page, game === 'computer_rush' ? 5 - i : game === 'direction_rush' ? 55 - i * 10 : 3)));
      await a.page.screenshot({ path: path.join(output, `${game}-${mode.toLowerCase()}-1440.png`) });
      await Promise.all(players.map((p) => p.page.locator('.arcade-result').waitFor({ timeout: 20000 })));
      await a.page.waitForFunction(() => !document.querySelector('.arcade-result button')?.disabled);
      const results = await Promise.all(players.map((p) => p.request('/rooms/' + roomId)));
      const reference = results[0].players.map((p) => [p.userId, p.rank, p.result.score]);
      for (const r of results) assert.deepEqual(r.players.map((p) => [p.userId, p.rank, p.result.score]), reference);
      for (const r of results[0].players) assert.ok(r.result.correct > 0, `correct evidence for ${game} ${mode}`);
      if (game === 'direction_rush') assert.ok(results[0].players[0].result.correct >= 50);
      pass(`${game} ${mode}: real ${count}-context input, common seed/clock, identical final ranks`, reference);
      await a.page.locator('.arcade-result button').filter({ hasText: 'BXH' }).click();
      await a.page.locator('.arcade-leaderboard tbody tr').first().waitFor();
      pass(`${game} ${mode}: leaderboard and personal best`);
    }
  }
  for (const p of sessions) await p.context.close();
} catch (error) {
  report.errors.push(error.stack); console.error(error); process.exitCode = 1;
  for (const [i, context] of browser.contexts().entries()) for (const [j, page] of context.pages().entries()) await page.screenshot({ path: path.join(output, `failure-${i}-${j}.png`) }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
