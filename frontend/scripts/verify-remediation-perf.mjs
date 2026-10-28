/**
 * Verify remediation — performance / network / responsive / a11y số lượng
 * (WR-AUDIT-004, 006, 007, 009, 011, 013, 020).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5001';
const OUT = path.resolve('docs/audit/2026-10-24');
const report = { checks: [] };
const log = (id, name, ok, detail) => {
  report.checks.push({ id, name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name} — ${JSON.stringify(detail).slice(0, 300)}`);
};

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'audit.admin@workrank.test', password: 'AuditPass!2026' }) });
  return res.json();
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });

  // ── 006/011 Teams YouTube ────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const t0 = Date.now();
    await page.goto(`${WEB}/admin/teams-youtube`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => {
      const sels = [...document.querySelectorAll('select')];
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const inputs = [...document.querySelectorAll('input,select,textarea')].filter(visible);
      const unlabeled = inputs.filter((i) => {
        if (i.getAttribute('aria-label') || i.getAttribute('placeholder')) return false;
        if (i.id && document.querySelector(`label[for="${i.id}"]`)) return false;
        return !i.closest('label');
      }).length;
      return {
        domNodes: document.querySelectorAll('*').length,
        options: sels.reduce((n, s) => n + s.options.length, 0),
        maxOptions: Math.max(0, ...sels.map((s) => s.options.length)),
        unlabeled,
        rows: document.querySelectorAll('tbody tr').length,
      };
    });
    const loadMs = Date.now() - t0;
    log('006', 'Teams YouTube DOM/options', metrics.domNodes < 8000 && metrics.options < 2000, { ...metrics, loadMs });
    log('011', 'Unlabeled controls', metrics.unlabeled === 0, { unlabeled: metrics.unlabeled });
    await page.screenshot({ path: path.join(OUT, 'shots', 'verify-teams-youtube.png'), fullPage: false }).catch(() => {});
    await ctx.close();
  }

  // ── 007 Seasons request storm + picker ───────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const counts = {};
    page.on('request', (req) => {
      const url = req.url();
      if (!url.includes('/api/')) return;
      const key = new URL(url).pathname;
      counts[key] = (counts[key] || 0) + 1;
    });
    await page.goto(`${WEB}/admin/competition/seasons`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const userCalls = counts['/api/users'] || 0;
    const optionInfo = await page.evaluate(() => {
      const sels = [...document.querySelectorAll('select')];
      return { selects: sels.length, maxOptions: Math.max(0, ...sels.map((s) => s.options.length)) };
    });
    await page.getByRole('button', { name: /Vinh Danh Trang Chủ/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
    const search = page.locator('input[aria-label*="MVP"], input[placeholder*="MVP"], input[placeholder*="thành viên"]').first();
    let searchWorked = false;
    let resultCount = 0;
    if (await search.isVisible().catch(() => false)) {
      await search.fill('Audit');
      await page.waitForTimeout(1400);
      resultCount = await page.locator('[role="option"]').count();
      searchWorked = resultCount > 0;
    }
    log('007', 'Seasons user loading', userCalls <= 1 && optionInfo.maxOptions < 100 && searchWorked,
      { userCalls, ...optionInfo, searchWorked, resultCount });
    await ctx.close();
  }

  // ── 009 Duplicate requests ───────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const count = {};
    page.on('request', (req) => {
      const url = req.url();
      if (!url.includes('/api/')) return;
      const key = new URL(url).pathname;
      count[key] = (count[key] || 0) + 1;
    });
    await page.goto(`${WEB}/leaderboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const lb = { friends: count['/api/friends'] || 0, requests: count['/api/friends/requests'] || 0, unread: count['/api/chats/unread-counts'] || 0, catalog: count['/api/games/catalog'] || 0 };
    const count2 = {};
    const page2 = await ctx.newPage();
    page2.on('request', (req) => {
      const url = req.url();
      if (!url.includes('/api/')) return;
      const key = new URL(url).pathname;
      count2[key] = (count2[key] || 0) + 1;
    });
    await page2.goto(`${WEB}/admin/kpi`, { waitUntil: 'domcontentloaded' });
    await page2.waitForTimeout(2200);
    const kpi = { departments: count2['/api/kpi/departments'] || 0, definitions: count2['/api/kpi/definitions'] || 0, periods: count2['/api/kpi/periods'] || 0, users: count2['/api/users'] || 0 };
    const ok = Object.values(lb).every((n) => n <= 1) && Object.values(kpi).every((n) => n <= 2);
    log('009', 'Duplicate requests', ok, { leaderboard: lb, adminKpi: kpi });
    await ctx.close();
  }

  // ── 013 Touch targets mobile ─────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const counts = {};
    for (const route of ['/games/drawing', '/creative-corner', '/dashboard']) {
      await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1300);
      counts[route] = await page.evaluate(() => {
        const els = [...document.querySelectorAll('button, a')].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 1 && r.height > 1 && el.offsetParent;
        });
        // Chỉ tính điều khiển icon (không có nhãn chữ) — link text inline được miễn trừ.
        return els.filter((el) => {
          const label = (el.innerText || '').trim();
          if (label) return false;
          const r = el.getBoundingClientRect();
          return r.width < 40 || r.height < 40;
        }).length;
      });
    }
    log('013', 'Small touch targets', Object.values(counts).every((n) => n === 0), counts);
    await ctx.close();
  }

  // ── 020 Polling + router warnings ───────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const warnings = [];
    page.on('console', (msg) => { if (msg.type() === 'warning' && /React Router Future Flag/.test(msg.text())) warnings.push(msg.text()); });
    let activeCalls = 0;
    page.on('request', (req) => { if (req.url().includes('/api/games/arcade/active')) activeCalls += 1; });
    await page.goto(`${WEB}/games/typing/words`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    activeCalls = 0;
    await page.waitForTimeout(10000);
    log('020', 'Idle polling + router warnings', activeCalls <= 3 && warnings.length === 0, { activeCallsIn10s: activeCalls, routerWarnings: warnings.length });
    await ctx.close();
  }

  // ── 004 responsive at 430/768/1440 ──────────────────────────────────────
  {
    const routes = ['/arena', '/grand', '/admin/operations', '/admin/competition/seasons', '/admin/competition/rules', '/admin/competition/grand'];
    const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, isMobile: true, hasTouch: true, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const results = [];
    for (const width of [430, 768, 1440]) {
      await page.setViewportSize({ width, height: width < 500 ? 932 : 900 });
      for (const route of routes) {
        await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(900);
        const info = await page.evaluate(() => ({
          vw: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          hero: (() => { const el = document.querySelector('.grand-hero-body, .arena-hero-body'); return el ? Math.round(el.getBoundingClientRect().width) : null; })(),
        }));
        results.push({ width, route, ok: info.scrollWidth <= info.vw + 2 && (!info.hero || info.hero <= info.vw), ...info });
      }
    }
    log('004b', 'Responsive 430/768/1440', results.every((r) => r.ok), results.filter((r) => !r.ok).slice(0, 4));
    await ctx.close();
  }

  await browser.close();
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'verification-perf.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.checks.filter((c) => c.ok).length}/${report.checks.length} checks passed`);
})();
