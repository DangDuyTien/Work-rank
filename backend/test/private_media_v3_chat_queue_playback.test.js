'use strict';

/**
 * PRIVATE MEDIA V3 — CHAT PERSISTENCE · END-OF-VIDEO · AUTO-QUEUE
 *
 * Regression suite for the four reported failures:
 *   1. chat lost when the page changes / on refresh / on reconnect
 *   2. the last second of a video replays
 *   3. the shared queue does not auto-advance
 *   4. solo listening has no queue / no "save to playlist"
 *
 * The ENDED tests deliberately use a REALISTIC clock: `referenceTime` is moved
 * into the past instead of forcing `currentTime = duration`. The old suite did
 * the latter, which is why the premature-rejection bug never showed up there.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const { Server } = require('socket.io');
const { io } = require('../../frontend/node_modules/socket.io-client');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  User, PrivateMediaSession: Session, PrivateMediaChatRead: ChatRead, sequelize,
} = require('../src/models');
const service = require('../src/services/privateMedia/session.service');
const chat = require('../src/services/privateMedia/chat.service');
const playlists = require('../src/services/privateMedia/playlist.service');
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
const song = (name, over = {}) => ({ videoId: name.repeat(11), title: name.toUpperCase(), durationSeconds: 200, ...over });
const cmd = (action, payload = {}, user = owner, room = 'shared') => service.issueCommand({
  commandId: crypto.randomUUID(), action, payload, actorUserId: user.id, room,
});

/** Move the server reference clock back so `position(s)` looks like real playback. */
async function setElapsed(sessionId, seconds) {
  await Session.update({ referenceTime: new Date(Date.now() - seconds * 1000) }, { where: { id: sessionId } });
}

const connect = (u, room = 'shared') => new Promise((resolve, reject) => {
  const s = io(`${base}/private-media`, {
    auth: { token: token(u), room },
    transports: ['websocket'],
    reconnection: false,
  });
  sockets.push(s);
  s.once('connect', () => resolve(s));
  s.once('connect_error', reject);
});

const hello = (s) => new Promise((resolve) => s.emit('private-media:player-hello', {}, resolve));
const emitEnded = (s, currentQueueItemId) => new Promise((resolve) => {
  s.emit('private-media:player-ended', { currentQueueItemId, eventId: crypto.randomUUID() }, resolve);
});

before(async () => {
  owner = await User.create({ name: 'Owner', email: 'tienddph50842@gmail.com', passwordHash: 'x', role: 'user' });
  delegate = await User.create({ name: 'Minh', email: 'v3-b@test.local', passwordHash: 'x', role: 'user' });
  outsider = await User.create({ name: 'Outsider', email: 'v3-c@test.local', passwordHash: 'x', role: 'user' });
  admin = await User.create({ name: 'Admin', email: 'v3-admin@test.local', passwordHash: 'x', role: 'admin' });
  await access.resolveOwnerUserId({ force: true });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: delegate.id, permissions: { view: true, queue: true, control: true } });

  server = http.createServer(app);
  socketServer = new Server(server);
  require('../src/sockets/privateMedia').registerPrivateMediaNamespace(socketServer);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  sockets.forEach((s) => s.disconnect());
  await new Promise((r) => socketServer.close(r));
});

// ── 1. ENDED authority / no 1-second replay ────────────────────────────────

test('a realistic end-of-track ENDED advances even when the server clock lags', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  await cmd('QUEUE_ADD', song('b'));

  // The player finished 2s before the server estimate reaches `duration`.
  // Before the fix this returned { premature: true } and the room never moved.
  await setElapsed(a.state.sessionId, 198);
  const result = await service.autoAdvance({
    userId: owner.id,
    room: 'shared',
    currentQueueItemId: a.state.currentQueueItemId,
    eventId: 'ended-realistic',
  });
  assert.equal(result.premature, undefined);
  assert.equal(result.advanced, true);
  assert.equal(result.state.video.title, 'B');
  assert.deepEqual(result.state.queue, []);
});

test('a spurious ENDED for a track that never started is rejected', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  const result = await service.autoAdvance({
    userId: owner.id,
    room: 'shared',
    currentQueueItemId: a.state.currentQueueItemId,
  });
  assert.equal(result.premature, true);
  assert.equal(result.reason, 'NOT_STARTED');
  assert.equal(result.state.video.title, 'A');
});

