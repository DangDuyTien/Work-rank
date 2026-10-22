import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const browser = await chromium.launch();
const report = { checks: [], errors: [], startedAt: new Date().toISOString() };
const api = 'http://127.0.0.1:5109', web = 'http://127.0.0.1:5279';
const output = path.resolve('../docs/audit/2026-10-21/arcade');
try {
  await Promise.all(['computer_rush', 'direction_rush', 'memory_flash'].map(async (gameType, i) => {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    const auth = await context.request.post(api + '/api/auth/login', { data: { email: `arcade-${['a', 'b', 'c'][i]}@audit.test`, password: 'ArcadeAuditTest123!' } }).then((r) => r.json());
    const headers = { Authorization: `Bearer ${auth.accessToken}` };
    await context.addInitScript((token) => localStorage.setItem('token', token), auth.accessToken);
    const created = await context.request.post(api + '/api/games/arcade/rooms', { headers, data: { gameType, mode: 'SOLO' } }).then((r) => r.json());
    assert.equal(created.room.durationSeconds, 60);
    const page = await context.newPage(); page.on('pageerror', (e) => report.errors.push(e.message));
    await page.goto(`${web}/games/arcade/${gameType}/room/${created.room.id}`);
    await page.locator('.arcade-world').waitFor(); await page.locator('.arcade-countdown').waitFor({ state: 'hidden' });
    if (gameType === 'computer_rush') {
      for (let index = 0; index < 3; index++) {
        const word = await page.locator('[data-testid="challenge-word"]').textContent();
        await page.locator('#arcade-word-input').focus(); await page.keyboard.type(word.toLowerCase(), { delay: 70 }); await page.waitForTimeout(100);
      }
    } else if (gameType === 'direction_rush') {
      await page.locator('.arcade-direction-arena').focus();
      for (let index = 0; index < 3; index++) {
        await page.waitForTimeout(180);
        const d = await page.locator('[data-testid="challenge-direction"]').getAttribute('data-direction');
        await page.keyboard.press(({ UP: 'ArrowUp', DOWN: 'ArrowDown', LEFT: 'ArrowLeft', RIGHT: 'ArrowRight' })[d]);
      }
    } else {
      await page.locator('.arcade-memory-board[data-phase="FLASH"]').waitFor();
      const cells = await page.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
      await page.locator('.arcade-memory-board[data-phase="SELECT"]').waitFor();
      for (const cell of cells) await page.locator(`[data-cell="${cell}"]`).click();
    }
    await page.locator('.arcade-result').waitFor({ timeout: 70000 });
    const result = await context.request.get(`${api}/api/games/arcade/rooms/${created.room.id}`, { headers }).then((r) => r.json());
    assert.equal(result.room.status, 'FINISHED'); assert.ok(result.players[0].result.correct > 0);
    await page.screenshot({ path: path.join(output, `${gameType}-default-60s-result.png`) });
    report.checks.push({ gameType, status: 'PASS', durationSeconds: 60, result: result.players[0].result });
    console.log('PASS', gameType, 'default full 60s');
    await context.close();
  }));
} catch (e) { report.errors.push(e.stack); console.error(e); process.exitCode = 1; }
finally { report.finishedAt = new Date().toISOString(); await fs.writeFile(path.join(output, 'default-round-results.json'), JSON.stringify(report, null, 2)); await browser.close(); }
