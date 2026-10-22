import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const web = 'http://127.0.0.1:5277', api = 'http://127.0.0.1:5107';
const output = path.resolve('../docs/audit/2026-10-21/arcade');
const report = { checks: [], errors: [] };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const login = await context.request.post(api + '/api/auth/login', { data: { email: 'arcade-a@audit.test', password: 'ArcadeAuditTest123!' } });
const credential = await login.json();
await context.addInitScript((token) => localStorage.setItem('token', token), credential.accessToken);
const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
const post = async (route, data) => {
  const r = await context.request.post(api + '/api/games/arcade' + route, { data, headers: { Authorization: `Bearer ${credential.accessToken}` } });
  assert.ok(r.ok(), await r.text()); return r.json();
};
try {
  for (const gameType of ['computer_rush', 'direction_rush', 'memory_flash']) {
    const { room } = await post('/rooms', { gameType, mode: 'SOLO' });
    await page.goto(`${web}/games/arcade/${gameType}/room/${room.id}`);
    await page.locator('.arcade-world').waitFor();
    for (const width of [1920, 1440, 1280, 1024, 768, 430, 390]) {
      await page.setViewportSize({ width, height: width < 600 ? 844 : 1100 });
      const overflow = await page.locator('.arcade-page').evaluate((el) => el.scrollWidth - el.clientWidth);
      assert.ok(overflow <= 1, `${gameType} surface ${width}px overflow ${overflow}`);
      if (gameType === 'memory_flash') assert.equal(await page.locator('.arcade-decor-star').evaluate((el) => getComputedStyle(el).display), 'none');
      report.checks.push({ gameType, width, status: 'PASS', overflow });
      if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(output, `${gameType}-surface-${width}.png`) });
    }
    await post(`/rooms/${room.id}/leave`, {});
  }
  const { room } = await post('/rooms', { gameType: 'direction_rush', mode: 'SOLO' });
  await page.goto(`${web}/games/arcade/direction_rush/room/${room.id}`);
  await page.locator('.arcade-direction-arena').waitFor();
  await page.locator('.arcade-countdown').waitFor({ state: 'hidden' });
  await page.waitForTimeout(150);
  const button = page.locator('[data-testid="challenge-direction"]');
  const dir = await button.getAttribute('data-direction');
  const key = ({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' })[dir];
  await page.locator('.arcade-direction-arena').focus();
  await page.keyboard.down(key); await page.waitForTimeout(200); await page.keyboard.down(key); await page.keyboard.up(key);
  await page.waitForTimeout(1000);
  const state = await context.request.get(`${api}/api/games/arcade/rooms/${room.id}`, { headers: { Authorization: `Bearer ${credential.accessToken}` } }).then((r) => r.json());
  assert.equal(state.players[0].events.filter((e) => e.direction !== null).length, 1);
  report.checks.push({ name: 'Direction native key-repeat does not complete a second challenge', status: 'PASS' });
  await post(`/rooms/${room.id}/leave`, {});
} catch (e) { report.errors.push(e.stack); console.error(e); process.exitCode = 1; }
finally { await fs.writeFile(path.join(output, 'surface-results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
console.log(JSON.stringify({ checks: report.checks.length, errors: report.errors.length }));