test('a duplicated ENDED for the same item is stale and cannot advance twice', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  await cmd('QUEUE_ADD', song('b'));
  await cmd('QUEUE_ADD', song('c'));
  await setElapsed(a.state.sessionId, 199);
  const first = await service.autoAdvance({ userId: owner.id, room: 'shared', currentQueueItemId: a.state.currentQueueItemId });
  assert.equal(first.state.video.title, 'B');
  const second = await service.autoAdvance({ userId: owner.id, room: 'shared', currentQueueItemId: a.state.currentQueueItemId });
  assert.equal(second.stale, true);
  const state = await service.getSessionState(owner.id, 'shared');
  assert.equal(state.video.title, 'B', 'the second report must not skip B');
  assert.deepEqual(state.queue.map((q) => q.title), ['C']);
});

test('two browsers reporting ENDED at the same time advance exactly once', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  await cmd('QUEUE_ADD', song('b'));
  await cmd('QUEUE_ADD', song('c'));
  await setElapsed(a.state.sessionId, 199);

  const s1 = await connect(owner);
  const s2 = await connect(delegate);
  await hello(s1);
  await hello(s2);

  const itemId = a.state.currentQueueItemId;
  const [r1, r2] = await Promise.all([emitEnded(s1, itemId), emitEnded(s2, itemId)]);
  const accepted = [r1, r2].filter((r) => r.ok);
  assert.equal(accepted.length, 1, 'exactly one report may be accepted');
  assert.equal([r1, r2].filter((r) => r.stale).length, 1);

  const state = await service.getSessionState(owner.id, 'shared');
  assert.equal(state.video.title, 'B');
  assert.deepEqual(state.queue.map((q) => q.title), ['C']);
  s1.disconnect();
  s2.disconnect();
});

test('shared queue auto-advances A → B → C → IDLE without pressing Next', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  await cmd('QUEUE_ADD', song('b'));
  await cmd('QUEUE_ADD', song('c'));

  let state = a.state;
  const seen = [];
  for (let i = 0; i < 3; i += 1) {
    await setElapsed(state.sessionId, 199);
    // eslint-disable-next-line no-await-in-loop
    const result = await service.autoAdvance({ userId: owner.id, room: 'shared', currentQueueItemId: state.currentQueueItemId });
    assert.equal(result.advanced, i < 2);
    state = result.state;
    seen.push(state.video ? state.video.title : 'IDLE');
  }
  assert.deepEqual(seen, ['B', 'C', 'IDLE']);
});

// ── 2. Solo queue + isolation ──────────────────────────────────────────────

test('solo queue auto-advances and never touches the shared queue', async () => {
  // Shared room gets its own track first.
  await cmd('QUEUE_CLEAR', {}, owner, 'shared');
  const shared = await cmd('LOAD_VIDEO', song('s'), owner, 'shared');
  assert.equal(shared.state.sessionKey, 'room:shared');

  // Solo: A playing, B and C waiting.
  await cmd('QUEUE_CLEAR', {}, owner, 'private');
  const a = await cmd('LOAD_VIDEO', song('a'), owner, 'private');
  assert.notEqual(a.state.sessionKey, 'room:shared');
  await cmd('QUEUE_ADD', song('b'), owner, 'private');
  await cmd('QUEUE_ADD', song('c'), owner, 'private');
  assert.deepEqual(a.state.queue.map((q) => q.title), []);

  const queued = await service.getSessionState(owner.id, 'private');
  assert.deepEqual(queued.queue.map((q) => q.title), ['B', 'C'], 'solo queue keeps FIFO order');

  await setElapsed(queued.sessionId, 199);
  const b = await service.autoAdvance({ userId: owner.id, room: 'private', currentQueueItemId: queued.currentQueueItemId });
  assert.equal(b.state.video.title, 'B');
  await setElapsed(b.state.sessionId, 199);
  const c = await service.autoAdvance({ userId: owner.id, room: 'private', currentQueueItemId: b.state.currentQueueItemId });
  assert.equal(c.state.video.title, 'C');

  const sharedNow = await service.getSessionState(owner.id, 'shared');
  assert.equal(sharedNow.video.title, 'S', 'solo actions must not change the shared room');
  assert.deepEqual(sharedNow.queue, []);
});

