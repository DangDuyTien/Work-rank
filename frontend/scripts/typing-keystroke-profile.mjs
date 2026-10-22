/*
 * Per-keystroke CPU profiler for WorkRank Typing Battle solo mode.
 *
 * Captures a V8 sampling profile (CDP Profiler) plus page counters while typing
 * a fast 100-char burst and a Vietnamese IME burst, then aggregates self-time by
 * function so every operation that runs on the hot path can be costed.
 */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base = process.env.PROFILE_WEB || 'http://127.0.0.1:5273';
const api = process.env.PROFILE_API || 'http://127.0.0.1:5101';
const outPath = process.env.PROFILE_OUT || '/var/folders/d2/7zb8g9zd7jbgvyb_xf77q84h0000gn/T/opencode/typing-keystroke-profile.json';
for (const url of [base, api]) assert.equal(new URL(url).hostname, '127.0.0.1', 'loopback only');

const browser = await chromium.launch({ headless: true });
const report = { startedAt: new Date().toISOString(), scenarios: [], errors: [] };

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
    window.__PROFILE = { inputs: 0, apiCalls: 0, socketFrames: 0, storageWrites: 0, commits: 0, longTasks: [], latencies: [], inFlight: null };
    const originalFetch = window.fetch;
    window.fetch = function patchedFetch(...args) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url;
      if (url && url.includes('/api/games/typing')) window.__PROFILE.apiCalls += 1;
      return originalFetch.apply(this, args);
    };
    const originalSend = WebSocket.prototype.send;
    WebSocket.prototype.send = function patchedSend(data) {
      try { if (typeof data === 'string' && data.includes('typing:')) window.__PROFILE.socketFrames += 1; } catch {}
      return originalSend.call(this, data);
    };
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      try { if (typeof key === 'string' && key.includes('typing')) window.__PROFILE.storageWrites += 1; } catch {}
      return originalSetItem.call(this, key, value);
    };
    new PerformanceObserver((list) => window.__PROFILE.longTasks.push(...list.getEntries().map((e) => e.duration))).observe({ type: 'longtask', buffered: false });
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(), supportsFiber: true,
      inject(renderer) { const id = this.renderers.size + 1; this.renderers.set(id, renderer); return id; },
      onCommitFiberRoot() { window.__PROFILE.commits += 1; },
      onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDependencies() {},
    };
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
    const record = () => {
      if (!window.__PROFILE.inFlight) return;
      const wanted = Number(document.querySelector('[data-state="current"]')?.dataset.charIndex ?? -1);
      if (wanted !== window.__PROFILE.inFlight.wanted) return;
      window.__PROFILE.latencies.push(performance.now() - window.__PROFILE.inFlight.t0);
      window.__PROFILE.inFlight = null;
    };
    new MutationObserver(record).observe(box, { childList: true, subtree: true, attributes: true });
    input.addEventListener('input', () => {
      window.__PROFILE.inputs += 1;
      window.__PROFILE.inFlight = { t0: performance.now(), wanted: Array.from(input.value.normalize('NFC')).length };
      record();
    }, true);
    return true;
  });
}

async function resetCounters(page) {
  await page.evaluate(() => {
    window.__PROFILE.inputs = 0;
    window.__PROFILE.apiCalls = 0;
    window.__PROFILE.socketFrames = 0;
    window.__PROFILE.storageWrites = 0;
    window.__PROFILE.commits = 0;
    window.__PROFILE.longTasks = [];
    window.__PROFILE.latencies = [];
    window.__PROFILE.inFlight = null;
  });
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] * 100) / 100;
}

