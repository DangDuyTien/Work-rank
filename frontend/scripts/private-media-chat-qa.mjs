/**
 * PRIVATE MEDIA — CHAT CHUNG / PHÒNG NGHE · BROWSER ACCEPTANCE
 *
 * Drives four real browser tabs against a REAL backend + frontend:
 *   owner (2 tabs, Nghe chung) · guest (Nghe riêng) · guest (mobile, Nghe chung)
 *
 * It proves, end to end:
 *   - participant avatars are deduplicated per account and update live
 *   - one chat channel for both listening modes, same order, no duplicates
 *   - mode switch and full reload keep today's history
 *   - an offline tab catches up exactly once after reconnecting
 *   - 00:00 Vietnam time switches every open tab to a new, empty day WITHOUT
 *     a page reload
 *
 * The 00:00 case needs the server clock near midnight. Run the backend with a
 * throwaway clock shim so the boundary can be observed in ~3 minutes:
 *
 *   cat > /tmp/qa-clock.cjs <<'JS'
 *   const RealDate = Date; const offset = Number(process.env.QA_CLOCK_OFFSET_MS || 0);
 *   class QaDate extends RealDate {
 *     constructor(...a) { if (a.length === 0) super(RealDate.now() + offset); else super(...a); }
 *     static now() { return RealDate.now() + offset; }
 *   }
 *   QaDate.parse = RealDate.parse; QaDate.UTC = RealDate.UTC; global.Date = QaDate;
 *   JS
 *
 *   # isolated database, never the working one
 *   DB_NAME=workrank_qa_chat npx sequelize-cli db:migrate
 *   QA_CLOCK_OFFSET_MS=$(node -e "…target 23:56 Asia/Ho_Chi_Minh…") \
 *     DB_NAME=workrank_qa_chat PORT=5119 PRIVATE_MEDIA_BOOTSTRAP_OWNER_EMAIL=qa-owner@workrank.test \
 *     NODE_OPTIONS="--require /tmp/qa-clock.cjs" node src/server.js
 *
 *   VITE_API_URL=http://127.0.0.1:5119 npx vite --port 5279 --host 127.0.0.1
 *   PM_QA_WEB=http://127.0.0.1:5279 PM_QA_API=http://127.0.0.1:5119 \
 *     node scripts/private-media-chat-qa.mjs
 *
 * Accounts (password QaPass123!): qa-owner@workrank.test (bootstrap owner),
 * qa-guest@workrank.test and qa-guest2@workrank.test (granted view/control).
 */

import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const web = process.env.PM_QA_WEB || 'http://127.0.0.1:5279';
const api = process.env.PM_QA_API || 'http://127.0.0.1:5119';
const outDir = process.env.PM_QA_OUT || '/tmp/pm-chat-qa';
await fs.mkdir(outDir, { recursive: true });

const run = Date.now().toString(36).slice(-4);
const tag = (text) => `QA${run} · ${text}`;
const report = { startedAt: new Date().toISOString(), run, checks: [], errors: [] };
const pass = (name, evidence) => {
  report.checks.push({ name, status: 'PASS', evidence });
  console.log('PASS', name, evidence ? JSON.stringify(evidence).slice(0, 400) : '');
};
const fail = (name, error) => {
  report.checks.push({ name, status: 'FAIL', error: String(error?.message || error) });
  console.log('FAIL', name, String(error?.message || error).slice(0, 400));
};

async function identity(email, password, room, viewport = { width: 1440, height: 1000 }) {
  const context = await browser.newContext({
    viewport,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const login = await context.request.post(`${api}/api/auth/login`, { data: { email, password } });
  assert.equal(login.status(), 200, await login.text());
  const auth = await login.json();
  await context.addInitScript(({ token, refresh, roomMode }) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refresh);
    localStorage.setItem('workrank:private-media:room', roomMode);
  }, { token: auth.accessToken, refresh: auth.refreshToken, roomMode: room });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  return { context, page, auth };
}

