/**
 * Phase 8/9 — Admin pages: tab/section switching, filter, modal open/close,
 * DOM size + render cost. Không bấm hành động phá huỷ (xóa/kết toán/khóa).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const PAGES = [
  { id: 'admin-kpi', route: '/admin/kpi', tabs: ['Quản Lý KPI', 'Phòng Ban', 'Kết Quả & Tiến Độ', 'Nhật Ký & Lịch Sử'] },
  { id: 'admin-privileges', route: '/admin/privileges', tabs: ['Tất cả', 'Có tích xanh', 'Developer', 'Quản trị viên', 'Chưa định danh'] },
  { id: 'admin-teams-youtube', route: '/admin/teams-youtube', tabs: ['Kênh YouTube & Đồng Bộ', 'Đội Nhóm & Phòng Ban'] },
  { id: 'admin-seasons', route: '/admin/competition/seasons', tabs: ['Quản Lý Mùa Giải', 'Vinh Danh Trang Chủ & Lịch Sử'] },
  { id: 'admin-rules', route: '/admin/competition/rules', tabs: ['Company Analytics', 'Rule Sets', 'State Monitor', 'Score Inspector'] },
  { id: 'admin-grand', route: '/admin/competition/grand', tabs: [] },
  { id: 'admin-operations', route: '/admin/operations', tabs: ['Sức Khỏe Hệ Thống', 'Nhật Ký Kiểm Toán', 'Hàng Đợi Sự Kiện'] },
];

const report = { pages: [], consoleErrors: [], badResponses: [] };
const step = (page, name, data, ok = true) => {
  page.steps.push({ name, ok, data });
  console.log(`${ok ? '✓' : '✗'} [${page.id}] ${name}`, JSON.stringify(data).slice(0, 220));
};

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'audit.admin@workrank.test', password: 'AuditPass!2026' }) });
  return res.json();
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  await context.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await context.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push({ url: page.url(), text: String(e.message).slice(0, 250) }));
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({ url: page.url(), text: m.text().slice(0, 250) }); });
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push({ status: r.status(), url: r.url().slice(0, 170), page: page.url() }); });

  for (const cfg of PAGES) {
    const entry = { id: cfg.id, route: cfg.route, steps: [] };
    const t0 = Date.now();
    await page.goto(WEB + cfg.route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const metrics = await page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      bodyText: document.body.innerText.length,
      buttons: document.querySelectorAll('button').length,
      tables: document.querySelectorAll('table').length,
      rows: document.querySelectorAll('tbody tr').length,
      selects: document.querySelectorAll('select').length,
      h1: document.querySelector('h1')?.textContent.trim(),
    }));
    step(entry, 'load', { ms: Date.now() - t0, ...metrics });

    for (const tab of cfg.tabs) {
      const btn = page.getByRole('button', { name: new RegExp(`^${tab.replace(/[()]/g, '\\$&')}`) }).first();
      if (!(await btn.isVisible().catch(() => false))) { step(entry, `tab ${tab}`, { found: false }, false); continue; }
      const before = await page.evaluate(() => document.body.innerText.length);
      await btn.click();
      await page.waitForTimeout(1100);
      const after = await page.evaluate(() => ({
        len: document.body.innerText.length,
        rows: document.querySelectorAll('tbody tr').length,
        sample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 160),
      }));
      step(entry, `tab ${tab}`, { before, after: after.len, rows: after.rows, changed: after.len !== before }, after.len > 200);
    }

    // modal mở/đóng (chỉ nút tạo/thêm)
    const createNames = [/Thêm Chỉ Tiêu KPI/, /Thêm Nhân Sự Mới/, /Thêm Kênh YouTube/, /Tạo Mùa Giải Mới/, /Tạo Rule Set Mới/, /Tạo Grand Championship/];
    for (const re of createNames) {
      const btn = page.getByRole('button', { name: re }).first();
      if (!(await btn.isVisible().catch(() => false))) continue;
      await btn.click();
      await page.waitForTimeout(900);
      const modal = await page.evaluate(() => {
        const panel = document.querySelector('.modal-dialog-enter, .modal-dialog, [role="dialog"]');
        return {
          open: Boolean(panel),
          role: panel?.getAttribute('role') || null,
          ariaModal: panel?.getAttribute('aria-modal') || null,
          title: panel?.querySelector('h2,h3')?.textContent.trim() || null,
          inputs: panel ? panel.querySelectorAll('input,select,textarea').length : 0,
          text: panel?.innerText.replace(/\s+/g, ' ').slice(0, 200) || '',
        };
      });
      step(entry, `modal ${re.source}`, modal, modal.open);
      // đóng bằng nút Hủy/Đóng nếu có, fallback Escape
      const cancel = page.getByRole('button', { name: /^(Hủy|Đóng|Quay lại|Bỏ qua)/ }).first();
      if (await cancel.isVisible().catch(() => false)) await cancel.click().catch(() => {});
      else await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
      step(entry, `modal closed ${re.source}`, { stillOpen: await page.locator('.modal-dialog-enter, [role="dialog"]').count() });
    }

    // filters
    const selects = page.locator('select');
    const selCount = await selects.count();
    for (let i = 0; i < Math.min(selCount, 3); i += 1) {
      const sel = selects.nth(i);
      const options = await sel.locator('option').count();
      if (options > 1) {
        const before = await page.evaluate(() => document.body.innerText.length);
        await sel.selectOption({ index: 1 }).catch(() => {});
        await page.waitForTimeout(900);
        const after = await page.evaluate(() => document.body.innerText.length);
        step(entry, `filter select#${i}`, { options, before, after });
      }
    }

    report.pages.push(entry);
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'admin-pages.json'), JSON.stringify(report, null, 2));
  console.log('bad', JSON.stringify(report.badResponses.slice(0, 12)));
  console.log('console', JSON.stringify(report.consoleErrors.slice(0, 12)));
})();
