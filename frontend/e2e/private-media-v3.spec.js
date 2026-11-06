import { test, expect } from '@playwright/test';

/**
 * PRIVATE MEDIA V3 — REAL BROWSER QA
 *
 * Runs against a live backend + Vite dev server (see the report for the exact
 * commands). Two real Chromium contexts are used: the owner and a granted
 * second account, exactly like the two people listening together.
 *
 * The YouTube IFrame API is replaced by a deterministic fake *only* for the
 * player tests. Everything else — our React components, the socket, the server,
 * the database — is the real thing. The fake exists because headless Chromium
 * cannot be trusted to decode a real video, and the bug under test (replaying
 * the last second after ENDED) lives in OUR code, not in YouTube's.
 */

const API = process.env.QA_API_URL || 'http://127.0.0.1:5099';
const PASSWORD = 'QaPass123!';
const OWNER = 'tienddph50842@gmail.com';
const FRIEND = 'minh.qa@workrank.local';
const ADMIN = 'admin.qa@workrank.local';
// Every run gets its own message texts so a re-run never collides with history.
const STAMP = `r${Date.now().toString(36)}`;

const FAKE_YT = () => {
  // Installed before any app script runs.
  window.__yt = {
    calls: [],
    endAt: 0,
    state: -1,
    time: 0,
    duration: 200,
    videoId: null,
    instance: null,
    // Set to true to simulate a browser refusing playback without a gesture.
    blockPlay: false,
  };
  const record = (name, arg) => {
    window.__yt.calls.push({ name, arg, at: performance.now() });
  };
  class FakePlayer {
    constructor(host, options) {
      this.options = options || {};
      this.host = host;
      window.__yt.instance = this;
      setTimeout(() => {
        record('onReady');
        this.options.events?.onReady?.({ target: this });
      }, 0);
    }

    getPlayerState() { return window.__yt.state; }

    getCurrentTime() { return window.__yt.time; }

    getDuration() { return window.__yt.duration; }

    getVideoData() { return { video_id: window.__yt.videoId }; }

    loadVideoById(payload) {
      record('loadVideoById', payload);
      this._start(payload?.videoId, payload?.startSeconds || 0);
    }

    cueVideoById(payload) {
      record('cueVideoById', payload);
      window.__yt.videoId = payload?.videoId || null;
      window.__yt.state = 5;
      window.__yt.time = payload?.startSeconds || 0;
    }

    playVideo() {
      record('playVideo');
      // A real browser refuses to start media without a user gesture; the fake
      // reproduces that by staying where it is.
      if (window.__yt.blockPlay) return;
      if (window.__yt.state === 0) window.__yt.time = 0; // YouTube restarts an ended video
      window.__yt.state = 1;
      this.options.events?.onStateChange?.({ data: 1, target: this });
    }

    pauseVideo() {
      record('pauseVideo');
      window.__yt.state = 2;
      this.options.events?.onStateChange?.({ data: 2, target: this });
    }

    stopVideo() {
      record('stopVideo');
      window.__yt.state = 5;
      window.__yt.time = 0;
    }

    seekTo(position) {
      record('seekTo', position);
      window.__yt.time = Number(position) || 0;
    }

    setVolume() {}
    mute() {}
    unMute() {}
    destroy() { record('destroy'); }

    _start(videoId, startSeconds) {
      window.__yt.videoId = videoId;
      window.__yt.time = Number(startSeconds) || 0;
      if (window.__yt.blockPlay) {
        // Cued but not started: exactly what a refused autoplay looks like.
        window.__yt.state = 5;
        return;
      }
      window.__yt.state = 1;
      this.options.events?.onStateChange?.({ data: 1, target: this });
    }
  }
  window.YT = { Player: FakePlayer, PlayerState: { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } };
  window.__ytEnd = () => {
    window.__yt.state = 0;
    window.__yt.time = window.__yt.duration;
    window.__yt.endAt = performance.now();
    window.__yt.instance?.options?.events?.onStateChange?.({ data: 0, target: window.__yt.instance });
  };
  // Count "ting" sounds without touching the real audio graph.
  const OriginalAudioContext = window.AudioContext;
  if (OriginalAudioContext) {
    window.__tingCount = 0;
    window.AudioContext = class extends OriginalAudioContext {
      createOscillator() {
        const osc = super.createOscillator();
        const start = osc.start.bind(osc);
        osc.start = (...args) => { window.__tingCount += 1; return start(...args); };
        return osc;
      }
    };
  }
};

