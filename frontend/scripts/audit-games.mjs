/**
 * Phase 7 — Games audit: solo end-to-end cho 4 game arcade + Đua Gõ Chữ,
 * kiểm tra result / replay / BXH / history.
 *
 * Chạy: GAMES=computer_rush node scripts/audit-games.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');
const GAMES = (process.env.GAMES || 'computer_rush').split(',');

const report = { games: [], consoleErrors: [], badResponses: [] };

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  return res.json();
}

const DIR_KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };

async function playComputer(page, deadline) {
  let typed = 0;
  while (Date.now() < deadline) {
    const word = await page.locator('[data-testid="challenge-word"]').getAttribute('aria-label').catch(() => null);
    const input = page.locator('input[placeholder="Gõ để bắt đầu chuỗi…"]');
    if (word && await input.isVisible().catch(() => false)) {
      await input.fill(word);
      typed += 1;
    }
    await page.waitForTimeout(140);
  }
  return { typed };
}

async function playDirection(page, deadline) {
  let pressed = 0;
  while (Date.now() < deadline) {
    const dir = await page.locator('[data-testid="challenge-direction"]').getAttribute('data-expected').catch(() => null);
    if (dir) {
      const key = DIR_KEY[dir] || 'ArrowUp';
      await page.keyboard.press(key).catch(() => {});
      pressed += 1;
    }
    await page.waitForTimeout(320);
  }
  return { pressed };
}

async function playMemory(page, deadline) {
  let rounds = 0;
  while (Date.now() < deadline) {
    const phase = await page.locator('.arcade-memory-board').getAttribute('data-phase').catch(() => null);
    if (phase === 'FLASH') {
      const lit = await page.locator('.arcade-memory-tile.is-lit').evaluateAll((els) => els.map((e) => e.getAttribute('data-cell')));
      await page.waitForTimeout(50);
      if (lit.length) {
        // Chờ sang SELECT rồi chọn lại đúng ô đã sáng.
        await page.waitForFunction(() => document.querySelector('.arcade-memory-board')?.getAttribute('data-phase') === 'SELECT', { timeout: 6000 }).catch(() => {});
        for (const cell of lit) {
          await page.locator(`[data-cell="${cell}"]`).click({ timeout: 1500 }).catch(() => {});
        }
        rounds += 1;
      }
    }
    await page.waitForTimeout(180);
  }
  return { rounds };
}

async function runArcade(browser, auth, gameType) {
  const route = gameType === 'computer_rush' ? '/games/typing/words' : `/games/arcade/${gameType}`;
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await context.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await context.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push({ game: gameType, text: String(e.message).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({ game: gameType, text: m.text().slice(0, 300) }); });
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push({ game: gameType, status: r.status(), url: r.url().slice(0, 180) }); });

  const entry = { gameType, route, steps: [] };
  const step = (name, data, ok = true) => { entry.steps.push({ name, ok, data }); console.log(`${ok ? '✓' : '✗'} [${gameType}] ${name}`, JSON.stringify(data).slice(0, 220)); };

  await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  step('open menu', { h1: await page.locator('h1').first().innerText().catch(() => ''), url: page.url().replace(WEB, '') });

  // BXH + history mở/đóng
  await page.getByRole('button', { name: /BXH/ }).first().click();
  await page.waitForTimeout(1200);
  step('BXH panel', { rows: await page.locator('.arcade-leaderboard tbody tr').count(), empty: await page.locator('.arcade-empty').count() });
  await page.getByRole('button', { name: /BXH/ }).first().click();
  await page.waitForTimeout(500);

  const startBtn = page.getByRole('button', { name: /Vào chơi ngay/ }).first();
  if (!(await startBtn.isVisible().catch(() => false))) { step('start', { error: 'no start button' }, false); await context.close(); return entry; }
  await startBtn.click();
  await page.waitForTimeout(2500);
  step('room created', { url: page.url().replace(WEB, '') });

  // SOLO auto-starts sau 3.2s
  await page.waitForTimeout(4500);
  const playing = await page.locator('.arcade-world').count();
  step('playing surface', { arcadeWorld: playing, countdown: await page.locator('.arcade-countdown').count() });

  const t0 = Date.now();
  const deadline = t0 + 62000;
  let activity = {};
  if (gameType === 'computer_rush') activity = await playComputer(page, deadline);
  if (gameType === 'direction_rush') activity = await playDirection(page, deadline);
  if (gameType === 'memory_flash') activity = await playMemory(page, deadline);
  step('gameplay activity', activity);

  // chờ hết giờ + result
  await page.waitForSelector('.arcade-actions', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const resultText = await page.locator('.arcade-actions').locator('xpath=..').innerText().catch(() => '');
  const scoreText = await page.locator('.arcade-result, .arcade-actions').first().innerText().catch(() => '');
  step('result screen', { hasActions: await page.locator('.arcade-actions').count(), text: (resultText || scoreText).replace(/\s+/g, ' ').slice(0, 300) });
  await page.screenshot({ path: path.join(OUT, 'shots', `game-${gameType}-result.png`), fullPage: true }).catch(() => {});

  // replay
  const replayBtn = page.getByRole('button', { name: /Chơi lại|Vào ván tiếp theo/ }).first();
  if (await replayBtn.isVisible().catch(() => false)) {
    const before = page.url();
    await replayBtn.click();
    await page.waitForTimeout(3000);
    step('replay', { before: before.replace(WEB, ''), after: page.url().replace(WEB, ''), changed: page.url() !== before });
  } else {
    step('replay', { error: 'no replay button' }, false);
  }

  // leave
  const leave = page.getByRole('button', { name: /Rời phòng/ }).first();
  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
    await page.waitForTimeout(1200);
    step('leave room', { url: page.url().replace(WEB, '') });
  }
  await context.close();
  return entry;
}

async function runTyping(browser, auth) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await context.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await context.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push({ game: 'typing', text: String(e.message).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({ game: 'typing', text: m.text().slice(0, 300) }); });
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push({ game: 'typing', status: r.status(), url: r.url().slice(0, 180) }); });

  const entry = { gameType: 'typing_passage', route: '/games/typing/passage', steps: [] };
  const step = (name, data, ok = true) => { entry.steps.push({ name, ok, data }); console.log(`${ok ? '✓' : '✗'} [typing] ${name}`, JSON.stringify(data).slice(0, 220)); };

  await page.goto(WEB + '/games/typing/passage', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  step('open', { h1: await page.locator('h1').first().innerText().catch(() => '') });

  // BXH / Lịch sử trước khi vào phiên luyện
  await page.getByRole('button', { name: 'BXH', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1400);
  step('BXH tab', { bodyLen: await page.evaluate(() => document.body.innerText.length), hasTable: await page.locator('table').count() });
  await page.getByRole('button', { name: 'Lịch sử', exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(1200);
  step('history tab', { bodyLen: await page.evaluate(() => document.body.innerText.length) });

  await page.getByRole('button', { name: /Một mình/ }).first().click();
  await page.waitForTimeout(1500);
  const durationSelect = page.locator('select[aria-label="Thời lượng chơi một mình"]');
  if (await durationSelect.isVisible().catch(() => false)) {
    await durationSelect.selectOption('30');
    await page.waitForTimeout(2000);
  }
  step('duration 30s', { value: await durationSelect.inputValue().catch(() => 'n/a') });
  const input = page.locator('input[aria-label="Nội dung đang gõ"]');
  step('solo practice started', { inputVisible: await input.isVisible().catch(() => false) });
  if (!(await input.isVisible().catch(() => false))) { await context.close(); return entry; }

  // lấy nội dung đoạn văn từ DOM (các token trong .typing-passage)
  const passage = await page.evaluate(() => {
    const root = document.querySelector('.typing-passage');
    if (!root) return '';
    return [...root.querySelectorAll('[data-char-index]')].map((n) => n.textContent).join('');
  });
  step('passage loaded', { length: passage.length, sample: passage.slice(0, 80) });

  const target = passage.slice(0, Math.min(120, passage.length));
  await page.locator('.typing-passage').click({ position: { x: 20, y: 20 } }).catch(() => {});
  await page.keyboard.insertText(target);
  await page.waitForTimeout(1500);
  const progress = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/Ký tự\s+(\d+)\s*\/\s*(\d+)/);
    const pct = t.match(/(\d+)%\s*chính xác/);
    return { chars: m ? `${m[1]}/${m[2]}` : null, accuracy: pct ? pct[1] : null };
  });
  step('typed 120 chars', progress, Boolean(progress.chars && Number(progress.chars.split('/')[0]) > 0));

  // chờ hết 30s để có kết quả
  await page.waitForTimeout(31000);
  const result = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(-700));
  step('result after 30s', { text: result });
  await page.screenshot({ path: path.join(OUT, 'shots', 'game-typing-result.png'), fullPage: true }).catch(() => {});

  const again = page.getByRole('button', { name: /Bài mới|Chơi lại/ }).first();
  if (await again.isVisible().catch(() => false)) {
    await again.click();
    await page.waitForTimeout(1800);
    step('replay/new challenge', { chars: await page.evaluate(() => document.body.innerText.match(/Ký tự\s+(\d+)\s*\/\s*(\d+)/)?.[0] || null) });
  }
  await context.close();
  return entry;
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });
  for (const game of GAMES) {
    if (game === 'typing_passage') report.games.push(await runTyping(browser, auth));
    else report.games.push(await runArcade(browser, auth, game));
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  const file = path.join(OUT, `games-${GAMES.join('-')}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  console.log('wrote', file);
  console.log('bad responses', JSON.stringify(report.badResponses.slice(0, 10)));
})();
