/**
 * Phase 16 — Permission / Auth / IDOR.
 * Dùng token member thật để gọi các endpoint nhạy cảm; kiểm tra route guard trên browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');
const report = { api: [], routes: [], consoleErrors: [] };

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return { status: res.status, body: await res.json() };
}

async function call(token, method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* ignore */ }
  return { status: res.status, body: json };
}

(async () => {
  const admin = await login('audit.admin@workrank.test', 'AuditPass!2026');
  const member = await login('audit.member@workrank.test', 'AuditPass!2026');
  const m = member.body.accessToken;
  const a = admin.body.accessToken;
  const memberId = member.body.user.id;
  const adminId = admin.body.user.id;

  const checks = [
    ['member đọc danh sách user (được phép)', () => call(m, 'GET', '/api/users?limit=2'), [200]],
    ['member sửa hồ sơ người khác', () => call(m, 'PATCH', `/api/users/${adminId}`, { name: 'Hacked' }), [403]],
    ['member tự nâng role=admin', () => call(m, 'PATCH', `/api/users/${memberId}`, { role: 'admin' }), [403]],
    ['member tự cấp isVerified', () => call(m, 'PATCH', `/api/users/${memberId}`, { isVerified: true }), [403]],
    ['member tự đổi teamId', () => call(m, 'PATCH', `/api/users/${memberId}`, { teamId: 1 }), [403]],
    ['member xóa user khác', () => call(m, 'DELETE', `/api/users/${adminId}`), [403]],
    ['member xóa tranh của người khác', () => call(m, 'DELETE', '/api/drawings/1'), [403, 404]],
    ['member đọc KPI admin', () => call(m, 'GET', '/api/kpi/departments'), [403]],
    ['member đọc audit log', () => call(m, 'GET', '/api/users/admin/recognitions/audit-logs'), [403]],
    ['member đổi cài đặt drawing', () => call(m, 'PATCH', '/api/drawings/settings', { homeVisible: false }), [403]],
    ['member tạo nhân sự', () => call(m, 'POST', '/api/users', { name: 'X', email: 'x@x.test' }), [403]],
    ['member xem storage status', () => call(m, 'GET', '/api/drawings/storage/status'), [403]],
    ['admin đọc KPI', () => call(a, 'GET', '/api/kpi/departments'), [200]],
  ];

  for (const [name, fn, expected] of checks) {
    const res = await fn();
    const ok = expected.includes(res.status);
    report.api.push({ name, status: res.status, expected, ok, message: res.body?.message || res.body?.success });
    console.log(`${ok ? '✓' : '✗'} ${name} → ${res.status} (expected ${expected.join('/')})`);
  }

  // route guard trên browser
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [m]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push(String(e.message).slice(0, 200)));
  for (const route of ['/admin/kpi', '/admin/privileges', '/admin/teams-youtube', '/admin/competition/seasons', '/admin/competition/rules', '/admin/competition/grand', '/admin/operations']) {
    await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const info = { route, finalUrl: page.url().replace(WEB, ''), redirected: !page.url().includes(route), bodyLen: await page.evaluate(() => document.body.innerText.length) };
    report.routes.push(info);
    console.log(`${info.redirected ? '✓' : '✗'} member ${route} → ${info.finalUrl}`);
  }
  await browser.close();

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'security.json'), JSON.stringify(report, null, 2));
})();
