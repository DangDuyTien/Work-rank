#!/usr/bin/env node
/**
 * Drawing persistent-storage acceptance harness.
 *
 * Chạy với backend + frontend + DB + object storage THẬT (không mock API).
 * Dùng được cho cả QA S3 local và bucket production (R2/S3/Supabase):
 *
 *   node scripts/drawing-storage-acceptance.mjs publish --state /tmp/wr.json
 *   node scripts/drawing-storage-acceptance.mjs read    --state /tmp/wr.json
 *   node scripts/drawing-storage-acceptance.mjs delete  --state /tmp/wr.json
 *
 * Mỗi bước ghi JSON + screenshot vào --out để làm bằng chứng.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';

const args = Object.fromEntries(
  process.argv.slice(3).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
  }, [])
);

const MODE = process.argv[2] || 'publish';
const API = String(args.api || 'http://127.0.0.1:5001').replace(/\/+$/, '');
const WEB = String(args.web || 'http://127.0.0.1:5173').replace(/\/+$/, '');
const EMAIL = String(args.email || 'qa.drawing.owner@workrank.test');
const PASSWORD = String(args.password || 'QaDraw!2026');
const OUT = path.resolve(args.out || '/Users/quynh/.workrank-qa/evidence');
const STATE_PATH = path.resolve(args.state || path.join(OUT, 'acceptance-state.json'));

fs.mkdirSync(OUT, { recursive: true });

function log(step, detail) {
  console.log(`[${new Date().toISOString()}] ${step}${detail ? ` :: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
}

function saveState(patch) {
  const current = fs.existsSync(STATE_PATH) ? JSON.parse(fs.readFileSync(STATE_PATH, 'utf8')) : {};
  const next = { ...current, ...patch };
  fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  return next;
}

function loadState() {
  if (!fs.existsSync(STATE_PATH)) throw new Error(`Không có state tại ${STATE_PATH}. Chạy mode publish trước.`);
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

async function apiLogin() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`Login thất bại (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

/** Bơm đúng shape mà storeAuth() ghi, để AuthContext bootstrap như một phiên thật. */
function authInitScript(session) {
  const payload = {
    token: session.accessToken,
    refreshToken: session.refreshToken,
    userId: String(session.user?.id || ''),
  };
  return `(() => {
    const s = ${JSON.stringify(payload)};
    if (s.token) localStorage.setItem('token', s.token);
    if (s.refreshToken) localStorage.setItem('refreshToken', s.refreshToken);
    if (s.userId) localStorage.setItem('workrank_active_user_id', s.userId);
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank_session', JSON.stringify({ userId: s.userId, token: s.token, sessionGeneration: Date.now() }));
  })();`;
}