async function loginAs(request, email) {
  const response = await request.post(`${API}/api/auth/login`, { data: { email, password: PASSWORD } });
  expect(response.ok(), `login ${email}`).toBeTruthy();
  return response.json();
}

async function openApp(browser, session, { room = 'private', fakePlayer = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addInitScript(({ tokens, roomMode }) => {
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('workrank_active_user_id', String(tokens.user.id));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank:private-media:room', roomMode);
  }, { tokens: session, roomMode: room });
  if (fakePlayer) await context.addInitScript(FAKE_YT);
  const page = await context.newPage();
  await page.goto('/private/media');
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });
  return { context, page };
}

async function setRoom(page, label) {
  await page.getByRole('group', { name: 'Chế độ nghe' }).getByRole('button', { name: label }).click();
}

/** Three messages in one burst, the way a fast typer (or a paste) arrives. */
async function burstChat(page, texts) {
  await page.evaluate(async ({ api, messages }) => {
    const token = localStorage.getItem('token');
    await Promise.all(messages.map((content) => fetch(`${api}/api/private-media/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PM-Room': 'shared' },
      body: JSON.stringify({ content, clientMessageId: crypto.randomUUID() }),
    })));
  }, { api: API, messages: texts });
}

async function sendChat(page, text) {
  const chat = page.getByRole('region', { name: 'Chat nghe chung' }).or(page.locator('section[aria-label="Chat nghe chung"]'));
  await chat.locator('textarea[aria-label="Nội dung tin nhắn"]').fill(text);
  await chat.getByRole('button', { name: 'Gửi tin nhắn' }).click();
  await expect(chat.getByText(text, { exact: true })).toBeVisible({ timeout: 10_000 });
}

async function openQaPlaylist(page) {
  const panel = page.locator('section[aria-label="Danh sách phát"]');
  await panel.getByRole('tab', { name: 'Của tôi' }).click();
  await panel.getByRole('button', { name: /QA Playlist/ }).click();
  await expect(panel.getByRole('heading', { name: 'QA Playlist' })).toBeVisible();
  return panel;
}

test.describe.configure({ mode: 'serial' });

test('chat survives a route change and counts unread on the tab, silently', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const friend = await loginAs(request, FRIEND);
  const a = await openApp(browser, owner, { room: 'shared' });
  const b = await openApp(browser, friend, { room: 'shared' });

  const baseTitle = await a.page.title();
  expect(baseTitle).not.toContain('Tin nhắn mới');

  // A leaves the media page for the dashboard.
  await a.page.getByRole('link', { name: /Tổng quan/ }).first().click().catch(async () => {
    await a.page.goto('/dashboard');
  });
  await a.page.waitForURL('**/dashboard');

  // B sends three messages in one burst while A is elsewhere.
  const first = `Mày nghe bài này chưa? ${STAMP}`;
  const second = `Thêm bài này vào hàng chờ đi. ${STAMP}`;
  const third = `Tin thứ ba ${STAMP}`;
  const fourth = `Tin thứ tư ${STAMP}`;
  const fifth = `Tin thứ năm ${STAMP}`;
  await burstChat(b.page, [first, second, third]);

  // A's tab shows the unread count without blinking.
  await expect.poll(async () => a.page.title(), { timeout: 10_000 }).toContain('(3) Tin nhắn mới');
  const title = await a.page.title();
  expect(title).toContain('3WIN MEDIA');

  // The badge IS the notification: no sound, no matter how many messages land.
  // (The fake player counts oscillators; a silent badge creates none.)
  await a.page.waitForTimeout(1500);
  expect(await a.page.evaluate(() => window.__tingCount || 0), 'the badge must stay silent').toBe(0);

  // A comes back: the history is intact and the badge is cleared.
  await a.page.goto('/private/media');
  await expect(a.page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible();
  const chat = a.page.locator('section[aria-label="Chat nghe chung"]');
  await expect(chat.getByText(first, { exact: true })).toBeVisible();
  await expect(chat.getByText(third, { exact: true })).toBeVisible();
  await expect.poll(async () => a.page.title(), { timeout: 10_000 }).not.toContain('Tin nhắn mới');

  const rowsBefore = await chat.locator('article.pm-chat__msg').count();
  const tingsBefore = await a.page.evaluate(() => window.__tingCount || 0);

  // B keeps talking; A is on the page, so no unread and no duplicate rows.
  await sendChat(b.page, fourth);
  await expect(chat.getByText(fourth, { exact: true })).toBeVisible({ timeout: 10_000 });
  expect(await a.page.title()).not.toContain('Tin nhắn mới');
  expect(await chat.locator('article.pm-chat__msg').count()).toBe(rowsBefore + 1);

  // Reading on screen is quiet by design, and so is everything else now.
  await a.page.waitForTimeout(800);
  expect(await a.page.evaluate(() => window.__tingCount || 0)).toBe(tingsBefore);

  // Leave the page again: the next message raises the badge and still makes no
  // noise — the count on the tab is what tells the person someone wrote.
  await a.page.getByRole('link', { name: /Tổng quan/ }).first().click();
  await a.page.waitForURL('**/dashboard');
  await sendChat(b.page, fifth);
  await expect.poll(async () => a.page.title(), { timeout: 10_000 }).toContain('(1) Tin nhắn mới');
  await a.page.waitForTimeout(1200);
  expect(await a.page.evaluate(() => window.__tingCount || 0), 'a lone message must be silent too').toBe(tingsBefore);

  await a.context.close();
  await b.context.close();
});

test('a refresh restores the same chat history with no duplicates', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const friend = await loginAs(request, FRIEND);
  const a = await openApp(browser, owner, { room: 'shared' });
  const b = await openApp(browser, friend, { room: 'shared' });

  const text = `trước khi refresh ${STAMP}`;
  await sendChat(b.page, text);

  const chat = a.page.locator('section[aria-label="Chat nghe chung"]');
  // Wait until A has actually rendered the message, otherwise the baseline is
  // taken one delivery too early and the comparison is meaningless.
  await expect(chat.getByText(text, { exact: true })).toBeVisible({ timeout: 10_000 });
  const before = await chat.locator('article.pm-chat__msg').count();
  expect(before).toBeGreaterThan(0);

  await a.page.reload();
  await expect(a.page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });
  await expect(chat.getByText(text, { exact: true })).toBeVisible({ timeout: 10_000 });
  const after = await chat.locator('article.pm-chat__msg').count();
  expect(after).toBe(before);

  await a.context.close();
  await b.context.close();
});

test('notification settings are behind an explicit button, silent by default, and opt-in sticks', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const context = await browser.newContext();
  const origin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:5199').origin;
  await context.grantPermissions(['notifications'], { origin });
  await context.addInitScript(({ tokens }) => {
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('workrank_active_user_id', String(tokens.user.id));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank:private-media:room', 'shared');
  }, { tokens: owner });
  const page = await context.newPage();
  await page.goto('/private/media');
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });

  // Whatever this browser allows, the app must not have asked for it on its own:
  // the settings popover starts closed, so nothing was requested or shown.
  const permission = await page.evaluate(() => (
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  ));
  await expect(page.getByRole('button', { name: 'Cài đặt thông báo tin nhắn' })).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('slider', { name: 'Âm lượng thông báo' })).toHaveCount(0);

  // Only an explicit click opens the settings.
  await page.getByRole('button', { name: 'Cài đặt thông báo tin nhắn' }).click();
  const notifyBox = page.getByRole('checkbox', { name: 'Thông báo tin nhắn' });
  const soundBox = page.getByRole('checkbox', { name: 'Âm báo' });
  const volume = page.getByRole('slider', { name: 'Âm lượng thông báo' });
  await expect(notifyBox).toBeVisible();
  await expect(soundBox).toBeVisible();
  await expect(volume).toBeVisible();
  await expect(notifyBox).toBeChecked();
  // Silent by default: the count on the tab is the notification.
  await expect(soundBox).not.toBeChecked();
  await expect(volume).toHaveValue('55');

  // Honest permission reporting, not a fake "enabled" badge.
  if (permission === 'granted') {
    await expect(page.getByText('Thông báo hệ thống đã bật.')).toBeVisible();
  } else if (permission === 'denied') {
    await expect(page.getByText('Trình duyệt đang chặn thông báo hệ thống.')).toBeVisible();
  } else {
    await expect(page.getByRole('button', { name: 'Bật thông báo trên máy tính' })).toBeVisible();
  }

  // Turning the sound on is still possible, and it is remembered.
  await soundBox.check();
  await expect(soundBox).toBeChecked();
  await volume.fill('20');
  await expect(page.getByText('20%')).toBeVisible();
  const stored = await page.evaluate((userId) => (
    localStorage.getItem(`workrank:private-media:notify:v1:${userId}`)
  ), owner.user.id);
  expect(stored).toContain('"sound":true');
  expect(stored).toContain('"volume":20');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Cài đặt thông báo tin nhắn' }).click();
  await expect(page.getByRole('checkbox', { name: 'Âm báo' })).toBeChecked();
  await expect(page.getByRole('checkbox', { name: 'Thông báo tin nhắn' })).toBeChecked();
  await expect(page.getByRole('slider', { name: 'Âm lượng thông báo' })).toHaveValue('20');

  // …and switching it back off sticks too.
  await page.getByRole('checkbox', { name: 'Âm báo' }).uncheck();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Cài đặt thông báo tin nhắn' }).click();
  await expect(page.getByRole('checkbox', { name: 'Âm báo' })).not.toBeChecked();

  await context.close();
});

test('solo: add to queue and auto-advance, with no last-second replay', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const { context, page } = await openApp(browser, owner, { room: 'private' });

  const panel = await openQaPlaylist(page);
  await panel.getByRole('button', { name: /^Phát/ }).first().click();

  // The (fake) player receives A.
  await expect.poll(async () => page.evaluate(() => window.__yt.videoId), { timeout: 15_000 }).toBe('aaaaaaaaaaa');
  await expect(page.locator('.pm-now__meta h2')).toContainText('QA A');

  // End A. The server must advance to B exactly once.
  await page.evaluate(() => { window.__yt.time = 199; window.__ytEnd(); });
  await expect(page.locator('.pm-now__meta h2')).toContainText('QA B', { timeout: 15_000 });
  await expect.poll(async () => page.evaluate(() => window.__yt.videoId), { timeout: 15_000 }).toBe('bbbbbbbbbbb');

  const audit = await page.evaluate(() => {
    const { calls, endAt } = window.__yt;
    // Count from the moment the playlist actually started A: a page that opens
    // while the server still resumes an older item is not a duplicate load.
    const startIndex = calls.reduce((acc, call, index) => (
      call.name === 'loadVideoById' && call.arg?.videoId === 'aaaaaaaaaaa' ? index : acc
    ), -1);
    const sinceStart = calls.slice(startIndex + 1);
    const after = calls.filter((call) => call.at >= endAt);
    return {
      loadsOfB: sinceStart.filter((c) => c.name === 'loadVideoById' && c.arg?.videoId === 'bbbbbbbbbbb').length,
      playAfterEnd: after.filter((c) => c.name === 'playVideo').length,
      seeksAfterEnd: after.filter((c) => c.name === 'seekTo' && Number(c.arg) >= 197).length,
      loadsAfterEnd: after.filter((c) => c.name === 'loadVideoById').map((c) => c.arg?.videoId),
    };
  });
  expect(audit.loadsOfB, 'B must be loaded exactly once').toBe(1);
  expect(audit.playAfterEnd, 'the finished track must never be replayed').toBe(0);
  expect(audit.seeksAfterEnd, 'no seek into the last seconds after ENDED').toBe(0);

  await context.close();
});

test('a finished track does not replay while the server cannot be reached', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const { context, page } = await openApp(browser, owner, { room: 'private' });

  const panel = await openQaPlaylist(page);
  await panel.getByRole('button', { name: /^Phát/ }).first().click();
  await expect.poll(async () => page.evaluate(() => window.__yt.videoId), { timeout: 15_000 }).toBe('aaaaaaaaaaa');

  // Cut the network, then end the track: the ENDED report cannot reach the
  // server. This is the exact situation that used to loop the last second.
  await context.setOffline(true);
  await page.evaluate(() => { window.__yt.time = 199; window.__ytEnd(); });
  await page.waitForTimeout(7000);

  const offlineAudit = await page.evaluate(() => {
    const { calls, endAt } = window.__yt;
    const after = calls.filter((call) => call.at >= endAt);
    return {
      playAfterEnd: after.filter((c) => c.name === 'playVideo').length,
      seeksAfterEnd: after.filter((c) => c.name === 'seekTo').length,
      loadsAfterEnd: after.filter((c) => c.name === 'loadVideoById').length,
    };
  });
  expect(offlineAudit.playAfterEnd, 'offline ENDED must not restart the video').toBe(0);
  expect(offlineAudit.seeksAfterEnd, 'offline ENDED must not seek back to the end').toBe(0);
  expect(offlineAudit.loadsAfterEnd).toBe(0);

  // Reconnect: the queue still advances once, and B loads exactly once.
  await context.setOffline(false);
  await expect(page.locator('.pm-now__meta h2')).toContainText('QA B', { timeout: 20_000 });
  const loads = await page.evaluate(() => {
    const { calls } = window.__yt;
    const startIndex = calls.reduce((acc, call, index) => (
      call.name === 'loadVideoById' && call.arg?.videoId === 'aaaaaaaaaaa' ? index : acc
    ), -1);
    return calls.slice(startIndex + 1).filter((c) => c.name === 'loadVideoById' && c.arg?.videoId === 'bbbbbbbbbbb').length;
  });
  expect(loads).toBe(1);

  await context.close();
});

test('shared: both browsers auto-advance A → B → C without pressing Next', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const friend = await loginAs(request, FRIEND);
  const a = await openApp(browser, owner, { room: 'shared' });
  const b = await openApp(browser, friend, { room: 'shared' });

  // Owner starts A, friend queues B and C through the real API path.
  const panel = await openQaPlaylist(a.page);
  await panel.getByRole('button', { name: /^Phát/ }).first().click();
  await expect.poll(async () => a.page.evaluate(() => window.__yt.videoId), { timeout: 15_000 }).toBe('aaaaaaaaaaa');

  for (const item of [{ id: 'bbbbbbbbbbb', title: 'QA B' }, { id: 'ccccccccccc', title: 'CCCCCCCCCCC' }]) {
    // eslint-disable-next-line no-await-in-loop
    const queued = await b.page.evaluate(async ({ id, title, api }) => {
      const token = localStorage.getItem('token');
      const response = await fetch(`${api}/api/private-media/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PM-Room': 'shared' },
        body: JSON.stringify({ commandId: crypto.randomUUID(), action: 'QUEUE_ADD', payload: { videoId: id, title } }),
      });
      return { status: response.status, body: await response.json() };
    }, { id: item.id, title: item.title, api: API });
    expect(queued.status).toBe(200);
  }

  await expect(b.page.locator('.pm-queue-card h2')).toContainText('Đang chờ · 2', { timeout: 10_000 });

  // Owner's player ends A → both tabs must show B.
  await a.page.evaluate(() => { window.__yt.time = 199; window.__ytEnd(); });
  await expect(a.page.locator('.pm-now__meta h2')).toContainText('QA B', { timeout: 15_000 });
  await expect(b.page.locator('.pm-now__meta h2')).toContainText('QA B', { timeout: 15_000 });
  await expect.poll(async () => b.page.evaluate(() => window.__yt.videoId), { timeout: 15_000 }).toBe('bbbbbbbbbbb');

  // …then B ends → C, with no manual Next anywhere.
  await a.page.evaluate(() => { window.__yt.time = 199; window.__ytEnd(); });
  await expect(a.page.locator('.pm-now__meta h2')).toContainText('CCCCCCCCCCC', { timeout: 15_000 });
  await expect(b.page.locator('.pm-now__meta h2')).toContainText('CCCCCCCCCCC', { timeout: 15_000 });
  await expect(b.page.locator('.pm-queue-card h2')).toContainText('Đang chờ · 0');

  await a.context.close();
  await b.context.close();
});

