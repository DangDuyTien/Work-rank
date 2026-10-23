/**
 * Đo HUD đội 3V3 trên mobile: hai đội phải nằm cạnh nhau, không đẩy board
 * xuống quá xa. Không chơi hết trận; chỉ mở phòng, start rồi đo.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const api = 'http://127.0.0.1:5113';
const web = 'http://localhost:5283';
const out = path.resolve('../docs/audit/2026-10-22/memory-flash-team-modes');
const browser = await chromium.launch({ args: ['--no-proxy-server'] });
const report = { measurements: [] };

async function apiSession(suffix) {
  const context = await browser.newContext();
  const login = await context.request.post(api + '/api/auth/login', { data: { email: `mf-audit-${suffix}@audit.test`, password: 'MemoryAudit123!' } });
  assert.ok(login.ok());
  const auth = await login.json();
  const req = async (route, data) => {
    const response = await context.request[data === undefined ? 'get' : 'post'](api + route, { headers: { Authorization: `Bearer ${auth.accessToken}` }, ...(data === undefined ? {} : { data }) });
    assert.ok(response.ok(), `${route}: ${await response.text()}`);
    return response.json();
  };
  const active = await req('/api/games/arcade/active');
  if (active) await req(`/api/games/arcade/rooms/${active.room.id}/leave`, {});
  return { context, auth, req };
}

try {
  const sessions = [];
  for (const suffix of ['1', '2', '3', '4', '5', '6']) sessions.push(await apiSession(suffix));
  const created = await sessions[0].req('/api/games/arcade/rooms', { gameType: 'memory_flash', mode: '3V3' });
  for (const member of sessions.slice(1)) await member.req(`/api/games/arcade/rooms/${created.room.id}/join`, {});
  for (const member of sessions) await member.req(`/api/games/arcade/rooms/${created.room.id}/ready`, { ready: true });
  await sessions[0].req(`/api/games/arcade/rooms/${created.room.id}/start`, {});

  const page = await sessions[0].context.newPage();
  await page.goto(web + '/login');
  await page.evaluate((token) => localStorage.setItem('token', token), sessions[0].auth.accessToken);
  await page.goto(`${web}/games/arcade/memory_flash/room/${created.room.id}`);
  await page.locator('.arcade-team-hud').waitFor({ timeout: 12000 });
  await page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 12000 });

  for (const width of [430, 390]) {
    await page.setViewportSize({ width, height: 932 });
    await page.waitForTimeout(250);
    const measurement = await page.evaluate(() => {
      const hud = document.querySelector('.arcade-team-hud');
      const board = document.querySelector('.arcade-memory-board');
      const sides = [...hud.querySelectorAll('.arcade-team-hud-side')];
      return {
        viewport: window.innerWidth,
        hudHeight: Math.round(hud.getBoundingClientRect().height),
        columns: getComputedStyle(hud).gridTemplateColumns.split(' ').length,
        sideTops: sides.map((side) => Math.round(side.getBoundingClientRect().top)),
        boardTop: Math.round(board.getBoundingClientRect().top),
        scrollY: Math.round(window.scrollY),
      };
    });
    assert.equal(measurement.columns, 2, `team HUD must stay 2 columns at ${width}`);
    assert.equal(measurement.sideTops[0], measurement.sideTops[1], `teams stacked at ${width}`);
    assert.ok(measurement.hudHeight <= 110, `team HUD ${measurement.hudHeight}px is too tall at ${width}`);
    report.measurements.push(measurement);
    console.log('PASS', `3V3 HUD compact at ${width}px`, measurement);
    await page.screenshot({ path: path.join(out, `3v3-hud-${width}.png`), fullPage: true });
  }

  await fs.writeFile(path.join(out, 'team-hud-results.json'), JSON.stringify(report, null, 2));
  for (const member of sessions) await member.req(`/api/games/arcade/rooms/${created.room.id}/leave`, {});
  for (const member of sessions) await member.context.close();
} catch (error) {
  report.error = error.message;
  await fs.writeFile(path.join(out, 'team-hud-results.json'), JSON.stringify(report, null, 2));
  console.error('FAIL', error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