async function newAuthedPage(browser, session, { withAuth = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  if (withAuth) await context.addInitScript(authInitScript(session));
  const page = await context.newPage();
  return { context, page };
}

async function drawArtwork(page) {
  await page.goto(`${WEB}/games/drawing`, { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas.drawing-canvas', { timeout: 30000 });
  // Chờ draft load xong (draftReady) — HUD đổi khỏi trạng thái "Đang mở bản nháp…".
  await page.waitForFunction(
    () => !document.querySelector('.drawing-save-hud span')?.textContent?.includes('Đang mở bản nháp'),
    { timeout: 30000 }
  );

  // Màu hồng để tác phẩm QA dễ nhận diện.
  await page.click('button[aria-label="Màu #ec4899"]');
  const box = await page.locator('canvas.drawing-canvas').boundingBox();
  if (!box) throw new Error('Không lấy được bounding box của canvas.');

  const stroke = async (points) => {
    const [first, ...rest] = points;
    await page.mouse.move(box.x + box.width * first[0], box.y + box.height * first[1]);
    await page.mouse.down();
    for (const [x, y] of rest) {
      await page.mouse.move(box.x + box.width * x, box.y + box.height * y, { steps: 8 });
    }
    await page.mouse.up();
  };

  // Chữ W + gạch chân: đủ nét để khác biệt với ảnh trắng.
  await stroke([[0.18, 0.28], [0.24, 0.62], [0.30, 0.36], [0.36, 0.62], [0.42, 0.28]]);
  await stroke([[0.18, 0.74], [0.42, 0.74]]);
  await stroke([[0.55, 0.30], [0.72, 0.30], [0.72, 0.66], [0.55, 0.66], [0.55, 0.30]]);
}

async function publishFlow(page, { doubleClick = false } = {}) {
  await drawArtwork(page);
  const title = `QA Persistent ${new Date().toISOString().replace(/[:.]/g, '-')}`;

  await page.click('button.drawing-finish-btn');
  await page.waitForSelector('#artwork-title', { timeout: 15000 });
  await page.fill('#artwork-title', title);

  const stage = [];
  const publishButton = page.getByRole('button', { name: /Đăng tranh lên Thư viện/i });
  if (doubleClick) {
    // Hai click trong cùng một tick: React chưa kịp disable nút, nên đây là
    // đúng tình huống double-click thật mà publishingRef phải chặn.
    await page.evaluate(() => {
      const btn = document.querySelector('.share-submit-btn');
      btn.click();
      btn.click();
    });
  } else {
    await publishButton.click();
  }

  // Bắt các trạng thái thật của nút trong lúc publish.
  for (let i = 0; i < 80; i += 1) {
    const text = (await page.locator('.share-submit-btn').innerText().catch(() => '')) || '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized && stage[stage.length - 1] !== normalized) stage.push(normalized);
    if (await page.locator('.publish-success-state').count()) break;
    await page.waitForTimeout(100);
  }

  await page.waitForSelector('.publish-success-state', { timeout: 60000 });
  const successText = await page.locator('.publish-success-state').innerText();
  const idMatch = successText.match(/#(\d+)/);
  if (!idMatch) throw new Error(`Không đọc được drawing id từ: ${successText}`);
  const drawingId = Number(idMatch[1]);

  await page.screenshot({ path: path.join(OUT, 'publish-success.png'), fullPage: false });

  // Ảnh preview trong modal phải là ảnh remote thật (không phải blob:).
  const previewSrc = await page.locator('.publish-preview-img').getAttribute('src');
  return { drawingId, title, stage, successText, previewSrc };
}

async function verifyViaApi(drawingId, session) {
  const res = await fetch(`${API}/api/drawings/${drawingId}`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`GET drawing thất bại (${res.status}): ${JSON.stringify(body)}`);
  return body.drawing;
}

async function headObject(url) {
  const res = await fetch(url, { redirect: 'follow' });
  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    contentType: res.headers.get('content-type'),
    contentLength: Number(res.headers.get('content-length') || buffer.length),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.length,
  };
}

async function galleryHasImage(page, imageUrl) {
  await page.goto(`${WEB}/creative-corner`, { waitUntil: 'networkidle' });
  const img = page.locator(`img.public-artwork-canvas-img[src="${imageUrl}"]`).first();
  try {
    await img.waitFor({ state: 'attached', timeout: 30000 });
  } catch (err) {
    const srcs = await page
      .locator('img.public-artwork-canvas-img')
      .evaluateAll((els) => els.map((el) => el.getAttribute('src')))
      .catch(() => []);
    throw new Error(
      `Không thấy ảnh trong gallery. url=${page.url()} srcs=${JSON.stringify(srcs)}`
    );
  }
  await page.waitForFunction(
    (src) => {
      const el = document.querySelector(`img.public-artwork-canvas-img[src="${src}"]`);
      return Boolean(el && el.complete && el.naturalWidth > 0);
    },
    imageUrl,
    { timeout: 30000 }
  );
  const natural = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight }));
  return natural;
}

async function clearAllBrowserStorage(context, page) {
  await page.evaluate(async () => {
    localStorage.clear();
    sessionStorage.clear();
    const dbs = (await indexedDB.databases?.()) || [];
    await Promise.all(
      dbs.map(
        (db) =>
          new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(db.name);
            req.onsuccess = req.onerror = req.onblocked = () => resolve();
          })
      )
    );
    if (self.caches) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  });
  await context.clearCookies();
}

