import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = process.env.TYPING_AUDIT_WEB || 'http://127.0.0.1:5273';
const api = process.env.TYPING_AUDIT_API || 'http://127.0.0.1:5101';
for (const url of [base, api]) assert.equal(new URL(url).hostname, '127.0.0.1', 'Only isolated loopback fixture servers are supported');

const dir = path.resolve('../docs/audit/2026-10-19/typing');
await fs.mkdir(dir, { recursive: true });
const report = { started: new Date().toISOString(), checks: [], errors: [], results: {} };
const browser = await chromium.launch({ headless: true });

async function identity(suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const response = await context.request.post(api + '/api/auth/login', { data: { email: `typing-${suffix}@audit.test`, password: 'TypingAuditTest123!' } });
  assert.equal(response.status(), 200, 'Use the isolated typing-live-server fixture');
  const credential = await response.json();
  const headers = { Authorization: `Bearer ${credential.accessToken}` };
  await context.addInitScript(({ access, refresh }) => { localStorage.setItem('token', access); localStorage.setItem('refreshToken', refresh); }, { access: credential.accessToken, refresh: credential.refreshToken });
  const post = async (route, data) => {
    const response = await context.request.post(api + '/api/games/typing' + route, { headers, data });
    assert.ok(response.ok(), `${route}: HTTP ${response.status()} ${await response.text()}`);
    return response.json();
  };
  const get = async (route) => { const r = await context.request.get(api + '/api/games/typing' + route, { headers }); assert.ok(r.ok(), `${route}: HTTP ${r.status()}`); return r.json(); };
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  return { context, page, post, get, headers, userId: credential.user.id };
}

const check = (name, evidence) => { report.checks.push({ name, status: 'PASS', evidence }); console.log('PASS:', name); };

// Reads a lobby section (Waiting / Live) from the real DOM and reports whether a
// card with the exact room title is present, plus the card's player-count text.
const CARD_PROBE = ({ sectionText, title }) => {
  const header = Array.from(document.querySelectorAll('h3')).find((h) => (h.textContent || '').includes(sectionText));
  if (!header) return { found: false, cardText: '' };
  let node = header;
  let grid = null;
  for (let i = 0; i < 4 && node && !grid; i += 1) {
    grid = Array.from(node.children || []).find((c) => (c.getAttribute('style') || '').includes('display: grid'));
    node = node.parentElement;
  }
  if (!grid) return { found: false, cardText: '' };
  const titleSpan = Array.from(grid.querySelectorAll('span')).find((s) => (s.textContent || '').trim() === title);
  if (!titleSpan) return { found: false, cardText: '' };
  let card = titleSpan;
  for (let i = 0; i < 8 && card; i += 1) {
    if ((card.textContent || '').includes('Người')) return { found: true, cardText: card.textContent };
    card = card.parentElement;
  }
  return { found: true, cardText: '' };
};

const WAITING = 'Danh Sách Phòng Đang Chờ';
const LIVE = 'Trận Đấu Đang Diễn Ra';

async function probe(page, sectionText, title) {
  return page.evaluate(CARD_PROBE, { sectionText, title });
}
async function waitCardPresent(page, sectionText, title, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if ((await probe(page, sectionText, title)).found) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`card "${title}" never appeared in section "${sectionText}"`);
}
async function waitCardGone(page, sectionText, title, timeout = 10000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (!(await probe(page, sectionText, title)).found) return;
    await page.waitForTimeout(150);
  }
  throw new Error(`card "${title}" never left section "${sectionText}"`);
}
async function waitCardCount(page, sectionText, title, needle, timeout = 8000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const card = await probe(page, sectionText, title);
    if (card.found && card.cardText.includes(needle)) return card.cardText;
    await page.waitForTimeout(150);
  }
  throw new Error(`card "${title}" never showed "${needle}"`);
}
async function cardText(page, sectionText, title) {
  return (await probe(page, sectionText, title)).cardText;
}

const ARENA_TAB = 'Đấu Trường Trực Tuyến (PvP)';
async function openLobby(page) {
  await page.goto(base + '/games/typing');
  await page.locator(`text=${ARENA_TAB}`).first().click();
  await page.locator(`text=${WAITING}`).first().waitFor({ timeout: 15000 });
}

