#!/usr/bin/env node
/**
 * Computer Rush — browser QA cho vocabulary expansion.
 *
 * Chạy trên frontend + backend thật (không mock API):
 *  1. SOLO nhiều trận liên tiếp → đo tỉ lệ lặp từ giữa các trận.
 *  2. DUO/TRIO → mọi người phải thấy cùng chuỗi từ theo index.
 *  3. Không tràn chữ với cụm 3 từ ở viewport 390.
 *
 *   node scripts/computer-vocabulary-browser-audit.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const API = process.env.QA_API || 'http://127.0.0.1:5001';
const WEB = process.env.QA_WEB || 'http://127.0.0.1:5173';
const OUT = path.resolve(process.env.QA_OUT || '../docs/audit/2026-10-22/computer-vocabulary');
const PASSWORD = 'QaVocab!2026';
const SOLO_MATCHES = Number(process.env.QA_SOLO_MATCHES || 6);
const WORDS_PER_MATCH = Number(process.env.QA_WORDS || 12);

fs.mkdirSync(OUT, { recursive: true });

async function auth(email, name) {
  const register = await fetch(`${API}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  if (register.ok) return register.json();
  const login = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!login.ok) throw new Error(`Không đăng nhập được ${email}: ${login.status}`);
  return login.json();
}

async function session(browser, credentials) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await context.addInitScript(({ token, userId }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('workrank_active_user_id', String(userId));
    localStorage.setItem('workrank_token_issued_at', String(Date.now()));
    localStorage.setItem('workrank_session', JSON.stringify({ userId: String(userId), token, sessionGeneration: Date.now() }));
  }, { token: credentials.accessToken, userId: credentials.user.id });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error('[pageerror]', error.message));
  const request = async (route, body) => {
    const res = await context.request.post(`${API}${route}`, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      data: body ?? {},
    });
    if (!res.ok()) throw new Error(`${route}: ${res.status()} ${await res.text()}`);
    return res.json();
  };
  return { context, page, request, auth: credentials };
}

async function typeWord(s) {
  const page = s.page;
  await page.waitForFunction(() => document.querySelectorAll('[data-testid="challenge-word"]').length === 1);
  await page.waitForTimeout(60);
  const before = Number(await page.locator('.arcade-world').getAttribute('data-attempts'));
  const word = (await page.getByTestId('challenge-word').textContent()).trim();
  const overflow = await page.evaluate(() => {
    const el = document.querySelector('[data-testid="challenge-word"]');
    return { scroll: el.scrollWidth, client: el.clientWidth };
  });
  await page.locator('#arcade-word-input').focus();
  await page.keyboard.type(word.toLowerCase(), { delay: 42 });
  await page.waitForFunction(
    (n) => Number(document.querySelector('.arcade-world')?.dataset.attempts) > n,
    before,
    { timeout: 8000 }
  );
  return { index: before, word, overflow: overflow.scroll > overflow.client + 2 };
}

async function openRoom(s, roomId) {
  await s.page.goto(`${WEB}/games/arcade/computer_rush/room/${roomId}`, { waitUntil: 'domcontentloaded' });
  await s.page.locator('.arcade-world').waitFor({ timeout: 20000 });
  await s.page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 20000 });
}

async function leaveQuietly(s, roomId) {
  await s.context.request
    .post(`${API}/api/games/arcade/rooms/${roomId}/leave`, {
      headers: { Authorization: `Bearer ${s.auth.accessToken}` },
      data: {},
    })
    .catch(() => {});
}

async function soloMatches(browser, credentials) {
  const runs = [];
  const allWords = [];
  for (let match = 0; match < SOLO_MATCHES; match += 1) {
    const s = await session(browser, credentials);
    const active = await s.context.request
      .get(`${API}/api/games/arcade/active`, { headers: { Authorization: `Bearer ${credentials.accessToken}` } })
      .then((r) => (r.ok() ? r.json() : null))
      .catch(() => null);
    if (active?.room?.id) await leaveQuietly(s, active.room.id);

    const created = await s.request('/api/games/arcade/rooms', { gameType: 'computer_rush', mode: 'SOLO' });
    const roomId = created.room.id;
    await openRoom(s, roomId);
    const words = [];
    for (let i = 0; i < WORDS_PER_MATCH; i += 1) {
      const typed = await typeWord(s);
      words.push(typed.word);
    }
    if (match === 0) await s.page.screenshot({ path: path.join(OUT, 'solo-390.png') });
    await leaveQuietly(s, roomId);
    await s.context.close();
    runs.push({ roomId, seed: created.room.seed, words });
    allWords.push(...words);
    console.log(`[solo ${match + 1}] ${words.join(' · ')}`);
  }

  const unique = new Set(allWords.map((w) => w.normalize('NFC').toUpperCase())).size;
  const repeated = [];
  for (let i = 1; i < runs.length; i += 1) {
    const before = new Set(runs[i - 1].words.map((w) => w.normalize('NFC').toUpperCase()));
    for (const word of runs[i].words) {
      if (before.has(word.normalize('NFC').toUpperCase())) repeated.push(word);
    }
  }
  return {
    matches: runs.length,
    words: allWords.length,
    uniqueWords: unique,
    inMatchDuplicates: runs.map((r) => r.words.length - new Set(r.words).size).reduce((a, b) => a + b, 0),
    consecutiveRepeats: repeated,
    runs,
  };
}

async function multiplayer(browser, mode, credentialsList) {
  const sessions = [];
  for (const credentials of credentialsList) sessions.push(await session(browser, credentials));
  const host = sessions[0];

  const active = await host.context.request
    .get(`${API}/api/games/arcade/active`, { headers: { Authorization: `Bearer ${host.auth.accessToken}` } })
    .then((r) => (r.ok() ? r.json() : null))
    .catch(() => null);
  if (active?.room?.id) await leaveQuietly(host, active.room.id);

  const created = await host.request('/api/games/arcade/rooms', { gameType: 'computer_rush', mode });
  const roomId = created.room.id;
  for (const s of sessions.slice(1)) await s.request(`/api/games/arcade/rooms/${roomId}/join`, {});
  // Phòng DUO/TRIO mở ở trạng thái lobby: chưa có .arcade-world cho tới khi bắt đầu.
  for (const s of sessions) {
    await s.page.goto(`${WEB}/games/arcade/computer_rush/room/${roomId}`, { waitUntil: 'domcontentloaded' });
    await s.page.getByRole('button', { name: 'Tôi đã sẵn sàng', exact: true }).waitFor({ timeout: 20000 });
  }
  for (const s of sessions) await s.page.getByRole('button', { name: 'Tôi đã sẵn sàng', exact: true }).click();
  await host.page.getByRole('button', { name: 'Bắt đầu', exact: true }).click();
  for (const s of sessions) {
    await s.page.locator('.arcade-world').waitFor({ timeout: 20000 });
    await s.page.locator('.arcade-countdown').waitFor({ state: 'hidden', timeout: 20000 });
  }

  const perPlayer = await Promise.all(
    sessions.map(async (s) => {
      const seen = [];
      for (let i = 0; i < 5; i += 1) seen.push(await typeWord(s));
      return seen;
    })
  );

  await host.page.screenshot({ path: path.join(OUT, `${mode.toLowerCase()}-390.png`) });

  const byIndex = new Map();
  perPlayer.forEach((list, player) => {
    for (const item of list) {
      if (!byIndex.has(item.index)) byIndex.set(item.index, []);
      byIndex.get(item.index).push({ player, word: item.word });
    }
  });
  let mismatches = 0;
  for (const entries of byIndex.values()) {
    if (entries.length < 2) continue;
    if (new Set(entries.map((e) => e.word)).size !== 1) mismatches += 1;
  }

  for (const s of sessions) await leaveQuietly(s, roomId);
  for (const s of sessions) await s.context.close();
  return { mode, roomId, seed: created.room.seed, sharedIndexes: byIndex.size, mismatches, perPlayer };
}

async function run() {
  const credentialsA = await auth('qa.vocab.a@workrank.test', 'QA Vocab A');
  const credentialsB = await auth('qa.vocab.b@workrank.test', 'QA Vocab B');
  const credentialsC = await auth('qa.vocab.c@workrank.test', 'QA Vocab C');
  const browser = await chromium.launch({ headless: true });
  const report = { capturedAt: new Date().toISOString(), solo: null, duo: null, trio: null };

  try {
    report.solo = await soloMatches(browser, credentialsA);
    report.duo = await multiplayer(browser, 'DUO', [credentialsA, credentialsB]);
    report.trio = await multiplayer(browser, 'TRIO', [credentialsA, credentialsB, credentialsC]);
  } finally {
    await browser.close();
  }

  report.verdict = {
    soloUniqueRatio: report.solo.uniqueWords / report.solo.words,
    soloInMatchDuplicates: report.solo.inMatchDuplicates,
    consecutiveRepeatCount: report.solo.consecutiveRepeats.length,
    duoMismatches: report.duo.mismatches,
    trioMismatches: report.trio.mismatches,
  };
  fs.writeFileSync(path.join(OUT, 'browser-audit.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report.verdict, null, 2));
}

run().catch((error) => {
  console.error('[vocab-browser] FAILED:', error.message);
  process.exit(1);
});