async function run() {
  if (MODE === 'publish') {
    const session = await apiLogin();
    const browser = await chromium.launch({ headless: true });
    try {
      const { context, page } = await newAuthedPage(browser, session);
      const result = await publishFlow(page);
      const drawing = await verifyViaApi(result.drawingId, session);
      const object = await headObject(drawing.imageUrl);

      const evidence = {
        capturedAt: new Date().toISOString(),
        mode: 'publish',
        user: { id: session.user?.id, email: session.user?.email },
        drawingId: result.drawingId,
        title: result.title,
        publishStages: result.stage,
        successText: result.successText,
        previewSrc: result.previewSrc,
        apiDrawing: drawing,
        object,
      };
      fs.writeFileSync(path.join(OUT, 'publish-evidence.json'), JSON.stringify(evidence, null, 2));
      saveState({
        drawingId: result.drawingId,
        imageUrl: drawing.imageUrl,
        title: result.title,
        sha256: object.sha256,
        bytes: object.bytes,
        userId: session.user?.id,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      });
      log('publish', { drawingId: result.drawingId, imageUrl: drawing.imageUrl, object });
      console.log(JSON.stringify({ ok: object.status === 200 && object.bytes > 0, drawingId: result.drawingId }));
      await context.close();
    } finally {
      await browser.close();
    }
    return;
  }

  if (MODE === 'read') {
    const state = loadState();
    const session = await apiLogin();
    const browser = await chromium.launch({ headless: true });
    const report = { capturedAt: new Date().toISOString(), mode: 'read', drawingId: state.drawingId, steps: {} };
    try {
      // Browser B — context hoàn toàn mới, không có storage của browser A.
      const b = await newAuthedPage(browser, session);
      report.steps.browserB = await galleryHasImage(b.page, state.imageUrl);
      await b.page.screenshot({ path: path.join(OUT, 'read-browser-b.png'), fullPage: false });
      await b.context.close();

      // Anonymous: Creative Corner nằm trong khu vực cần đăng nhập, nhưng API
      // gallery phải trả được tranh PUBLIC mà không cần token.
      const anonApi = await fetch(`${API}/api/drawings?page=1&limit=24&visibility=PUBLIC`);
      const anonBody = await anonApi.json();
      report.steps.anonymousApi = {
        status: anonApi.status,
        containsDrawing: Boolean(anonBody.drawings?.some((d) => d.id === state.drawingId)),
      };
      const anon = await newAuthedPage(browser, session, { withAuth: false });
      await anon.page.goto(`${WEB}/creative-corner`, { waitUntil: 'networkidle' });
      report.steps.anonymousUiRedirect = new URL(anon.page.url()).pathname;
      await anon.page.screenshot({ path: path.join(OUT, 'read-anonymous.png'), fullPage: false });
      await anon.context.close();

      // Browser A: xóa sạch storage + cache rồi đọc lại.
      const a = await newAuthedPage(browser, session);
      report.steps.browserABeforeClear = await galleryHasImage(a.page, state.imageUrl);
      await clearAllBrowserStorage(a.context, a.page);
      const cdp = await a.context.newCDPSession(a.page);
      await cdp.send('Network.clearBrowserCache').catch(() => {});
      // Sau khi xóa, phiên đăng nhập cũng mất → đăng nhập lại rồi mở gallery.
      await a.page.goto(`${WEB}/login`, { waitUntil: 'domcontentloaded' });
      await a.context.addInitScript(authInitScript(session));
      report.steps.afterClearStorage = await galleryHasImage(a.page, state.imageUrl);
      await a.page.screenshot({ path: path.join(OUT, 'read-after-clear-storage.png'), fullPage: false });
      await a.context.close();

      fs.writeFileSync(path.join(OUT, 'read-evidence.json'), JSON.stringify(report, null, 2));
      log('read', report.steps);
      console.log(JSON.stringify({ ok: true, steps: report.steps }));
    } finally {
      await browser.close();
    }
    return;
  }

  if (MODE === 'duplicate') {
    const session = await apiLogin();
    const browser = await chromium.launch({ headless: true });
    try {
      const { context, page } = await newAuthedPage(browser, session);
      const result = await publishFlow(page, { doubleClick: true });
      const list = await fetch(`${API}/api/drawings?page=1&limit=50&visibility=PUBLIC`).then((r) => r.json());
      const sameTitle = list.drawings.filter((d) => d.title === result.title);
      const evidence = {
        capturedAt: new Date().toISOString(),
        mode: 'duplicate-publish',
        title: result.title,
        drawingId: result.drawingId,
        sameTitleCount: sameTitle.length,
        sameTitleIds: sameTitle.map((d) => d.id),
      };
      fs.writeFileSync(path.join(OUT, 'duplicate-publish-evidence.json'), JSON.stringify(evidence, null, 2));
      log('duplicate', evidence);
      console.log(JSON.stringify({ ok: sameTitle.length === 1, evidence }));
      await context.close();
    } finally {
      await browser.close();
    }
    return;
  }

  if (MODE === 'delete') {
    const state = loadState();
    const session = await apiLogin();
    const before = await verifyViaApi(state.drawingId, session);

    const del = await fetch(`${API}/api/drawings/${state.drawingId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const delBody = await del.json();

    const afterGet = await fetch(`${API}/api/drawings/${state.drawingId}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    const objectAfter = await headObject(state.imageUrl);

    const evidence = {
      capturedAt: new Date().toISOString(),
      mode: 'delete',
      drawingId: state.drawingId,
      before: { imageUrl: before.imageUrl },
      deleteStatus: del.status,
      deleteBody: delBody,
      getAfterStatus: afterGet.status,
      objectAfter,
    };
    fs.writeFileSync(path.join(OUT, 'delete-evidence.json'), JSON.stringify(evidence, null, 2));
    log('delete', evidence);
    console.log(JSON.stringify({ ok: del.ok && objectAfter.status === 404, evidence }));
    return;
  }

  throw new Error(`Mode không hỗ trợ: ${MODE}`);
}

run().catch((err) => {
  console.error('[acceptance] FAILED:', err.message);
  process.exit(1);
});
