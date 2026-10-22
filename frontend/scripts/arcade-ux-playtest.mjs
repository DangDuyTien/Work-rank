import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const phase = process.env.UX_PHASE || 'baseline';
const web = process.env.UX_WEB || 'http://127.0.0.1:5277';
const api = process.env.UX_API || 'http://127.0.0.1:5107';
const output = path.resolve(process.env.UX_OUTPUT || `../docs/audit/2026-10-21/arcade-ux/${phase}`);
await fs.mkdir(output, { recursive: true });
const report = { phase, startedAt: new Date().toISOString(), checks: [], observations: [], errors: [] };
const browser = await chromium.launch({ headless: true });
const games = ['computer_rush', 'direction_rush', 'memory_flash'].filter((g) => !process.env.UX_GAME || g === process.env.UX_GAME);
const keys = { UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' };

async function identity(suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const response = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${suffix}@audit.test`, password: 'ArcadeAuditTest123!' } });
  assert.ok(response.ok()); const auth = await response.json();
  await context.addInitScript((token) => localStorage.setItem('token', token), auth.accessToken);
  const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
  const request = async (route, data) => {
    const r = await context.request[data === undefined ? 'get' : 'post'](api + '/api/games/arcade' + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(r.ok(), `${route}: ${await r.text()}`); return r.json();
  };
  const active = await request('/active'); if (active) await request(`/rooms/${active.room.id}/leave`, {});
  return { context, page, request, userId: auth.user.id };
}
async function shot(page, game, mode, name) { await page.screenshot({ path: path.join(output, `${game}-${mode}-${name}.png`) }); }
async function word(page, wrong = false) {
  const input = page.locator('#arcade-word-input'); await input.focus();
  await page.waitForTimeout(180);
  await page.locator('.arcade-word-wrap[data-transition="complete"]').waitFor({ state: 'hidden' });
  if (wrong) { await page.keyboard.type('xyz', { delay: 70 }); await page.keyboard.press('Enter'); }
  else { const target = await page.getByTestId('challenge-word').textContent(); await page.keyboard.type(target.toLowerCase(), { delay: 70 }); }
}
async function direction(page, wrong = false) {
  const prompt = page.getByTestId('challenge-direction');
  const expected = await prompt.getAttribute('data-expected') || await prompt.getAttribute('data-direction');
  await page.locator('.arcade-direction-arena').focus(); await page.waitForTimeout(220);
  await page.keyboard.press(keys[wrong ? Object.keys(keys).find((d) => d !== expected) : expected]);
}
async function memory(page, wrong = false, capture) {
  await page.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor({ timeout: 12000 });
  const target = await page.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
  if (capture) await capture('memorize');
  const all = await page.locator('.arcade-memory-tile').evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
  await page.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
  const cells = wrong ? [all.find((c) => !target.includes(c)), ...target.slice(1)] : target;
  for (const cell of cells) await page.locator(`[data-cell="${cell}"]`).click({ force: true });
  if (capture) await capture('selection');
  await page.waitForTimeout(250);
}
async function play(game, players, mode) {
  const a = players[0];
  const created = await a.request('/rooms', { gameType: game, mode });
  const id = created.room.id;
  if (mode !== 'SOLO') {
    for (const p of players.slice(1)) await p.request(`/rooms/${id}/join`, {});
    for (const p of players) await p.request(`/rooms/${id}/ready`, { ready: true });
  }
  await Promise.all(players.map((p) => p.page.goto(`${web}/games/arcade/${game}/room/${id}`)));
  if (mode !== 'SOLO') { await a.page.locator('.arcade-lobby').waitFor(); await shot(a.page, game, mode, 'lobby'); await a.request(`/rooms/${id}/start`, {}); }
  await Promise.all(players.map(async (p) => { await p.page.locator('.arcade-world').waitFor(); await p.page.locator('.arcade-countdown').waitFor({ state: 'hidden' }); }));
  await Promise.all(players.map(async (p, i) => {
    const capture = i === 0 ? (name) => shot(p.page, game, mode, name) : null;
    if (game === 'computer_rush') {
      await word(p.page, true); if (capture) await capture('wrong');
      await word(p.page); if (capture) await capture('correct');
      for (let n = 0; n < 4 - i; n++) await word(p.page);
    } else if (game === 'direction_rush') {
      if (phase === 'iteration2') assert.equal(await p.page.locator('.arcade-arrow-object').evaluate((e) => getComputedStyle(e).transform), 'none');
      await direction(p.page, true); if (capture) await capture('wrong');
      for (let n = 0; n < 10 - i * 2; n++) await direction(p.page);
      if (capture) await capture('correct');
      if (phase !== 'baseline') {
        const trickAt = new Date(created.room.startedAt || (await p.request(`/rooms/${id}`)).room.startedAt).getTime() + created.room.durationSeconds * 1000 * .69;
        const wait = Math.max(0, trickAt - Date.now()); if (wait) await p.page.waitForTimeout(wait);
        await direction(p.page); await p.page.waitForTimeout(800); await direction(p.page);
        if (capture) await capture('trick');
      }
    } else {
      await memory(p.page, true, capture);
      if (phase === 'iteration2') for (const state of ['correct', 'incorrect', 'missed']) assert.ok(await p.page.locator(`[data-cell-state="${state}"]`).count(), `Missing Memory ${state}`);
      if (capture) await capture('wrong');
      await memory(p.page); await memory(p.page);
    }
    if (i === 0) {
      await p.page.setViewportSize({ width: 390, height: 844 });
      if (game === 'computer_rush') await word(p.page);
      else if (game === 'direction_rush') { const expected = await p.page.getByTestId('challenge-direction').getAttribute('data-expected') || await p.page.getByTestId('challenge-direction').getAttribute('data-direction'); await p.page.getByRole('button', { name: `Đi ${expected}`, exact: true }).click(); }
      await shot(p.page, game, mode, 'mobile'); await p.page.setViewportSize({ width: 1440, height: 1000 });
      await shot(p.page, game, mode, 'gameplay');
    }
  }));
  await Promise.all(players.map((p) => p.page.locator('.arcade-result').waitFor({ timeout: 35000 })));
  await a.page.waitForFunction(() => !document.querySelector('.arcade-result button')?.disabled);
  await shot(a.page, game, mode, 'result');
  const states = await Promise.all(players.map((p) => p.request(`/rooms/${id}`)));
  const ranks = states[0].players.map((p) => [p.userId, p.rank, p.result.score]);
  for (const state of states) assert.deepEqual(state.players.map((p) => [p.userId, p.rank, p.result.score]), ranks);
  const wrongText = await a.page.locator('.arcade-result').innerText();
  report.checks.push({ game, mode, status: 'PASS', roomId: id, ranks, result: states[0].players[0].result, resultText: wrongText });
  if (['iteration2', 'iteration3', 'final'].includes(phase)) {
    await Promise.all(players.map((p) => p.page.locator('.arcade-result').getByRole('button', { name: /Chơi lại|Vào ván tiếp theo/ }).click()));
    await Promise.all(players.map((p) => p.page.waitForURL((url) => url.pathname.includes('/room/') && !url.pathname.endsWith(id))));
    const nextIds = players.map((p) => p.page.url().split('/').at(-1));
    assert.equal(new Set(nextIds).size, 1, 'Party split on replay');
    const next = await a.request(`/rooms/${nextIds[0]}`);
    assert.equal(next.room.mode, mode); assert.equal(next.room.difficulty, created.room.difficulty);
    assert.equal(next.players.length, players.length); assert.notEqual(next.room.seed, created.room.seed);
    await a.page.locator(mode === 'SOLO' ? '.arcade-world' : '.arcade-lobby').waitFor();
    await shot(a.page, game, mode, 'quick-replay');
    report.checks.push({ game, mode, quickReplay: 'PASS', oldRoom: id, newRoom: next.room.id, sharedParty: nextIds, freshChallenge: true, resultPersonalBest: states[0].players[0].result.personalBestScore });
    for (const p of players) await p.request(`/rooms/${next.room.id}/leave`, {});
  }
  console.log('PLAYED', phase, game, mode);
}
try {
  const sessions = await Promise.all(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map(identity));
  if (process.env.UX_TRIO_ONLY !== '1') await Promise.all(games.map((g, i) => play(g, [sessions[i * 3]], 'SOLO')));
  if (process.env.UX_TRIO_ONLY !== '1' && process.env.UX_ALL_MODES === '1') await Promise.all(games.map((g, i) => play(g, sessions.slice(i * 3, i * 3 + 2), 'DUO')));
  if (process.env.UX_SOLO_ONLY !== '1') await Promise.all(games.map((g, i) => play(g, sessions.slice(i * 3, i * 3 + 3), 'TRIO')));
} catch (e) {
  report.errors.push(e.stack); console.error(e); process.exitCode = 1;
  for (const [i, c] of browser.contexts().entries()) for (const p of c.pages()) await p.screenshot({ path: path.join(output, `failure-${i}.png`) }).catch(() => {});
} finally {
  report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'gameplay-results.json'), JSON.stringify(report, null, 2)); await browser.close();
}
