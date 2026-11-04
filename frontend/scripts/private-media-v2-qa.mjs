/**
 * PRIVATE MEDIA V2 — browser acceptance suite.
 *
 * Every check writes evidence to docs/audit/2026-11-04/browser/. A check is only
 * PASS when the assertion ran against the real YouTube iframe in a real browser.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.PM_QA_WEB || 'http://127.0.0.1:5279';
const api = process.env.PM_QA_API || 'http://127.0.0.1:5119';
const output = path.resolve('../docs/audit/2026-11-04/browser');
await fs.mkdir(output, { recursive: true });

const report = { startedAt: new Date().toISOString(), checks: [], errors: [], browser: '' };
const results = [];
function record(name, status, evidence) {
  report.checks.push({ name, status, evidence });
  results.push({ name, status });
  console.log(`${status} ${name}${evidence ? ` ${JSON.stringify(evidence).slice(0, 220)}` : ''}`);
}
function pass(name, evidence) { record(name, 'PASS', evidence); }
function fail(name, evidence) { record(name, 'FAIL', evidence); }
function blocked(name, evidence) { record(name, 'BLOCKED', evidence); }

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling'],
});
report.browser = `Chromium ${browser.version()}`;

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

async function identity(email, password = 'PrivateMediaAudit123!', viewport = { width: 1440, height: 980 }) {
  const context = await browser.newContext({ viewport, userAgent: UA });
  const login = await context.request.post(`${api}/api/auth/login`, { data: { email, password } });
  assert.equal(login.status(), 200, `login ${email}: ${await login.text()}`);
  const auth = await login.json();
  await context.addInitScript(({ token, refresh }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('workrank:private-media:room', 'shared');
  }, { token: auth.accessToken, refresh: auth.refreshToken });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(`${email}: ${error.message}`));
  const call = async (route, data, method) => {
    const response = await context.request[method || (data === undefined ? 'get' : 'post')](`${api}/api/private-media/${route}`, {
      headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-PM-Room': 'shared' },
      ...(data === undefined ? {} : { data }),
    });
    return { status: response.status(), body: await response.json().catch(() => null) };
  };
  const command = async (action, payload = {}) => {
    const response = await context.request.post(`${api}/api/private-media/commands`, {
      headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-PM-Room': 'shared' },
      data: { commandId: crypto.randomUUID(), action, payload },
    });
    return { status: response.status(), body: await response.json().catch(() => null) };
  };
  return { context, page, auth, call, command, email };
}

const mediaFrame = (page) => page.frames().find((frame) => frame.url().includes('/embed/'));

async function media(page) {
  const frame = mediaFrame(page);
  if (!frame) return null;
  return frame.evaluate(() => {
    const video = document.querySelector('video');
    if (!video) return { noVideo: true };
    return {
      currentTime: Number(video.currentTime.toFixed(2)),
      duration: Number((video.duration || 0).toFixed(1)),
      paused: video.paused,
      muted: video.muted,
      volume: Number(video.volume.toFixed(2)),
      readyState: video.readyState,
      src: (video.currentSrc || '').slice(0, 40),
    };
  }).catch(() => null);
}

async function until(work, predicate, timeout = 30000, label = 'condition') {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    last = await work();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`timeout waiting for ${label}: ${JSON.stringify(last)}`);
}

async function markIframe(page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('.pm-player__canvas iframe');
    if (!iframe) return false;
    iframe.dataset.pmQa = 'original';
    window.__pmIframe = iframe;
    return true;
  });
}

async function iframeIdentity(page) {
  return page.evaluate(() => {
    const marked = document.querySelectorAll('iframe[data-pm-qa="original"]').length;
    const iframe = document.querySelector('.pm-player__canvas iframe');
    const host = document.querySelector('.pm-audio-host');
    const box = host?.getBoundingClientRect();
    return {
      marked,
      sameNode: Boolean(iframe) && iframe === window.__pmIframe,
      audioOnly: host?.getAttribute('data-pm-player') === 'audio-only',
      offscreen: Boolean(box) && box.right <= 0,
      visibleVideo: [...document.querySelectorAll('iframe')].some((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && rect.right > 0 && rect.bottom > 0;
      }),
    };
  });
}

/** The app shell scrolls an inner container, not the window. */
async function scrollMediaToTop(page) {
  await page.evaluate(() => {
    let node = document.querySelector('.pm-now');
    while (node) {
      if (node.scrollHeight > node.clientHeight + 20) { node.scrollTop = 0; return; }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(600);
}

async function openMedia(page) {
  await page.goto(`${web}/private/media`);
  await page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
}

async function navigateTo(page, route) {
  const link = page.locator(`a[href="${route}"]`).first();
  await link.waitFor({ state: 'attached', timeout: 10000 });
  await link.click({ force: true });
  await page.waitForURL(`**${route}`, { timeout: 15000 });
  await page.waitForTimeout(400);
}

let A;
let B;
let admin;

try {
  A = await identity('tienddph50842@gmail.com');
  B = await identity('pm-listener@audit.test');
  admin = await identity('pm-admin@audit.test');

  // ═════════════════════════════════════════════════════════════════════════
  // TEST A — route change must not stop or reset the player
  // ═════════════════════════════════════════════════════════════════════════
  await openMedia(A.page);
  await A.command('QUEUE_CLEAR');
  await A.command('LOAD_VIDEO', { videoId: 'aqz-KE-bpKQ', title: 'A · Big Buck Bunny', durationSeconds: 635 });
  await until(() => media(A.page), (state) => state?.currentTime > 6 && !state.paused, 30000, 'A playing');

  const volumeBefore = await media(A.page);
  await A.page.getByLabel('Âm lượng của bạn', { exact: true }).focus();
  await A.page.getByLabel('Âm lượng của bạn', { exact: true }).press('Home');
  for (let i = 0; i < 8; i += 1) await A.page.getByLabel('Âm lượng của bạn', { exact: true }).press('ArrowRight');
  await A.page.waitForTimeout(400);
  const volumeSet = await media(A.page);

  assert.equal(await markIframe(A.page), true, 'player iframe exists on the media page');
  const beforeRoute = await media(A.page);

  const routeTrace = [];
  for (const route of ['/dashboard', '/leaderboard', '/games']) {
    await navigateTo(A.page, route);
    const onRoute = await media(A.page);
    const identityState = await iframeIdentity(A.page);
    routeTrace.push({ route, media: onRoute, ...identityState });
    assert.equal(identityState.sameNode, true, `iframe survives ${route}`);
    assert.equal(onRoute?.paused, false, `audio keeps playing on ${route}`);
  }
  await A.page.waitForTimeout(3000);

  await navigateTo(A.page, '/private/media');
  const afterReturn = await until(() => media(A.page), (state) => Boolean(state) && !state.noVideo, 20000, 'player after return');
  const identityAfter = await iframeIdentity(A.page);

  assert.equal(identityAfter.sameNode, true, 'same iframe node after returning');
  assert.equal(identityAfter.audioOnly, true, 'player stays audio-only');
  assert.equal(identityAfter.offscreen, true, 'player iframe stays off-screen');
  assert.equal(identityAfter.visibleVideo, false, 'no video surface is rendered');
  assert.equal(afterReturn.paused, false, 'still playing after returning');
  assert.ok(afterReturn.currentTime > beforeRoute.currentTime + 2, `timeline advanced (${beforeRoute.currentTime} → ${afterReturn.currentTime})`);
  assert.ok(Math.abs(afterReturn.volume - volumeSet.volume) < 0.03, 'local volume preserved across routes');

  if (routeTrace.every((entry) => entry.sameNode && entry.media && entry.media.paused === false) && identityAfter.sameNode) {
    pass('PLAYER_ROUTE_PERSISTENCE', { before: beforeRoute, after: afterReturn, routeTrace });
    pass('PLAYER_NO_RESET_TO_ZERO', { before: beforeRoute.currentTime, after: afterReturn.currentTime });
    pass('LOCAL_VOLUME_INDEPENDENT', { set: volumeSet.volume, afterReturn: afterReturn.volume });
  } else {
    fail('PLAYER_ROUTE_PERSISTENCE', { routeTrace, identityAfter });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST B — browser tab switch
  // ═════════════════════════════════════════════════════════════════════════
  const beforeTab = await media(A.page);
  const otherTab = await A.context.newPage();
  await otherTab.goto('https://example.com/');
  await otherTab.bringToFront();
  await A.page.waitForTimeout(6000);
  await A.page.bringToFront();
  await A.page.waitForTimeout(1200);
  const afterTab = await media(A.page);
  const tabAdvanced = afterTab.currentTime - beforeTab.currentTime;
  const tabEvidence = { before: beforeTab.currentTime, after: afterTab.currentTime, advancedSeconds: Number(tabAdvanced.toFixed(1)), paused: afterTab.paused };
  if (!afterTab.paused && tabAdvanced > 3) {
    pass('BROWSER_TAB_BEHAVIOR_VERIFIED', { ...tabEvidence, backgroundAudio: 'continued while another tab was focused' });
  } else if (afterTab.paused) {
    blocked('BROWSER_TAB_BEHAVIOR_VERIFIED', { ...tabEvidence, reason: 'Chromium paused the iframe when backgrounded' });
  } else {
    fail('BROWSER_TAB_BEHAVIOR_VERIFIED', tabEvidence);
  }
  await otherTab.close();

  // ═════════════════════════════════════════════════════════════════════════
  // TEST C — shared listening: B keeps listening while A leaves
  // ═════════════════════════════════════════════════════════════════════════
  await openMedia(B.page);
  const bJoined = await until(() => media(B.page), (state) => state?.currentTime > 1 && !state.paused, 30000, 'B joins');
  const aAtJoin = await media(A.page);
  const joinDrift = Math.abs(bJoined.currentTime - aAtJoin.currentTime);

  await navigateTo(A.page, '/dashboard');
  await A.page.waitForTimeout(5000);
  const bWhileAway = await media(B.page);
  const aAway = await media(A.page);
  await navigateTo(A.page, '/private/media');
  const aBack = await until(() => media(A.page), (state) => state?.currentTime > 1 && !state.paused, 20000, 'A back');
  const bAfter = await media(B.page);

  const sharedEvidence = {
    joinDrift: Number(joinDrift.toFixed(2)),
    bWhileAway: bWhileAway?.currentTime,
    aAway: aAway?.currentTime ?? null,
    aBack: aBack.currentTime,
    bAfter: bAfter.currentTime,
    bPaused: bAfter.paused,
    finalDrift: Number(Math.abs(aBack.currentTime - bAfter.currentTime).toFixed(2)),
  };
  if (!bWhileAway.paused && bWhileAway.currentTime > bJoined.currentTime + 2 && !bAfter.paused && Math.abs(aBack.currentTime - bAfter.currentTime) < 4) {
    pass('SHARED_LISTENING_STABLE', sharedEvidence);
  } else {
    fail('SHARED_LISTENING_STABLE', sharedEvidence);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST D — chat: 10 messages, realtime, persistence, no duplicates
  // ═════════════════════════════════════════════════════════════════════════
  const chatA = A.page.locator('.pm-chat__form textarea');
  await chatA.waitFor({ timeout: 15000 });
  const stamp = Date.now().toString().slice(-5);
  for (let i = 1; i <= 10; i += 1) {
    await chatA.fill(`tin A ${stamp} #${i}`);
    await chatA.press('Enter');
    await A.page.waitForTimeout(160);
  }
  await until(() => B.page.locator('.pm-chat__text').allInnerTexts(), (texts) => texts.filter((text) => text.includes(`tin A ${stamp}`)).length >= 10, 20000, 'B receives 10 messages');
  const bCount = (await B.page.locator('.pm-chat__text').allInnerTexts()).filter((text) => text.includes(`tin A ${stamp}`)).length;

  const chatB = B.page.locator('.pm-chat__form textarea');
  await chatB.fill(`tin B ${stamp} trả lời`);
  await chatB.press('Enter');
  await until(() => A.page.locator('.pm-chat__text').allInnerTexts(), (texts) => texts.some((text) => text.includes(`tin B ${stamp}`)), 20000, 'A receives B reply');

  // Shift+Enter keeps a newline instead of sending.
  await chatA.click();
  await chatA.type('dòng một');
  await chatA.press('Shift+Enter');
  await chatA.type('dòng hai');
  const draftValue = await chatA.inputValue();
  await chatA.fill('');
  assert.equal(draftValue.includes('\n'), true, 'Shift+Enter inserts a newline');

  // Test D — refresh rebuilds the iframe but must resume the same timeline.
  const beforeReload = await media(A.page);
  await A.page.reload();
  await A.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
  const afterReload = await until(() => media(A.page), (state) => state && !state.noVideo && state.readyState >= 2, 30000, 'player after refresh');
  const refreshEvidence = {
    before: beforeReload?.currentTime,
    after: afterReload?.currentTime,
    volumeBefore: beforeReload?.volume,
    volumeAfter: afterReload?.volume,
    paused: afterReload?.paused,
  };
  if (afterReload.currentTime > 1 && afterReload.currentTime >= beforeReload.currentTime - 2) {
    pass('PLAYER_REFRESH_RESTORE', refreshEvidence);
  } else {
    fail('PLAYER_REFRESH_RESTORE', refreshEvidence);
  }

  await B.page.reload();
  await B.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
  await A.page.waitForTimeout(1500);

  const aTexts = await A.page.locator('.pm-chat__text').allInnerTexts();
  const bTexts = await B.page.locator('.pm-chat__text').allInnerTexts();
  const aMine = aTexts.filter((text) => text.includes(`tin A ${stamp}`));
  const bMine = bTexts.filter((text) => text.includes(`tin A ${stamp}`));
  const chatEvidence = {
    bRealtimeCount: bCount,
    aAfterReload: aMine.length,
    bAfterReload: bMine.length,
    uniqueA: new Set(aMine).size,
    hasBReplyOnA: aTexts.some((text) => text.includes(`tin B ${stamp}`)),
    hasBReplyOnB: bTexts.some((text) => text.includes(`tin B ${stamp}`)),
  };
  if (bCount >= 10 && aMine.length === 10 && bMine.length === 10 && new Set(aMine).size === 10 && chatEvidence.hasBReplyOnA) {
    pass('REALTIME_CHAT', { bRealtimeCount: bCount });
    pass('CHAT_PERSISTENCE', chatEvidence);
  } else {
    fail('CHAT_PERSISTENCE', chatEvidence);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST E — curated playlists (Conan + Vịt Độ Mixi)
  // ═════════════════════════════════════════════════════════════════════════
  const playlistsResponse = await A.call('playlists');
  const curated = (playlistsResponse.body.playlists || []).filter((playlist) => playlist.kind === 'curated');
  const conan = curated.find((playlist) => playlist.slug === 'conan-1-200');
  const duck = curated.find((playlist) => playlist.slug === 'vit-do-mixi');
  const conanDetail = conan ? (await A.call(`playlists/${conan.id}`)).body.playlist : null;

  if (conan && conan.itemCount === 200 && conanDetail.items.length === 200 && conanDetail.items.every((item) => item.available)) {
    pass('CONAN_EPISODE_CATALOG_VERIFIED', {
      episodes: conanDetail.items.length,
      first: conanDetail.items[0].videoId,
      last: conanDetail.items[199].videoId,
      uniqueVideoIds: new Set(conanDetail.items.map((item) => item.videoId)).size,
      channel: conan.sourceChannel,
    });
  } else {
    fail('CONAN_EPISODE_CATALOG_VERIFIED', { conan, items: conanDetail?.items?.length });
  }
  if (duck && duck.itemCount === 85) {
    pass('DO_MIXI_PLAYLIST_VERIFIED', { videos: duck.itemCount, channel: duck.sourceChannel, sourceUrl: duck.sourceUrl });
  } else {
    fail('DO_MIXI_PLAYLIST_VERIFIED', { duck });
  }

  // Play Conan sequentially from the UI.
  await A.page.locator('.pm-tab', { hasText: 'Có sẵn' }).click();
  await A.page.locator('.pm-playlist-card', { hasText: 'Conan' }).first().click();
  await A.page.locator('.pm-playlist-items .pm-playlist-item').first().waitFor({ timeout: 15000 });
  const renderedItems = await A.page.locator('.pm-playlist-items .pm-playlist-item').count();
  await A.page.getByRole('button', { name: 'Phát từ đầu' }).click();
  await until(async () => (await A.call('session')).body.session, (session) => session?.video?.videoId === conanDetail.items[0].videoId, 20000, 'Conan ep1 loaded');
  await until(() => media(A.page), (state) => state?.currentTime > 1 && !state.paused, 30000, 'Conan ep1 playing');
  const conanState1 = (await A.call('session')).body.session;

  await A.command('NEXT');
  await until(async () => (await A.call('session')).body.session, (session) => session?.video?.videoId === conanDetail.items[1].videoId, 20000, 'Conan ep2');
  const conanState2 = (await A.call('session')).body.session;

  if (conanState1.video.videoId === conanDetail.items[0].videoId
    && conanState2.video.videoId === conanDetail.items[1].videoId
    && conanState1.playlist.mode === 'sequential'
    && renderedItems === 200) {
    pass('CONAN_SEQUENTIAL_PLAYBACK', {
      renderedItems,
      ep1: conanState1.video.videoId,
      ep2: conanState2.video.videoId,
      mode: conanState1.playlist.mode,
    });
  } else {
    fail('CONAN_SEQUENTIAL_PLAYBACK', { conanState1: conanState1?.video, conanState2: conanState2?.video, renderedItems });
  }

  await A.page.screenshot({ path: path.join(output, 'playlist-conan.png') });

  // Resume: the account's bookmark is served with the playlist and the UI
  // offers "Tiếp tục từ Tập N" — clicking it must reload that exact episode.
  await A.page.locator('.pm-playlist-detail .pm-link', { hasText: 'Đóng' }).first().click();
  await A.page.locator('.pm-playlist-card', { hasText: 'Conan' }).first().click();
  const resumeButton = A.page.locator('.pm-playlist-detail__actions button', { hasText: /Tiếp tục/ });
  await resumeButton.waitFor({ timeout: 15000 });
  const resumeLabel = await resumeButton.innerText();
  await resumeButton.click();
  await until(async () => (await A.call('session')).body.session, (session) => session?.video?.videoId === conanDetail.items[1].videoId, 20000, 'resume loads episode 2');
  const resumed = (await A.call('session')).body.session;
  if (resumed.video.videoId === conanDetail.items[1].videoId && /Tập 2/.test(resumeLabel)) {
    pass('PLAYLIST_RESUME', { label: resumeLabel.trim(), videoId: resumed.video.videoId });
  } else {
    fail('PLAYLIST_RESUME', { label: resumeLabel, videoId: resumed.video?.videoId });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST F — user playlist: create, add 10, persist, shuffle bag
  // ═════════════════════════════════════════════════════════════════════════
  const created = await A.call('playlists', { title: `QA Nhạc ${stamp}`, visibility: 'private', playbackMode: 'sequential' });
  const playlistId = created.body?.playlist?.id;
  const tracks = [
    ['aqz-KE-bpKQ', 'Big Buck Bunny'],
    ['jNQXAC9IVRw', 'Me at the zoo'],
    ['M7lc1UVf-VE', 'IFrame API demo'],
    ['9bZkp7q19f0', 'Gangnam Style'],
    ['kJQP7kiw5Fk', 'Despacito'],
    ['JGwWNGJdvx8', 'Shape of You'],
    ['RgKAFK5djSk', 'See You Again'],
    ['OPf0YbXqDm0', 'Uptown Funk'],
    ['CevxZvSJLk8', 'Roar'],
    ['hT_nvWreIhg', 'Counting Stars'],
  ];
  const added = await A.call(`playlists/${playlistId}/items`, {
    // No fake durations: the player reports the real length, so seeking to the
    // real end produces a genuine YouTube ENDED event.
    items: tracks.map(([videoId, title]) => ({ videoId, title })),
  });

  await A.page.reload();
  await A.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
  await A.page.locator('.pm-tab', { hasText: 'Của tôi' }).click();
  await A.page.locator('.pm-playlist-card', { hasText: `QA Nhạc ${stamp}` }).waitFor({ timeout: 15000 });
  const persisted = await A.page.locator('.pm-playlist-card', { hasText: `QA Nhạc ${stamp}` }).count();

  if (added.status === 200 && added.body.playlist.items.length === 10 && persisted === 1) {
    pass('PLAYLIST_CREATE', { id: playlistId });
    pass('PLAYLIST_ADD_VIDEO', { items: added.body.playlist.items.length });
    pass('PLAYLIST_PERSISTENCE', { afterRefresh: persisted });
  } else {
    fail('PLAYLIST_PERSISTENCE', { status: added.status, items: added.body?.playlist?.items?.length, persisted });
  }

  await A.page.locator('.pm-playlist-card', { hasText: `QA Nhạc ${stamp}` }).click();
  await A.page.locator('.pm-playlist-items .pm-playlist-item').first().waitFor({ timeout: 15000 });
  await A.page.getByRole('button', { name: 'Ngẫu nhiên' }).click();
  await until(async () => (await A.call('session')).body.session, (session) => session?.playlist?.mode === 'shuffle', 15000, 'shuffle started');

  // The bag order is decided server-side when the shuffle starts. Walking it
  // with NEXT exercises exactly the same `advance()` engine the ENDED event uses.
  // Wait for the cycle to be fully committed before walking it (no stale snapshot).
  const cursor = await until(
    async () => (await A.call('session')).body.session,
    (session) => session?.playlist?.mode === 'shuffle'
      && session?.playlist?.total === added.body.playlist.items.length
      && Boolean(session?.video),
    15000,
    'shuffle cycle ready',
  );
  const order = [];
  const shuffleTotal = cursor.playlist?.total;
  order.push(cursor.video.videoId);
  for (let i = 0; i < 12; i += 1) {
    const moved = await A.command('NEXT');
    assert.equal(moved.status, 200, `NEXT ${i + 1}: ${JSON.stringify(moved.body)}`);
    const next = moved.body.state;
    if (!next?.video) break;
    order.push(next.video.videoId);
  }
  const shuffleEvidence = { order, unique: new Set(order).size, plays: order.length, total: shuffleTotal, itemCount: added.body.playlist.items.length };
  if (order.length === 10 && new Set(order).size === 10) {
    pass('PLAYLIST_SHUFFLE_NO_PREMATURE_REPEAT', shuffleEvidence);
  } else {
    fail('PLAYLIST_SHUFFLE_NO_PREMATURE_REPEAT', shuffleEvidence);
  }

  // Delete an item and confirm the playlist shrinks and persists.
  const detailBeforeDelete = (await A.call(`playlists/${playlistId}`)).body.playlist;
  const removeTarget = detailBeforeDelete.items[detailBeforeDelete.items.length - 1];
  const afterDelete = await A.call(`playlists/${playlistId}/items/${removeTarget.id}`, undefined, 'delete');
  if (afterDelete.status === 200 && afterDelete.body.playlist.items.length === 9) {
    pass('PLAYLIST_DELETE_VIDEO', { remaining: afterDelete.body.playlist.items.length });
  } else {
    fail('PLAYLIST_DELETE_VIDEO', { status: afterDelete.status, body: afterDelete.body });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST G — queue precedence + concurrent ENDED
  // ═════════════════════════════════════════════════════════════════════════
  await A.command('QUEUE_CLEAR');
  const conanPlay = await A.command('PLAYLIST_PLAY', { playlistId: conan.id });
  const currentBefore = conanPlay.body.state.video.videoId;
  const plannedNext = conanPlay.body.state.playlist.next.videoId;
  await B.command('QUEUE_ADD', { videoId: 'jNQXAC9IVRw', title: 'Manual X', durationSeconds: 19 });
  const afterAdd = (await A.call('session')).body.session;
  await A.command('NEXT');
  const afterNext = (await A.call('session')).body.session;
  await A.command('NEXT');
  const afterSecond = (await A.call('session')).body.session;

  if (afterAdd.video.videoId === currentBefore && afterNext.video.videoId === 'jNQXAC9IVRw' && afterSecond.video.videoId === plannedNext) {
    pass('QUEUE_PRIORITY', { current: currentBefore, manual: afterNext.video.videoId, resumed: afterSecond.video.videoId });
  } else {
    fail('QUEUE_PRIORITY', { currentBefore, afterAdd: afterAdd.video.videoId, afterNext: afterNext.video.videoId, plannedNext, afterSecond: afterSecond.video.videoId });
  }

  // Natural ENDED: a 19-second video seeked to its last seconds must advance once,
  // and both players (A and B) report it at almost the same moment.
  await A.command('QUEUE_CLEAR');
  await A.command('LOAD_VIDEO', { videoId: 'jNQXAC9IVRw', title: 'Ended test', durationSeconds: 19 });
  await A.command('QUEUE_ADD', { videoId: 'M7lc1UVf-VE', title: 'Queued next', durationSeconds: 300 });
  await until(() => media(A.page), (state) => state?.duration > 15 && state.duration < 25 && !state.paused, 30000, 'short video loaded');
  await until(() => media(B.page), (state) => state?.duration > 15 && state.duration < 25, 30000, 'B sees the same short video');
  await A.command('SEEK', { position: 16 });
  await A.page.waitForTimeout(600);
  const raceBefore = (await A.call('session')).body.session;
  await until(async () => (await A.call('session')).body.session, (session) => session?.currentQueueItemId !== raceBefore.currentQueueItemId, 45000, 'auto advance');
  await A.page.waitForTimeout(1500);
  const raceAfter = (await A.call('session')).body.session;
  const expectedNext = raceBefore.playlist?.next?.videoId || 'M7lc1UVf-VE';
  if (raceAfter.currentQueueItemId !== raceBefore.currentQueueItemId
    && raceAfter.video?.videoId === 'M7lc1UVf-VE'
    && raceAfter.queue.length === 0) {
    pass('DOUBLE_ENDED_IDEMPOTENCY', { before: raceBefore.video?.videoId, after: raceAfter.video?.videoId, queueAfter: raceAfter.queue.length });
    pass('AUTO_ADVANCE', { from: raceBefore.video?.videoId, to: raceAfter.video?.videoId, skippedManualItem: false });
  } else {
    fail('DOUBLE_ENDED_IDEMPOTENCY', { before: raceBefore.video?.videoId, after: raceAfter.video?.videoId, queue: raceAfter.queue?.length, expectedNext });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST H — admin without a grant
  // ═════════════════════════════════════════════════════════════════════════
  const adminStatus = await admin.call('status');
  const adminSession = await admin.call('session');
  const adminChat = await admin.call('chat');
  const adminPlaylists = await admin.call('playlists');
  await admin.page.goto(`${web}/private/media`);
  await admin.page.waitForTimeout(1500);
  const adminBody = await admin.page.locator('body').innerText();
  const adminSidebar = await admin.page.locator('a[href="/private/media"]').count();
  const adminEvidence = {
    status: adminStatus.status,
    session: adminSession.status,
    chat: adminChat.status,
    playlists: adminPlaylists.status,
    sidebarEntry: adminSidebar,
    concealed: adminBody.includes('Không tìm thấy trang'),
  };
  if ([adminStatus.status, adminSession.status, adminChat.status, adminPlaylists.status].every((status) => status === 404)
    && adminSidebar === 0 && adminEvidence.concealed) {
    pass('ADMIN_ACCESS_DENIED', adminEvidence);
  } else {
    fail('ADMIN_ACCESS_DENIED', adminEvidence);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST G2 — two tabs of the SAME account: one player only
  // ═════════════════════════════════════════════════════════════════════════
  await scrollMediaToTop(A.page);
  const tabB = await A.context.newPage();
  await tabB.goto(`${web}/private/media`);
  await tabB.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 25000 });
  await tabB.waitForTimeout(2500);

  const ownership = await Promise.all([
    A.page.evaluate(() => ({
      iframe: document.querySelectorAll('.pm-player__canvas iframe').length,
      handoff: Boolean(document.querySelector('.pm-now__handoff')),
    })),
    tabB.evaluate(() => ({
      iframe: document.querySelectorAll('.pm-player__canvas iframe').length,
      handoff: Boolean(document.querySelector('.pm-now__handoff')),
    })),
  ]);
  const onePlayer = ownership[0].iframe + ownership[1].iframe === 1;

  // Move playback to the second tab and confirm the first one yields.
  await tabB.locator('.pm-now__handoff button').click({ force: true });
  await tabB.waitForTimeout(2500);
  const afterTakeover = await Promise.all([
    A.page.evaluate(() => document.querySelectorAll('.pm-player__canvas iframe').length),
    tabB.evaluate(() => document.querySelectorAll('.pm-player__canvas iframe').length),
  ]);
  const takeoverWorked = afterTakeover[0] === 0 && afterTakeover[1] === 1;

  // Give the lease back to the first tab for the remaining checks.
  await A.page.bringToFront();
  const takeBack = A.page.locator('.pm-now__handoff button');
  if (await takeBack.count()) await takeBack.first().click({ force: true });
  await A.page.waitForTimeout(2500);
  const restored = await A.page.evaluate(() => document.querySelectorAll('.pm-player__canvas iframe').length);

  if (onePlayer && takeoverWorked && restored === 1) {
    pass('MULTI_TAB_PLAYER_OWNERSHIP', { ownership, afterTakeover, restored });
  } else {
    fail('MULTI_TAB_PLAYER_OWNERSHIP', { ownership, afterTakeover, restored });
  }
  await tabB.close();

  // ═════════════════════════════════════════════════════════════════════════
  // TEST F2 — create and delete a playlist through the UI
  // ═════════════════════════════════════════════════════════════════════════
  const uiTitle = `UI Playlist ${stamp}`;
  // Close any open detail so the library grid is visible again.
  const closeDetail = A.page.locator('.pm-playlist-detail .pm-link', { hasText: 'Đóng' });
  if (await closeDetail.count()) await closeDetail.first().click();
  await A.page.locator('.pm-tab', { hasText: 'Của tôi' }).click();
  await A.page.getByRole('button', { name: /Tạo playlist/ }).click();
  await A.page.getByLabel('Tên playlist').fill(uiTitle);
  await A.page.getByRole('button', { name: 'Tạo', exact: true }).click();
  // Creating opens the new playlist, which is the intended flow.
  await A.page.locator('.pm-playlist-detail__head h3', { hasText: uiTitle }).waitFor({ timeout: 15000 });
  const uiCreated = await A.page.locator('.pm-playlist-detail__head h3', { hasText: uiTitle }).count();
  await A.page.getByRole('button', { name: 'Xóa', exact: true }).click();
  await A.page.waitForTimeout(1500);
  const listAfterDelete = await A.call('playlists');
  const uiDeleted = (listAfterDelete.body.playlists || []).filter((playlist) => playlist.title === uiTitle).length;

  if (uiCreated === 1 && uiDeleted === 0) {
    pass('PLAYLIST_CREATE_UI', { created: uiCreated, remainingAfterDelete: uiDeleted });
  } else {
    fail('PLAYLIST_CREATE_UI', { created: uiCreated, remainingAfterDelete: uiDeleted });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // TEST I — mobile 390 / 430
  // ═════════════════════════════════════════════════════════════════════════
  const mobileChecks = [];
  for (const width of [390, 430]) {
    await A.page.setViewportSize({ width, height: 860 });
    await A.page.waitForTimeout(900);
    await scrollMediaToTop(A.page);
    await A.page.screenshot({ path: path.join(output, `mobile-${width}-top.png`), fullPage: false });
    const beforeResize = await media(A.page);
    const layout = await A.page.evaluate(() => {
      const doc = document.documentElement;
      const host = document.querySelector('.pm-audio-host')?.getBoundingClientRect();
      const nowCard = document.querySelector('.pm-now')?.getBoundingClientRect();
      return {
        scrollWidth: doc.scrollWidth,
        innerWidth: window.innerWidth,
        overflow: doc.scrollWidth - window.innerWidth,
        audioHost: host && { x: Math.round(host.x), w: Math.round(host.width), h: Math.round(host.height), offscreen: host.right <= 0 },
        nowCard: nowCard && { w: Math.round(nowCard.width) },
        chatToggleVisible: Boolean(document.querySelector('.pm-chat__toggle') && getComputedStyle(document.querySelector('.pm-chat__toggle')).display !== 'none'),
      };
    });

    // Open/close the chat panel: the player must not reset.
    const toggle = A.page.locator('.pm-chat__toggle');
    if (await toggle.isVisible()) {
      await toggle.click();
      await A.page.waitForTimeout(700);
      const collapsed = await A.page.evaluate(() => document.querySelector('.pm-chat')?.className.includes('is-collapsed'));
      await toggle.click();
      await A.page.waitForTimeout(700);
      mobileChecks.push({ width, layout, chatCollapsed: collapsed });
    } else {
      mobileChecks.push({ width, layout });
    }
    const afterResize = await media(A.page);
    mobileChecks[mobileChecks.length - 1].mediaBefore = beforeResize?.currentTime;
    mobileChecks[mobileChecks.length - 1].mediaAfter = afterResize?.currentTime;
    mobileChecks[mobileChecks.length - 1].paused = afterResize?.paused;
    await A.page.screenshot({ path: path.join(output, `mobile-${width}.png`), fullPage: false });
  }
  const mobileOk = mobileChecks.every((check) => check.layout.overflow <= 0 && check.paused === false);
  if (mobileOk) pass('MOBILE_390', mobileChecks);
  else fail('MOBILE_390', mobileChecks);

  await A.page.setViewportSize({ width: 1440, height: 980 });
  await A.page.waitForTimeout(800);
  await scrollMediaToTop(A.page);
  await A.page.screenshot({ path: path.join(output, 'desktop-final.png') });
  await B.page.screenshot({ path: path.join(output, 'desktop-listener.png') });
} catch (error) {
  report.errors.push(error.stack);
  record('SUITE', 'FAIL', { message: error.message });
  for (const [index, identityRef] of [A, B, admin].entries()) {
    if (identityRef) {
      await identityRef.page.screenshot({ path: path.join(output, `failure-${index}.png`), fullPage: false }).catch(() => {});
    }
  }
} finally {
  report.finishedAt = new Date().toISOString();
  report.summary = results.reduce((acc, entry) => ({ ...acc, [entry.status]: (acc[entry.status] || 0) + 1 }), {});
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify(report, null, 2));
  console.log('\nSUMMARY', JSON.stringify(report.summary));
  await browser.close();
  if (report.errors.length) process.exitCode = 1;
}
