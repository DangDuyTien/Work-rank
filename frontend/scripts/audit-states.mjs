/**
 * Phase 11/12/13 — Empty state (user mới), Error state (API 500), Loading state (API chậm).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');
const report = { empty: [], error: [], loading: [], consoleErrors: [] };

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return res.json();
}

(async () => {
  const admin = await login('audit.admin@workrank.test', 'AuditPass!2026');
  const member = await login('audit.member@workrank.test', 'AuditPass!2026');
  const browser = await chromium.launch({ headless: true });

  // ── EMPTY STATE với user mới ────────────────────────────────────────────────
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [member.accessToken]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push({ where: 'empty', text: String(e.message).slice(0, 200) }));

  for (const route of ['/dashboard', '/leaderboard?scope=teams', '/arena', '/grand', '/friends', '/games', '/settings']) {
    await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        bodyLen: text.length,
        hasEmptyCopy: /chưa có|chưa đủ|chưa tham gia|chưa ghi nhận|chưa mở|trống|hãy |bắt đầu|chưa đăng ký|không có dữ liệu/i.test(text),
        hasZeroOnly: /^0$/.test(text.trim()),
        sample: text.replace(/\s+/g, ' ').slice(0, 220),
      };
    });
    report.empty.push({ route, ...info });
    console.log(`[empty] ${route} len=${info.bodyLen} emptyCopy=${info.hasEmptyCopy}`);
    await page.screenshot({ path: path.join(OUT, 'shots', `empty-${route.replace(/[^a-z0-9]+/gi, '_')}.png`), fullPage: false }).catch(() => {});
  }
  await ctx.close();

  // ── ERROR STATE: chặn API bằng 500 ────────────────────────────────────────
  const errCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await errCtx.addInitScript(([t]) => localStorage.setItem('token', t), [admin.accessToken]);
  const errPage = await errCtx.newPage();
  errPage.on('pageerror', (e) => report.consoleErrors.push({ where: 'error', text: String(e.message).slice(0, 200) }));

  const cases = [
    { route: '/dashboard', pattern: '**/api/dashboard/**' },
    { route: '/youtube', pattern: '**/api/youtube/**' },
    { route: '/leaderboard?scope=members', pattern: '**/api/rankings/**' },
    { route: '/admin/teams-youtube', pattern: '**/api/youtube/admin/**' },
    { route: '/games/typing/words', pattern: '**/api/games/arcade/**' },
  ];
  for (const c of cases) {
    await errPage.route(c.pattern, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'Audit simulated failure' }) }));
    await errPage.goto(WEB + c.route, { waitUntil: 'domcontentloaded' });
    await errPage.waitForTimeout(2600);
    const info = await errPage.evaluate(() => {
      const text = document.body.innerText;
      return {
        bodyLen: text.length,
        hasErrorCopy: /không tải|lỗi|thử lại|không thể|đã xảy ra/i.test(text),
        hasRetryButton: [...document.querySelectorAll('button')].some((b) => /thử lại|tải lại/i.test(b.innerText)),
        blank: text.trim().length < 120,
        sample: text.replace(/\s+/g, ' ').slice(0, 260),
      };
    });
    report.error.push({ ...c, ...info });
    console.log(`[error] ${c.route} len=${info.bodyLen} errorCopy=${info.hasErrorCopy} retry=${info.hasRetryButton} blank=${info.blank}`);
    await errPage.screenshot({ path: path.join(OUT, 'shots', `error-${c.route.replace(/[^a-z0-9]+/gi, '_')}.png`), fullPage: false }).catch(() => {});
    await errPage.unroute(c.pattern);
  }
  await errCtx.close();

  // ── LOADING STATE: delay 3s ───────────────────────────────────────────────
  for (const c of [{ route: '/dashboard', pattern: '**/api/dashboard/**' }, { route: '/youtube', pattern: '**/api/youtube/**' }]) {
    const loadCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await loadCtx.addInitScript(([t]) => localStorage.setItem('token', t), [admin.accessToken]);
    const loadPage = await loadCtx.newPage();
    await loadPage.route(c.pattern, async (route) => { await new Promise((r) => setTimeout(r, 3000)); await route.continue().catch(() => {}); });
    await loadPage.goto(WEB + c.route, { waitUntil: 'domcontentloaded' });
    await loadPage.waitForTimeout(700);
    const info = await loadPage.evaluate(() => ({
      hasSkeleton: document.querySelectorAll('[class*="skeleton"], [class*="loading"], .ui-spinner').length,
      hasSpinner: document.querySelectorAll('.ui-spinner').length,
      bodyLen: document.body.innerText.length,
      blank: document.body.innerText.trim().length < 100,
      sample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
    }));
    report.loading.push({ ...c, ...info });
    console.log(`[loading] ${c.route} skeleton=${info.hasSkeleton} blank=${info.blank} len=${info.bodyLen}`);
    await loadPage.screenshot({ path: path.join(OUT, 'shots', `loading-${c.route.replace(/[^a-z0-9]+/gi, '_')}.png`), fullPage: false }).catch(() => {});
    await loadPage.waitForTimeout(2800);
    await loadCtx.close();
  }
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'states.json'), JSON.stringify(report, null, 2));
})();