test('a second account has its own solo session, queue and chat', async () => {
  const mine = await service.getSessionState(owner.id, 'private');
  const theirs = await service.getSessionState(delegate.id, 'private');
  assert.notEqual(mine.sessionId, theirs.sessionId);
  assert.notEqual(mine.sessionKey, theirs.sessionKey);
});

// ── 3. Chat persistence / unread ───────────────────────────────────────────

test('chat history survives a page change, a refresh and a reconnect cursor', async () => {
  const room = 'shared';
  const state = await service.getSessionState(owner.id, room);
  await chat.markRead({ userId: owner.id, room });
  await chat.markRead({ userId: delegate.id, room });

  const sent = [];
  for (const text of ['tin 1', 'tin 2', 'tin 3']) {
    // eslint-disable-next-line no-await-in-loop
    const result = await chat.createMessage({ userId: delegate.id, room, content: text, clientMessageId: crypto.randomUUID() });
    sent.push(result.message.id);
  }

  // "Route change": the page unmounts, the provider keeps state, but even a
  // fresh fetch must return the same history.
  const page = await chat.listMessages({ userId: owner.id, room, limit: 30 });
  assert.deepEqual(page.messages.map((m) => m.id), sent);

  // "Refresh": a brand-new client with no cursor.
  const refreshed = await chat.listMessages({ userId: owner.id, room, limit: 30 });
  assert.equal(refreshed.messages.length, 3);

  // "Reconnect": only what the tab is missing, ascending, no duplicates.
  const cursor = await chat.listMessages({ userId: owner.id, room, afterId: sent[1] });
  assert.deepEqual(cursor.messages.map((m) => m.id), [sent[2]]);
  const empty = await chat.listMessages({ userId: owner.id, room, afterId: sent[2] });
  assert.deepEqual(empty.messages, []);
  assert.equal(empty.unread, 3);
  assert.ok(state.sessionId);
});

test('unread counts only other people, never your own messages, never duplicates', async () => {
  const room = 'shared';
  const state = await service.getSessionState(owner.id, room);
  await ChatRead.destroy({ where: { sessionId: state.sessionId } });
  const baseline = (await chat.getUnread({ userId: owner.id, room })).unread;

  for (const text of ['a', 'b', 'c']) {
    // eslint-disable-next-line no-await-in-loop
    await chat.createMessage({ userId: delegate.id, room, content: text, clientMessageId: crypto.randomUUID() });
  }
  const unread = await chat.getUnread({ userId: owner.id, room });
  assert.equal(unread.unread, baseline + 3);

  // Own message: does not increase the count.
  await chat.createMessage({ userId: owner.id, room, content: 'của tôi', clientMessageId: crypto.randomUUID() });
  const afterOwn = await chat.getUnread({ userId: owner.id, room });
  assert.equal(afterOwn.unread, baseline + 3);

  // Same clientMessageId twice: one row, one increment.
  const key = crypto.randomUUID();
  await chat.createMessage({ userId: delegate.id, room, content: 'retry', clientMessageId: key });
  const duplicate = await chat.createMessage({ userId: delegate.id, room, content: 'retry', clientMessageId: key });
  assert.equal(duplicate.duplicate, true);
  const afterRetry = await chat.getUnread({ userId: owner.id, room });
  assert.equal(afterRetry.unread, baseline + 4);

  // Reading clears it, and the marker survives a new "device".
  const read = await chat.markRead({ userId: owner.id, room });
  assert.equal(read.unread, 0);
  const again = await chat.getUnread({ userId: owner.id, room });
  assert.equal(again.unread, 0);
  // Marking read twice must not rewind a later message.
  await chat.createMessage({ userId: delegate.id, room, content: 'sau khi đọc', clientMessageId: crypto.randomUUID() });
  const later = await chat.getUnread({ userId: owner.id, room });
  assert.equal(later.unread, 1);
  await chat.markRead({ userId: owner.id, room, messageId: read.lastReadMessageId });
  const notRewound = await chat.getUnread({ userId: owner.id, room });
  assert.equal(notRewound.unread, 1, 'an older marker must not clear a newer message');
});

