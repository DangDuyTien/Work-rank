/**
 * Condensed game smoke — 5 game mở/start/tương tác/exit, không chơi hết ván.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5001';
const OUT = path.resolve('docs/audit/2026-10-24');
const report = { games: [], consoleErrors: [] };

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'audit.admin@workrank.test', password: 'AuditPass!2026' }) });
  return res.json();
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e.message).slice(0, 200)));

  const cases = [
    { id: 'typing', route: '/games/typing/passage', start: /Một mình/, surface: 'input[aria-label="Nội dung đang gõ"]' },
    { id: 'computer_rush', route: '/games/typing/words', start: /Vào chơi ngay/, surface: 'input[placeholder="Gõ để bắt đầu chuỗi…"]' },
    { id: 'direction_rush', route: '/games/arcade/direction_rush', start: /Vào chơi ngay/, surface: '.arcade-direction-arena' },
    { id: 'memory_flash', route: '/games/arcade/memory_flash', start: /Vào chơi ngay/, surface: '.arcade-memory-board' },
  ];

  for (const item of cases) {
    const errors = [];
    const onErr = (e) => errors.push(String(e.message).slice(0, 160));
    page.on('pageerror', onErr);
    await page.goto(WEB + item.route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    await page.getByRole('button', { name: item.start }).first().click();
    await page.waitForTimeout(item.id === 'typing' ? 2600 : 5200);
    const surface = await page.locator(item.surface).count();
    let interacted = false;
    if (item.id === 'computer_rush') {
      const word = await page.locator('[data-testid="challenge-word"]').getAttribute('aria-label').catch(() => null);
      if (word) { await page.locator(item.surface).fill(word); interacted = true; }
    } else if (item.id === 'direction_rush') {
      await page.keyboard.press('ArrowUp'); interacted = true;
    } else if (item.id === 'memory_flash') {
      await page.waitForTimeout(1200); interacted = surface > 0;
    } else {
      await page.locator('.typing-passage').click({ position: { x: 20, y: 20 } }).catch(() => {});
      await page.keyboard.insertText('đôi bàn tay'); interacted = true;
    }
    await page.waitForTimeout(700);
    const leave = page.getByRole('button', { name: /Rời phòng|Đổi chế độ gõ/ }).first();
    if (await leave.isVisible().catch(() => false)) await leave.click();
    await page.waitForTimeout(900);
    const ok = surface > 0 && interacted && errors.length === 0;
    report.games.push({ ...item, surface, interacted, ok, errors });
    console.log(`${ok ? '✓' : '✗'} ${item.id} surface=${surface} interacted=${interacted} errors=${errors.length}`);
    page.off('pageerror', onErr);
  }

  // Drawing: mở + vẽ 1 nét
  await page.goto(`${WEB}/games/drawing`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1600);
  const canvas = await page.locator('canvas').count();
  let painted = 0;
  if (canvas) {
    const box = await page.locator('canvas').boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.55, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(500);
    painted = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 400) if (d[i] > 0) n += 1;
      return n;
    });
  }
  report.games.push({ id: 'drawing', canvas, painted, ok: canvas > 0 && painted > 0 });
  console.log(`${canvas > 0 && painted > 0 ? '✓' : '✗'} drawing canvas=${canvas} painted=${painted}`);

  // Gallery
  await page.goto(`${WEB}/creative-corner`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const cards = await page.locator('.public-artwork-card').count();
  report.games.push({ id: 'gallery', cards, ok: cards > 0 });
  console.log(`${cards > 0 ? '✓' : '✗'} gallery cards=${cards}`);

  await browser.close();
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'regression-games.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.games.filter((g) => g.ok).length}/${report.games.length} game smoke OK`);
})();
