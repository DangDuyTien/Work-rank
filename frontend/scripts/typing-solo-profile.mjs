/*
 * Solo Fast-Path profiler for WorkRank Typing Battle.
 * Runs against the isolated real full stack (Vite + Express + Socket.IO + SQLite :memory:).
 * Captures per-keystroke work: React commits, API calls, socket frames, storage writes,
 * input->marker latency, long tasks and a CPU profile summary.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PROFILE_WEB || 'http://127.0.0.1:5273';
const api = process.env.PROFILE_API || 'http://127.0.0.1:5101';
const outPath = process.env.PROFILE_OUT || '/var/folders/d2/7zb8g9zd7jbgvyb_xf77q84h0000gn/T/opencode/typing-solo-profile.json';
for (const url of [base, api]) assert.equal(new URL(url).hostname, '127.0.0.1', 'loopback only');

const browser = await chromium.launch({ headless: true });
const report = { startedAt: new Date().toISOString(), runs: [], errors: [] };

async function login() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const response = await context.request.post(api + '/api/auth/login', {
    data: { email: 'typing-a@audit.test', password: 'TypingAuditTest123!' },
  });
  assert.equal(response.status(), 200, 'fixture login');
  const credential = await response.json();
  await context.addInitScript(({ access, refresh }) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', refresh);
    window.__PROFILE = { inputs: 0, apiCalls: [], socketFrames: [], storageWrites: [], commits: 0, longTasks: [] };
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && url.includes('/api/games/typing')) window.__PROFILE.apiCalls.push({ url, t: performance.now() });
      return originalFetch.apply(this, args);
    };
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function patchedOpen(method, url, ...rest) {
      if (typeof url === 'string' && url.includes('/api/games/typing')) window.__PROFILE.apiCalls.push({ url, t: performance.now() });
      return originalOpen.call(this, method, url, ...rest);
    };
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function patchedSend(data) {
      try {
        if (typeof data === 'string' && data.includes('typing:')) window.__PROFILE.socketFrames.push({ data: data.slice(0, 160), t: performance.now() });
      } catch {}
      return originalSend.call(this, data);
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      try {
        if (typeof key === 'string' && key.includes('typing')) window.__PROFILE.storageWrites.push({ key, bytes: String(value).length, t: performance.now() });
      } catch {}
      return originalSetItem.call(this, key, value);
    };
    new PerformanceObserver((list) => window.__PROFILE.longTasks.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: false });
    const hook = {
      renderers: new Map(),
      supportsFiber: true,
      inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
      onCommitFiberRoot() { window.__PROFILE.commits += 1; },
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      checkDependencies() {},
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
  }, { access: credential.accessToken, refresh: credential.refreshToken });
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  return { context, page, headers: { Authorization: `Bearer ${credential.accessToken}` } };
}

function instrumentKeystrokeLatency(page) {
  return page.evaluate(() => {
    const input = document.querySelector('input[style*="opacity: 0"]');
    const box = document.querySelector('.typing-passage');
    if (!input || !box) return false;
    window.__PROFILE.latencies = [];
    window.__PROFILE.inFlight = null;
    const record = () => {
      if (!window.__PROFILE.inFlight) return;
      const wanted = Number(document.querySelector('[data-state="current"]')?.dataset.charIndex ?? -1);
      if (wanted !== window.__PROFILE.inFlight.wanted) return;
      const commit = performance.now();
      window.__PROFILE.latencies.push({ commit: commit - window.__PROFILE.inFlight.t0, t0: window.__PROFILE.inFlight.t0 });
      const done = window.__PROFILE.inFlight;
      window.__PROFILE.inFlight = null;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        done.paint = performance.now() - done.t0;
      }));
    };
    const observer = new MutationObserver(record);
    observer.observe(box, { childList: true, subtree: true, attributes: true });
    input.addEventListener('input', () => {
      window.__PROFILE.inputs += 1;
      const wanted = Array.from(input.value.normalize('NFC')).length;
      window.__PROFILE.inFlight = { t0: performance.now(), wanted };
      record();
    }, true);
    return true;
  });
}

async function resetCounters(page) {
  await page.evaluate(() => {
    window.__PROFILE.inputs = 0;
    window.__PROFILE.apiCalls = [];
    window.__PROFILE.socketFrames = [];
    window.__PROFILE.storageWrites = [];
    window.__PROFILE.commits = 0;
    window.__PROFILE.longTasks = [];
    window.__PROFILE.latencies = [];
  });
}

async function collect(page, label, typedChars) {
  const data = await page.evaluate(() => ({
    inputs: window.__PROFILE.inputs,
    apiCalls: window.__PROFILE.apiCalls,
    socketFrames: window.__PROFILE.socketFrames,
    storageWrites: window.__PROFILE.storageWrites,
    commits: window.__PROFILE.commits,
    longTasks: window.__PROFILE.longTasks,
    latencies: window.__PROFILE.latencies,
  }));
  const percentile = (arr, p) => {
    if (!arr.length) return null;
    const sorted = [...arr].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  };
  const run = {
    label,
    typedChars,
    inputEvents: data.inputs,
    apiCalls: data.apiCalls.length,
    apiCallDetail: summarize(data.apiCalls.map((c) => c.url.replace(/https?:\/\/[^/]+/, '').replace(/\/[0-9a-f-]{36}/g, '/:uuid'))),
    socketFrames: data.socketFrames.length,
    socketFrameDetail: summarize(data.socketFrames.map((f) => {
      const m = f.data.match(/"(\d+)[^,]*,|44(\d+)|.*/);
      return m ? m[0] : f.data;
    })),
    socketEmitEvents: summarize(data.socketFrames.map((f) => (f.data.match(/^\d+\[?"?(typing:[a-zA-Z]+)/) || [])[1] || 'other')),
    storageWrites: data.storageWrites.length,
    storageBytes: data.storageWrites.reduce((sum, w) => sum + w.bytes, 0),
    reactCommits: data.commits,
    longTaskCount: data.longTasks.length,
    longTaskTotalMs: Math.round(data.longTasks.reduce((s, d) => s + d, 0)),
    latencyMs: {
      p50: percentile(data.latencies.map((l) => l.commit), 0.5),
      p95: percentile(data.latencies.map((l) => l.commit), 0.95),
      max: data.latencies.length ? Math.max(...data.latencies.map((l) => l.commit)) : null,
    },
  };
  report.runs.push(run);
  console.log(JSON.stringify(run, null, 2));
  return run;
}

function summarize(list) {
  const map = new Map();
  for (const item of list) map.set(item, (map.get(item) || 0) + 1);
  return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12));
}

try {
  const { context, page, headers } = await login();
  await page.goto(base + '/games/typing');
  await page.locator('.typing-passage-viewport').waitFor();

  const practiceRes = await context.request.post(api + '/api/games/typing/practice/attempts', {
    headers,
    data: { durationLimitSeconds: 120, restart: true },
  });
  assert.ok(practiceRes.ok(), 'create practice attempt');
  const attempt = await practiceRes.json();
  await page.reload();
  await page.locator('input[style*="opacity: 0"]').waitFor({ state: 'attached' });
  await page.waitForFunction(() => !document.querySelector('input[style*="opacity: 0"]')?.disabled);
  await page.locator('.typing-passage-viewport').click();
  assert.ok(await instrumentKeystrokeLatency(page), 'instrument');

  const target = Array.from(attempt.challengeText);

  // 1. Fast ASCII typing burst, 100 chars, no artificial delay (as fast as the harness can go).
  await resetCounters(page);
  let cursor = 0;
  const fastText = target.slice(0, 100).join('');
  for (const ch of fastText) await page.keyboard.type(ch);
  await page.waitForFunction((n) => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) === n, cursor + 100, { timeout: 5000 });
  cursor += 100;
  await collect(page, 'fast-ascii-100 (no delay)', 100);

  // 2. Human-speed ASCII 120 WPM (100ms/char), 50 chars.
  await resetCounters(page);
  for (const ch of target.slice(cursor, cursor + 50)) {
    await page.keyboard.type(ch);
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForFunction((n) => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) === n, cursor + 50, { timeout: 5000 });
  cursor += 50;
  await collect(page, 'human-120wpm-ascii-50', 50);

  // 3. Vietnamese via native IME-style insertion (CDP insertText), 40 chars, 100ms cadence.
  await resetCounters(page);
  const vnSegment = target.slice(cursor, cursor + 40).join('');
  for (const ch of Array.from(vnSegment)) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Input.insertText', { text: ch });
    await cdp.detach();
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForFunction((n) => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) >= n, cursor + 40, { timeout: 8000 });
  cursor += 40;
  await collect(page, 'vietnamese-ime-100ms-40', 40);

  // 4. Backspace hold: delete 30 characters as fast as possible.
  await resetCounters(page);
  for (let i = 0; i < 30; i += 1) await page.keyboard.press('Backspace');
  await page.waitForFunction((n) => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) === n, cursor - 30, { timeout: 5000 });
  cursor -= 30;
  await collect(page, 'backspace-fast-30', 30);

  // 5. Long typing burst: 500 chars with 20ms delay (very fast human ~240 WPM sustained).
  await resetCounters(page);
  const longText = target.slice(cursor, cursor + 500).join('');
  for (const ch of Array.from(longText)) {
    await page.keyboard.type(ch);
    await new Promise((r) => setTimeout(r, 20));
  }
  await page.waitForFunction((n) => Number(document.querySelector('[data-state="current"]')?.dataset.charIndex) === n, cursor + 500, { timeout: 30000 });
  cursor += 500;
  await collect(page, 'long-500-20ms-delay', 500);

  // Finish the run through the real server path, measure finish behaviour.
  await resetCounters(page);
  const finishStart = Date.now();
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => /Thử bài mới/.test(b.textContent || ''));
    return Boolean(button);
  });
  const finishRes = await context.request.post(api + '/api/games/typing/practice/attempts/' + attempt.attemptId + '/progress', {
    headers,
    data: { typedText: target.slice(0, cursor).join(''), inputRevision: 999999 },
  });
  console.log('progress flush http', finishRes.status());
  await collect(page, 'idle-after-flush', 0);
  report.finishProbe = { elapsedMs: Date.now() - finishStart };

  // 6. SOLO room (socket multiplayer path) — outbound socket frames per keystroke.
  const roomRes = await context.request.post(api + '/api/games/typing/rooms', {
    headers,
    data: { title: 'Solo profile room', mode: 'SOLO', matchType: 'RANKED', durationLimitSeconds: 120 },
  });
  assert.ok(roomRes.ok(), 'create solo room');
  const room = (await roomRes.json()).room;
  await context.request.post(`${api}/api/games/typing/rooms/${room.id}/start`, { headers, data: {} });
  await page.goto(base + `/games/typing/room/${room.id}`);
  await page.waitForFunction(() => !document.querySelector('input[style*="opacity: 0"]')?.disabled, null, { timeout: 15000 });
  await page.locator('.typing-passage-viewport').click();
  const roomTarget = Array.from((await (await context.request.get(`${api}/api/games/typing/rooms/${room.id}`, { headers })).json()).room.challengeText || '');
  await instrumentKeystrokeLatency(page);
  await resetCounters(page);
  for (const ch of roomTarget.slice(0, 60)) {
    await page.keyboard.type(ch);
    await new Promise((r) => setTimeout(r, 100));
  }
  await page.waitForTimeout(600);
  await collect(page, 'solo-room-socket-60@100ms', 60);
  await context.request.post(`${api}/api/games/typing/rooms/${room.id}/finish`, { headers, data: { typedText: roomTarget.slice(0, 60).join(''), inputRevision: 9999 } });

  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  await browser.close();
  console.log('report written to', outPath);
}
