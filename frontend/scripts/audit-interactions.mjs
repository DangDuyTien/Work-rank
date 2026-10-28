/**
 * Phase 2-5 — interaction audit cho các trang dữ liệu chính.
 * Mỗi bước ghi lại: URL, text thay đổi, request phát sinh, console error.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const results = [];
const consoleErrors = [];
const failed = [];

function record(name, page, detail, extra = {}) {
  const entry = { name, url: page.url().replace(WEB, ''), detail, ...extra };
  results.push(entry);
  console.log(`${extra.ok === false ? '✗' : '✓'} ${name} — ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 200)}`);
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  return res.json();
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await context.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await context.newPage();
  page.on('pageerror', (e) => consoleErrors.push({ type: 'pageerror', text: String(e.message).slice(0, 300), url: page.url() }));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push({ type: 'console', text: m.text().slice(0, 300), url: page.url() }); });
  page.on('response', (r) => { if (r.status() >= 400) failed.push({ status: r.status(), url: r.url().slice(0, 200), page: page.url() }); });

  // ══════════════════════════ YOUTUBE ══════════════════════════
  await page.goto(`${WEB}/youtube`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const ytTabs = page.locator('[role="tab"]');
  const ytTabNames = await ytTabs.allInnerTexts();
  record('YouTube — tab list', page, ytTabNames.map((t) => t.trim()));

  for (const [label, expectTab] of [['Kênh theo đội', 'team_detail'], ['So sánh', 'compare'], ['Tổng quan', 'overview']]) {
    const tab = page.getByRole('tab', { name: label });
    const visible = await tab.isVisible().catch(() => false);
    if (!visible) { record(`YouTube — tab ${label}`, page, 'tab không hiển thị', { ok: false }); continue; }
    await tab.click();
    await page.waitForTimeout(1200);
    const url = page.url();
    const h1 = await page.locator('h1').first().innerText().catch(() => '');
    record(`YouTube — tab ${label}`, page, { url, h1, hasTabParam: url.includes(`tab=${expectTab}`) }, { ok: url.includes(`tab=${expectTab}`) });
  }

  // compare deep link
  await page.goto(`${WEB}/youtube?tab=compare`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  record('YouTube — deep link ?tab=compare', page, {
    h1: await page.locator('h1').first().innerText().catch(() => ''),
    selects: await page.locator('select').count(),
    bodyLen: await page.evaluate(() => document.body.innerText.length),
  });

  // invalid tab fallback
  await page.goto(`${WEB}/youtube?tab=khong_ton_tai`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  record('YouTube — tab không hợp lệ', page, {
    url: page.url().replace(WEB, ''),
    h1: await page.locator('h1').first().innerText().catch(() => ''),
  });

  // refresh
  await page.goto(`${WEB}/youtube`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const refreshBtn = page.getByRole('button', { name: /Làm mới/ });
  if (await refreshBtn.isVisible().catch(() => false)) {
    await refreshBtn.click();
    await page.waitForTimeout(1500);
    const toast = await page.locator('text=Đã làm mới dữ liệu YouTube').count();
    record('YouTube — Làm mới', page, { toastVisible: toast > 0 }, { ok: toast > 0 });
  } else {
    record('YouTube — Làm mới', page, 'không có nút Làm mới', { ok: false });
  }

  // Views/Subs metric toggle
  const subsBtn = page.getByRole('button', { name: 'Subs', exact: true });
  if (await subsBtn.isVisible().catch(() => false)) {
    await subsBtn.click();
    await page.waitForTimeout(900);
    record('YouTube — toggle Subs', page, { clicked: true, bodyLen: await page.evaluate(() => document.body.innerText.length) });
  }

  // ══════════════════════════ LEADERBOARD ══════════════════════════
  await page.goto(`${WEB}/leaderboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const lbScopes = ['BXH KPI', 'BXH Đội Nhóm', 'BXH Thành Viên', 'BXH YouTube', 'Bảng Vinh Danh'];
  for (const scope of lbScopes) {
    const btn = page.getByRole('button', { name: scope, exact: true });
    if (!(await btn.isVisible().catch(() => false))) { record(`Leaderboard — ${scope}`, page, 'không thấy nút', { ok: false }); continue; }
    await btn.click();
    await page.waitForTimeout(1300);
    const info = await page.evaluate(() => ({
      url: location.pathname + location.search,
      h1: document.querySelector('h1')?.textContent.trim() || '',
      rows: document.querySelectorAll('tbody tr').length,
      empty: /chưa có|không có dữ liệu|chưa đủ/i.test(document.body.innerText.slice(0, 4000)),
      bodyLen: document.body.innerText.length,
    }));
    record(`Leaderboard — ${scope}`, page, info, { ok: info.bodyLen > 300 });
  }

  // periods
  for (const period of ['Mùa Giải', 'Vô Địch Năm (Grand)', 'Điểm hiện tại']) {
    await page.goto(`${WEB}/leaderboard?scope=members`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const btn = page.getByRole('button', { name: period, exact: true });
    if (!(await btn.isVisible().catch(() => false))) { record(`Leaderboard — kỳ ${period}`, page, 'không thấy nút', { ok: false }); continue; }
    await btn.click();
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => ({
      url: location.pathname + location.search,
      rows: document.querySelectorAll('tbody tr').length,
      bodyLen: document.body.innerText.length,
    }));
    record(`Leaderboard — kỳ ${period}`, page, info, { ok: info.bodyLen > 300 });
  }

  // search
  await page.goto(`${WEB}/leaderboard?scope=members`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const searchInput = page.locator('input[placeholder*="Tìm"]').first();
  if (await searchInput.isVisible().catch(() => false)) {
    const before = await page.locator('tbody tr').count();
    await searchInput.fill('Audit');
    await page.waitForTimeout(1500);
    const after = await page.locator('tbody tr').count();
    const txt = await page.locator('tbody').innerText().catch(() => '');
    record('Leaderboard — tìm kiếm "Audit"', page, { before, after, containsAudit: /audit/i.test(txt) }, { ok: after > 0 && /audit/i.test(txt) });
    await searchInput.fill('zzzz_khong_ton_tai');
    await page.waitForTimeout(1500);
    const emptyTxt = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    record('Leaderboard — tìm kiếm rỗng', page, {
      rows: await page.locator('tbody tr').count(),
      hasEmptyMessage: /không tìm thấy|chưa có|không có kết quả/i.test(emptyTxt),
    });
    await searchInput.fill('');
    await page.waitForTimeout(600);
  } else {
    record('Leaderboard — tìm kiếm', page, 'không thấy input tìm kiếm', { ok: false });
  }

  // pagination
  await page.goto(`${WEB}/leaderboard?scope=members`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const nextBtn = page.getByRole('button', { name: 'Trang sau' });
  if (await nextBtn.isVisible().catch(() => false)) {
    const disabled = await nextBtn.isDisabled();
    if (!disabled) {
      await nextBtn.click();
      await page.waitForTimeout(1300);
      record('Leaderboard — phân trang', page, { url: page.url().replace(WEB, ''), rows: await page.locator('tbody tr').count() });
    } else {
      record('Leaderboard — phân trang', page, 'nút Trang sau disabled (chỉ 1 trang)', { ok: true });
    }
  }

  // ══════════════════════════ ARENA ══════════════════════════
  await page.goto(`${WEB}/arena`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  for (const tab of ['BXH Cá Nhân', 'Thử Thách', 'Luật Chơi', 'BXH Đội']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${tab}`) }).first();
    if (!(await btn.isVisible().catch(() => false))) { record(`Arena — tab ${tab}`, page, 'không thấy', { ok: false }); continue; }
    await btn.click();
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => ({
      bodyLen: document.body.innerText.length,
      sample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 260),
      hasError: /không tải được|đã xảy ra lỗi/i.test(document.body.innerText),
    }));
    record(`Arena — tab ${tab}`, page, info, { ok: info.bodyLen > 300 && !info.hasError });
  }
  const arenaRefresh = page.getByRole('button', { name: /Cập nhật/ }).first();
  if (await arenaRefresh.isVisible().catch(() => false)) {
    await arenaRefresh.click();
    await page.waitForTimeout(1500);
    record('Arena — Cập nhật', page, { bodyLen: await page.evaluate(() => document.body.innerText.length) });
  }

  // ══════════════════════════ GRAND ══════════════════════════
  await page.goto(`${WEB}/grand`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(900);
  for (const tab of ['BXH Cá Nhân', 'Dòng Thời Gian', 'Hành Trình Đội', 'Vinh Danh', 'BXH Đội']) {
    const btn = page.getByRole('button', { name: new RegExp(`^${tab}`) }).first();
    if (!(await btn.isVisible().catch(() => false))) { record(`Grand — tab ${tab}`, page, 'không thấy', { ok: false }); continue; }
    await btn.click();
    await page.waitForTimeout(700);
    const info = await page.evaluate(() => ({
      bodyLen: document.body.innerText.length,
      sample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 240),
    }));
    record(`Grand — tab ${tab}`, page, info, { ok: info.bodyLen > 300 });
  }

  // ══════════════════════════ DASHBOARD ══════════════════════════
  await page.goto(`${WEB}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const dashRefresh = page.getByRole('button', { name: /Làm mới/ }).first();
  await dashRefresh.click();
  await page.waitForTimeout(1800);
  record('Dashboard — Làm mới', page, { bodyLen: await page.evaluate(() => document.body.innerText.length), disabled: await dashRefresh.isDisabled() });

  // anchors
  const anchor = page.locator('.dashboard-section-nav a[href="#dashboard-youtube"]');
  if (await anchor.isVisible().catch(() => false)) {
    await anchor.click();
    await page.waitForTimeout(800);
    const hash = await page.evaluate(() => location.hash);
    const inView = await page.evaluate(() => {
      const el = document.getElementById('dashboard-youtube');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      return r.top >= -50 && r.top < window.innerHeight;
    });
    record('Dashboard — anchor YouTube', page, { hash, inView }, { ok: hash === '#dashboard-youtube' && inView });
  }

  // personal leaderboard CTA
  const cta = page.getByRole('button', { name: /Bảng xếp hạng cá nhân/ }).first();
  if (await cta.isVisible().catch(() => false)) {
    await cta.click();
    await page.waitForTimeout(1200);
    record('Dashboard — CTA BXH cá nhân', page, { url: page.url().replace(WEB, '') });
  }

  // ══════════════════════════ FRIENDS ══════════════════════════
  await page.goto(`${WEB}/friends`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const teamTab = page.getByRole('button', { name: /Đội Nhóm Của Tôi/ }).first();
  if (await teamTab.isVisible().catch(() => false)) {
    await teamTab.click();
    await page.waitForTimeout(900);
    record('Friends — tab Đội Nhóm Của Tôi', page, {
      bodyLen: await page.evaluate(() => document.body.innerText.length),
      sample: await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)),
    });
  }
  const dirTab = page.getByRole('button', { name: /Danh Bạ Đồng Nghiệp/ }).first();
  if (await dirTab.isVisible().catch(() => false)) {
    await dirTab.click();
    await page.waitForTimeout(700);
  }

  // search in friends
  const fSearch = page.locator('input[placeholder*="Tìm"], input[type="text"]').first();
  if (await fSearch.isVisible().catch(() => false)) {
    await fSearch.fill('Audit Member');
    await page.waitForTimeout(1200);
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    record('Friends — tìm "Audit Member"', page, { found: /Audit Member/i.test(txt) });
    await fSearch.fill('');
    await page.waitForTimeout(500);
  }

  // invite modal
  const inviteBtn = page.getByRole('button', { name: /Nhập mã mời/ }).first();
  if (await inviteBtn.isVisible().catch(() => false)) {
    await inviteBtn.click();
    await page.waitForTimeout(600);
    const modal = await page.locator('[role="dialog"], .modal, .wr-modal').count();
    record('Friends — mở modal nhập mã mời', page, { modalCount: modal });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    record('Friends — đóng modal bằng Escape', page, { modalAfter: await page.locator('[role="dialog"], .modal, .wr-modal').count() });
  }

  // ══════════════════════════ SETTINGS ══════════════════════════
  await page.goto(`${WEB}/settings`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  const bio = page.locator('textarea').first();
  if (await bio.isVisible().catch(() => false)) {
    const original = await bio.inputValue();
    await bio.fill(`${original} [audit ${Date.now()}]`.trim());
    const saveBtn = page.getByRole('button', { name: /Lưu thông tin cá nhân/ }).first();
    await saveBtn.click();
    await page.waitForTimeout(1800);
    const toast = await page.locator('text=/Đã lưu|Cập nhật thành công|thành công/i').count();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const persisted = await page.locator('textarea').first().inputValue();
    record('Settings — lưu bio + reload', page, { toast: toast > 0, persisted: persisted.includes('[audit'), value: persisted.slice(0, 80) }, { ok: toast > 0 && persisted.includes('[audit') });
    // restore
    await page.locator('textarea').first().fill(original);
    await page.getByRole('button', { name: /Lưu thông tin cá nhân/ }).first().click();
    await page.waitForTimeout(1200);
  } else {
    record('Settings — lưu bio', page, 'không thấy textarea', { ok: false });
  }

  // invalid password change
  const pwInputs = page.locator('input[type="password"]');
  if (await pwInputs.count() >= 3) {
    await pwInputs.nth(0).fill('sai_mat_khau_123');
    await pwInputs.nth(1).fill('NewPass!2026');
    await pwInputs.nth(2).fill('NewPass!2026');
    await page.getByRole('button', { name: /Cập nhật mật khẩu/ }).first().click();
    await page.waitForTimeout(1500);
    const txt = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    record('Settings — đổi mật khẩu sai', page, { hasError: /không đúng|sai|thất bại|không chính xác/i.test(txt), sample: txt.slice(0, 200) });
  }

  // delete modal open/close
  const danger = page.getByRole('button', { name: /Xóa tài khoản|Xóa vĩnh viễn/i }).first();
  if (await danger.isVisible().catch(() => false)) {
    await danger.click();
    await page.waitForTimeout(600);
    record('Settings — modal xóa tài khoản', page, { dialogs: await page.locator('[role="dialog"], .modal').count() });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'interactions.json'), JSON.stringify({ results, consoleErrors, failed }, null, 2));
  console.log('\nFAILED REQUESTS:', JSON.stringify(failed.slice(0, 20), null, 2));
  console.log('CONSOLE ERRORS:', JSON.stringify(consoleErrors.slice(0, 20), null, 2));
})();
