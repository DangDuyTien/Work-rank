/**
 * Full sidebar product audit — route crawler.
 *
 * Mở từng route bằng browser thật (Chromium), ghi lại:
 * console, pageerror, network 4xx/5xx, request trùng, overflow, screenshot,
 * thời gian load, refresh, deep-link, mobile.
 *
 * Chỉ đọc / quan sát. Không thao tác phá huỷ.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');
const ONLY = process.env.ONLY_ROUTES ? new Set(process.env.ONLY_ROUTES.split(',')) : null;

const ROUTES = [
  { id: 'dashboard', label: 'Tổng quan', route: '/dashboard' },
  { id: 'youtube', label: 'Số liệu YouTube', route: '/youtube' },
  { id: 'leaderboard', label: 'Bảng xếp hạng', route: '/leaderboard' },
  { id: 'arena', label: 'Đấu Trường Mùa Giải', route: '/arena' },
  { id: 'grand', label: 'Giải Vô Địch Năm', route: '/grand' },
  { id: 'friends', label: 'Cộng tác — Thành Viên & Đội Nhóm', route: '/friends' },
  { id: 'games', label: 'Trò Chơi — Trung tâm', route: '/games' },
  { id: 'typing-hub', label: 'Đua Gõ Chữ — Hub', route: '/games/typing' },
  { id: 'typing-passage', label: 'Đua Gõ Chữ — Văn bản', route: '/games/typing/passage' },
  { id: 'typing-words', label: 'Gõ Nhanh', route: '/games/typing/words' },
  { id: 'direction-rush', label: 'Phản Xạ Bốn Hướng', route: '/games/arcade/direction_rush' },
  { id: 'memory-flash', label: 'Trí Nhớ Nhanh', route: '/games/arcade/memory_flash' },
  { id: 'drawing', label: 'Xưởng Vẽ', route: '/games/drawing' },
  { id: 'gallery', label: 'Thư viện tranh', route: '/creative-corner' },
  { id: 'profile', label: 'Hồ sơ cá nhân', route: '/users/1' },
  { id: 'settings', label: 'Cài đặt tài khoản', route: '/settings' },
  { id: 'admin-kpi', label: 'Quản Lý KPI & Phòng Ban', route: '/admin/kpi' },
  { id: 'admin-privileges', label: 'Quản Lý Nhân Sự & Đặc Quyền', route: '/admin/privileges' },
  { id: 'admin-teams-youtube', label: 'Quản Lý Đội Nhóm & Kênh YouTube', route: '/admin/teams-youtube' },
  { id: 'admin-seasons', label: 'Quản Lý Mùa Giải', route: '/admin/competition/seasons' },
  { id: 'admin-rules', label: 'Rule Builder & Mô Phỏng', route: '/admin/competition/rules' },
  { id: 'admin-grand', label: 'Quản Lý Giải Vô Địch Năm', route: '/admin/competition/grand' },
  { id: 'admin-operations', label: 'Giám Sát & Nhật Ký Kiểm Toán', route: '/admin/operations' },
  { id: 'login', label: 'Đăng nhập (public)', route: '/login', anonymous: true },
  { id: 'home', label: 'Trang chủ (public)', route: '/', anonymous: true },
];

const ALIASES = [
  { id: 'alias-kpi', route: '/kpi', expect: '/dashboard' },
  { id: 'alias-rankings', route: '/rankings', expect: '/leaderboard' },
  { id: 'alias-groups', route: '/groups', expect: '/friends' },
  { id: 'alias-admin-departments', route: '/admin/departments', expect: '/admin/kpi' },
  { id: 'alias-admin-competition', route: '/admin/competition', expect: '/admin/competition/seasons' },
  { id: 'alias-admin-games', route: '/admin/games/foo', expect: '/settings?tab=games' },
  { id: 'alias-retired-game', route: '/games/retired_game', expect: '/games' },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeName(value) {
  return value.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase();
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status} ${await res.text()}`);
  const json = await res.json();
  return json;
}

function attachTelemetry(page) {
  const state = {
    console: [],
    pageErrors: [],
    failedRequests: [],
    badResponses: [],
    requests: {},
  };
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      state.console.push({ type, text: msg.text().slice(0, 600), location: msg.location() });
    }
  });
  page.on('pageerror', (err) => {
    state.pageErrors.push({ message: String(err?.message || err).slice(0, 600), stack: String(err?.stack || '').slice(0, 900) });
  });
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.startsWith('data:') || url.includes('favicon')) return;
    state.failedRequests.push({ url: url.slice(0, 300), method: req.method(), error: req.failure()?.errorText });
  });
  page.on('response', (res) => {
    const status = res.status();
    const url = res.url();
    if (status >= 400 && !url.includes('favicon')) {
      state.badResponses.push({ status, url: url.slice(0, 300), method: res.request().method() });
    }
  });
  page.on('request', (req) => {
    const url = req.url();
    if (!url.includes('/api/')) return;
    const key = `${req.method()} ${url.split('?')[0]}`;
    state.requests[key] = (state.requests[key] || 0) + 1;
  });
  return state;
}

async function measureLayout(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    const vw = window.innerWidth;
    const overflowing = [];
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (overflowing.length >= 12) break;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.position === 'fixed') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (rect.right > vw + 2 || rect.left < -2) {
        overflowing.push({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className || '').slice(0, 80),
          text: String(el.textContent || '').trim().slice(0, 60),
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    }
    const truncated = [...document.querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.textOverflow === 'ellipsis' || s.overflow === 'hidden') && el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0;
    }).slice(0, 10).map((el) => ({
      tag: el.tagName.toLowerCase(),
      cls: String(el.className || '').slice(0, 60),
      text: String(el.textContent || '').trim().slice(0, 60),
    }));

    return {
      viewportWidth: vw,
      scrollWidth: doc.scrollWidth,
      horizontalOverflow: doc.scrollWidth > vw + 2,
      overflowing,
      truncated,
      title: document.title,
      h1: [...document.querySelectorAll('h1')].map((n) => n.textContent.trim()).slice(0, 4),
      h2: [...document.querySelectorAll('h2')].map((n) => n.textContent.trim()).slice(0, 8),
      bodyTextLength: document.body.innerText.length,
      bodyTextSample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 1200),
      buttons: [...document.querySelectorAll('button, [role="button"]')].filter((b) => b.offsetParent !== null).length,
      links: [...document.querySelectorAll('a[href]')].filter((a) => a.offsetParent !== null).length,
      inputs: [...document.querySelectorAll('input, select, textarea')].filter((i) => i.offsetParent !== null).length,
      emptyStateHint: /chưa có|không có|trống|chưa đủ|bắt đầu|hãy |vui lòng/i.test(document.body.innerText.slice(0, 3000)),
      errorHint: /không tải được|lỗi|thử lại|đã xảy ra/i.test(document.body.innerText.slice(0, 3000)),
    };
  });
}

async function visit(browser, auth, item, viewport, suffix) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    isMobile: viewport.width < 500,
    hasTouch: viewport.width < 500,
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  });
  await context.addInitScript(([token, refresh]) => {
    localStorage.setItem('token', token);
    if (refresh) localStorage.setItem('refreshToken', refresh);
  }, [auth.accessToken, auth.refreshToken]);

  const page = await context.newPage();
  const telemetry = attachTelemetry(page);
  const started = Date.now();
  let navError = null;
  let status = null;
  try {
    const response = await page.goto(WEB + item.route, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = response?.status() ?? null;
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1400);
  } catch (error) {
    navError = String(error?.message || error).slice(0, 400);
  }
  const loadMs = Date.now() - started;
  const url = page.url();
  let layout = null;
  try {
    layout = await measureLayout(page);
  } catch (error) {
    layout = { error: String(error?.message || error) };
  }
  const shotName = `${item.id}-${suffix}.png`;
  await page.screenshot({ path: path.join(OUT, 'shots', shotName), fullPage: true }).catch(() => {});

  const result = {
    ...item,
    viewport: `${viewport.width}x${viewport.height}`,
    finalUrl: url,
    httpStatus: status,
    loadMs,
    navError,
    layout,
    telemetry: {
      console: telemetry.console.slice(0, 40),
      pageErrors: telemetry.pageErrors.slice(0, 20),
      failedRequests: telemetry.failedRequests.slice(0, 20),
      badResponses: telemetry.badResponses.slice(0, 30),
      duplicateRequests: Object.entries(telemetry.requests).filter(([, count]) => count > 2).slice(0, 20),
      requestCount: Object.values(telemetry.requests).reduce((a, b) => a + b, 0),
    },
    screenshot: `shots/${shotName}`,
  };

  // refresh test
  if (!item.anonymous) {
    const before = telemetry.console.length;
    const t0 = Date.now();
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(800);
    result.refresh = {
      ms: Date.now() - t0,
      finalUrl: page.url(),
      newConsole: telemetry.console.slice(before, before + 10),
      bodyTextLength: await page.evaluate(() => document.body.innerText.length).catch(() => 0),
    };
  }

  // back/forward test
  if (!item.anonymous) {
    try {
      await page.goto(WEB + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      await page.goto(WEB + item.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(600);
      await page.goBack({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      const backUrl = page.url();
      await page.goForward({ waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(400);
      result.history = { backUrl, forwardUrl: page.url(), expected: item.route };
    } catch (error) {
      result.history = { error: String(error?.message || error).slice(0, 200) };
    }
  }

  await context.close();
  return result;
}

async function checkAliases(browser, auth) {
  const results = [];
  for (const alias of ALIASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(([token]) => localStorage.setItem('token', token), [auth.accessToken]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
    try {
      await page.goto(WEB + alias.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(1200);
    } catch (e) { errors.push(String(e.message).slice(0, 200)); }
    results.push({ ...alias, finalUrl: page.url(), ok: page.url().includes(alias.expect.split('?')[0]), errors });
    await context.close();
  }
  return results;
}

(async () => {
  ensureDir(OUT);
  ensureDir(path.join(OUT, 'shots'));
  const auth = await login();
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const item of ROUTES) {
    if (ONLY && !ONLY.has(item.id)) continue;
    process.stdout.write(`→ ${item.id} ${item.route}\n`);
    const desktop = await visit(browser, auth, item, { width: 1440, height: 900 }, '1440');
    const mobile = await visit(browser, auth, item, { width: 390, height: 844 }, '390');
    results.push({ ...item, desktop, mobile });
    const issues = [];
    if (desktop.layout?.horizontalOverflow) issues.push('DESKTOP_OVERFLOW');
    if (mobile.layout?.horizontalOverflow) issues.push('MOBILE_OVERFLOW');
    if (desktop.telemetry.pageErrors.length) issues.push('PAGE_ERROR');
    if (desktop.telemetry.badResponses.length) issues.push(`HTTP_${desktop.telemetry.badResponses[0].status}`);
    console.log(`   desktop ${desktop.loadMs}ms console=${desktop.telemetry.console.length} err=${desktop.telemetry.pageErrors.length} bad=${desktop.telemetry.badResponses.length} overflow=${desktop.layout?.horizontalOverflow}`);
    console.log(`   mobile  ${mobile.loadMs}ms console=${mobile.telemetry.console.length} err=${mobile.telemetry.pageErrors.length} bad=${mobile.telemetry.badResponses.length} overflow=${mobile.layout?.horizontalOverflow}`);
  }
  const aliases = await checkAliases(browser, auth);
  await browser.close();
  const payload = { generatedAt: new Date().toISOString(), web: WEB, api: API, account: EMAIL, results, aliases };
  fs.writeFileSync(path.join(OUT, 'crawl.json'), JSON.stringify(payload, null, 2));
  console.log(`\nWrote ${path.join(OUT, 'crawl.json')}`);
  console.log(`Routes: ${results.length}, aliases: ${aliases.length}`);
})();
