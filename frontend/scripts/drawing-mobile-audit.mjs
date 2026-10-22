#!/usr/bin/env node
/**
 * Drawing mobile / touch audit.
 *
 * Kiểm ở 390, 430, 768 (và 1440 để so sánh):
 *  - canvas có phải focal point, toolbar có nằm trong viewport
 *  - touch vẽ đúng toạ độ (pixel tại điểm chạm đổi màu)
 *  - trang không bị scroll khi đang vẽ
 *  - canvas không mờ: backing store = CSS size × devicePixelRatio
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const API = process.env.API_URL || 'http://127.0.0.1:5001';
const WEB = process.env.WEB_URL || 'http://127.0.0.1:5173';
const OUT = path.resolve(process.env.OUT_DIR || '/Users/quynh/.workrank-qa/evidence/ux');
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = process.env.QA_EMAIL || 'qa.drawing.owner@workrank.test';
const PASSWORD = process.env.QA_PASSWORD || 'QaDraw!2026';

const VIEWPORTS = [
  { name: '390', width: 390, height: 844, dpr: 3, touch: true },
  { name: '430', width: 430, height: 932, dpr: 3, touch: true },
  { name: '768', width: 768, height: 1024, dpr: 2, touch: true },
  { name: '1440', width: 1440, height: 900, dpr: 1, touch: false },
];

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`login ${res.status}`);
  return res.json();
}

function initScript(session) {
  return `(() => {
    localStorage.setItem('token', ${JSON.stringify(session.accessToken)});
    localStorage.setItem('refreshToken', ${JSON.stringify(session.refreshToken)});
    localStorage.setItem('workrank_active_user_id', ${JSON.stringify(String(session.user.id))});
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank_session', JSON.stringify({ userId: ${JSON.stringify(String(session.user.id))}, token: ${JSON.stringify(session.accessToken)}, sessionGeneration: Date.now() }));
  })();`;
}

async function touchStroke(context, page, box, points) {
  const cdp = await context.newCDPSession(page);
  const toScreen = ([x, y]) => ({ x: box.x + box.width * x, y: box.y + box.height * y });
  const [first, ...rest] = points.map(toScreen);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...first, id: 1 }] });
  for (const point of rest) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ ...point, id: 1 }] });
    await page.waitForTimeout(12);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
}

async function run() {
  const session = await login();
  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), viewports: {} };

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dpr,
      hasTouch: vp.touch,
      isMobile: vp.touch,
    });
    await context.addInitScript(initScript(session));
    const page = await context.newPage();
    await page.goto(`${WEB}/games/drawing`, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas.drawing-canvas');
    await page.waitForFunction(
      () => !document.querySelector('.drawing-save-hud span')?.textContent?.includes('Đang mở bản nháp'),
      { timeout: 20000 }
    );
    // Xóa nét cũ để phép đo pixel không phụ thuộc bản nháp trước đó.
    const clearButton = page.locator('.drawing-toolbar button[aria-label="Làm mới khung vẽ"]');
    if (await clearButton.count()) {
      await clearButton.first().click();
      const confirm = page.getByRole('button', { name: /^Xóa bảng vẽ$/ });
      if (await confirm.count()) await confirm.first().click();
      await page.waitForTimeout(400);
    }

    const metrics = await page.evaluate(() => {
      const canvas = document.querySelector('canvas.drawing-canvas');
      const rect = canvas.getBoundingClientRect();
      const style = getComputedStyle(canvas);
      const controls = [...document.querySelectorAll('.drawing-toolbar button')].filter((el) => {
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return r.width > 0 && style.visibility !== 'hidden' && style.opacity !== '0';
      });
      const offscreen = controls.filter((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > window.innerHeight + 1 || r.right > window.innerWidth + 1 || r.top < -1 || r.left < -1;
      }).length;
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        backing: { width: canvas.width, height: canvas.height },
        cssSize: { width: style.width, height: style.height },
        dpr: window.devicePixelRatio,
        scrollY: window.scrollY,
        docScrollable: document.documentElement.scrollHeight > window.innerHeight + 2,
        controlCount: controls.length,
        offscreenControls: offscreen,
        viewportShare: Number(((rect.width * rect.height) / (window.innerWidth * window.innerHeight)).toFixed(3)),
      };
    });

    await page.screenshot({ path: path.join(OUT, `drawing-${vp.name}.png`) });

    let touchResult = null;
    if (vp.touch) {
      const before = await page.evaluate(() => window.scrollY);
      await touchStroke(context, page, metrics.rect, [
        [0.30, 0.40],
        [0.50, 0.50],
        [0.70, 0.40],
      ]);
      await page.waitForTimeout(250);
      touchResult = await page.evaluate(() => {
        const canvas = document.querySelector('canvas.drawing-canvas');
        const ctx = canvas.getContext('2d');
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        // Điểm giữa đoạn đầu của nét vừa vẽ.
        const px = Math.round(0.4 * rect.width * scaleX);
        const py = Math.round(0.45 * rect.height * scaleY);
        const data = ctx.getImageData(Math.min(px, canvas.width - 1), Math.min(py, canvas.height - 1), 1, 1).data;
        return { pixel: [data[0], data[1], data[2], data[3]], scrollY: window.scrollY, drewAtPoint: data[3] > 0 && !(data[0] > 245 && data[1] > 245 && data[2] > 245) };
      });
      touchResult.scrollDelta = touchResult.scrollY - before;
      await page.screenshot({ path: path.join(OUT, `drawing-${vp.name}-touch.png`) });
    }

    report.viewports[vp.name] = {
      ...metrics,
      // Canvas 1200×700 được scale bằng CSS transform. Backing store luôn 1200px;
      // ở DPR 2/3 thì tỉ lệ backing/device ~0.9–1.3, tức không phóng quá 10%.
      backingToDeviceRatio: Number((metrics.backing.width / (metrics.rect.width * metrics.dpr)).toFixed(3)),
      canvasSharp: metrics.backing.width >= metrics.rect.width * metrics.dpr * 0.9,
      touch: touchResult,
    };
    console.log(`[ux] ${vp.name}`, JSON.stringify(report.viewports[vp.name]));
    await context.close();
  }

  fs.writeFileSync(path.join(OUT, 'drawing-ux-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}

run().catch((err) => {
  console.error('[ux] FAILED:', err.message);
  process.exit(1);
});
