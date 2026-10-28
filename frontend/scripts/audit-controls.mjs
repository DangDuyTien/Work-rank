/**
 * Dump visible interactive controls cho từng route — dùng để lập interaction inventory
 * trước khi click. Không click gì ở đây.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const ROUTES = JSON.parse(process.env.ROUTES_JSON || '[]');

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
  const out = {};

  for (const route of ROUTES) {
    await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(900);
    out[route] = await page.evaluate(() => {
      const visible = (el) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const name = (el) => (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 80);
      const sel = (el) => {
        if (el.id) return `#${el.id}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        const cls = String(el.className || '').split(/\s+/).filter(Boolean).slice(0, 2).join('.');
        return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}`;
      };
      const collect = (selector, kind) => [...document.querySelectorAll(selector)]
        .filter(visible)
        .map((el) => ({
          kind,
          name: name(el),
          sel: sel(el),
          href: el.getAttribute('href') || undefined,
          type: el.getAttribute('type') || undefined,
          disabled: el.disabled || undefined,
          ariaExpanded: el.getAttribute('aria-expanded') || undefined,
          role: el.getAttribute('role') || undefined,
        }));
      return {
        url: location.pathname + location.search,
        h1: [...document.querySelectorAll('h1')].filter(visible).map(name),
        buttons: collect('button, [role="button"], input[type="submit"]', 'button'),
        links: collect('a[href]', 'link'),
        tabs: collect('[role="tab"]', 'tab'),
        inputs: collect('input:not([type="hidden"]), textarea, select', 'input'),
        headings: [...document.querySelectorAll('h2, h3')].filter(visible).map(name).slice(0, 20),
        textSample: document.body.innerText.replace(/\s+/g, ' ').slice(0, 800),
      };
    });
  }
  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'controls.json'), JSON.stringify(out, null, 2));
  console.log('wrote controls.json', Object.keys(out).length, 'routes');
})();
