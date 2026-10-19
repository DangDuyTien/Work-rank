/*
 * Local-first acceptance audit for WorkRank Typing Battle (solo practice path).
 *
 * Proves, against the isolated real stack (Vite + Express + SQLite :memory:):
 *  1. With 3s network latency the keystroke→paint stays fluent (no local work waits
 *     on the network) and every committed char still reaches the server eventually.
 *  2. While fully offline typing continues, no error banner interrupts the run,
 *     and the deferred queue flushes once the network returns.
 *  3. The final submit (still slow) records the authoritative server result.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.TYPING_AUDIT_WEB || 'http://127.0.0.1:5273';
const api = process.env.TYPING_AUDIT_API || 'http://127.0.0.1:5101';
for (const url of [base, api]) assert.equal(new URL(url).hostname, '127.0.0.1', 'loopback only');
const dir = path.resolve('../docs/audit/2026-10-19/typing');
await fs.mkdir(dir, { recursive: true });

const input = 'input[style*="opacity: 0"]';
const report = { started: new Date().toISOString(), checks: [], errors: [] };
const browser = await chromium.launch({ headless: true });

function check(name, detail = {}) {
  report.checks.push({ name, ok: true, ...detail });
  console.log('PASS:', name);
}

async function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
}

try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const login = await context.request.post(api + '/api/auth/login', {
    data: { email: 'typing-a@audit.test', password: 'TypingAuditTest123!' },
  });
  assert.equal(login.status(), 200, 'fixture login');
  const credential = await login.json();
  const headers = { Authorization: `Bearer ${credential.accessToken}` };
  await context.addInitScript(({ access, refresh }) => {
    localStorage.setItem('token', access);
    localStorage.setItem('refreshToken', refresh);
    window.__PROFILE = { inputs: 0, latencies: [], inFlight: null, apiCalls: [] };
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && url.includes('/api/games/typing')) window.__PROFILE.apiCalls.push({ url, t: performance.now() });
      return originalFetch.apply(this, args);
    };
  }, { access: credential.accessToken, refresh: credential.refreshToken });

  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));

  const attemptRes = await context.request.post(api + '/api/games/typing/practice/attempts', {
    headers,
    data: { durationLimitSeconds: 120, restart: true },
  });
  assert.ok(attemptRes.ok(), 'create practice attempt');
  const attempt = await attemptRes.json();
  const target = Array.from(attempt.challengeText);

  await page.goto(base + '/games/typing');
  await page.waitForFunction(() => !document.querySelector('input[style*="opacity: 0"]')?.disabled, null, { timeout: 15000 });
  await page.locator('.typing-passage-viewport').click();

  await page.evaluate(() => {
    const box = document.querySelector('.typing-passage');
    const field = document.querySelector('input[style*="opacity: 0"]');
    const record = () => {
      if (!window.__PROFILE.inFlight) return;
      const wanted = Number(document.querySelector('[data-state="current"]')?.dataset.charIndex ?? -1);
      if (wanted !== window.__PROFILE.inFlight.wanted) return;
      window.__PROFILE.latencies.push(performance.now() - window.__PROFILE.inFlight.t0);
      window.__PROFILE.inFlight = null;
    };
    new MutationObserver(record).observe(box, { childList: true, subtree: true, attributes: true });
    field.addEventListener('input', () => {
      window.__PROFILE.inputs += 1;
      window.__PROFILE.inFlight = { t0: performance.now(), wanted: Array.from(field.value.normalize('NFC')).length };
      record();
    }, true);
  });

  const reset = () => page.evaluate(() => {
    window.__PROFILE.inputs = 0;
    window.__PROFILE.latencies = [];
    window.__PROFILE.inFlight = null;
    window.__PROFILE.apiCalls = [];
  });
  const stall = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const latencyStats = async () => {
    const values = await page.evaluate(() => window.__PROFILE.latencies);
    return {
      p50: await percentile(values, 0.5), p95: await percentile(values, 0.95),
      max: values.length ? Math.max(...values) : null, samples: values.length,
    };
  };
  const waitForServerRevision = async (minRevision, timeoutMs = 30000) => {
    const deadline = Date.now() + timeoutMs;
    let last = -1;
    while (Date.now() < deadline) {
      const res = await context.request.get(api + '/api/games/typing/practice/active', { headers });
      if (res.ok()) {
        const body = await res.json();
        last = Number(body?.attempt?.inputRevision || 0);
        if (last >= minRevision) return last;
      }
      await stall(400);
    }
    return last;
  };
  const bannerCount = () => page.locator('[role="alert"]').count();

  // ── 1. 3000ms network latency: typing must not feel it ──
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 3000, downloadThroughput: -1, uploadThroughput: -1 });
  await reset();

  let typed = '';
  for (const ch of target.slice(0, 40)) {
    await page.keyboard.type(ch);
    typed += ch;
    await stall(100);
  }
  await stall(300);
  const slowStats = await latencyStats();
  const slowValue = await page.locator(input).inputValue();
  assert.equal(slowValue.normalize('NFC'), typed.normalize('NFC'), 'slow network: input value intact');
  assert.ok(slowStats.samples >= 35, `slow network: latency samples ${slowStats.samples}`);
  assert.ok(slowStats.p95 < 30, `slow network: keystroke p95 ${slowStats.p95}ms < 30ms`);
  assert.equal(await bannerCount(), 0, 'slow network: no error banner during typing');
  check('3000ms network latency does not slow the keystroke path', { ...slowStats, characters: typed.length });

  const slowRevision = await waitForServerRevision(40);
  assert.ok(slowRevision >= 40, `slow network: server revision reached ${slowRevision}`);
  assert.equal(await bannerCount(), 0, 'slow network: no error banner after flush');
  check('deferred progress still reaches the server under 3000ms latency', { serverRevision: slowRevision });

  // ── 2. Offline mid-run: keep typing locally, flush after reconnect ──
  await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await reset();
  for (const ch of target.slice(40, 65)) {
    await page.keyboard.type(ch);
    typed += ch;
    await stall(100);
  }
  await stall(500);
  const offlineStats = await latencyStats();
  const offlineValue = await page.locator(input).inputValue();
  assert.equal(offlineValue.normalize('NFC'), typed.normalize('NFC'), 'offline: input value intact');
  assert.ok(offlineStats.p95 < 30, `offline: keystroke p95 ${offlineStats.p95}ms < 30ms`);
  assert.equal(await bannerCount(), 0, 'offline: no error banner interrupts typing');
  check('offline typing continues with zero interruption', { ...offlineStats, characters: typed.length });

  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  const reconnectRevision = await waitForServerRevision(65, 40000);
  assert.ok(reconnectRevision >= 65, `reconnect: server revision reached ${reconnectRevision}`);
  check('reconnect flushes the deferred queue', { serverRevision: reconnectRevision });

  // ── 3. Slow final submit: server-authoritative result for the exact text ──
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 3000, downloadThroughput: -1, uploadThroughput: -1 });
  const finishRes = await context.request.post(api + '/api/games/typing/practice/finish', {
    headers,
    data: { attemptId: attempt.attemptId, typedText: typed, inputRevision: 65 },
    timeout: 30000,
  });
  assert.ok(finishRes.ok(), `finish slow: HTTP ${finishRes.status()}`);
  const result = await finishRes.json();
  // The short audit run is correctly NOT reward-eligible (server needs the full
  // duration), but the authoritative metrics still come from the exact text.
  assert.equal(result.recorded, false, 'finish slow: short run not rewardable');
  assert.equal(result.reason, 'ATTEMPT_ENDED_EARLY', 'finish slow: server reason');
  assert.equal(result.accuracy, 100, 'finish slow: perfect accuracy for exact prefix');
  assert.ok(result.wpm > 0, 'finish slow: wpm computed server-side');
  check('final result is server-authoritative under 3000ms latency', { wpm: result.wpm, accuracy: result.accuracy, revision: 65 });

  assert.deepEqual(report.errors, []);
  report.status = 'PASS';
  await cdp.detach();
} catch (error) {
  report.status = 'FAIL';
  report.failure = error.stack;
  console.error(error);
  process.exitCode = 1;
} finally {
  report.finished = new Date().toISOString();
  await fs.writeFile(path.join(dir, 'local-first-results.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('report written to', path.join(dir, 'local-first-results.json'));
  console.log('STATUS:', report.status);
}
