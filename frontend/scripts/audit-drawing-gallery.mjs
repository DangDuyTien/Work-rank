/**
 * Phase 7/10 — Xưởng Vẽ + Thư viện tranh: vẽ thật, autosave draft, reload,
 * publish, kiểm tra trong gallery, like, lightbox, download, delete.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const API = process.env.API_URL || 'http://127.0.0.1:5001';
const EMAIL = process.env.AUDIT_EMAIL || 'audit.admin@workrank.test';
const PASSWORD = process.env.AUDIT_PASSWORD || 'AuditPass!2026';
const OUT = process.env.OUT_DIR || path.resolve('docs/audit/2026-10-23/full-sidebar');

const report = { steps: [], consoleErrors: [], badResponses: [] };
const step = (name, data, ok = true) => {
  report.steps.push({ name, ok, data });
  console.log(`${ok ? '✓' : '✗'} ${name}`, JSON.stringify(data).slice(0, 260));
};

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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', acceptDownloads: true });
  await context.addInitScript(([t]) => localStorage.setItem('token', t), [auth.accessToken]);
  const page = await context.newPage();
  page.on('pageerror', (e) => report.consoleErrors.push({ text: String(e.message).slice(0, 300) }));
  page.on('console', (m) => { if (m.type() === 'error') report.consoleErrors.push({ text: m.text().slice(0, 300) }); });
  page.on('response', (r) => { if (r.status() >= 400) report.badResponses.push({ status: r.status(), url: r.url().slice(0, 180) }); });

  // ═══════════════ XƯỞNG VẼ ═══════════════
  await page.goto(`${WEB}/games/drawing`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const canvasInfo = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return null;
    const r = c.getBoundingClientRect();
    return { width: c.width, height: c.height, rect: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
  step('canvas present', canvasInfo, Boolean(canvasInfo));

  // vẽ một nét
  if (canvasInfo) {
    const box = await page.locator('canvas').boundingBox();
    const y = box.y + box.height / 2;
    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    for (let i = 1; i <= 12; i += 1) {
      await page.mouse.move(box.x + box.width * (0.25 + i * 0.02), y + Math.sin(i / 2) * 40, { steps: 2 });
    }
    await page.mouse.up();
    await page.waitForTimeout(600);
    const painted = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      const ctx = c.getContext('2d');
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      let count = 0;
      for (let i = 3; i < data.length; i += 400) if (data[i] > 0) count += 1;
      return count;
    });
    step('draw stroke', { paintedSamples: painted }, painted > 0);
    await page.screenshot({ path: path.join(OUT, 'shots', 'drawing-after-stroke.png'), fullPage: false }).catch(() => {});
  }

  // đổi màu + cỡ cọ
  const colorBtns = page.locator('.drawing-swatch, button[aria-label*="màu"], button[title*="màu"]');
  const colorCount = await colorBtns.count();
  if (colorCount > 2) { await colorBtns.nth(2).click(); await page.waitForTimeout(300); }
  step('color palette', { swatches: colorCount });

  // autosave draft
  await page.waitForTimeout(2500);
  const draftStatus = await page.evaluate(() => {
    const t = document.body.innerText;
    const m = t.match(/(Đã lưu bản nháp|Đang lưu|Bản nháp[^\n]*)/i);
    return m ? m[0] : null;
  });
  step('draft status text', { draftStatus });

  // reload → draft restore
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  const restored = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return { canvas: false };
    const ctx = c.getContext('2d');
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    let count = 0;
    for (let i = 3; i < data.length; i += 400) if (data[i] > 0) count += 1;
    const t = document.body.innerText;
    const m = t.match(/Đã khôi phục bản nháp[^\n]*|Bản nháp[^\n]*/i);
    return { canvas: true, paintedSamples: count, status: m ? m[0] : null };
  });
  step('draft restored after reload', restored, restored.paintedSamples > 0);

  // publish
  const title = `Audit Test ${new Date().toISOString().slice(11, 19)}`;
  const publishBtn = page.getByRole('button', { name: /Đăng tranh/ }).first();
  if (await publishBtn.isVisible().catch(() => false)) {
    await publishBtn.click();
    await page.waitForTimeout(1200);
    const titleInput = page.locator('input[placeholder*="tên tác phẩm"]').first();
    const hasModal = await titleInput.isVisible().catch(() => false);
    step('publish modal', { hasModal });
    if (hasModal) {
      await titleInput.fill(title);
      await page.waitForTimeout(400);
      const submit = page.getByRole('button', { name: /Đăng tranh lên Thư viện/ }).first();
      const enabled = await submit.isEnabled().catch(() => false);
      step('publish submit enabled', { enabled });
      if (enabled) {
        await submit.click();
        await page.waitForTimeout(6000);
        const success = await page.evaluate(() => document.body.innerText.includes('Đã đăng tranh!'));
        const idMatch = await page.evaluate(() => document.body.innerText.match(/Tác phẩm #(\d+)/));
        step('publish success', { success, artworkId: idMatch ? idMatch[1] : null, title }, success);
        await page.screenshot({ path: path.join(OUT, 'shots', 'drawing-published.png'), fullPage: false }).catch(() => {});
      } else {
        const notice = await page.evaluate(() => document.body.innerText.match(/Hiện chưa thể đăng tranh[^\n]*/)?.[0] || null);
        step('publish unavailable', { notice }, true);
        await page.getByRole('button', { name: /Tiếp tục chỉnh sửa/ }).first().click().catch(() => {});
        await page.waitForTimeout(500);
      }
    }
  } else {
    step('publish button', { found: false }, false);
  }

  // ═══════════════ THƯ VIỆN TRANH ═══════════════
  await page.goto(`${WEB}/creative-corner`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const gallery = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('.public-artwork-grid img, .gallery-wall img')];
    return {
      cards: document.querySelectorAll('.public-artwork-card, .gallery-wall article').length,
      images: imgs.length,
      broken: imgs.filter((i) => i.complete && i.naturalWidth === 0).length,
      titles: [...document.querySelectorAll('.public-artwork-title, .gallery-wall h3')].map((n) => n.textContent.trim()).slice(0, 10),
    };
  });
  step('gallery render', gallery);

  // sort tabs
  for (const label of ['Mới nhất', 'Nhiều tim nhất']) {
    const tab = page.getByRole('tab', { name: label }).first();
    if (await tab.isVisible().catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(1200);
      step(`gallery sort ${label}`, { pressed: await tab.getAttribute('aria-selected') });
    }
  }

  // like first artwork
  const likeBtn = page.locator('.public-artwork-card button[title*="tim"], button[title*="Thả tim"]').first();
  if (await likeBtn.isVisible().catch(() => false)) {
    const before = (await likeBtn.innerText()).trim();
    await likeBtn.click();
    await page.waitForTimeout(1200);
    const after = (await likeBtn.innerText()).trim();
    step('gallery like toggle', { before, after, changed: before !== after });
    await likeBtn.click();
    await page.waitForTimeout(800);
  } else {
    step('gallery like toggle', { found: false }, false);
  }

  // lightbox
  const detail = page.getByRole('button', { name: /Xem chi tiết tác phẩm/ }).first();
  if (await detail.isVisible().catch(() => false)) {
    await detail.click();
    await page.waitForTimeout(900);
    const lb = await page.evaluate(() => {
      const el = document.querySelector('[role="dialog"]');
      return { open: Boolean(el), role: el?.getAttribute('role'), ariaModal: el?.getAttribute('aria-modal') };
    });
    step('lightbox open', lb, lb.open);
    await page.screenshot({ path: path.join(OUT, 'shots', 'gallery-lightbox.png') }).catch(() => {});
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    step('lightbox Escape close', { stillOpen: await page.locator('[role="dialog"]').count() });
  }

  // download
  const dlBtn = page.getByRole('button', { name: 'Tải ảnh PNG' }).first();
  if (await dlBtn.isVisible().catch(() => false)) {
    const dlPromise = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
    await dlBtn.click();
    const dl = await dlPromise;
    step('gallery download', { downloaded: Boolean(dl), filename: dl ? dl.suggestedFilename() : null }, Boolean(dl));
  }

  // delete the artwork we created
  const card = page.locator('.public-artwork-card', { hasText: title }).first();
  if (await card.count()) {
    const del = card.getByRole('button', { name: 'Xóa tác phẩm' }).first();
    if (await del.isVisible().catch(() => false)) {
      await del.click();
      await page.waitForTimeout(700);
      const confirm = page.getByRole('button', { name: /^Xóa/ }).last();
      await confirm.click().catch(() => {});
      await page.waitForTimeout(1500);
      step('gallery delete', { stillThere: await page.locator('.public-artwork-card', { hasText: title }).count() });
    }
  }

  await browser.close();
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'drawing-gallery.json'), JSON.stringify(report, null, 2));
  console.log('bad responses', JSON.stringify(report.badResponses.slice(0, 10)));
  console.log('console errors', JSON.stringify(report.consoleErrors.slice(0, 10)));
})();