test('chat read marker is per account and the REST endpoints agree', async () => {
  const res = await request(app)
    .get('/api/private-media/chat/unread')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(res.status, 200);
  assert.ok(res.body.unread >= 0);

  const history = await request(app)
    .get('/api/private-media/chat?limit=5')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(history.status, 200);
  assert.ok(Array.isArray(history.body.messages));
  assert.ok('lastReadMessageId' in history.body);

  const mark = await request(app)
    .post('/api/private-media/chat/read')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`)
    .send({});
  assert.equal(mark.status, 200);
  assert.equal(mark.body.unread, 0);
});

// ── 4. Playlists: persistence + shuffle correctness ────────────────────────

test('saving a video to a playlist persists across sessions and refresh', async () => {
  const created = await playlists.createPlaylist({ userId: owner.id, title: 'V3 list', visibility: 'private' });
  const saved = await playlists.addItems({
    userId: owner.id,
    playlistId: created.id,
    items: [{ videoId: 'ddddddddddd', title: 'D', durationSeconds: 120 }],
  });
  assert.equal(saved.added, 1);

  // "Refresh" = a brand-new read of the same playlist.
  const reread = await playlists.getPlaylist({ userId: owner.id, playlistId: created.id });
  assert.deepEqual(reread.items.map((item) => item.videoId), ['ddddddddddd']);
  assert.equal(reread.itemCount, 1);

  // Another entitled account cannot see a private playlist.
  await assert.rejects(
    playlists.getPlaylist({ userId: delegate.id, playlistId: created.id }),
    { status: 404 },
  );
});

test('shuffle plays every item once before repeating, and never repeats back-to-back', async () => {
  const items = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc', 'ddddddddddd', 'eeeeeeeeeee']
    .map((videoId, index) => ({ videoId, title: `T${index}`, position: index }));
  const cycle = service.buildCycle(items, 'shuffle', 'eeeeeeeeeee');
  assert.equal(cycle.length, items.length);
  assert.equal(new Set(cycle.map((entry) => entry.videoId)).size, items.length, 'no repeat inside one bag');
  assert.notEqual(cycle[0].videoId, 'eeeeeeeeeee', 'never the track that just ended first');
});

test('a playlist cycle advances sequentially and honours repeat=all', async () => {
  await cmd('QUEUE_CLEAR', {}, owner, 'private');
  const created = await playlists.createPlaylist({ userId: owner.id, title: 'V3 cycle' });
  await playlists.addItems({
    userId: owner.id,
    playlistId: created.id,
    items: [
      { videoId: 'aaaaaaaaaaa', title: 'A' },
      { videoId: 'bbbbbbbbbbb', title: 'B' },
    ],
  });
  const started = await cmd('PLAYLIST_PLAY', { playlistId: created.id, mode: 'sequential', repeat: 'all' }, owner, 'private');
  assert.equal(started.state.video.videoId, 'aaaaaaaaaaa');
  assert.equal(started.state.playlist.mode, 'sequential');

  await setElapsed(started.state.sessionId, 199);
  const second = await service.autoAdvance({ userId: owner.id, room: 'private', currentQueueItemId: started.state.currentQueueItemId });
  assert.equal(second.state.video.videoId, 'bbbbbbbbbbb');

  await setElapsed(second.state.sessionId, 199);
  const third = await service.autoAdvance({ userId: owner.id, room: 'private', currentQueueItemId: second.state.currentQueueItemId });
  assert.ok(third.state.video, 'repeat=all must start a new cycle');
  assert.equal(third.state.playlist.played, 1);
});

// ── 5. Authorization ──────────────────────────────────────────────────────

test('an admin without a grant gets 404 on chat, queue and playback', async () => {
  const authed = (method, url) => request(app)[method](url).set('X-PM-Room', 'shared').set('Authorization', `Bearer ${token(admin)}`);
  assert.equal((await authed('get', '/api/private-media/chat')).status, 404);
  assert.equal((await authed('get', '/api/private-media/chat/unread')).status, 404);
  assert.equal((await authed('post', '/api/private-media/chat/read')).status, 404);
  assert.equal((await authed('get', '/api/private-media/session')).status, 404);
  await assert.rejects(connect(admin), /Unauthorized/);
});

test('revoking a grant removes chat and playback access immediately', async () => {
  const before = await request(app)
    .get('/api/private-media/chat')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(before.status, 200);

  await access.revokeAccess({ actorUserId: owner.id, targetUserId: delegate.id, reason: 'v3-test' });

  const after = await request(app)
    .get('/api/private-media/chat')
    .set('X-PM-Room', 'shared')
    .set('Authorization', `Bearer ${token(delegate)}`);
  assert.equal(after.status, 404);
  assert.equal(outsider.email, 'v3-c@test.local');
  assert.ok(sequelize);
});