function aggregateProfile(profile, samplingIntervalMs, typedChars) {
  const nodes = new Map();
  for (const node of profile.nodes) {
    const frame = node.callFrame || {};
    const url = (frame.url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\?.*$/, '');
    const name = frame.functionName || '(anonymous)';
    const key = `${name} @ ${url || 'native'}`;
    const current = nodes.get(key) || { name, url, selfMs: 0, hits: 0 };
    current.selfMs += (node.hitCount || 0) * samplingIntervalMs;
    current.hits += node.hitCount || 0;
    nodes.set(key, current);
  }
  const list = [...nodes.values()].map((n) => ({
    function: n.name,
    source: n.url,
    selfMs: Math.round(n.selfMs * 1000) / 1000,
    selfMsPerKey: Math.round((n.selfMs / typedChars) * 1000) / 1000,
    hits: n.hits,
  })).sort((a, b) => b.selfMs - a.selfMs);
  const totalMs = Math.round(list.reduce((s, n) => s + n.selfMs, 0) * 1000) / 1000;
  return { totalMs, functions: list };
}

async function runScenario({ page, context, label, text, delayMs, insertText, profile: withProfile }) {
  await resetCounters(page);
  const cdp = await context.newCDPSession(page);
  let samplingIntervalMs = 1;
  if (withProfile) {
    await cdp.send('Profiler.enable');
    samplingIntervalMs = 0.2;
    await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
    await cdp.send('Profiler.start');
  }
  const t0 = Date.now();
  for (const ch of Array.from(text)) {
    if (insertText) {
      const insertSession = await context.newCDPSession(page);
      await insertSession.send('Input.insertText', { text: ch });
      await insertSession.detach();
    } else {
      await page.keyboard.type(ch);
    }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
  }
  const wallMs = Date.now() - t0;
  await page.waitForTimeout(400);
  let cpu = null;
  if (withProfile) {
    const { profile } = await cdp.send('Profiler.stop');
    cpu = aggregateProfile(profile, samplingIntervalMs, Array.from(text).length);
    await cdp.detach();
  } else {
    await cdp.detach();
  }
  const data = await page.evaluate(() => ({
    inputs: window.__PROFILE.inputs,
    apiCalls: window.__PROFILE.apiCalls,
    socketFrames: window.__PROFILE.socketFrames,
    storageWrites: window.__PROFILE.storageWrites,
    commits: window.__PROFILE.commits,
    longTasks: window.__PROFILE.longTasks,
    latencies: window.__PROFILE.latencies,
  }));
  const scenario = {
    label,
    typedChars: Array.from(text).length,
    wallMs,
    inputEvents: data.inputs,
    reactCommits: data.commits,
    commitsPerKey: Math.round((data.commits / Math.max(1, data.inputs)) * 100) / 100,
    apiCalls: data.apiCalls,
    socketFrames: data.socketFrames,
    storageWrites: data.storageWrites,
    longTaskCount: data.longTasks.length,
    longTaskTotalMs: Math.round(data.longTasks.reduce((s, d) => s + d, 0)),
    latencyMs: { p50: percentile(data.latencies, 0.5), p95: percentile(data.latencies, 0.95), max: percentile(data.latencies, 1) },
    cpu,
  };
  report.scenarios.push(scenario);
  console.log(JSON.stringify({ ...scenario, cpu: cpu ? { totalMs: cpu.totalMs, top: cpu.functions.slice(0, 12) } : null }, null, 2));
  return scenario;
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
  await page.waitForFunction(() => !document.querySelector('input[style*="opacity: 0"]')?.disabled, null, { timeout: 15000 });
  await page.locator('.typing-passage-viewport').click();
  assert.ok(await instrumentKeystrokeLatency(page), 'instrument');
  await page.waitForTimeout(500);

  const target = Array.from(attempt.challengeText);

  await runScenario({ page, context, label: 'cpu-fast-ascii-100', text: target.slice(0, 100).join(''), delayMs: 0, profile: true });
  await runScenario({ page, context, label: 'cpu-vietnamese-ime-40', text: target.slice(100, 140).join(''), delayMs: 80, insertText: true, profile: true });

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
  console.log('STATUS:', report.status);
}