test('solo: the result rows offer play, queue and save-to-playlist', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const { context, page } = await openApp(browser, owner, { room: 'private' });

  // A remote load (the Telegram / hotkey path) is what fills "Đã phát gần đây",
  // and those rows carry the same three actions as a search result.
  const loaded = await page.evaluate(async ({ api }) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${api}/api/private-media/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-PM-Room': 'private' },
      body: JSON.stringify({
        commandId: crypto.randomUUID(),
        action: 'LOAD_VIDEO',
        payload: { videoId: 'aaaaaaaaaaa', title: 'QA A' },
      }),
    });
    return response.status;
  }, { api: API });
  expect(loaded).toBe(200);

  // Reload so the list is built from the server on mount (no dependence on a
  // live refresh racing the command).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });

  const panel = await openQaPlaylist(page);
  const itemsBefore = await panel.locator('.pm-playlist-items li').count();
  await panel.getByRole('button', { name: 'Đóng' }).click();

  const recent = page.locator('.pm-recent');
  await expect(recent).toBeVisible({ timeout: 15_000 });
  const row = recent.locator('li.pm-result').first();
  await expect(row.getByRole('button', { name: /Phát/ })).toBeVisible();
  await expect(row.getByRole('button', { name: /vào hàng chờ/ })).toBeVisible();
  await expect(row.getByRole('button', { name: /vào playlist/ })).toBeVisible();

  // Queue it: the queue card must grow by exactly one.
  const queueCount = async () => {
    const text = await page.locator('.pm-queue-card h2').textContent();
    return Number((text || '').match(/(\d+)/)?.[1] || 0);
  };
  const queuedBefore = await queueCount();
  await row.getByRole('button', { name: /vào hàng chờ/ }).click();
  await expect.poll(queueCount, { timeout: 10_000 }).toBe(queuedBefore + 1);
  await expect(page.getByText('Hết bài sẽ tự phát bài kế tiếp trong hàng chờ', { exact: false })).toBeVisible();

  // Save it to a playlist: dialog → choose → toast → survives a reload.
  await row.getByRole('button', { name: /vào playlist/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Lưu vào playlist')).toBeVisible();
  await dialog.getByRole('radio').first().check();
  await dialog.getByRole('button', { name: 'Lưu' }).click();
  await expect(page.getByText(/Đã lưu/).first()).toBeVisible({ timeout: 10_000 });

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });
  const reopened = await openQaPlaylist(page);
  await expect(reopened.locator('.pm-playlist-items li')).toHaveCount(itemsBefore + 1);

  await context.close();
});