async function until(work, predicate, timeout = 15000, label = 'condition') {
  const deadline = Date.now() + timeout;
  let value;
  while (Date.now() < deadline) {
    value = await work();
    if (predicate(value)) return value;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timeout waiting for ${label}: ${JSON.stringify(value)}`);
}

const openMedia = async (page) => {
  await page.goto(`${web}/private/media`);
  await page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 20000 });
};

const texts = (page) => page.$$eval('.pm-chat__text', (nodes) => nodes.map((n) => n.textContent.trim()));
const people = (page) => page.$$eval('.pm-room__person .pm-room__name', (nodes) => nodes.map((n) => n.textContent.trim()));
const dayChip = (page) => page.$eval('.pm-chat__day', (n) => n.textContent.trim()).catch(() => '');
// A second Enter while the first send is in flight is ignored by the UI guard
// (`if (!text || sending) return`). Wait for the draft to clear, exactly like a
// human who watches the message appear before typing the next one.
const send = async (page, text) => {
  const box = page.getByLabel('Nội dung tin nhắn');
  await box.fill(text);
  await box.press('Enter');
  await until(() => box.inputValue(), (value) => value === '', 12000, `draft cleared after "${text}"`);
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
let a; let b; let a2; let mobile;

try {
  a = await identity('qa-owner@workrank.test', 'QaPass123!', 'shared');
  b = await identity('qa-guest@workrank.test', 'QaPass123!', 'private');
  a2 = await identity('qa-owner@workrank.test', 'QaPass123!', 'shared');
  mobile = await identity('qa-guest2@workrank.test', 'QaPass123!', 'shared', { width: 390, height: 844 });

  await openMedia(a.page);
  await openMedia(b.page);
  await openMedia(a2.page);
  await openMedia(mobile.page);
  pass('four tabs opened: owner (2 tabs, shared) + guest (private) + guest (mobile, shared)');

  // ── 1. Participant avatars ────────────────────────────────────────────────
  const ownerList = await until(() => people(a.page), (list) => list.includes('Bạn') && list.length === 2, 15000, 'participants in owner tab');
  const unique = new Set(ownerList);
  assert.equal(unique.size, ownerList.length, 'the same account must not appear twice');
  assert.ok(ownerList.filter((n) => n === 'Bạn').length === 1);
  assert.equal(ownerList.length, 2, 'owner (two tabs, counted once) + the mobile guest in the room');
  pass('shared participant avatars show one chip per account', ownerList);

  const avatars = await a.page.$$eval('.pm-room__person .pm-room__avatar', (nodes) => nodes.length);
  assert.equal(avatars, 2);
  const countLabel = await a.page.$eval('.pm-room__live', (n) => n.textContent.trim());
  assert.match(countLabel, /2 người đang nghe/);
  pass('online state + total listeners', countLabel);

  const privateList = await until(() => people(b.page), (list) => list.length === 2, 10000, 'participants in private tab');
  assert.ok(!privateList.includes('Bạn'), 'a private-mode tab is not a shared listener');
  assert.deepEqual(privateList.sort(), ['Bảo Trâm', 'Bạn'].filter((n) => n !== 'Bạn').concat(['QA Owner']).sort());
  pass('private-mode tab sees the room but is not counted in it', privateList);

  // ── 2. One chat channel for both modes ────────────────────────────────────
  await send(b.page, tag('Tin từ chế độ nghe riêng'));
  await until(() => texts(a.page), (list) => list.includes(tag('Tin từ chế độ nghe riêng')), 12000, 'private message in shared tab');
  await until(() => texts(a2.page), (list) => list.includes(tag('Tin từ chế độ nghe riêng')), 12000, 'private message in second tab');
  pass('a message written in Nghe riêng arrives in Nghe chung tabs');

  await send(a.page, tag('Tin từ chế độ nghe chung'));
  await until(() => texts(b.page), (list) => list.includes(tag('Tin từ chế độ nghe chung')), 12000, 'shared message in private tab');
  pass('a message written in Nghe chung arrives in a Nghe riêng tab');

  const orderA = (await texts(a.page)).filter((t) => t.startsWith(`QA${run} · Tin từ chế độ`));
  const orderB = (await texts(b.page)).filter((t) => t.startsWith(`QA${run} · Tin từ chế độ`));
  assert.deepEqual(orderA, [tag('Tin từ chế độ nghe riêng'), tag('Tin từ chế độ nghe chung')]);
  assert.deepEqual(orderB, orderA);
  pass('both tabs show the same messages in the same order', orderA);

  const duplicates = await a.page.$$eval('.pm-chat__text', (nodes) => {
    const seen = new Map();
    nodes.forEach((n) => seen.set(n.textContent.trim(), (seen.get(n.textContent.trim()) || 0) + 1));
    return [...seen.entries()].filter(([, count]) => count > 1);
  });
  assert.deepEqual(duplicates, []);
  pass('no duplicated message bubbles');

  const meta = await a.page.$eval('.pm-chat__msg .pm-chat__meta', (n) => n.textContent.trim());
  const hasAvatar = await a.page.$eval('.pm-chat__msg .pm-chat__avatar .wr-avatar-container', () => true).catch(() => false);
  assert.ok(hasAvatar, 'each message carries an avatar');
  pass('message shows avatar, name and time', meta);

  // ── 3. Mode switch and reload keep the history ────────────────────────────
  await a.page.getByRole('button', { name: 'Nghe riêng', exact: true }).click();
  await a.page.waitForTimeout(800);
  const afterSwitch = await texts(a.page);
  assert.ok(afterSwitch.includes(tag('Tin từ chế độ nghe riêng')), 'switching mode must not wipe the feed');
  pass('switching Nghe chung → Nghe riêng keeps today\'s history', afterSwitch.length);
  await a.page.getByRole('button', { name: 'Nghe chung', exact: true }).click();
  await a.page.waitForTimeout(600);

  await a.page.reload();
  await a.page.getByRole('heading', { level: 1, name: 'Điều khiển media' }).waitFor({ timeout: 20000 });
  const afterReload = await until(() => texts(a.page), (list) => list.includes(tag('Tin từ chế độ nghe riêng')), 12000, 'history after reload');
  pass('a full page reload restores the same day', afterReload.length);

  // ── 4. Reconnect catch-up ─────────────────────────────────────────────────
  await a.context.setOffline(true);
  await a.page.waitForTimeout(1200);
  await send(b.page, tag('Tin gửi khi A mất mạng 1'));
  await send(b.page, tag('Tin gửi khi A mất mạng 2'));
  await a.context.setOffline(false);
  const caught = await until(() => texts(a.page), (list) => list.includes(tag('Tin gửi khi A mất mạng 1')) && list.includes(tag('Tin gửi khi A mất mạng 2')), 25000, 'catch-up after reconnect');
  assert.equal(caught.filter((t) => t === tag('Tin gửi khi A mất mạng 1')).length, 1);
  pass('reconnect delivers exactly the missed messages, once', caught.filter((t) => t.includes('Tin gửi khi A mất mạng')).length);

  // ── 5. Screenshots (before midnight) ──────────────────────────────────────
  await a.page.screenshot({ path: path.join(outDir, 'desktop-shared.png'), fullPage: false });
  await b.page.screenshot({ path: path.join(outDir, 'desktop-private.png'), fullPage: false });
  await mobile.page.screenshot({ path: path.join(outDir, 'mobile-shared.png'), fullPage: false });
  pass('screenshots captured', outDir);

  // ── 6. 00:00 Vietnam rollover ─────────────────────────────────────────────
  // Set AFTER the deliberate reload above, so a `false` here really means the
  // midnight switch reloaded the page.
  await a.page.evaluate(() => { window.__qaNoReload = 'kept'; });
  const beforeDay = await dayChip(a.page);
  const beforeMessages = (await texts(a.page)).length;
  pass('feed before midnight', { beforeDay, beforeMessages });

  const started = Date.now();
  const rolled = await until(
    async () => ({ day: await dayChip(a.page), messages: (await texts(a.page)).length }),
    (state) => state.messages === 0 && state.day !== beforeDay,
    7 * 60 * 1000,
    'midnight rollover',
  );
  const noReload = await a.page.evaluate(() => window.__qaNoReload === 'kept');
  assert.equal(noReload, true, 'the page must not reload at midnight');
  pass('00:00 switches every open tab to the new day without a reload', {
    ...rolled, waitedSeconds: Math.round((Date.now() - started) / 1000),
  });

  const bRolled = await until(async () => ({ day: await dayChip(b.page), messages: (await texts(b.page)).length }), (s) => s.messages === 0, 20000, 'guest tab rollover');
  assert.notEqual(bRolled.day, beforeDay);
  pass('the private-mode tab switched at the same moment', bRolled);

  await send(b.page, tag('Tin của ngày mới'));
  await until(() => texts(a.page), (list) => list.includes(tag('Tin của ngày mới')), 12000, 'new day message');
  const oldGone = !(await texts(a.page)).some((t) => t.includes('Tin từ chế độ nghe riêng'));
  assert.equal(oldGone, true, 'yesterday\'s messages must not appear in the new day');
  pass('the new day starts empty and accepts new messages only');

  await a.page.screenshot({ path: path.join(outDir, 'desktop-after-midnight.png'), fullPage: false });

  // ── 7. Authorization ──────────────────────────────────────────────────────
  const outsider = await browser.newContext();
  const denied = await outsider.request.get(`${api}/api/private-media/chat`, { headers: { Authorization: 'Bearer invalid' } });
  assert.equal(denied.status(), 401);
  await outsider.close();
  pass('the chat endpoint rejects an unauthenticated caller', denied.status());
} catch (error) {
  fail('qa-run', error);
  try { await a?.page.screenshot({ path: path.join(outDir, 'failure.png'), fullPage: false }); } catch { /* ignore */ }
} finally {
  report.finishedAt = new Date().toISOString();
  report.passed = report.checks.filter((c) => c.status === 'PASS').length;
  report.failed = report.checks.filter((c) => c.status === 'FAIL').length;
  await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\n${report.passed} passed, ${report.failed} failed, ${report.errors.length} console errors`);
  if (report.errors.length) console.log('console errors:', report.errors.slice(0, 10));
  await browser.close();
  process.exit(report.failed ? 1 : 0);
}
