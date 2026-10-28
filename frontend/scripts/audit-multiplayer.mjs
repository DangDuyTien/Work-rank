/**
 * Phase 7 — Shared room smoke: create → join → ready → start → leave.
 * Dùng 2 tài khoản thật, 2 browser context.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');
const report = { steps: [], consoleErrors: [], badResponses: [] };
const step = (name, data, ok = true) => { report.steps.push({ name, ok, data }); console.log(`${ok ? '✓' : '✗'} ${name}`, JSON.stringify(data).slice(0, 240)); };

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`);
  return res.json();
}

async function newPage(browser, token) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [token]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e.message).slice(0, 200)));
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push({ status: r.status(), url: r.url().slice(0, 160) }); });
  return { ctx, page };
}

(async () => {
  const host = await login('audit.admin@workrank.test', 'AuditPass!2026');
  const guest = await login('audit.member@workrank.test', 'AuditPass!2026');
  const browser = await chromium.launch({ headless: true });
  const A = await newPage(browser, host.accessToken);
  const B = await newPage(browser, guest.accessToken);

  // HOST: chọn 1V1 và tạo phòng
  await A.page.goto(`${WEB}/games/arcade/computer_rush`, { waitUntil: 'domcontentloaded' });
  await A.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await A.page.waitForTimeout(1200);
  await A.page.getByRole('button', { name: /Đấu 1 chọi 1/ }).first().click();
  await A.page.waitForTimeout(600);
  const createBtn = A.page.getByRole('button', { name: /Tạo phòng/ }).first();
  step('host select 1V1', { createLabel: (await createBtn.innerText()).replace(/\s+/g, ' ').trim() });
  await createBtn.click();
  await A.page.waitForTimeout(2500);
  const roomUrl = A.page.url();
  step('host created room', { url: roomUrl.replace(WEB, '') }, roomUrl.includes('/room/'));

  // GUEST: mở cùng game, chọn 1V1, join phòng trong danh sách
  await B.page.goto(`${WEB}/games/arcade/computer_rush`, { waitUntil: 'domcontentloaded' });
  await B.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await B.page.waitForTimeout(1500);
  await B.page.getByRole('button', { name: /Đấu 1 chọi 1/ }).first().click();
  await B.page.waitForTimeout(1800);
  const roomItem = B.page.locator('.arcade-room-list button').first();
  const listCount = await B.page.locator('.arcade-room-list button').count();
  step('guest sees room list', { listCount, text: (await roomItem.innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120) });
  if (listCount > 0) {
    await roomItem.click();
    await B.page.waitForTimeout(2500);
    step('guest joined', { url: B.page.url().replace(WEB, ''), sameRoom: B.page.url() === roomUrl });
  }

  // cả hai ready
  for (const [label, p] of [['host', A.page], ['guest', B.page]]) {
    const ready = p.getByRole('button', { name: /Tôi đã sẵn sàng/ }).first();
    if (await ready.isVisible().catch(() => false)) {
      await ready.click();
      await p.waitForTimeout(900);
      step(`${label} ready`, { pressed: await p.getByRole('button', { name: /Hủy sẵn sàng/ }).count() });
    } else {
      step(`${label} ready`, { found: false }, false);
    }
  }

  // host start
  const start = A.page.getByRole('button', { name: /^Bắt đầu$/ }).first();
  const startEnabled = await start.isEnabled().catch(() => false);
  step('host start enabled', { startEnabled });
  if (startEnabled) {
    await start.click();
    await A.page.waitForTimeout(4000);
    const aPlaying = await A.page.locator('.arcade-world').count();
    const bPlaying = await B.page.locator('.arcade-world').count();
    step('both playing', { host: aPlaying, guest: bPlaying }, aPlaying > 0 && bPlaying > 0);
    // chơi vài từ ở cả hai
    for (const p of [A.page, B.page]) {
      const input = p.locator('input[placeholder="Gõ để bắt đầu chuỗi…"]');
      for (let i = 0; i < 6; i += 1) {
        const word = await p.locator('[data-testid="challenge-word"]').getAttribute('aria-label').catch(() => null);
        if (word && await input.isVisible().catch(() => false)) await input.fill(word);
        await p.waitForTimeout(300);
      }
    }
    step('both submitted input', { hostScore: await A.page.locator('.arcade-hud, .arcade-score').first().innerText().catch(() => '').then((t) => t.replace(/\s+/g, ' ').slice(0, 80)) });
  }

  // leave
  const leave = A.page.getByRole('button', { name: /Rời phòng/ }).first();
  if (await leave.isVisible().catch(() => false)) {
    await leave.click();
    await A.page.waitForTimeout(1500);
    step('host left room', { url: A.page.url().replace(WEB, '') });
  }

  await A.ctx.close();
  await B.ctx.close();
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'multiplayer-smoke.json'), JSON.stringify(report, null, 2));
  console.log('bad', JSON.stringify(report.badResponses.slice(0, 8)));
})();
