/**
 * Phase 1 — Navigation audit: sidebar groups, items, active state, deep link,
 * mobile drawer, label truncation.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const results = { groups: [], items: [], mobile: {}, truncation: [], console: [], errors: [] };

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
  page.on('pageerror', (e) => results.errors.push(String(e.message).slice(0, 300)));
  page.on('console', (m) => { if (m.type() === 'error') results.console.push(m.text().slice(0, 300)); });

  await page.goto(`${WEB}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);

  const sidebar = page.locator('.workrank-desktop-sidebar');
  results.sidebarBox = await sidebar.boundingBox().catch(() => null);

  // ── group expand / collapse ────────────────────────────────────────────────
  const groupButtons = page.locator('.workrank-group-toggle');
  const groupCount = await groupButtons.count();
  for (let i = 0; i < groupCount; i += 1) {
    const btn = groupButtons.nth(i);
    const label = (await btn.innerText()).replace(/\s+/g, ' ').trim();
    const expandedBefore = await btn.getAttribute('aria-expanded');
    await btn.click();
    await page.waitForTimeout(350);
    const expandedAfter = await btn.getAttribute('aria-expanded');
    const visibleItems = await btn.evaluate((el) => {
      const group = el.closest('.workrank-nav-group');
      return group ? [...group.querySelectorAll('.workrank-nav-subitems a')].filter((e) => {
        const r = e.getBoundingClientRect();
        return r.height > 0 && r.width > 0;
      }).length : -1;
    });
    await btn.click();
    await page.waitForTimeout(350);
    const expandedRestored = await btn.getAttribute('aria-expanded');
    results.groups.push({ label, expandedBefore, expandedAfter, expandedRestored, visibleItemsWhenOpen: visibleItems });
  }

  // ── label truncation ──────────────────────────────────────────────────────
  results.truncation = await page.locator('.workrank-desktop-sidebar a.workrank-nav-item span').evaluateAll((spans) => spans
    .filter((s) => s.scrollWidth > s.clientWidth + 1)
    .map((s) => ({
      text: s.textContent.trim(),
      clientWidth: s.clientWidth,
      scrollWidth: s.scrollWidth,
      title: s.closest('a')?.getAttribute('title') || '',
    })));

  // ── click every sidebar item ──────────────────────────────────────────────
  const links = page.locator('.workrank-desktop-sidebar a.workrank-nav-item');
  const linkCount = await links.count();
  const targets = [];
  for (let i = 0; i < linkCount; i += 1) {
    const a = links.nth(i);
    targets.push({ i, href: await a.getAttribute('href'), label: (await a.innerText()).replace(/\s+/g, ' ').trim() });
  }

  for (const t of targets) {
    const before = results.console.length;
    const a = page.locator(`.workrank-desktop-sidebar a.workrank-nav-item[href="${t.href}"]`).first();
    let clicked = true;
    try {
      // Mở group chứa item nếu đang đóng (item trong group đóng bị inert/height 0).
      const needsExpand = await a.evaluate((el) => el.closest('[inert]') !== null);
      if (needsExpand) {
        await page.evaluate((href) => {
          const link = [...document.querySelectorAll('.workrank-desktop-sidebar a.workrank-nav-item')]
            .find((el) => el.getAttribute('href') === href);
          const group = link?.closest('.workrank-nav-group');
          const toggle = group?.querySelector('.workrank-group-toggle');
          if (toggle && toggle.getAttribute('aria-expanded') === 'false') toggle.click();
        }, t.href);
        await page.waitForTimeout(420);
      }
      await a.scrollIntoViewIfNeeded();
      await a.click({ timeout: 5000 });
    } catch {
      clicked = false;
    }
    await page.waitForTimeout(900);
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const state = await page.evaluate(() => {
      const active = document.querySelector('.workrank-desktop-sidebar a[aria-current="page"]');
      return {
        url: location.pathname + location.search,
        activeText: active ? active.textContent.replace(/\s+/g, ' ').trim() : null,
        activeHref: active ? active.getAttribute('href') : null,
        h1: document.querySelector('h1')?.textContent.trim() || null,
        bodyLen: document.body.innerText.length,
        title: document.title,
      };
    });
    results.items.push({
      label: t.label,
      href: t.href,
      clicked,
      ...state,
      urlOk: state.url === t.href || state.url.startsWith(`${t.href}?`),
      activeOk: state.activeHref === t.href,
      newConsoleErrors: results.console.slice(before, before + 5),
    });
  }

  // ── mobile drawer ─────────────────────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${WEB}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const toggle = page.locator('.mobile-menu-toggle');
  results.mobile.toggleVisible = await toggle.isVisible().catch(() => false);
  if (results.mobile.toggleVisible) {
    await toggle.click();
    await page.waitForTimeout(500);
    const drawer = page.locator('.workrank-mobile-drawer');
    results.mobile.drawerVisible = await drawer.isVisible().catch(() => false);
    results.mobile.drawerBox = await drawer.boundingBox().catch(() => null);
    results.mobile.drawerItems = await page.locator('.workrank-mobile-drawer a.workrank-nav-item').count();
    results.mobile.drawerOverflow = await page.evaluate(() => {
      const el = document.querySelector('.workrank-mobile-drawer');
      return el ? { scrollWidth: el.scrollWidth, clientWidth: el.clientWidth } : null;
    });
    await page.screenshot({ path: path.join(OUT, 'shots', 'sidebar-mobile-open.png') });
    const firstLink = page.locator('.workrank-mobile-drawer a.workrank-nav-item').first();
    const firstHref = await firstLink.getAttribute('href');
    await firstLink.click();
    await page.waitForTimeout(900);
    results.mobile.afterClick = {
      url: page.url().replace(WEB, ''),
      drawerStillVisible: await page.locator('.workrank-mobile-drawer').isVisible().catch(() => false),
      expectedHref: firstHref,
    };
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'navigation.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    groups: results.groups,
    truncation: results.truncation,
    itemCount: results.items.length,
    failed: results.items.filter((i) => !i.urlOk || !i.activeOk || i.bodyLen < 100),
    mobile: results.mobile,
    errors: results.errors,
  }, null, 2));
})();
