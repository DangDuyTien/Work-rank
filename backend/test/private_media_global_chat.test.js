'use strict';

/**
 * PRIVATE MEDIA — GLOBAL CHAT + SHARED LISTENING PRESENCE
 *
 * Acceptance suite for the four requirements:
 *   1. avatars/names of everybody listening together, deduplicated per account
 *   2. ONE chat channel for Nghe riêng and Nghe chung
 *   3. today-only history, switched by the SERVER at 00:00 Vietnam time
 *   4. no duplicate, out-of-order or lost messages across reconnect
 *
 * Everything here uses real HTTP + real Socket.IO against the SQLite test
 * database, with two entitled accounts and several sockets per account.
 */

const { test, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { Server } = require('socket.io');
const { io } = require('../../frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, PrivateMediaChatMessage: Message, sequelize } = require('../src/models');
const service = require('../src/services/privateMedia/session.service');
const chat = require('../src/services/privateMedia/chat.service');
const chatTime = require('../src/services/privateMedia/chatTime');
const chatClock = require('../src/services/privateMedia/chatClock.service');
const realtime = require('../src/services/privateMedia/realtime.service');
const access = require('../src/services/privateMedia/access.service');

let owner;
let delegate;
let outsider;
let admin;
let server;
let socketServer;
let base;
const sockets = [];

const token = (u) => jwt.sign({ sub: u.id, tokenVersion: u.tokenVersion || 0 }, env.jwtSecret);
const uid = () => crypto.randomUUID();

const connect = (u, room = 'private') => new Promise((resolve, reject) => {
  const socket = io(`${base}/private-media`, {
    auth: { token: token(u), room },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(socket);
  // Every web socket receives the day snapshot and the participant snapshot on
  // connect. Waiting for both makes the assertions below deterministic instead
  // of racing the first packets.
  let day = false;
  let people = false;
  const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
  const settle = () => {
    if (!day || !people) return;
    clearTimeout(timer);
    resolve(socket);
  };
  socket.on('private-media:chat-day', (payload) => {
    // The first one is the connect snapshot; remember it for assertions.
    if (!day) socket.initialDay = payload;
    day = true;
    settle();
  });
  socket.on('private-media:participants', (payload) => {
    if (!people) socket.initialParticipants = payload;
    people = true;
    settle();
  });
  socket.once('connect_error', (error) => { clearTimeout(timer); reject(error); });
});

/** Wait for one event, or reject after `timeout` — never hang a suite. */
function nextEvent(socket, event, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for ${event}`));
    }, timeout);
    function handler(payload) {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    }
    socket.on(event, handler);
  });
}

async function waitFor(predicate, timeout = 3000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 40));
  }
  return predicate();
}

const emitAck = (socket, event, payload) => new Promise((resolve) => socket.emit(event, payload, resolve));

const send = (user, content, room = 'private') => request(app)
  .post('/api/private-media/chat')
  .set('X-PM-Room', room)
  .set('Authorization', `Bearer ${token(user)}`)
  .send({ content, clientMessageId: uid() });

const history = (user, room = 'private', query = '') => request(app)
  .get(`/api/private-media/chat${query}`)
  .set('X-PM-Room', room)
  .set('Authorization', `Bearer ${token(user)}`);

const dayOffset = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

before(async () => {
  owner = await User.create({ name: 'Duy Tiến', email: 'tienddph50842@gmail.com', passwordHash: 'x', role: 'user' });
  delegate = await User.create({ name: 'Minh Anh', email: 'global-chat-b@test.local', passwordHash: 'x', role: 'user' });
  outsider = await User.create({ name: 'Người ngoài', email: 'global-chat-c@test.local', passwordHash: 'x', role: 'user' });
  admin = await User.create({ name: 'Admin', email: 'global-chat-admin@test.local', passwordHash: 'x', role: 'admin' });
  await access.resolveOwnerUserId({ force: true });
  await access.grantAccess({
    actorUserId: owner.id,
    targetUserId: delegate.id,
    permissions: { view: true, queue: true, control: true },
  });

  server = http.createServer(app);
  socketServer = new Server(server);
  require('../src/sockets/privateMedia').registerPrivateMediaNamespace(socketServer);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  chatClock.stop();
  sockets.forEach((socket) => socket.disconnect());
  if (socketServer) await new Promise((r) => socketServer.close(r));
});

beforeEach(async () => {
  chat.resetRateLimit(owner.id);
  chat.resetRateLimit(delegate.id);
  // Disconnects are asynchronous: let the previous test's sockets leave the
  // participant registry before the next one measures it.
  await waitFor(() => realtime.listeningParticipants().length === 0);
});

/**
 * Close every socket this test opened. Without it a single failing assertion
 * would leave a listener behind and cascade into the next test's counts.
 */
afterEach(async () => {
  const open = sockets.splice(0);
  open.forEach((socket) => {
    try { socket.disconnect(); } catch { /* already gone */ }
  });
  await waitFor(() => realtime.listeningParticipants().length === 0, 2500);
});

// ── 1. Vietnam calendar day ────────────────────────────────────────────────

test('the server files chat under the Vietnam calendar day, not UTC', () => {
  // 18:30 UTC on 06/11 is already 01:30 on 07/11 in Vietnam (UTC+7).
  assert.equal(chatTime.dayKey(new Date('2026-11-06T18:30:00Z')), '2026-11-07');
  // 16:59 UTC is 23:59 the same Vietnam day.
  assert.equal(chatTime.dayKey(new Date('2026-11-06T16:59:00Z')), '2026-11-06');
  // The boundary itself belongs to the NEW day.
  assert.equal(chatTime.dayKey(new Date('2026-11-06T17:00:00Z')), '2026-11-07');

  const endsAt = chatTime.dayEndsAt('2026-11-06');
  assert.equal(endsAt.toISOString(), '2026-11-06T17:00:00.000Z');
  assert.equal(chatTime.dayStartsAt('2026-11-06').toISOString(), '2026-11-05T17:00:00.000Z');
  assert.equal(chatTime.msUntilNextDay(new Date('2026-11-06T16:00:00Z')), 60 * 60 * 1000);
});

// ── 2. One channel for both listening modes ────────────────────────────────

test('a message sent in Nghe riêng is visible in Nghe chung, and the reverse', async () => {
  const fromPrivate = await send(owner, 'Tin gửi từ chế độ nghe riêng', 'private');
  assert.equal(fromPrivate.status, 201);
  assert.equal(fromPrivate.body.channel, 'global');

  const seenInShared = await history(delegate, 'shared');
  assert.equal(seenInShared.status, 200);
  assert.ok(
    seenInShared.body.messages.some((m) => m.content === 'Tin gửi từ chế độ nghe riêng'),
    'a private-mode message must appear for a user in shared mode',
  );

  const fromShared = await send(delegate, 'Tin gửi từ chế độ nghe chung', 'shared');
  assert.equal(fromShared.status, 201);

  const seenInPrivate = await history(owner, 'private');
  assert.ok(
    seenInPrivate.body.messages.some((m) => m.content === 'Tin gửi từ chế độ nghe chung'),
    'a shared-mode message must appear for a user in private mode',
  );
  // Same feed, therefore the same message ids in both modes.
  const inShared = await history(owner, 'shared');
  assert.deepEqual(
    inShared.body.messages.map((m) => m.id),
    seenInPrivate.body.messages.map((m) => m.id),
  );
});

test('legacy session-scoped rows are never merged into the public feed', async () => {
  const anchor = await service.getChatAnchorSession();
  const legacy = await Message.create({
    sessionId: anchor.sessionId,
    userId: delegate.id,
    content: 'Tin nhắn cũ trong phiên riêng',
    channel: chat.LEGACY_CHANNEL,
    day: chatTime.dayKey(),
    clientMessageId: uid(),
  });

  const page = await chat.listMessages({ userId: owner.id, limit: 100 });
  assert.ok(!page.messages.some((m) => m.id === Number(legacy.id)), 'legacy row must stay hidden');
  // …but it is still stored, not deleted.
  assert.ok(await Message.findByPk(legacy.id));
});

// ── 3. Today only, switched at 00:00 ───────────────────────────────────────

test('history is scoped to today; a message stamped yesterday never appears', async () => {
  const yesterday = await chat.createMessage({
    userId: delegate.id,
    content: 'Tin của hôm qua',
    clientMessageId: uid(),
    at: dayOffset(-1),
  });
  assert.notEqual(yesterday.day, chatTime.dayKey());

  const today = await chat.listMessages({ userId: owner.id, limit: 100 });
  assert.ok(!today.messages.some((m) => m.content === 'Tin của hôm qua'));
  assert.equal(today.day, chatTime.dayKey());
  assert.ok(today.dayEndsAt);

  // "Tomorrow" (what every client sees at 00:00) starts empty even though the
  // rows of today are still in the table.
  const tomorrow = await chat.listMessages({ userId: owner.id, limit: 100, at: dayOffset(1) });
  assert.deepEqual(tomorrow.messages, []);
  assert.equal(tomorrow.unread, 0);
  assert.equal(tomorrow.hasMore, false);
  assert.ok(await Message.findOne({ where: { content: 'Tin của hôm qua' } }));
});

test('unread restarts at 00:00 without deleting yesterday', async () => {
  await chat.resetRateLimit(delegate.id);
  await chat.createMessage({ userId: delegate.id, content: 'Trước nửa đêm', clientMessageId: uid() });
  const beforeMidnight = await chat.getUnread({ userId: owner.id });
  assert.ok(beforeMidnight.unread >= 1);

  const afterMidnight = await chat.getUnread({ userId: owner.id, at: dayOffset(1) });
  assert.equal(afterMidnight.unread, 0, 'a new day starts with nothing unread');

  const marker = await chat.markRead({ userId: owner.id, at: dayOffset(1) });
  assert.equal(marker.unread, 0);
  assert.equal(marker.day, chatTime.dayKey(dayOffset(1)));
});

test('the 00:00 switch is pushed to every open client, in both modes', async () => {
  const a = await connect(owner, 'private');
  const b = await connect(delegate, 'shared');

  const [forA, forB] = await Promise.all([
    nextEvent(a, 'private-media:chat-day'),
    nextEvent(b, 'private-media:chat-day'),
    Promise.resolve(chatClock.emitRollover(dayOffset(1))),
  ]);

  const expected = chatTime.dayKey(dayOffset(1));
  for (const payload of [forA, forB]) {
    assert.equal(payload.day, expected);
    assert.equal(payload.dayEndsAt, chatTime.dayEndsAt(expected).toISOString());
    assert.equal(typeof payload.serverNow, 'number');
  }
  a.disconnect();
  b.disconnect();
});

test('a client that connects after 00:00 receives the new day immediately', async () => {
  const socket = await connect(owner, 'private');
  assert.equal(socket.initialDay.day, chatTime.dayKey());
  assert.equal(socket.initialDay.dayEndsAt, chatTime.dayEndsAt(chatTime.dayKey()).toISOString());
  assert.ok(new Date(socket.initialDay.dayEndsAt).getTime() > Date.now());
  socket.disconnect();
});

// ── 4. Realtime delivery, dedupe, order, reconnect ─────────────────────────

test('a socket in each mode receives the same message exactly once', async () => {
  const inPrivate = await connect(owner, 'private');
  const inShared = await connect(delegate, 'shared');

  const [forPrivate, forShared] = await Promise.all([
    nextEvent(inPrivate, 'private-media:chat-message'),
    nextEvent(inShared, 'private-media:chat-message'),
    emitAck(inPrivate, 'private-media:chat-send', { content: 'Xin chào cả phòng', clientMessageId: uid() }),
  ]);

  assert.equal(forPrivate.id, forShared.id);
  assert.equal(forPrivate.content, 'Xin chào cả phòng');
  assert.equal(forPrivate.user.id, owner.id);
  assert.equal(forPrivate.user.name, 'Duy Tiến');
  assert.equal(forPrivate.day, chatTime.dayKey());

  inPrivate.disconnect();
  inShared.disconnect();
});

test('a retried send returns the original row and is broadcast once', async () => {
  const socket = await connect(owner, 'private');
  const clientMessageId = uid();
  let broadcasts = 0;
  socket.on('private-media:chat-message', () => { broadcasts += 1; });

  const first = await emitAck(socket, 'private-media:chat-send', { content: 'Gửi lại thử', clientMessageId });
  const second = await emitAck(socket, 'private-media:chat-send', { content: 'Gửi lại thử', clientMessageId });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(second.duplicate, true);
  assert.equal(first.message.id, second.message.id);

  const page = await history(owner, 'private', '?limit=100');
  assert.equal(page.body.messages.filter((m) => m.content === 'Gửi lại thử').length, 1);
  // Give a late duplicate broadcast a chance to show up before asserting.
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(broadcasts, 1);
  socket.disconnect();
});

test('reconnect catch-up returns only what was missed, ascending and without duplicates', async () => {
  await chat.resetRateLimit(delegate.id);
  const sent = [];
  for (const text of ['một', 'hai', 'ba', 'bốn']) {
    // eslint-disable-next-line no-await-in-loop
    const result = await chat.createMessage({ userId: delegate.id, content: text, clientMessageId: uid() });
    sent.push(result.message.id);
  }

  // The tab holds `sent[0]` and reconnects.
  const catchUp = await chat.listMessages({ userId: owner.id, afterId: sent[0], limit: 100 });
  const ids = catchUp.messages.map((m) => m.id);
  assert.deepEqual(ids, sent.slice(1));
  assert.deepEqual([...ids].sort((x, y) => x - y), ids, 'must be ascending');
  assert.equal(new Set(ids).size, ids.length, 'no duplicates');

  // A cursor at the newest message returns nothing — not the whole day again.
  const empty = await chat.listMessages({ userId: owner.id, afterId: sent[sent.length - 1] });
  assert.deepEqual(empty.messages, []);

  // And the socket path agrees with the REST path.
  const viaRest = await history(owner, 'private', `?after=${sent[0]}&limit=100`);
  assert.deepEqual(viaRest.body.messages.map((m) => m.id), ids);
});

test('a socket that reconnects gets the full current day and then the cursor', async () => {
  const first = await connect(owner, 'private');
  first.disconnect();

  const second = await connect(owner, 'private');
  const page = await history(owner, 'private', '?limit=100');
  assert.equal(page.body.day, chatTime.dayKey());
  assert.ok(page.body.messages.length > 0);

  const lastId = page.body.nextAfterId;
  const [broadcast] = await Promise.all([
    nextEvent(second, 'private-media:chat-message'),
    emitAck(second, 'private-media:chat-send', { content: 'Sau khi kết nối lại', clientMessageId: uid() }),
  ]);
  assert.ok(broadcast.id > lastId);
  second.disconnect();
});

// ── 5. Participants (avatars) ──────────────────────────────────────────────

test('participants are deduplicated per account across tabs', async () => {
  const a1 = await connect(owner, 'shared');
  const a2 = await connect(owner, 'shared');

  // B joining is what triggers the broadcast everybody receives.
  const joinNotice = nextEvent(a1, 'private-media:participants');
  const b1 = await connect(delegate, 'shared');
  const joined = await joinNotice;

  const ids = joined.participants.map((p) => p.id).sort((x, y) => x - y);
  assert.deepEqual(ids, [owner.id, delegate.id].sort((x, y) => x - y));
  assert.equal(joined.count, 2, 'two tabs of the same account count once');
  const mine = joined.participants.find((p) => p.id === owner.id);
  assert.equal(mine.name, 'Duy Tiến');
  assert.equal(mine.online, true);

  // Closing one tab of A must NOT remove A.
  a2.disconnect();
  await new Promise((r) => setTimeout(r, 250));
  assert.equal(realtime.listeningParticipants().filter((p) => p.id === owner.id).length, 1);
  assert.equal(realtime.listeningSnapshot().count, 2);

  // Closing A's last tab removes A and notifies the remaining listener.
  const leaveNotice = nextEvent(b1, 'private-media:participants');
  a1.disconnect();
  const after = await leaveNotice;
  assert.deepEqual(after.participants.map((p) => p.id), [delegate.id]);
  assert.equal(after.count, 1);
  b1.disconnect();
});

test('joining and leaving shared listening is pushed in realtime to everybody', async () => {
  const listener = await connect(owner, 'shared');

  const joinNotice = nextEvent(listener, 'private-media:participants');
  const newcomer = await connect(delegate, 'shared');
  const joined = await joinNotice;
  assert.equal(joined.count, 2);
  assert.ok(joined.participants.some((p) => p.name === 'Minh Anh'));

  const leaveNotice = nextEvent(listener, 'private-media:participants');
  newcomer.disconnect();
  const left = await leaveNotice;
  assert.equal(left.count, 1);
  assert.ok(!left.participants.some((p) => p.id === delegate.id));

  listener.disconnect();
});

test('a private-mode tab is not listed as a shared listener', async () => {
  const solo = await connect(owner, 'private');
  await new Promise((r) => setTimeout(r, 150));
  assert.ok(!realtime.listeningParticipants().some((p) => p.id === owner.id));
  solo.disconnect();
});

test('the participant list marks the account that actually owns the player', async () => {
  const player = await connect(owner, 'shared');
  const observer = await connect(delegate, 'shared');
  await emitAck(player, 'private-media:player-hello', {});

  const snapshot = realtime.listeningSnapshot();
  const mine = snapshot.participants.find((p) => p.id === owner.id);
  assert.equal(mine.isPlayer, true);
  assert.equal(snapshot.participants.find((p) => p.id === delegate.id).isPlayer, false);
  player.disconnect();
  observer.disconnect();
});

test('the participants endpoint and /status agree with the live registry', async () => {
  const socket = await connect(owner, 'shared');
  await new Promise((r) => setTimeout(r, 120));

  const participants = await request(app)
    .get('/api/private-media/participants')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(participants.status, 200);
  assert.equal(participants.body.count, 1);
  assert.equal(participants.body.participants[0].name, 'Duy Tiến');
  assert.equal(participants.body.chat.day, chatTime.dayKey());

  const status = await request(app)
    .get('/api/private-media/status')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(status.status, 200);
  assert.equal(status.body.participants.length, 1);
  assert.equal(status.body.chat.day, chatTime.dayKey());
  socket.disconnect();
});

// ── 6. Authorization ───────────────────────────────────────────────────────

test('an unentitled account cannot read or write the chat, and cannot join presence', async () => {
  for (const user of [outsider, admin]) {
    const read = await history(user);
    assert.equal(read.status, 404);
    const write = await send(user, 'Tôi không có quyền');
    assert.equal(write.status, 404);
    await assert.rejects(connect(user, 'shared'), /Unauthorized/);
  }
  // Nothing from those attempts reached the feed.
  const page = await history(owner);
  assert.ok(!page.body.messages.some((m) => m.content === 'Tôi không có quyền'));
});

test('a revoked account disappears from the room and loses the feed', async () => {
  const socket = await connect(delegate, 'shared');
  const watcher = await connect(owner, 'shared');
  const notice = nextEvent(watcher, 'private-media:participants', 5000);

  await access.revokeAccess({ actorUserId: owner.id, targetUserId: delegate.id, reason: 'global-chat-test' });
  realtime.revokeUser(delegate.id, 'access-revoked');

  const after = await notice;
  assert.ok(!after.participants.some((p) => p.id === delegate.id));
  assert.equal((await history(delegate)).status, 404);
  assert.equal(socket.connected, false);
  watcher.disconnect();
  assert.ok(sequelize);
});
