/**
 * Verify remediation — phần chức năng/a11y/data (WR-AUDIT-001..005, 008, 010..019).
 * Mỗi check ghi BEFORE/AFTER theo repro gốc trong báo cáo audit.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:5001';
const OUT = path.resolve('docs/audit/2026-10-24');
const report = { checks: [], consoleErrors: [] };

function log(id, name, ok, detail) {
  report.checks.push({ id, name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${id} ${name} — ${JSON.stringify(detail).slice(0, 260)}`);
}

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
  return res.json();
}

function contrast(rgb1, rgb2) {
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const l1 = lum(rgb1); const l2 = lum(rgb2);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}
const parseRgb = (value) => (value.match(/\d+/g) || []).slice(0, 3).map(Number);

(async () => {
  const admin = await login('audit.admin@workrank.test', 'AuditPass!2026');
  const member = await login('audit.member@workrank.test', 'AuditPass!2026');
  const adminToken = admin.accessToken;
  const memberToken = member.accessToken;
  const browser = await chromium.launch({ headless: true });

  // ── 001 KPI authz ────────────────────────────────────────────────────────
  const memberResults = await fetch(`${API}/api/kpi/results`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const memberHistory = await fetch(`${API}/api/kpi/results/history`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const memberProjection = await fetch(`${API}/api/kpi/results/leaderboard`, { headers: { Authorization: `Bearer ${memberToken}` } });
  const projectionBody = await memberProjection.json();
  const adminResults = await fetch(`${API}/api/kpi/results`, { headers: { Authorization: `Bearer ${adminToken}` } });
  log('001', 'KPI authz', memberResults.status === 403 && memberHistory.status === 403 && memberProjection.status === 200 && adminResults.status === 200,
    { memberResults: memberResults.status, memberHistory: memberHistory.status, memberProjection: memberProjection.status, projectionKeys: Object.keys(projectionBody.data?.[0] || {}), adminResults: adminResults.status });

  // ── 002 Grand contrast + width ───────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/grand`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const info = await page.evaluate(() => {
      const h = document.querySelector('h1');
      const section = h?.closest('section');
      const body = document.querySelector('.grand-hero-body');
      return {
        h1: h?.textContent.trim(),
        color: h ? getComputedStyle(h).color : null,
        bg: section ? getComputedStyle(section).backgroundColor : null,
        h1Width: h ? Math.round(h.getBoundingClientRect().width) : null,
        bodyWidth: body ? Math.round(body.getBoundingClientRect().width) : null,
        vw: window.innerWidth,
      };
    });
    const ratio = contrast(parseRgb(info.color), parseRgb(info.bg));
    log('002', 'Grand H1 contrast', ratio >= 4.5, { ...info, contrast: Number(ratio.toFixed(2)) });
    await page.screenshot({ path: path.join(OUT, 'shots', 'verify-grand-hero.png'), clip: { x: 240, y: 60, width: 1100, height: 240 } }).catch(() => {});
    await ctx.close();
  }

  // ── 003 Drawing likes ────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [memberToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/creative-corner`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const card = page.locator('.public-artwork-card', { hasText: 'Vũ Điệu Ánh Sáng' }).first();
    const like = card.locator('button[title*="tim"]').first();
    const before = (await like.innerText()).trim();
    await like.click();
    await page.waitForTimeout(1200);
    const after = (await like.innerText()).trim();
    await like.click();
    await page.waitForTimeout(1000);
    const reverted = (await like.innerText()).trim();
    const apiList = await (await fetch(`${API}/api/drawings`, { headers: { Authorization: `Bearer ${memberToken}` } })).json();
    const apiCount = apiList.drawings?.find((d) => d.id === 2)?.likesCount;
    const db = await (await fetch(`${API}/api/drawings/2`, { headers: { Authorization: `Bearer ${memberToken}` } })).json();
    log('003', 'Drawing like integrity', before === '0' && after === '1' && reverted === '0' && apiCount === 0 && db.drawing?.likesCount === 0,
      { before, after, reverted, apiCount, detailCount: db.drawing?.likesCount });
    await ctx.close();
  }

  // ── 004 responsive (Grand/Arena/Admin Ops/segmented) ─────────────────────
  {
    const routes = ['/arena', '/grand', '/admin/operations', '/admin/competition/seasons', '/admin/competition/rules', '/admin/competition/grand'];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    const results = [];
    for (const route of routes) {
      await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1300);
      const info = await page.evaluate(() => {
        const seg = document.querySelector('.ui-segmented');
        const hero = document.querySelector('.grand-hero-body, .arena-hero-body');
        return {
          vw: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          segOverflowX: seg ? getComputedStyle(seg).overflowX : null,
          segScrollable: seg ? seg.scrollWidth > seg.clientWidth : null,
          heroWidth: hero ? Math.round(hero.getBoundingClientRect().width) : null,
        };
      });
      const ok = info.scrollWidth <= info.vw + 2 && (!info.segOverflowX || info.segOverflowX === 'auto') && (!info.heroWidth || info.heroWidth <= info.vw);
      results.push({ route, ok, ...info });
    }
    log('004', 'Responsive mobile clipping', results.every((r) => r.ok), results);
    await page.screenshot({ path: path.join(OUT, 'shots', 'verify-mobile-arena.png'), fullPage: false }).catch(() => {});
    await ctx.close();
  }

  // ── 005 Modal a11y ───────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/friends`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    const trigger = page.getByRole('button', { name: /Nhập mã mời/ }).first();
    await trigger.click();
    await page.waitForTimeout(700);
    const openInfo = await page.evaluate(() => {
      const panel = document.querySelector('.modal-dialog-enter');
      return {
        exists: Boolean(panel),
        role: panel?.getAttribute('role'),
        ariaModal: panel?.getAttribute('aria-modal'),
        label: panel?.getAttribute('aria-label'),
        focusInside: panel ? panel.contains(document.activeElement) : false,
      };
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const afterEscape = await page.locator('.modal-dialog-enter').count();
    log('005', 'Modal accessibility', openInfo.role === 'dialog' && openInfo.ariaModal === 'true' && openInfo.focusInside && afterEscape === 0,
      { ...openInfo, afterEscape });
    await ctx.close();
  }

  // ── 008 Drawing image URL ────────────────────────────────────────────────
  {
    const list = await (await fetch(`${API}/api/drawings`, { headers: { Authorization: `Bearer ${memberToken}` } })).json();
    const bad = (list.drawings || []).filter((d) => /localhost|127\.0\.0\.1/.test(d.imageUrl || ''));
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [memberToken]);
    const page = await ctx.newPage();
    const failed = [];
    page.on('requestfailed', (req) => { if (req.resourceType() === 'image' && /localhost|127\.0\.0\.1/.test(req.url())) failed.push(req.url()); });
    await page.goto(`${WEB}/creative-corner`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const fallback = await page.locator('.public-artwork-img-fallback').count();
    log('008', 'Drawing image host', bad.length === 0 && failed.length === 0, { badUrls: bad.length, failedLocalhost: failed.length, fallbackCards: fallback });
    await ctx.close();
  }

  // ── 010 Recipients ───────────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    const page = await ctx.newPage();
    await page.goto(`${WEB}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const homeH1 = await page.locator('h1').first().innerText().catch(() => '');
    await page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const loginText = await page.evaluate(() => document.body.innerText);
    log('010', 'Recipients copy', !/Recipients/.test(homeH1) && !/Recipients/.test(loginText), { homeH1, loginHasRecipients: /Recipients/.test(loginText) });
    await ctx.close();
  }

  // ── 012 Sidebar tooltip ──────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const link = [...document.querySelectorAll('.workrank-desktop-sidebar a.workrank-nav-item')]
        .find((a) => a.textContent.includes('Quản Lý Đội Nhóm & Kênh YouTube'));
      return { title: link?.getAttribute('title'), aria: link?.getAttribute('aria-label') };
    });
    log('012', 'Sidebar full label', /Quản Lý Đội Nhóm & Kênh YouTube/.test(info.title || '') && /Quản Lý Đội Nhóm & Kênh YouTube/.test(info.aria || ''), info);
    await ctx.close();
  }

  // ── 014 Publish modal reason ─────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/games/drawing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1800);
    await page.getByRole('button', { name: /Đăng tranh/ }).first().click();
    await page.waitForTimeout(900);
    const text = await page.evaluate(() => document.querySelector('.modal-dialog-enter, [role="dialog"]')?.innerText || '');
    log('014', 'Publish modal explains disabled state', /kho lưu trữ chưa được cấu hình|chưa thể đăng tranh/i.test(text), { hasReason: /kho lưu trữ chưa được cấu hình/i.test(text) });
    await ctx.close();
  }

  // ── 015 YouTube compare URL ──────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [memberToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/youtube?tab=compare`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    log('015', 'YouTube compare URL normalized', !page.url().includes('tab=compare'), { url: page.url().replace(WEB, '') });
    await ctx.close();
  }

  // ── 016 English leftovers ────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/admin/kpi`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1600);
    const kpiText = await page.evaluate(() => document.body.innerText);
    await page.goto(`${WEB}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const dashText = await page.evaluate(() => document.body.innerText);
    const badKpi = /WorkRank KPI Foundation|YouTube Studio Hub|Version draft/.test(kpiText);
    const badDash = /WorkRank Performance Center/.test(dashText);
    log('016', 'English leftovers', !badKpi && !badDash, { badKpi, badDash });
    await ctx.close();
  }

  // ── 017 Toast alert + headings ───────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/settings`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    const pw = page.locator('input[type="password"]');
    await pw.nth(0).fill('sai_mat_khau_123');
    await pw.nth(1).fill('NewPass!2026');
    await pw.nth(2).fill('NewPass!2026');
    await page.getByRole('button', { name: /Cập nhật mật khẩu/ }).first().click();
    await page.waitForTimeout(1200);
    const toastRole = await page.locator('[role="alert"]').count();
    const skips = {};
    for (const route of ['/users/1', '/admin/competition/seasons', '/admin/operations']) {
      await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1300);
      skips[route] = await page.evaluate(() => {
        const levels = [...document.querySelectorAll('h1,h2,h3,h4')].filter((h) => h.offsetParent).map((h) => Number(h.tagName[1]));
        let n = 0;
        for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i - 1] > 1) n += 1;
        return n;
      });
    }
    log('017', 'Toast role + heading order', toastRole > 0 && Object.values(skips).every((n) => n === 0), { toastRole, skips });
    await ctx.close();
  }

  // ── 018 Test season names ────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.goto(`${WEB}/arena`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    const arenaH1 = await page.locator('h1').first().innerText().catch(() => '');
    await page.goto(`${WEB}/grand`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1400);
    const grandH1 = await page.locator('h1').first().innerText().catch(() => '');
    const ok = !/\d{10,}/.test(arenaH1) && !/\d{10,}/.test(grandH1);
    log('018', 'Human season/grand names', ok, { arenaH1, grandH1 });
    await ctx.close();
  }

  // ── 019 Admin teams retry ────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [adminToken]);
    const page = await ctx.newPage();
    await page.route('**/api/youtube/admin/channels**', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Audit simulated failure' }) }));
    await page.goto(`${WEB}/admin/teams-youtube`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2200);
    const retry = await page.getByRole('button', { name: /Thử lại/ }).count();
    const alert = await page.locator('[role="alert"]').count();
    log('019', 'Admin Teams error retry', retry > 0 && alert > 0, { retryButtons: retry, alerts: alert });
    await ctx.close();
  }

  await browser.close();
  fs.mkdirSync(path.join(OUT, 'shots'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'verification-core.json'), JSON.stringify(report, null, 2));
  const failed = report.checks.filter((c) => !c.ok);
  console.log(`\n${report.checks.length - failed.length}/${report.checks.length} checks passed`);
})();