const stamp = Date.now();
const a = await identity('a');
const b = await identity('b');
await openLobby(a.page);

async function createRoomFor(session, title) {
  const created = await session.post('/rooms', { title, mode: '1V1', matchType: 'RANKED', durationLimitSeconds: 30 });
  await session.page.goto(base + `/games/typing/room/${created.room.id}`);
  await session.page.locator('text=Rời phòng').waitFor({ timeout: 15000 });
  return created.room.id;
}

try {
  // ── Test 1: room appears live in the other user's lobby with the real count ──
  const room1Title = `Audit Room 1 ${stamp}`;
  const room1 = await createRoomFor(b, room1Title);
  await waitCardPresent(a.page, WAITING, room1Title);
  const card1 = await cardText(a.page, WAITING, room1Title);
  assert.ok(card1.includes('1 Người'), `expected "1 Người" on card, got: ${card1}`);
  report.results.room1 = { id: room1, cardText: card1.slice(0, 140) };
  check('Live room appears in watcher lobby with correct real player count', { roomId: room1, cardText: card1.slice(0, 90) });

  // ── Test 2: UI leave removes the card instantly for the watcher ──
  const t0 = Date.now();
  await b.page.locator('text=Rời phòng').click();
  await b.page.waitForURL('**/games/typing', { timeout: 10000 });
  await waitCardGone(a.page, WAITING, room1Title, 3000);
  const gone1Ms = Date.now() - t0;
  const listAfter1 = await b.get('/rooms?status=WAITING');
  assert.ok(!listAfter1.rooms.some((r) => Number(r.id) === Number(room1)), 'server list must not contain the left room');
  const detail1 = await b.get(`/rooms/${room1}`);
  assert.equal(detail1.room.status, 'ABANDONED');
  check('UI leave removes the lobby card instantly and the server list/DB agree', { gone1Ms, roomStatus: detail1.room.status });

  // ── Test 3: closing the tab removes the ghost after the grace window ──
  const room2Title = `Audit Room 2 ${stamp}`;
  const room2 = await createRoomFor(b, room2Title);
  await waitCardPresent(a.page, WAITING, room2Title);
  const t2 = Date.now();
  await b.context.close();
  await waitCardGone(a.page, WAITING, room2Title, 12000);
  const gone2Ms = Date.now() - t2;
  assert.ok(gone2Ms < 11000, `ghost cleanup took too long: ${gone2Ms}ms`);
  assert.ok(gone2Ms > 3000, `seat released before grace window (${gone2Ms}ms) — reload recovery would break`);
  const detail2 = await a.get(`/rooms/${room2}`);
  assert.equal(detail2?.room?.status, 'ABANDONED');
  assert.equal((detail2?.players || []).length, 0, 'no ghost seat rows');
  check('Tab close releases the waiting seat after grace; lobby drops the card live', { gone2Ms, seats: (detail2?.players || []).length });

  // ── Test 4: reload inside the room keeps the seat ──
  const b2 = await identity('b');
  const room3Title = `Audit Room 3 ${stamp}`;
  const created3 = await b2.post('/rooms', { title: room3Title, mode: '1V1', matchType: 'RANKED', durationLimitSeconds: 30 });
  const room3 = created3.room.id;
  await b2.page.goto(base + `/games/typing/room/${room3}`);
  await b2.page.locator('text=Rời phòng').waitFor({ timeout: 15000 });
  await waitCardPresent(a.page, WAITING, room3Title);
  await b2.page.reload();
  await b2.page.locator('text=Rời phòng').waitFor({ timeout: 15000 });
  await a.page.waitForTimeout(7000); // longer than the 5s disconnect grace
  const detail3 = await a.get(`/rooms/${room3}`);
  assert.equal(detail3?.room?.status, 'WAITING', 'reload within grace must keep the room alive');
  assert.equal((detail3?.players || []).length, 1, 'reloaded player keeps the seat');
  assert.equal((await probe(a.page, WAITING, room3Title)).found, true, 'watcher card never disappeared');
  check('Reload inside a waiting room keeps the seat; watcher card never disappears', { roomId: room3 });

  // ── Test 5: guest joins and leaves via UI; host room survives with 1 player ──
  const guest = await identity('spectator');
  await openLobby(guest.page);
  await waitCardPresent(guest.page, WAITING, room3Title);
  await guest.post(`/rooms/${room3}/join`, {});
  await guest.page.goto(base + `/games/typing/room/${room3}`);
  await guest.page.locator('text=Rời phòng').waitFor({ timeout: 15000 });
  assert.equal((await a.get(`/rooms/${room3}`))?.players?.length, 2);
  await guest.page.locator('text=Rời phòng').click();
  await guest.page.waitForURL('**/games/typing', { timeout: 10000 });
  const updatedCard = await waitCardCount(a.page, WAITING, room3Title, '1 Người', 6000);
  report.results.updatedCard = updatedCard.slice(0, 140);
  const afterGuest = await a.get(`/rooms/${room3}`);
  assert.equal(afterGuest?.players?.length, 1, 'guest seat released, host untouched');
  assert.equal(afterGuest?.room?.status, 'WAITING');
  check('Guest leave releases only the guest seat; watcher card updates to the live count', { players: afterGuest?.players?.length });

  // ── Test 6: start moves the card to the live list; reload mid-match keeps seats ──
  await guest.post(`/rooms/${room3}/join`, {});
  await b2.post(`/rooms/${room3}/start`, {});
  await waitCardPresent(a.page, LIVE, room3Title, 12000);
  await waitCardGone(a.page, WAITING, room3Title, 5000);
  const liveList = await a.get('/rooms?status=PLAYING');
  assert.ok(liveList.rooms.some((r) => Number(r.id) === Number(room3)), 'live list exposes the playing room');
  await b2.page.reload();
  await b2.page.locator('text=Rời phòng').waitFor({ timeout: 15000 });
  await a.page.waitForTimeout(7000);
  const midMatch = await a.get(`/rooms/${room3}`);
  assert.equal(midMatch?.room?.status, 'PLAYING');
  assert.equal(midMatch?.players?.length, 2, 'reload during a match must not surrender the seat');
  assert.ok(midMatch.players.every((p) => p.status !== 'SURRENDERED'));
  check('Start moves room to live list; mid-match reload keeps both seats (recovery intact)', { players: midMatch?.players?.length });

  // ── Test 7: finishing the match removes the live card everywhere ──
  const challenge = midMatch.room.challengeText || '';
  const typed = Array.from(challenge).slice(0, 40).join('');
  await b2.post(`/rooms/${room3}/finish`, { typedText: typed, completionTimeMs: 20000 });
  await guest.post(`/rooms/${room3}/finish`, { typedText: typed, completionTimeMs: 25000 });
  await waitCardGone(a.page, LIVE, room3Title, 12000);
  const finalList = await a.get('/rooms?status=PLAYING');
  assert.ok(!finalList.rooms.some((r) => Number(r.id) === Number(room3)), 'finished room leaves the live list');
  const finalDetail = await a.get(`/rooms/${room3}`);
  assert.equal(finalDetail.room.status, 'FINISHED');
  check('Match finish removes the live card for every lobby immediately', { roomId: room3 });

  // ── Test 8: server-side integrity: no ghost rooms in any listable status ──
  const all = await a.get('/rooms');
  const zero = all.rooms.filter((r) => Number(r.playerCount || 0) === 0);
  assert.equal(zero.length, 0, 'public list never exposes zero-player rooms');
  const bogusStatus = await a.get('/rooms?status=FINISHED');
  assert.ok(bogusStatus.rooms.every((r) => ['WAITING', 'STARTING', 'PLAYING'].includes(r.status)), 'unknown status filter cannot leak closed rooms');
  check('Server list integrity: no zero-player ghosts, status filter allow-listed', { visibleRooms: all.rooms.length });

  report.status = 'PASS';
} catch (error) {
  report.status = 'FAIL';
  report.failure = { message: error.message, stack: error.stack };
  console.error('FAIL:', error.message);
  throw error;
} finally {
  report.finishedAt = new Date().toISOString();
  await fs.writeFile(path.join(dir, 'room-lifecycle-results.json'), JSON.stringify(report, null, 2));
  console.log('report written to', path.join(dir, 'room-lifecycle-results.json'));
  await browser.close().catch(() => {});
}
