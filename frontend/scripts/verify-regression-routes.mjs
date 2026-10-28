/**
 * Condensed regression — 25 route desktop, 1 lần mỗi route.
 * Không lặp lại audit sâu; chỉ bắt crash/blank/lỗi mạng nghiêm trọng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5001';
const OUT = path.resolve('docs/audit/2026-10-24');
const ROUTES = [
  '/dashboard', '/youtube', '/leaderboard', '/arena', '/grand', '/friends', '/games',
  '/games/typing', '/games/typing/passage', '/games/typing/words',
  '/games/arcade/direction_rush', '/games/arcade/memory_flash', '/games/drawing',
  '/creative-corner', '/users/1', '/settings',
  '/admin/kpi', '/admin/privileges', '/admin/teams-youtube', '/admin/competition/seasons',
  '/admin/competition/rules', '/admin/competition/grand', '/admin/operations',
  '/login', '/',
];
const report = { routes: [], errors: [] };

(async () => {
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'audit.admin@workrank.test', password: 'AuditPass!2026' }),
  }).then((r) => r.json());

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [login.accessToken]);
  const page = await ctx.newPage();

  for (const route of ROUTES) {
    const errors = [];
    const bad = [];
    const onError = (e) => errors.push(String(e.message).slice(0, 200));
    const onConsole = (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); };
    const onResponse = (r) => { if (r.status() >= 500) bad.push(`${r.status()} ${r.url().slice(0, 120)}`); };
    page.on('pageerror', onError);
    page.on('console', onConsole);
    page.on('response', onResponse);

    await page.goto(WEB + route, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch((e) => errors.push(String(e.message).slice(0, 200)));
    await page.waitForTimeout(1400);
    const info = await page.evaluate(() => ({
      h1: document.querySelector('h1')?.textContent.trim() || '',
      bodyLen: document.body.innerText.trim().length,
      crashed: document.body.innerText.includes('Không tải được giao diện'),
      url: location.pathname + location.search,
    }));
    const ok = info.bodyLen > 150 && !info.crashed && bad.length === 0;
    report.routes.push({ route, ok, ...info, errors: errors.slice(0, 4), bad });
    console.log(`${ok ? '✓' : '✗'} ${route} — ${info.h1.slice(0, 40)} (${info.bodyLen}) ${bad.length ? 'HTTP5xx' : ''}`);

    page.off('pageerror', onError);
    page.off('console', onConsole);
    page.off('response', onResponse);
  }

  await browser.close();
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'regression-routes.json'), JSON.stringify(report, null, 2));
  const failed = report.routes.filter((r) => !r.ok);
  console.log(`\n${report.routes.length - failed.length}/${report.routes.length} routes OK`);
})();
