/**
 * Memory Flash — mobile hard-mode + desktop team lobby evidence.
 *
 * 1. Chơi SOLO tới khi bảng lên 5×5, đo tile ở 390px và 430px:
 *    tile >= 44px, board không tràn ngang.
 * 2. Mở lobby 2V2 ở desktop 1280×800 để chụp hai cột đội.
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
const report = { measurements: [], checks: [] };

async function session(suffix, viewport) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: viewport.width < 700, deviceScaleFactor: 1 });
  const login = await context.request.post(api + '/api/auth/login', { data: { email: `mf-audit-${suffix}@audit.test`, password: 'MemoryAudit123!' } });
  assert.ok(login.ok());
  const auth = await login.json();
  const page = await context.newPage();
  await page.goto(web + '/login');
  await page.evaluate((token) => localStorage.setItem('token', token), auth.accessToken);
  const req = async (route, data) => {
    const response = await context.request[data === undefined ? 'get' : 'post'](api + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(response.ok(), `${route}: ${await response.text()}`);
    return response.json();
  };
  const active = await req('/api/games/arcade/active');
  if (active) await req(`/api/games/arcade/rooms/${active.room.id}/leave`, {});
  return { context, page, req, auth };
}

try {
  const solo = await session('solo', { width: 430, height: 932 });
  const created = await solo.req('/api/games/arcade/rooms', { gameType: 'memory_flash', mode: 'SOLO' });
  await solo.page.goto(`${web}/games/arcade/memory_flash/room/${created.room.id}`);
  await solo.page.locator('.arcade-world').waitFor();
  await solo.page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 12000 });
  await solo.page.evaluate(() => {
    window.__mfPatterns = {};
    const capture = () => {
      const board = document.querySelector('.arcade-memory-board[data-phase="FLASH"]');
      if (!board) return;
      const index = Number(document.querySelector('.arcade-world')?.dataset.attempts || 0);
      if (!window.__mfPatterns[index]) window.__mfPatterns[index] = [...board.querySelectorAll('[data-cell-state="lit"]')].map((element) => element.dataset.cell);
    };
    new MutationObserver(capture).observe(document.body, { subtree: true, childList: true, attributes: true });
  });

  const deadline = Date.now() + 60000;
  let size = 0;
  while (Date.now() < deadline && size < 5) {
    const state = await solo.page.evaluate(() => {
      const board = document.querySelector('.arcade-memory-board');
      const index = Number(document.querySelector('.arcade-world')?.dataset.attempts || 0);
      return { size: Number(board?.dataset.size || 0), phase: board?.dataset.phase || null, cells: window.__mfPatterns?.[index] || null };
    });
    size = state.size;
    if (state.phase === 'SELECT' && state.cells) {
      for (const cell of state.cells) await solo.page.locator(`[data-cell="${cell}"]`).click({ force: true });
      await solo.page.waitForTimeout(300);
    } else await solo.page.waitForTimeout(70);
  }
  assert.equal(size, 5, 'solo did not reach a 5x5 board in time');

  for (const width of [430, 390]) {
    await solo.page.setViewportSize({ width, height: 932 });
    await solo.page.waitForTimeout(250);
    const measurement = await solo.page.evaluate(() => {
      const board = document.querySelector('.arcade-memory-board');
      const tile = board.querySelector('.arcade-memory-tile');
      const rect = tile.getBoundingClientRect();
      return {
        boardWidth: Math.round(board.getBoundingClientRect().width),
        boardScrollWidth: board.scrollWidth,
        boardClientWidth: board.clientWidth,
        tileWidth: Math.round(rect.width * 10) / 10,
        tileHeight: Math.round(rect.height * 10) / 10,
        viewport: window.innerWidth,
        columns: getComputedStyle(board).gridTemplateColumns.split(' ').length,
      };
    });
    assert.ok(measurement.tileWidth >= 44, `tile ${measurement.tileWidth}px < 44px at ${width}`);
    assert.ok(measurement.tileHeight >= 44, `tile ${measurement.tileHeight}px < 44px at ${width}`);
    assert.ok(measurement.boardScrollWidth <= measurement.boardClientWidth + 1, `board overflows at ${width}`);
    assert.equal(measurement.columns, 5);
    report.measurements.push(measurement);
    await solo.page.screenshot({ path: path.join(out, `mobile-${width}-5x5.png`), fullPage: true });
    report.checks.push({ name: `5x5 usable at ${width}px`, status: 'PASS', measurement });
    console.log('PASS', `5x5 usable at ${width}px`, measurement);
  }
  await solo.req(`/api/games/arcade/rooms/${created.room.id}/leave`, {});
  await solo.context.close();

  // Desktop 2V2 lobby with two teams.
  const desktop = await session('3', { width: 1280, height: 900 });
  const host2 = await session('4', { width: 1280, height: 900 });
  const room = await desktop.req('/api/games/arcade/rooms', { gameType: 'memory_flash', mode: '2V2' });
  await host2.req(`/api/games/arcade/rooms/${room.room.id}/join`, {});
  await desktop.page.goto(`${web}/games/arcade/memory_flash/room/${room.room.id}`);
  await desktop.page.locator('.arcade-team').first().waitFor();
  assert.equal(await desktop.page.locator('.arcade-team').count(), 2);
  const lobbyText = await desktop.page.locator('.arcade-teams').textContent();
  assert.ok(lobbyText.includes('TEAM A') && lobbyText.includes('TEAM B'));
  await desktop.page.screenshot({ path: path.join(out, 'desktop-2v2-lobby.png'), fullPage: true });
  report.checks.push({ name: 'desktop 2V2 lobby shows two teams', status: 'PASS' });
  console.log('PASS desktop 2V2 lobby shows two teams');
  await desktop.req(`/api/games/arcade/rooms/${room.room.id}/leave`, {});
  await host2.req(`/api/games/arcade/rooms/${room.room.id}/leave`, {});
  await desktop.context.close();
  await host2.context.close();

  await fs.writeFile(path.join(out, 'mobile-results.json'), JSON.stringify(report, null, 2));
} catch (error) {
  report.error = error.message;
  await fs.writeFile(path.join(out, 'mobile-results.json'), JSON.stringify(report, null, 2));
  console.error('FAIL', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
