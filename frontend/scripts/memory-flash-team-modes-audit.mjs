/**
 * Memory Flash — team modes + difficulty browser audit.
 *
 * Chạy thật trên Chromium:
 * - SOLO 60s: ghi lại level/size/reveal từng vòng để chứng minh curve tăng.
 * - 1V1 (2 context), 2V2 (4 context), 3V3 (6 context): lobby đội, ready,
 *   start, cùng pattern, team HUD, team result, rematch giữ đội.
 *
 * Yêu cầu server: API 5113, web 5283, DB đã migrate.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const api = 'http://127.0.0.1:5113';
const web = 'http://localhost:5283';
const out = path.resolve('../docs/audit/2026-10-22/memory-flash-team-modes');
await fs.mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const report = { startedAt: new Date().toISOString(), checks: [], solo: null, matches: [], errors: [], consoleErrors: [] };
const check = (name, evidence) => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS', name); };

async function session(suffix, viewport = { width: 430, height: 932 }) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const login = await context.request.post(api + '/api/auth/login', { data: { email: `mf-audit-${suffix}@audit.test`, password: 'MemoryAudit123!' } });
  assert.ok(login.ok(), `login ${suffix}: ${await login.text()}`);
  const auth = await login.json();
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(`${suffix}: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(`${suffix}: ${message.text()}`); });
  await page.goto(web + '/login');
  await page.evaluate((token) => localStorage.setItem('token', token), auth.accessToken);
  const req = async (route, data) => {
    const response = await context.request[data === undefined ? 'get' : 'post'](api + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(response.ok(), `${route}: ${await response.text()}`);
    return response.json();
  };
  const active = await req('/api/games/arcade/active');
  if (active) await req(`/api/games/arcade/rooms/${active.room.id}/leave`, {});
  return { suffix, context, page, auth, req };
}

async function installMemoryProbe(session) {
  await session.page.evaluate(() => {
    window.__mfPatterns = {};
    window.__mfRounds = {};
    const capture = () => {
      const board = document.querySelector('.arcade-memory-board[data-phase="FLASH"]');
      if (!board) return;
      const index = Number(document.querySelector('.arcade-world')?.dataset.attempts || 0);
      if (window.__mfPatterns[index]) return;
      window.__mfPatterns[index] = [...board.querySelectorAll('[data-cell-state="lit"]')].map((element) => element.dataset.cell);
      const heading = document.querySelector('.arcade-memory-heading > span')?.textContent || '';
      const small = document.querySelector('.arcade-memory-heading small')?.textContent || '';
      window.__mfRounds[index] = {
        index,
        level: Number(board.dataset.level || 0),
        size: Number(board.dataset.size || 0),
        targets: Number(board.dataset.targets || 0),
        revealSeconds: Number((small.match(/([\d.]+)\s*giây/) || [])[1]),
        heading,
        small,
      };
    };
    const observer = new MutationObserver(capture);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-phase', 'data-cell-state', 'class'] });
    window.__mfObserver = observer;
  });
}

async function playMemory(session) {
  const page = session.page;
  const deadline = Date.now() + 80000;
  while (Date.now() < deadline) {
    if (await page.locator('.arcade-result').count()) return;
    const state = await page.evaluate(() => {
      const board = document.querySelector('.arcade-memory-board');
      const index = Number(document.querySelector('.arcade-world')?.dataset.attempts || 0);
      return { phase: board?.dataset.phase || null, index, cells: window.__mfPatterns?.[index] || null };
    });
    if (state.phase === 'SELECT') {
      if (!state.cells) { await page.waitForTimeout(120); continue; }
      for (const cell of state.cells) await page.locator(`[data-cell="${cell}"]`).click({ force: true });
      await page.waitForTimeout(300);
      continue;
    }
    await page.waitForTimeout(80);
  }
  throw new Error(`${session.suffix}: memory loop timed out`);
}

async function playSolo() {
  const solo = await session('solo');
  const created = await solo.req('/api/games/arcade/rooms', { gameType: 'memory_flash', mode: 'SOLO' });
  assert.equal(created.room.mode, 'SOLO');
  assert.equal(created.room.rulesVersion, 3);
  await solo.page.goto(`${web}/games/arcade/memory_flash/room/${created.room.id}`);
  await solo.page.locator('.arcade-world').waitFor();
  await solo.page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 12000 });
  await installMemoryProbe(solo);
  await playMemory(solo);
  await solo.page.locator('.arcade-result').waitFor({ timeout: 15000 });
  const rounds = await solo.page.evaluate(() => window.__mfRounds);
  const list = Object.values(rounds).sort((a, b) => a.index - b.index);
  const state = await solo.req(`/api/games/arcade/rooms/${created.room.id}`);
  await solo.page.screenshot({ path: path.join(out, 'solo-result.png'), fullPage: true });
  report.solo = { roomId: created.room.id, rounds: list, result: state.players[0].result };

  assert.ok(list.length >= 12, `only ${list.length} rounds in 60s`);
  const last = list.at(-1);
  assert.ok(last.level >= 8, `solo only reached level ${last.level}`);
  const reveals = list.map((round) => round.revealSeconds);
  assert.ok(reveals[0] >= reveals.at(-1), 'reveal must shrink over the run');
  assert.ok(list.every((round, index) => index === 0 || round.level >= list[index - 1].level), `level regressed: ${list.map((round) => `${round.index}:L${round.level}`).join(' ')}`);
  assert.ok(state.room.status === 'FINISHED');
  assert.ok(state.players[0].result.correct >= 10, 'probe should answer most rounds');

  check('SOLO 60s reaches HARD/RUSH with shrinking reveal', { rounds: list.length, first: list[0], last, accuracy: state.players[0].result.accuracy });
  await solo.context.close();
}

async function match(mode, suffixes) {
  const group = [];
  for (const suffix of suffixes) group.push(await session(suffix));
  const host = group[0];
  const created = await host.req('/api/games/arcade/rooms', { gameType: 'memory_flash', mode });
  const id = created.room.id;
  assert.equal(created.room.mode, mode);
  for (const member of group.slice(1)) await member.req(`/api/games/arcade/rooms/${id}/join`, {});
  for (const member of group) {
    await member.page.goto(`${web}/games/arcade/memory_flash/room/${id}`);
    await member.page.locator('.arcade-lobby').waitFor();
  }

  const lobby = await group[0].req(`/api/games/arcade/rooms/${id}`);
  if (mode === '2V2' || mode === '3V3') {
    const expected = mode === '2V2' ? 2 : 3;
    assert.equal(lobby.teams.length, 2);
    assert.deepEqual(lobby.teams.map((team) => team.players.length), [expected, expected]);
    for (const member of group) {
      assert.equal(await member.page.locator('.arcade-team').count(), 2);
      assert.ok((await member.page.locator('.arcade-team').first().textContent()).includes('TEAM A'));
    }
    check(`${mode} lobby shows two teams with ${expected} players each`, { teams: lobby.teams.map((team) => ({ id: team.id, players: team.players.map((player) => player.name) })) });
  } else {
    assert.equal(await group[0].page.locator('.arcade-lobby-stage').count(), 1);
    check(`${mode} lobby has ${group.length} seats`, { capacity: lobby.room.capacity });
  }

  for (const member of group) await member.page.getByRole('button', { name: 'Tôi đã sẵn sàng', exact: true }).click();
  await host.page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  for (const member of group) {
    await member.page.locator('.arcade-world').waitFor({ timeout: 12000 });
    await member.page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 12000 });
    await installMemoryProbe(member);
  }
  if (mode === '2V2' || mode === '3V3') {
    for (const member of group) assert.equal(await member.page.locator('.arcade-team-hud').count(), 1);
    check(`${mode} compact team HUD is visible during play`, { hud: await host.page.locator('.arcade-team-hud').first().textContent() });
    await host.page.screenshot({ path: path.join(out, `${mode}-play.png`), fullPage: true });
  }

  await Promise.all(group.map((member) => playMemory(member)));
  await Promise.all(group.map((member) => member.page.locator('.arcade-result').waitFor({ timeout: 20000 })));

  // Cùng challenge: so pattern của các index mà mọi người đều đã thấy.
  const patterns = await Promise.all(group.map((member) => member.page.evaluate(() => window.__mfPatterns)));
  const shared = Object.keys(patterns[0]).filter((index) => patterns.every((set) => set[index]));
  assert.ok(shared.length >= 4, `only ${shared.length} shared rounds`);
  for (const index of shared) {
    const reference = patterns[0][index].slice().sort().join(',');
    for (let player = 1; player < patterns.length; player++) assert.equal(patterns[player][index].slice().sort().join(','), reference, `${mode} round ${index} differs for player ${player}`);
  }
  check(`${mode} all players received identical patterns`, { sharedRounds: shared.length, sample: patterns.map((set) => set[shared[0]]) });

  const done = await host.req(`/api/games/arcade/rooms/${id}`);
  assert.equal(done.room.status, 'FINISHED');
  assert.equal(done.players.length, group.length);
  if (mode === '2V2' || mode === '3V3') {
    assert.equal(await host.page.locator('.arcade-team-card').count(), 2);
    const resultText = await host.page.locator('.arcade-team-result').textContent();
    assert.ok(resultText.includes('ĐIỂM ĐỘI'));
    assert.ok(resultText.includes('TEAM A') && resultText.includes('TEAM B'));
    assert.equal(await host.page.locator('.arcade-team-formula').count(), 1);
    for (const player of done.players) {
      assert.ok(player.result.team === 'A' || player.result.team === 'B');
      assert.equal(typeof player.result.teamScore, 'number');
    }
    const teamA = done.teams.find((team) => team.id === 'A');
    const teamB = done.teams.find((team) => team.id === 'B');
    assert.equal(teamA.players.length, mode === '2V2' ? 2 : 3);
    assert.equal(teamB.players.length, mode === '2V2' ? 2 : 3);
    check(`${mode} team result screen and server team score`, { teamA: teamA.score, teamB: teamB.score, winner: teamA.score >= teamB.score ? 'A' : 'B' });
  } else {
    assert.equal(new Set(done.players.map((player) => player.result.rank)).size, 2);
    check('1V1 result has two distinct ranks', { ranks: done.players.map((player) => player.result.rank) });
  }
  await host.page.screenshot({ path: path.join(out, `${mode}-result.png`), fullPage: true });

  // Rematch: giữ mode + đội, seed mới.
  for (const member of group) await member.page.getByRole('button', { name: /Chơi lại|Vào ván tiếp theo/ }).click();
  await host.page.waitForURL((url) => url.pathname.includes('/room/') && !url.pathname.endsWith(id), { timeout: 15000 });
  const nextId = host.page.url().split('/').at(-1);
  let next = await host.req(`/api/games/arcade/rooms/${nextId}`);
  for (let attempt = 0; attempt < 30 && next.players.length < group.length; attempt++) {
    await host.page.waitForTimeout(300);
    next = await host.req(`/api/games/arcade/rooms/${nextId}`);
  }
  assert.equal(next.players.length, group.length, 'rematch room did not receive the whole group');
  assert.equal(next.room.mode, mode);
  assert.notEqual(next.room.seed, done.room.seed);
  if (mode === '2V2' || mode === '3V3') {
    for (const player of done.players) {
      const again = next.players.find((entry) => String(entry.userId) === String(player.userId));
      assert.equal(again.team, player.team);
    }
    check(`${mode} rematch keeps teams and issues a new seed`, { nextId, seedChanged: next.room.seed !== done.room.seed });
  } else {
    check(`${mode} rematch opens a new room with a new seed`, { nextId });
  }

  report.matches.push({ mode, roomId: id, nextId, players: done.players.map((player) => ({ name: player.name, team: player.team, score: player.result.score, correct: player.result.correct, accuracy: player.result.accuracy, teamScore: player.result.teamScore, teamWon: player.result.teamWon })), teams: done.teams.map((team) => ({ id: team.id, score: team.score })) });
  for (const member of group) await member.req(`/api/games/arcade/rooms/${nextId}/leave`, {});
  for (const member of group) await member.context.close();
}

try {
  await playSolo();
  await match('1V1', ['1', '2']);
  await match('2V2', ['3', '4', '5', '6']);
  await match('3V3', ['1', '2', '3', '4', '5', '6']);
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors.length, consoleErrors: report.consoleErrors.length }, null, 2));
} catch (error) {
  report.errors.push(error.message);
  await fs.writeFile(path.join(out, 'browser-results.json'), JSON.stringify(report, null, 2));
  console.error('FAIL', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
