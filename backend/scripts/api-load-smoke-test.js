#!/usr/bin/env node

const { performance } = require('node:perf_hooks');

const baseUrl = process.env.API_BASE_URL || 'http://localhost:5001';
const email = process.env.TEST_EMAIL || 'admin@workrank.local';
const password = process.env.TEST_PASSWORD || 'Admin@123456';
const concurrency = clampNumber(process.env.LOAD_TEST_CONCURRENCY, 4, 1, 50);
const rounds = clampNumber(process.env.LOAD_TEST_ROUNDS, 3, 1, 100);
const timeoutMs = clampNumber(process.env.LOAD_TEST_TIMEOUT_MS, 10_000, 1000, 120_000);

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

function urlFor(path) {
  return new URL(path, baseUrl).toString();
}

async function requestJson(path, { method = 'GET', token, body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const res = await fetch(urlFor(path), {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    const durationMs = performance.now() - startedAt;
    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text.slice(0, 500) };
      }
    }
    if (!res.ok) {
      const error = new Error(`${method} ${path} failed with ${res.status}`);
      error.status = res.status;
      error.payload = payload;
      error.durationMs = durationMs;
      throw error;
    }
    return { status: res.status, payload, durationMs };
  } finally {
    clearTimeout(timer);
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

async function runPool(jobs, workerCount) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < jobs.length) {
      const job = jobs[cursor];
      cursor += 1;
      const startedAt = performance.now();
      try {
        const res = await requestJson(job.path, { token: job.token });
        results.push({ ...job, ok: true, status: res.status, durationMs: res.durationMs });
      } catch (error) {
        results.push({
          ...job,
          ok: false,
          status: error.status || 'ERR',
          durationMs: error.durationMs || (performance.now() - startedAt),
          error: error.message,
        });
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

async function main() {
  console.log(`API load smoke: ${baseUrl} | rounds=${rounds} concurrency=${concurrency}`);
  const login = await requestJson('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  const token = login.payload?.accessToken;
  if (!token) throw new Error('Login response did not include accessToken');

  const me = await requestJson('/api/auth/me', { token });
  const userId = me.payload?.user?.id;
  if (!userId) throw new Error('Auth/me response did not include user.id');

  const endpoints = [
    { name: 'dashboard.overview', path: '/api/dashboard/overview?range=today' },
    { name: 'dashboard.realtimeUsers', path: '/api/dashboard/realtime-users' },
    { name: 'leaderboard.daily', path: '/api/leaderboard/daily?page=1&limit=20' },
    { name: 'leaderboard.weekly', path: '/api/leaderboard/weekly?page=1&limit=20' },
    { name: 'users.list', path: '/api/users?page=1&limit=20' },
    { name: 'reports.weekly', path: `/api/reports/users/${userId}/weekly?limit=6` },
    { name: 'reports.monthly', path: `/api/reports/users/${userId}/monthly?limit=3` },
  ];

  const jobs = [];
  for (let round = 1; round <= rounds; round += 1) {
    for (const endpoint of endpoints) jobs.push({ ...endpoint, round, token });
  }

  const startedAt = performance.now();
  const results = await runPool(jobs, concurrency);
  const totalMs = performance.now() - startedAt;
  const grouped = new Map();
  for (const result of results) {
    if (!grouped.has(result.name)) grouped.set(result.name, []);
    grouped.get(result.name).push(result);
  }

  const rows = [...grouped.entries()].map(([name, list]) => {
    const durations = list.map((item) => item.durationMs);
    const failed = list.filter((item) => !item.ok);
    return {
      endpoint: name,
      requests: list.length,
      failed: failed.length,
      p50_ms: Math.round(percentile(durations, 50)),
      p95_ms: Math.round(percentile(durations, 95)),
      max_ms: Math.round(Math.max(...durations)),
    };
  });

  console.table(rows);
  console.log(`Total: ${results.length} requests in ${Math.round(totalMs)}ms`);

  const failures = results.filter((item) => !item.ok);
  if (failures.length) {
    console.error('Failures:');
    for (const failure of failures.slice(0, 10)) {
      console.error(`- ${failure.name} round=${failure.round} status=${failure.status}: ${failure.error}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