test('an admin without a grant sees the concealed page, not the media UI', async ({ browser, request }) => {
  const admin = await loginAs(request, ADMIN);
  const context = await browser.newContext();
  await context.addInitScript(({ tokens }) => {
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('workrank_active_user_id', String(tokens.user.id));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
  }, { tokens: admin });
  const page = await context.newPage();
  await page.goto('/private/media');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toHaveCount(0);
  const api = await page.evaluate(async (apiBase) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiBase}/api/private-media/chat`, { headers: { Authorization: `Bearer ${token}`, 'X-PM-Room': 'shared' } });
    return response.status;
  }, API);
  expect(api).toBe(404);
  await context.close();
});

test('a refused autoplay asks for a click instead of pretending to play', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const { context, page } = await openApp(browser, owner, { room: 'private' });

  // From here on the browser refuses to start playback without a gesture.
  await page.evaluate(() => { window.__yt.blockPlay = true; });

  const panel = await openQaPlaylist(page);
  await panel.getByRole('button', { name: /^Phát/ }).first().click();

  // The honest affordance appears — not a silent lie that it is playing.
  const activate = page.getByRole('button', { name: 'Kích hoạt trình phát trên thiết bị này' });
  await expect(activate).toBeVisible({ timeout: 20_000 });
  expect(await page.evaluate(() => window.__yt.state), 'the track must not claim to be playing').not.toBe(1);

  // The user clicks: playback really starts and the prompt goes away.
  await page.evaluate(() => { window.__yt.blockPlay = false; });
  await activate.click();
  await expect(activate).toBeHidden({ timeout: 10_000 });
  await expect.poll(async () => page.evaluate(() => window.__yt.state), { timeout: 10_000 }).toBe(1);

  await context.close();
});

test('a hidden tab gets a system notification whose click returns to the media page', async ({ browser, request }) => {
  const owner = await loginAs(request, OWNER);
  const friend = await loginAs(request, FRIEND);
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const origin = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:5199').origin;
  await context.grantPermissions(['notifications'], { origin });
  await context.addInitScript(({ tokens }) => {
    localStorage.setItem('token', tokens.accessToken);
    localStorage.setItem('refreshToken', tokens.refreshToken);
    localStorage.setItem('workrank_active_user_id', String(tokens.user.id));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank:private-media:room', 'shared');
  }, { tokens: owner });
  // Keep the real constructor, just remember what was shown.
  await context.addInitScript(() => {
    window.__notes = [];
    const Real = window.Notification;
    if (!Real) return;
    window.Notification = class extends Real {
      constructor(title, options) {
        super(title, options);
        window.__notes.push(this);
      }
    };
  });
  const page = await context.newPage();
  await page.goto('/private/media');
  await expect(page.getByRole('heading', { name: 'Điều khiển media' })).toBeVisible({ timeout: 20_000 });

  // Leave the media page (so the click has somewhere to come back from).
  await page.getByRole('link', { name: /Tổng quan/ }).first().click();
  await page.waitForURL('**/dashboard');

  // Playwright gives every page its own window, so backgrounding another page
  // never flips this document to 'hidden'. Emulate exactly that one browser
  // fact; the Notification constructor and the click handler stay real.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');

  const friendPage = await openApp(browser, friend, { room: 'shared' });
  await sendChat(friendPage.page, `tin khi tab ẩn ${STAMP}`);

  // The system notification was really constructed, not simulated.
  await expect.poll(async () => page.evaluate(() => window.__notes.length), { timeout: 15_000 }).toBeGreaterThan(0);
  const shown = await page.evaluate(() => {
    const note = window.__notes[window.__notes.length - 1];
    return { body: note.body, hasClick: typeof note.onclick === 'function' };
  });
  expect(shown.hasClick).toBe(true);
  expect(shown.body).toContain('tin khi tab ẩn');

  // Clicking it brings this tab back to the media page.
  await page.evaluate(() => window.__notes[window.__notes.length - 1].onclick());
  await expect(page).toHaveURL(/\/private\/media/, { timeout: 10_000 });

  await friendPage.context.close();
  await context.close();
});
