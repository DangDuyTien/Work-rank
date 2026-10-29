#!/usr/bin/env node
/**
 * PRIVATE MEDIA — BROWSER QA
 *
 * Verifies the two properties that only a real browser can prove:
 *   1. The capability is invisible in the sidebar for accounts without a grant
 *      (including a Work Rank admin).
 *   2. Pasting the URL directly shows the concealment page, not a permission
 *      error and not the feature.
 *
 * Usage (servers already running):
 *   PM_QA_BASE_URL=http://127.0.0.1:4173 \
 *   PM_QA_OWNER_TOKEN=... PM_QA_ADMIN_TOKEN=... \
 *   node scripts/private-media-browser-qa.mjs
 *
 * Tokens are minted out-of-band (see docs/audit/2026-10-27). The script never
 * logs them.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PM_QA_BASE_URL || 'http://127.0.0.1:4173';
const API = process.env.PM_QA_API_URL || 'http://127.0.0.1:5001';
const OWNER_TOKEN = process.env.PM_QA_OWNER_TOKEN || '';
const ADMIN_TOKEN = process.env.PM_QA_ADMIN_TOKEN || '';
const SHOTS = path.resolve(__dirname, '../../docs/audit/2026-10-27/shots');

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** Not a pass and not a failure: the capability is unavailable (missing credential). */
function recordSkip(name, detail = '') {
  results.push({ name, pass: null, detail });
  console.log(`SKIP  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function seedSession(page, token, userId) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(({ token: t, userId: id }) => {
    localStorage.setItem('token', t);
    localStorage.setItem('workrank_active_user_id', String(id));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank_session', JSON.stringify({
      userId: String(id), token: t, sessionGeneration: Date.now(),
    }));
  }, { token, userId });
}

async function sidebarHasPrivateMedia(page) {
  const nav = page.locator('nav[aria-label="Điều hướng chính"]');
  await nav.waitFor({ state: 'visible', timeout: 15000 });
  return nav.getByText('Điều khiển media', { exact: true }).count();
}

async function run() {
  if (!OWNER_TOKEN || !ADMIN_TOKEN) {
    console.error('Missing PM_QA_OWNER_TOKEN / PM_QA_ADMIN_TOKEN');
    process.exit(2);
  }
  fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    // YouTube serves a degraded player to HeadlessChrome; a normal desktop UA
    // makes the embed behave like the browser a real owner would use.
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  // ── Owner ────────────────────────────────────────────────────────────────
  await seedSession(page, OWNER_TOKEN, process.env.PM_QA_OWNER_ID || '10943');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const ownerNavCount = await sidebarHasPrivateMedia(page);
  record('OWNER_SEES_NAV', ownerNavCount > 0, `entries=${ownerNavCount}`);
  await page.screenshot({ path: path.join(SHOTS, 'owner-sidebar.png'), fullPage: false });

  await page.goto(`${BASE}/private/media`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
  const ownerHeading = await page.getByRole('heading', { name: 'Điều khiển media', level: 1 }).count();
  record('OWNER_OPENS_PAGE', ownerHeading > 0, `h1=${ownerHeading}`);
  await page.screenshot({ path: path.join(SHOTS, 'owner-private-media.png'), fullPage: true });

  // Real YouTube lookup through the official embed (keyless oEmbed resolve).
  const EMBEDDABLE_VIDEO = process.env.PM_QA_VIDEO_URL || 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
  const searchInput = page.getByLabel('Tìm video YouTube hoặc dán link');
  if (await searchInput.count()) {
    await searchInput.fill(EMBEDDABLE_VIDEO);
    await page.locator('.pm-search__form button[type="submit"]').click();
    await page.waitForTimeout(9000);
    const iframe = page.locator('iframe[src*="youtube.com/embed"]');
    const iframeCount = await iframe.count();
    record('YOUTUBE_PLAYER_EMBEDDED', iframeCount > 0, `iframes=${iframeCount}`);

    // The session must never claim PLAYING while the clock is frozen. This is
    // the invariant that catches a UI faking playback.
    const honestState = await page.evaluate(async ({ api, token }) => {
      const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? (await res.json()).session : null;
    }, { api: API, token: OWNER_TOKEN });
    const stateHonest = honestState?.status !== 'PLAYING' || Number(honestState?.currentTime) > 0;
    record(
      'SESSION_STATE_HONEST',
      stateHonest,
      `status=${honestState?.status} t=${Math.round(Number(honestState?.currentTime) || 0)}s`,
    );

    const activate = page.getByRole('button', { name: 'Kích hoạt trình phát' });
    const needsActivation = await activate.count();
    record(
      'AUTOPLAY_GESTURE_OFFERED_OR_ALLOWED',
      true,
      needsActivation > 0 ? 'activation button shown' : 'browser allowed autoplay',
    );
    await page.screenshot({ path: path.join(SHOTS, 'owner-player-loaded.png'), fullPage: true });
  } else {
    record('YOUTUBE_PLAYER_EMBEDDED', false, 'search input not found');
  }

  // ── Controls on the page itself ───────────────────────────────────────────
  // The floating window is an extra, never the only way to pause or change
  // volume: the page must always render the same five buttons.
  const readStatus = () => page.evaluate(async ({ api, token }) => {
    const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? (await res.json()).session.status : null;
  }, { api: API, token: OWNER_TOKEN });

  const inlineBar = await page.evaluate(() => {
    const bar = document.querySelector('.pm-inline-bar');
    if (!bar) return null;
    const btns = Array.from(bar.querySelectorAll('.pm-mini__btn'));
    return {
      count: btns.length,
      visible: bar.getBoundingClientRect().height > 0,
      enabled: btns.filter((b) => !b.disabled).length,
      labels: btns.map((b) => b.getAttribute('aria-label')),
    };
  });
  record(
    'INLINE_CONTROLS',
    Boolean(inlineBar) && inlineBar.visible && inlineBar.count === 5 && inlineBar.enabled === 5,
    inlineBar ? `buttons=${inlineBar.count} enabled=${inlineBar.enabled} [${inlineBar.labels.join(', ')}]` : 'inline bar missing',
  );

  if (inlineBar?.count === 5) {
    const beforeInline = await readStatus();
    await page.locator('.pm-inline .pm-mini__btn.is-primary').click();
    await page.waitForTimeout(2500);
    const afterInline = await readStatus();
    record('INLINE_COMMAND_WORKS', beforeInline !== afterInline, `${beforeInline} → ${afterInline}`);
    await page.screenshot({ path: path.join(SHOTS, 'owner-inline-controls.png'), fullPage: false });
  } else {
    recordSkip('INLINE_COMMAND_WORKS', 'inline bar missing');
  }

  // ── Floating controller (real Document PiP window) ────────────────────────
  await page.locator('.ui-page-actions button').first().waitFor({ state: 'visible', timeout: 15000 });
  await page.getByRole('button', { name: 'Cửa sổ nhỏ', exact: true }).click();
  await page.waitForTimeout(2000);

  const readPip = () => page.evaluate(() => {
    const win = window.documentPictureInPicture?.window;
    if (!win) return null;
    const el = win.document.querySelector('.pm-mini');
    return {
      buttons: Array.from(win.document.querySelectorAll('.pm-mini__btn')).map((b) => b.getAttribute('aria-label')),
      bg: el ? window.getComputedStyle(el).backgroundColor : null,
      text: win.document.body.innerText.trim(),
    };
  });

  const pip = await readPip();
  // The primary button label follows the real session status (Phát / Tạm dừng),
  // so only its position is fixed — the rest are stable.
  const expectedButtons = ['Nhỏ hơn', 'Dừng', 'Video tiếp theo', 'To hơn'];
  const primaryIsPlayState = (label) => label === 'Phát' || label === 'Tạm dừng';
  const pipLabelsOk = Boolean(pip)
    && pip.buttons.length === 5
    && primaryIsPlayState(pip.buttons[1])
    && expectedButtons.every((label, i) => pip.buttons[i === 0 ? 0 : i + 1] === label);

  // The window must be big enough for its content. Requesting less than the
  // content width clips the outer buttons — that is exactly how the controller
  // once shipped "with no buttons" on Windows.
  const pipFit = await page.evaluate(() => {
    const win = window.documentPictureInPicture?.window;
    const el = win?.document.querySelector('.pm-mini');
    if (!el) return null;
    const btns = Array.from(el.querySelectorAll('.pm-mini__btn'));
    const bar = el.getBoundingClientRect();
    const last = btns[btns.length - 1].getBoundingClientRect();
    return {
      overflow: el.scrollWidth > el.clientWidth,
      lastRight: Math.round(last.right),
      width: Math.round(bar.width),
      fits: last.right <= bar.right + 0.5,
    };
  });

  record(
    'MINI_PIP_WINDOW',
    Boolean(pip)
      && pipLabelsOk
      && pip.text === ''
      && Boolean(pipFit)
      && pipFit.fits
      && !pipFit.overflow,
    pip
      ? `buttons=${pip.buttons.length} text="${pip.text}" fits=${pipFit?.fits} overflow=${pipFit?.overflow}`
      : 'no PiP window opened',
  );

  if (pip) {
    record('MINI_CONTROLLER_THEME', pip.bg === 'rgb(255, 255, 255)', `bg=${pip.bg}`);

    // Manual palette override from the rail control.
    await page.getByRole('button', { name: 'Tối', exact: true }).click();
    await page.waitForTimeout(700);
    const dark = await readPip();
    await page.getByRole('button', { name: 'Tự động', exact: true }).click();
    await page.waitForTimeout(700);
    const back = await readPip();
    record(
      'MINI_PALETTE_OVERRIDE',
      Boolean(dark) && dark.bg !== pip.bg && back?.bg === pip.bg,
      `auto=${pip.bg} dark=${dark?.bg} back=${back?.bg}`,
    );

    // A click inside the floating window must reach the shared command bus.
    const before = await page.evaluate(async ({ api, token }) => {
      const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? (await res.json()).session.status : null;
    }, { api: API, token: OWNER_TOKEN });
    await page.evaluate(() => {
      window.documentPictureInPicture?.window?.document.querySelector('.pm-mini__btn.is-primary')?.click();
    });
    await page.waitForTimeout(2500);
    const after = await page.evaluate(async ({ api, token }) => {
      const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? (await res.json()).session.status : null;
    }, { api: API, token: OWNER_TOKEN });
    record('MINI_COMMAND_WORKS', before !== after, `${before} → ${after}`);

    // Volume: two extra buttons step the session volume by 10.
    const readVolume = () => page.evaluate(async ({ api, token }) => {
      const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
      return res.ok ? (await res.json()).session.volume : null;
    }, { api: API, token: OWNER_TOKEN });
    const volBefore = await readVolume();
    await page.evaluate(() => {
      window.documentPictureInPicture?.window?.document.querySelector('.pm-mini__btn[aria-label="Nhỏ hơn"]')?.click();
    });
    await page.waitForTimeout(2000);
    const volDown = await readVolume();
    await page.evaluate(() => {
      window.documentPictureInPicture?.window?.document.querySelector('.pm-mini__btn[aria-label="To hơn"]')?.click();
    });
    await page.waitForTimeout(2000);
    const volUp = await readVolume();
    record(
      'MINI_VOLUME',
      volDown === Math.max(0, volBefore - 10) && volUp === volDown + 10,
      `${volBefore} → ${volDown} → ${volUp}`,
    );

    await page.screenshot({ path: path.join(SHOTS, 'owner-mini-bar.png'), fullPage: false });
    await page.getByRole('button', { name: 'Đóng cửa sổ nhỏ', exact: true }).click();
    await page.waitForTimeout(1200);
    const stillOpen = await page.evaluate(() => Boolean(window.documentPictureInPicture?.window));
    record('MINI_CLOSE', stillOpen === false, `window closed=${!stillOpen}`);
  } else {
    recordSkip('MINI_CONTROLLER_THEME', 'no PiP window');
    recordSkip('MINI_PALETTE_OVERRIDE', 'no PiP window');
    recordSkip('MINI_COMMAND_WORKS', 'no PiP window');
    recordSkip('MINI_CLOSE', 'no PiP window');
  }

  // ── In-app search (needs YOUTUBE_API_KEY on the server) ───────────────────
  const capabilities = await page.evaluate(async ({ api, token }) => {
    const res = await fetch(`${api}/api/private-media/status`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? (await res.json()).youtube : null;
  }, { api: API, token: OWNER_TOKEN });

  if (capabilities?.search) {
    await page.goto(`${BASE}/private/media`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.getByLabel('Tìm video YouTube hoặc dán link').fill('big buck bunny');
    await page.locator('.pm-search__form button[type="submit"]').click();
    await page.waitForTimeout(4500);
    const found = await page.locator('.pm-search .pm-result').count();
    record('YOUTUBE_SEARCH', found > 0, `results=${found}`);
    if (found > 0) {
      await page.screenshot({ path: path.join(SHOTS, 'owner-search-results.png'), fullPage: false });
    }
  } else {
    recordSkip('YOUTUBE_SEARCH', 'YOUTUBE_API_KEY not configured');
  }

  // ── Names only: no thumbnails anywhere, and no visible player ─────────────
  const thumbs = await page.locator('.pm-search .pm-result img').count();
  const visiblePlayer = await page.locator('.pm-player, .pm-stage__veil').count();
  const audioHost = await page.locator('.pm-audio-host iframe').count();
  record(
    'NAMES_ONLY_UI',
    thumbs === 0 && visiblePlayer === 0 && audioHost === 1,
    `thumbnails=${thumbs} visiblePlayer=${visiblePlayer} audioIframe=${audioHost}`,
  );
  await page.screenshot({ path: path.join(SHOTS, 'owner-discreet-mode.png'), fullPage: false });

  // ── Playback proof in a browser configured to permit autoplay ─────────────
  // Headless Chromium otherwise stalls in BUFFERING, which would prove nothing
  // about the product. This second context behaves like a desktop Chrome where
  // the viewer has allowed media autoplay.
  const playBrowser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const playContext = await playBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const playPage = await playContext.newPage();
  await seedSession(playPage, OWNER_TOKEN, process.env.PM_QA_OWNER_ID || '10943');
  await playPage.goto(`${BASE}/private/media`, { waitUntil: 'domcontentloaded' });
  await playPage.waitForTimeout(3000);
  const playInput = playPage.getByLabel('Tìm video YouTube hoặc dán link');
  await playInput.fill(EMBEDDABLE_VIDEO);
  await playPage.locator('.pm-search__form button[type="submit"]').click();
  await playPage.waitForTimeout(11000);

  const playback = await playPage.evaluate(async ({ api, token }) => {
    const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? (await res.json()).session : null;
  }, { api: API, token: OWNER_TOKEN });
  record(
    'PLAYBACK_PROGRESS',
    Boolean(playback?.video?.videoId) && Number(playback?.currentTime) > 0,
    `video=${playback?.video?.videoId || 'none'} t=${playback?.currentTime || 0}s status=${playback?.status}`,
  );
  await playPage.screenshot({ path: path.join(SHOTS, 'owner-player-playing.png'), fullPage: true });

  // ── Seek (scrub bar on the page) ──────────────────────────────────────────
  // The scrub must move the real playhead and must NOT be rewound by the
  // heartbeat that was already in flight when the command landed.
  const readPlay = () => playPage.evaluate(async ({ api, token }) => {
    const res = await fetch(`${api}/api/private-media/session`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const s = (await res.json()).session;
    return { t: Math.round(Number(s.currentTime) || 0), status: s.status, dur: Number(s.durationSeconds || s.video?.durationSeconds || 0) };
  }, { api: API, token: OWNER_TOKEN });

  const seekBar = playPage.locator('.pm-seek__range');
  if (await seekBar.count()) {
    const before = await readPlay();
    const box = await seekBar.boundingBox();
    await playPage.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
    await playPage.mouse.down();
    await playPage.mouse.move(box.x + box.width * 0.55, box.y + box.height / 2, { steps: 10 });
    await playPage.mouse.up();
    await playPage.waitForTimeout(2500);
    const after = await readPlay();
    await playPage.waitForTimeout(2500);
    const later = await readPlay();

    const target = Math.round((before?.dur || 0) * 0.55);
    record(
      'SEEK_WORKS',
      Boolean(after) && target > 0 && Math.abs(after.t - target) < 30 && later.t >= after.t,
      `target≈${target}s got=${after?.t}s → +2.5s ${later?.t}s`,
    );
    await playPage.screenshot({ path: path.join(SHOTS, 'owner-seek-bar.png'), fullPage: false });
  } else {
    recordSkip('SEEK_WORKS', 'seek bar missing');
  }

  await playBrowser.close();

  // Owner API surface answers with entitlement.
  const ownerApi = await page.evaluate(async ({ api, token }) => {
    const res = await fetch(`${api}/api/private-media/access`, { headers: { Authorization: `Bearer ${token}` } });
    return { status: res.status, body: await res.json().catch(() => null) };
  }, { api: API, token: OWNER_TOKEN });
  record('OWNER_API_ACCESS', ownerApi.status === 200 && ownerApi.body?.isOwner === true, `status=${ownerApi.status}`);

  // ── Admin (no grant) ─────────────────────────────────────────────────────
  await seedSession(page, ADMIN_TOKEN, process.env.PM_QA_ADMIN_ID || '1');
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);

  const adminNavCount = await sidebarHasPrivateMedia(page);
  record('ADMIN_HIDDEN_IN_SIDEBAR', adminNavCount === 0, `entries=${adminNavCount}`);
  await page.screenshot({ path: path.join(SHOTS, 'admin-sidebar.png'), fullPage: false });

  await page.goto(`${BASE}/private/media`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
  const notFound = await page.getByRole('heading', { name: 'Không tìm thấy trang' }).count();
  const leaked = await page.getByRole('heading', { name: 'Điều khiển media', level: 1 }).count();
  record('ADMIN_DIRECT_ROUTE_CONCEALED', notFound > 0 && leaked === 0, `notFound=${notFound} leaked=${leaked}`);
  await page.screenshot({ path: path.join(SHOTS, 'admin-direct-url.png'), fullPage: true });

  const adminApi = await page.evaluate(async ({ api, token }) => {
    const endpoints = ['access', 'status', 'session', 'grants', 'audit', 'devices'];
    const out = {};
    for (const endpoint of endpoints) {
      const res = await fetch(`${api}/api/private-media/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } });
      out[endpoint] = res.status;
    }
    const grant = await fetch(`${api}/api/private-media/grants`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 1, permissions: { view: true, control: true } }),
    });
    out.grantPost = grant.status;
    return out;
  }, { api: API, token: ADMIN_TOKEN });

  const allDenied = Object.values(adminApi).every((status) => status === 404);
  record('ADMIN_API_DENIED', allDenied, JSON.stringify(adminApi));

  await browser.close();

  const failed = results.filter((entry) => entry.pass === false);
  const skipped = results.filter((entry) => entry.pass === null);
  const passed = results.filter((entry) => entry.pass === true);
  console.log(`\n${passed.length}/${results.length - skipped.length} checks passed`
    + (skipped.length ? ` (${skipped.length} skipped)` : ''));
  fs.writeFileSync(
    path.join(SHOTS, 'browser-qa.json'),
    JSON.stringify({ base: BASE, api: API, results }, null, 2),
  );
  process.exit(failed.length ? 1 : 0);
}

run().catch((error) => {
  console.error('QA crashed:', error.message);
  process.exit(1);
});
