/**
 * Phase 18/21 — Responsive (390/430/768/1024/1280/1920) + accessibility heuristics.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const ROUTES = [
  '/dashboard', '/youtube', '/leaderboard', '/arena', '/grand', '/friends', '/games',
  '/games/typing/passage', '/games/typing/words', '/games/arcade/direction_rush',
  '/games/arcade/memory_flash', '/games/drawing', '/creative-corner', '/users/1', '/settings',
  '/admin/kpi', '/admin/privileges', '/admin/teams-youtube', '/admin/competition/seasons',
  '/admin/competition/rules', '/admin/competition/grand', '/admin/operations',
];
const WIDTHS = [390, 430, 768, 1024, 1280, 1920];

const report = { responsive: [], a11y: [] };

async function login() {
  const res = await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'audit.admin@workrank.test', password: 'AuditPass!2026' }) });
  return res.json();
}

(async () => {
  const auth = await login();
  const browser = await chromium.launch({ headless: true });

  for (const route of ROUTES) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await ctx.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
    const page = await ctx.newPage();
    const entry = { route, widths: [] };

    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
      await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(900);
      const m = await page.evaluate(() => {
        const vw = window.innerWidth;
        const doc = document.documentElement;
        const clipped = [];
        const smallTargets = [];
        for (const el of document.querySelectorAll('body *')) {
          const s = getComputedStyle(el);
          if (s.display === 'none' || s.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width < 1 || r.height < 1) continue;
          if (r.right > vw + 2 && r.left < vw) {
            if (clipped.length < 6) clipped.push({ tag: el.tagName.toLowerCase(), cls: String(el.className || '').slice(0, 50), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 40) });
          }
          if ((el.tagName === 'BUTTON' || el.tagName === 'A') && r.width < 32 && r.height < 32) {
            if (smallTargets.length < 6) smallTargets.push({ tag: el.tagName.toLowerCase(), w: Math.round(r.width), h: Math.round(r.height), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30) });
          }
        }
        return {
          viewport: vw,
          scrollWidth: doc.scrollWidth,
          overflow: doc.scrollWidth > vw + 2,
          clipped,
          smallTargets,
          tableOverflow: [...document.querySelectorAll('table')].filter((t) => t.scrollWidth > t.parentElement.clientWidth + 2).length,
        };
      });
      entry.widths.push({ width, ...m });
      if (m.overflow) console.log(`✗ overflow ${route} @${width} (${m.scrollWidth}px)`);
    }

    // A11y heuristics ở desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(WEB + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const a11y = await page.evaluate(() => {
      const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
      const buttons = [...document.querySelectorAll('button')].filter(visible);
      const noName = buttons.filter((b) => !(b.innerText || '').trim() && !b.getAttribute('aria-label') && !b.getAttribute('title')).length;
      const imgs = [...document.querySelectorAll('img')].filter(visible);
      const noAlt = imgs.filter((i) => !i.getAttribute('alt')).length;
      const inputs = [...document.querySelectorAll('input,select,textarea')].filter(visible);
      const unlabeled = inputs.filter((i) => {
        if (i.getAttribute('aria-label') || i.getAttribute('placeholder')) return false;
        if (i.id && document.querySelector(`label[for="${i.id}"]`)) return false;
        return !i.closest('label');
      }).length;
      const h1 = document.querySelectorAll('h1').length;
      const headings = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => Number(h.tagName[1]));
      let skips = 0;
      for (let i = 1; i < headings.length; i += 1) if (headings[i] - headings[i - 1] > 1) skips += 1;
      return { buttons: buttons.length, buttonsNoName: noName, images: imgs.length, imagesNoAlt: noAlt, inputs: inputs.length, inputsUnlabeled: unlabeled, h1Count: h1, headingSkips: skips };
    });
    report.a11y.push({ route, ...a11y });
    report.responsive.push(entry);
    await ctx.close();
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'responsive-a11y.json'), JSON.stringify(report, null, 2));

  console.log('\n=== A11Y ===');
  for (const a of report.a11y) console.log(`${a.route} h1=${a.h1Count} btnNoName=${a.buttonsNoName}/${a.buttons} imgNoAlt=${a.imagesNoAlt}/${a.images} inputUnlabeled=${a.inputsUnlabeled}/${a.inputs} headingSkips=${a.headingSkips}`);
})();
