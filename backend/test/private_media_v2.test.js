'use strict';

/**
 * PRIVATE MEDIA V2 — playlists, shuffle, queue precedence and chat.
 *
 * These tests exercise the real service layer and the real HTTP routes. They do
 * not mock the database: the engine's guarantees (one advance per ENDED, a
 * shuffle bag that never repeats early, chat dedupe) only mean something when
 * the storage is real.
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
  User,
  PrivateMediaSession: Session,
  PrivateMediaPlaylist: Playlist,
  PrivateMediaPlaylistItem: PlaylistItem,
  PrivateMediaChatMessage: ChatMessage,
} = require('../src/models');
const service = require('../src/services/privateMedia/session.service');
const playlists = require('../src/services/privateMedia/playlist.service');
const chats = require('../src/services/privateMedia/chat.service');
const access = require('../src/services/privateMedia/access.service');

let owner;
let member;
let outsider;
let admin;
let server;
let socketServer;
let base;
const sockets = [];
const token = (user) => jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion || 0 }, env.jwtSecret);
const cmd = (action, payload = {}, user = owner, room = 'shared') => service.issueCommand({
  commandId: crypto.randomUUID(), action, payload, actorUserId: user.id, room,
});

async function finishTrack(state, user = owner) {
  await Session.update(
    { currentTime: Number(state.video?.durationSeconds) || 200, referenceTime: new Date() },
    { where: { id: state.sessionId } },
  );
  return service.autoAdvance({ userId: user.id, room: 'shared', currentQueueItemId: state.currentQueueItemId });
}

function connect(user) {
  return new Promise((resolve, reject) => {
    const socket = io(`${base}/private-media`, { auth: { token: token(user), room: 'shared' }, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

before(async () => {
  owner = await User.create({ name: 'Owner', email: 'tienddph50842@gmail.com', passwordHash: 'x', role: 'user' });
  member = await User.create({ name: 'Member', email: 'v2-member@test.local', passwordHash: 'x', role: 'user' });
  outsider = await User.create({ name: 'Outsider', email: 'v2-outsider@test.local', passwordHash: 'x', role: 'user' });
  admin = await User.create({ name: 'Admin', email: 'v2-admin@test.local', passwordHash: 'x', role: 'admin' });
  await access.resolveOwnerUserId({ force: true });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: member.id, permissions: { view: true, queue: true, control: true } });

  server = http.createServer(app);
  socketServer = new Server(server);
  require('../src/sockets/privateMedia').registerPrivateMediaNamespace(socketServer);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  sockets.forEach((socket) => socket.disconnect());
  await new Promise((resolve) => socketServer.close(resolve));
});

// ── Curated catalog ─────────────────────────────────────────────────────────

test('curated catalog seeds both playlists with real, playable episodes', async () => {
  const applied = await playlists.seedCuratedCatalog({ force: true });
  assert.equal(applied.length, 2);

  const conan = await Playlist.findOne({ where: { slug: 'conan-1-200' } });
  assert.ok(conan, 'conan playlist exists');
  const conanItems = await PlaylistItem.findAll({ where: { playlistId: conan.id }, order: [['position', 'ASC']] });
  assert.equal(conanItems.length, 200);
  assert.equal(Number(conan.expectedCount), 200);
  assert.equal(conanItems.every((item) => item.available), true);
  assert.deepEqual(conanItems.map((item) => item.episodeNumber), Array.from({ length: 200 }, (_, i) => i + 1));
  assert.equal(new Set(conanItems.map((item) => item.videoId)).size, 200, 'no duplicate episodes');
  assert.equal(conanItems.every((item) => /^[A-Za-z0-9_-]{11}$/.test(item.videoId)), true);

  const duck = await Playlist.findOne({ where: { slug: 'vit-do-mixi' } });
  const duckItems = await PlaylistItem.findAll({ where: { playlistId: duck.id } });
  assert.equal(duckItems.length, 85);
  assert.equal(duckItems.every((item) => item.available), true);

  // Re-seeding must not duplicate anything.
  await playlists.seedCuratedCatalog({ force: true });
  assert.equal(await PlaylistItem.count({ where: { playlistId: conan.id } }), 200);
});

// ── Sequential playback ─────────────────────────────────────────────────────

test('Conan plays sequentially from the chosen episode and never shuffles by default', async () => {
  await cmd('QUEUE_CLEAR');
  await cmd('PLAYLIST_STOP');
  const conan = await Playlist.findOne({ where: { slug: 'conan-1-200' } });
  const items = await PlaylistItem.findAll({ where: { playlistId: conan.id }, order: [['position', 'ASC']], limit: 4 });

  const started = await cmd('PLAYLIST_PLAY', { playlistId: conan.id });
  assert.equal(started.state.video.videoId, items[0].videoId);
  assert.equal(started.state.playlist.mode, 'sequential');
  assert.equal(started.state.playlist.total, 200);

  const second = await finishTrack(started.state);
  assert.equal(second.state.video.videoId, items[1].videoId);
  assert.equal(second.state.playlist.played, 2);
  const third = await finishTrack(second.state);
  assert.equal(third.state.video.videoId, items[2].videoId);

  // Explicit "start at episode N" is honoured.
  const fromThird = await cmd('PLAYLIST_PLAY', { playlistId: conan.id, startItemId: items[2].id });
  assert.equal(fromThird.state.video.videoId, items[2].videoId);
  const next = await finishTrack(fromThird.state);
  assert.equal(next.state.video.videoId, items[3].videoId);
});

// ── Shuffle ─────────────────────────────────────────────────────────────────

test('shuffle is a bag: every video once per cycle, no immediate repeat, stable across reconnects', async () => {
  const playlist = await playlists.createPlaylist({ userId: owner.id, title: 'Shuffle 12' });
  const ids = Array.from({ length: 12 }, (_, i) => `shuf${String(i).padStart(7, '0')}`);
  await playlists.addItems({
    userId: owner.id,
    playlistId: playlist.id,
    items: ids.map((videoId, i) => ({ videoId, title: `Track ${i}`, durationSeconds: 60 })),
  });

  await cmd('QUEUE_CLEAR');
  const started = await cmd('PLAYLIST_SHUFFLE', { playlistId: playlist.id });
  const seen = [started.state.video.videoId];
  let state = started.state;

  for (let i = 0; i < 11; i += 1) {
    const advanced = await finishTrack(state);
    seen.push(advanced.state.video.videoId);
    state = advanced.state;
    // Re-reading the session (what a reconnect does) must not reshuffle.
    const snapshot = await service.getSessionState(owner.id, 'shared');
    assert.equal(snapshot.currentQueueItemId, state.currentQueueItemId);
    assert.equal(snapshot.playlist.next?.videoId || null, state.playlist.next?.videoId || null);
  }

  assert.equal(seen.length, 12);
  assert.equal(new Set(seen).size, 12, 'every track played exactly once in the cycle');
  for (let i = 1; i < seen.length; i += 1) assert.notEqual(seen[i], seen[i - 1], 'no immediate repeat');

  // End of cycle without repeat → idle, not a silent loop.
  const ended = await finishTrack(state);
  assert.equal(ended.state.video, null);
  assert.equal(ended.state.playlist, null);
});

test('repeat=all rebuilds the bag without replaying the same track first', async () => {
  const playlist = await playlists.createPlaylist({ userId: owner.id, title: 'Loop 3' });
  const ids = ['loopAAAAAAA', 'loopBBBBBBB', 'loopCCCCCCC'];
  await playlists.addItems({ userId: owner.id, playlistId: playlist.id, items: ids.map((videoId, i) => ({ videoId, title: `Loop ${i}`, durationSeconds: 60 })) });

  await cmd('QUEUE_CLEAR');
  const started = await cmd('PLAYLIST_SHUFFLE', { playlistId: playlist.id, repeat: 'all' });
  let state = started.state;
  const firstCycle = [state.video.videoId];
  for (let i = 0; i < 2; i += 1) {
    state = (await finishTrack(state)).state;
    firstCycle.push(state.video.videoId);
  }
  assert.equal(new Set(firstCycle).size, 3);

  const wrapped = await finishTrack(state);
  assert.ok(wrapped.state.video, 'cycle restarted');
  assert.notEqual(wrapped.state.video.videoId, firstCycle[2], 'new cycle does not repeat the last track first');
  assert.equal(wrapped.state.playlist.repeat, 'all');
});

// ── Queue precedence ────────────────────────────────────────────────────────

test('manual queue jumps ahead of the playlist and the shuffle position is preserved', async () => {
  const playlist = await playlists.createPlaylist({ userId: owner.id, title: 'Priority' });
  const ids = ['prioAAAAAAA', 'prioBBBBBBB', 'prioCCCCCCC', 'prioDDDDDDD'];
  await playlists.addItems({ userId: owner.id, playlistId: playlist.id, items: ids.map((videoId, i) => ({ videoId, title: `P${i}`, durationSeconds: 60 })) });

  await cmd('QUEUE_CLEAR');
  const started = await cmd('PLAYLIST_PLAY', { playlistId: playlist.id });
  const first = started.state.video.videoId;
  const plannedNext = started.state.playlist.next.videoId;

  const added = await cmd('QUEUE_ADD', { videoId: 'manualXXXXX', title: 'Manual X', durationSeconds: 60 }, member);
  assert.equal(added.state.video.videoId, first, 'current track is not interrupted');

  const afterManual = await finishTrack(started.state);
  assert.equal(afterManual.state.video.videoId, 'manualXXXXX', 'manual queue plays first');
  assert.equal(afterManual.state.queue.length, 0);

  const backToPlaylist = await finishTrack(afterManual.state);
  assert.equal(backToPlaylist.state.video.videoId, plannedNext, 'playlist resumes at the planned position');
});

test('two simultaneous ENDED reports advance the playlist exactly once', async () => {
  const playlist = await playlists.createPlaylist({ userId: owner.id, title: 'Race' });
  const ids = ['raceAAAAAAA', 'raceBBBBBBB', 'raceCCCCCCC'];
  await playlists.addItems({ userId: owner.id, playlistId: playlist.id, items: ids.map((videoId, i) => ({ videoId, title: `R${i}`, durationSeconds: 60 })) });

  await cmd('QUEUE_CLEAR');
  const started = await cmd('PLAYLIST_PLAY', { playlistId: playlist.id });
  await Session.update({ currentTime: 60, referenceTime: new Date() }, { where: { id: started.state.sessionId } });

  const results = await Promise.all(Array.from({ length: 4 }, () => service.autoAdvance({
    userId: owner.id, room: 'shared', currentQueueItemId: started.state.currentQueueItemId,
  })));
  assert.equal(results.filter((result) => result.advanced).length, 1);
  const now = await service.getSessionState(owner.id, 'shared');
  assert.equal(now.video.videoId, ids[1], 'advanced exactly one track');
});

// ── Playlist CRUD + ownership ───────────────────────────────────────────────

test('playlist CRUD persists and is scoped to its owner', async () => {
  const created = await playlists.createPlaylist({ userId: owner.id, title: '  Nhạc của tôi  ', visibility: 'private' });
  assert.equal(created.title, 'Nhạc của tôi');

  const added = await playlists.addItems({
    userId: owner.id,
    playlistId: created.id,
    items: [
      { videoId: 'crudAAAAAAA', title: 'A' },
      { videoId: 'crudBBBBBBB', title: 'B' },
      { videoId: 'crudCCCCCCC', title: 'C' },
    ],
  });
  assert.equal(added.playlist.items.length, 3);

  // Reorder C, A, B
  const order = [added.playlist.items[2].id, added.playlist.items[0].id, added.playlist.items[1].id];
  const reordered = await playlists.reorderItems({ userId: owner.id, playlistId: created.id, itemIds: order });
  assert.deepEqual(reordered.items.map((item) => item.title), ['C', 'A', 'B']);

  const removed = await playlists.removeItem({ userId: owner.id, playlistId: created.id, itemId: order[0] });
  assert.deepEqual(removed.items.map((item) => item.title), ['A', 'B']);
  assert.deepEqual(removed.items.map((item) => item.position), [0, 1]);

  // Another entitled member cannot even see a private playlist…
  await assert.rejects(
    () => playlists.getPlaylist({ userId: member.id, playlistId: created.id }),
    (error) => error.code === 'PLAYLIST_NOT_FOUND' && error.status === 404,
  );
  // …and cannot edit or delete it.
  await assert.rejects(() => playlists.updatePlaylist({ userId: member.id, playlistId: created.id, patch: { title: 'hijack' } }), (error) => error.status === 404);
  await assert.rejects(() => playlists.deletePlaylist({ userId: member.id, playlistId: created.id }), (error) => error.status === 404);

  // Shared visibility: readable, still not editable.
  await playlists.updatePlaylist({ userId: owner.id, playlistId: created.id, patch: { visibility: 'shared' } });
  const visible = await playlists.getPlaylist({ userId: member.id, playlistId: created.id });
  assert.equal(visible.title, 'Nhạc của tôi');
  assert.equal(visible.editable, false);
  await assert.rejects(() => playlists.deletePlaylist({ userId: member.id, playlistId: created.id }), (error) => error.status === 404);

  const deleted = await playlists.deletePlaylist({ userId: owner.id, playlistId: created.id });
  assert.equal(deleted.deleted, true);
  assert.equal(await PlaylistItem.count({ where: { playlistId: created.id } }), 0);
});

test('a curated playlist can never be edited through the service', async () => {
  const conan = await Playlist.findOne({ where: { slug: 'conan-1-200' } });
  await assert.rejects(() => playlists.updatePlaylist({ userId: owner.id, playlistId: conan.id, patch: { title: 'x' } }), (error) => error.status === 404);
  await assert.rejects(() => playlists.deletePlaylist({ userId: owner.id, playlistId: conan.id }), (error) => error.status === 404);
});

// ── Chat ────────────────────────────────────────────────────────────────────

test('chat persists, paginates, dedupes retries and keeps the sender identity server-side', async () => {
  chats.resetRateLimit(owner.id);
  await cmd('QUEUE_CLEAR');
  const sent = [];
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await chats.createMessage({ userId: owner.id, room: 'shared', content: `tin ${i}` });
    sent.push(result.message);
  }
  assert.equal(new Set(sent.map((message) => message.id)).size, 12);

  const page = await chats.listMessages({ userId: owner.id, room: 'shared', limit: 5 });
  assert.equal(page.messages.length, 5);
  assert.equal(page.hasMore, true);
  assert.deepEqual(page.messages.map((message) => message.content), ['tin 7', 'tin 8', 'tin 9', 'tin 10', 'tin 11']);

  const older = await chats.listMessages({ userId: owner.id, room: 'shared', limit: 5, beforeId: page.messages[0].id });
  assert.deepEqual(older.messages.map((message) => message.content), ['tin 2', 'tin 3', 'tin 4', 'tin 5', 'tin 6']);

  // A retry with the same client id returns the original row.
  const first = await chats.createMessage({ userId: member.id, room: 'shared', content: 'một lần', clientMessageId: 'client-1' });
  const retry = await chats.createMessage({ userId: member.id, room: 'shared', content: 'một lần', clientMessageId: 'client-1' });
  assert.equal(retry.duplicate, true);
  assert.equal(retry.message.id, first.message.id);
  assert.equal(await ChatMessage.count({ where: { clientMessageId: 'client-1' } }), 1);

  // The sender is always the authenticated id, never a body field.
  const spoof = await chats.createMessage({ userId: member.id, room: 'shared', content: 'ai gửi?', authorId: owner.id, senderId: owner.id });
  assert.equal(spoof.message.user.id, member.id, 'client-supplied author fields are ignored');
});

test('chat rejects empty/oversized content, strips control characters and rate-limits', async () => {
  assert.throws(() => chats.cleanContent('   \n  '), (error) => error.code === 'CHAT_EMPTY');
  assert.throws(() => chats.cleanContent('a'.repeat(1001)), (error) => error.code === 'CHAT_TOO_LONG');
  assert.equal(chats.cleanContent('  <script>alert(1)</script>  '), '<script>alert(1)</script>', 'stored as text, escaped at render');
  assert.equal(chats.cleanContent('a\u0000b\u200Bc'), 'abc');

  const throttled = await User.create({ name: 'Spam', email: 'v2-spam@test.local', passwordHash: 'x', role: 'user' });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: throttled.id, permissions: { view: true } });
  chats.resetRateLimit(throttled.id);
  let limited = false;
  for (let i = 0; i < 24; i += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await chats.createMessage({ userId: throttled.id, room: 'shared', content: `spam ${i}` });
    } catch (error) {
      if (error.code === 'CHAT_RATE_LIMITED') { limited = true; break; }
      throw error;
    }
  }
  assert.equal(limited, true, 'rate limit fires before 24 messages in 15s');
});

test('chat is invisible to accounts without a grant and to admins without one', async () => {
  await assert.rejects(() => chats.listMessages({ userId: outsider.id, room: 'shared' }), (error) => error.status === 404);
  await assert.rejects(() => chats.listMessages({ userId: admin.id, room: 'shared' }), (error) => error.status === 404);
  await assert.rejects(() => chats.createMessage({ userId: admin.id, room: 'shared', content: 'hello' }), (error) => error.status === 404);
});

test('chat over HTTP is authorized per request and returns 404 when revoked', async () => {
  const auth = { Authorization: `Bearer ${token(member)}` };
  const post = await request(app).post('/api/private-media/chat').set(auth).set('X-PM-Room', 'shared').send({ content: 'qua HTTP' });
  assert.equal(post.status, 201);
  assert.equal(post.body.message.user.id, member.id);

  const list = await request(app).get('/api/private-media/chat').set(auth).set('X-PM-Room', 'shared');
  assert.equal(list.status, 200);
  assert.ok(list.body.messages.some((message) => message.content === 'qua HTTP'));

  const denied = await request(app).get('/api/private-media/chat').set('Authorization', `Bearer ${token(admin)}`).set('X-PM-Room', 'shared');
  assert.equal(denied.status, 404);
  assert.equal(denied.body.code, 'NOT_FOUND');

  await access.revokeAccess({ actorUserId: owner.id, targetUserId: member.id });
  const revoked = await request(app).get('/api/private-media/chat').set(auth).set('X-PM-Room', 'shared');
  assert.equal(revoked.status, 404);
});

test('chat is delivered over the authenticated socket, never to an unentitled socket', async () => {
  await access.grantAccess({ actorUserId: owner.id, targetUserId: member.id, permissions: { view: true, queue: true, control: true } });
  const ownerSocket = await connect(owner);
  const memberSocket = await connect(member);
  await new Promise((resolve) => ownerSocket.emit('private-media:player-hello', {}, resolve));
  await new Promise((resolve) => memberSocket.emit('private-media:player-hello', {}, resolve));

  const received = new Promise((resolve) => ownerSocket.once('private-media:chat-message', resolve));
  const ack = await new Promise((resolve) => memberSocket.emit('private-media:chat-send', { content: 'socket chat' }, resolve));
  assert.equal(ack.ok, true);
  const message = await received;
  assert.equal(message.content, 'socket chat');
  assert.equal(message.user.id, member.id);

  // A second send with the same client id is a duplicate and is not re-broadcast.
  let broadcasts = 0;
  ownerSocket.on('private-media:chat-message', () => { broadcasts += 1; });
  const duplicate = await new Promise((resolve) => memberSocket.emit('private-media:chat-send', { content: 'socket chat', clientMessageId: ack.message.id ? `dup-${ack.message.id}` : 'dup' }, resolve));
  await new Promise((resolve) => memberSocket.emit('private-media:chat-send', { content: 'socket chat', clientMessageId: `dup-${ack.message.id}` }, resolve));
  assert.equal(duplicate.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 150));
  assert.equal(broadcasts, 1, 'duplicate client id is not broadcast twice');

  ownerSocket.disconnect();
  memberSocket.disconnect();
});

// ── Playlist HTTP surface ───────────────────────────────────────────────────

test('playlist HTTP routes require entitlement and honour ownership', async () => {
  const ownerAuth = { Authorization: `Bearer ${token(owner)}` };
  const created = await request(app).post('/api/private-media/playlists').set(ownerAuth).send({ title: 'HTTP list' });
  assert.equal(created.status, 201);
  const id = created.body.playlist.id;

  const added = await request(app).post(`/api/private-media/playlists/${id}/items`).set(ownerAuth).send({ items: [{ videoId: 'httpAAAAAAA', title: 'H1' }] });
  assert.equal(added.status, 200);
  assert.equal(added.body.playlist.items.length, 1);

  const list = await request(app).get('/api/private-media/playlists').set(ownerAuth);
  assert.equal(list.status, 200);
  assert.ok(list.body.playlists.some((playlist) => playlist.id === id));
  assert.ok(list.body.playlists.some((playlist) => playlist.slug === 'conan-1-200'));

  const adminList = await request(app).get('/api/private-media/playlists').set('Authorization', `Bearer ${token(admin)}`);
  assert.equal(adminList.status, 404);

  const memberDelete = await request(app).delete(`/api/private-media/playlists/${id}`).set('Authorization', `Bearer ${token(member)}`);
  assert.equal(memberDelete.status, 404);

  const removed = await request(app).delete(`/api/private-media/playlists/${id}`).set(ownerAuth);
  assert.equal(removed.status, 200);
});

test('playlist playback requires CONTROL, queueing a playlist only requires QUEUE', async () => {
  const queueOnly = await User.create({ name: 'QueueOnly', email: 'v2-queue@test.local', passwordHash: 'x', role: 'user' });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: queueOnly.id, permissions: { view: true, queue: true } });
  const conan = await Playlist.findOne({ where: { slug: 'conan-1-200' } });

  await assert.rejects(
    () => cmd('PLAYLIST_PLAY', { playlistId: conan.id }, queueOnly),
    (error) => error.code === 'NOT_FOUND' && error.status === 404,
  );
  const queued = await cmd('PLAYLIST_QUEUE', { playlistId: conan.id }, queueOnly);
  assert.ok(queued.state.queue.length > 0);
  await cmd('QUEUE_CLEAR');
});

// ── Telegram ────────────────────────────────────────────────────────────────

test('Telegram /playlist and /shuffle use the same engine and require a binding', async () => {
  const telegram = require('../src/services/privateMedia/telegram.service');
  const { PrivateMediaTelegramBinding } = require('../src/models');
  const env = require('../src/config/env');

  const sent = [];
  const originalFetch = global.fetch;
  const originalToken = env.privateMedia.telegramBotToken;
  env.privateMedia.telegramBotToken = 'test-token';
  global.fetch = async (url, options) => {
    const body = JSON.parse(options?.body || '{}');
    sent.push({ url: String(url), body });
    return { ok: true, json: async () => ({ ok: true, result: { message_id: sent.length } }) };
  };

  try {
    await PrivateMediaTelegramBinding.create({ userId: owner.id, telegramUserId: '777001', telegramChatId: '777001' });

    await telegram.handleMessage({ chat: { id: '777001' }, from: { id: '777001' }, text: '/playlist' });
    const listMessage = sent.at(-1)?.body?.text || '';
    assert.match(listMessage, /Danh sách phát/);
    assert.match(listMessage, /Conan/);

    await cmd('QUEUE_CLEAR');
    await telegram.handleMessage({ chat: { id: '777001' }, from: { id: '777001' }, text: '/shuffle 1' });
    const afterShuffle = await service.getSessionState(owner.id, 'shared');
    assert.ok(afterShuffle.video, 'shuffle started a track');
    assert.equal(afterShuffle.playlist.mode, 'shuffle');

    await telegram.handleMessage({ chat: { id: '777001' }, from: { id: '777001' }, text: '/queue' });
    assert.match(sent.at(-1)?.body?.text || '', /Danh sách phát:/);

    await telegram.handleMessage({ chat: { id: '777001' }, from: { id: '777001' }, text: '/now' });
    assert.match(sent.at(-1)?.body?.text || '', /Trạng thái:/);

    // Unbound chat: binding instructions only, no command side effects.
    const before = (await service.getSessionState(owner.id, 'shared')).sessionRevision;
    await telegram.handleMessage({ chat: { id: '999999' }, from: { id: '999999' }, text: '/shuffle' });
    assert.match(sent.at(-1)?.body?.text || '', /chưa được liên kết/i);
    assert.equal((await service.getSessionState(owner.id, 'shared')).sessionRevision, before);
  } finally {
    global.fetch = originalFetch;
    env.privateMedia.telegramBotToken = originalToken;
    await require('../src/models').PrivateMediaTelegramBinding.destroy({ where: { telegramUserId: '777001' } });
  }
});

test('playlist progress is bookmarked per account and survives a new session', async () => {
  const conan = await Playlist.findOne({ where: { slug: 'conan-1-200' } });
  const items = await PlaylistItem.findAll({ where: { playlistId: conan.id }, order: [['position', 'ASC']] });
  await cmd('QUEUE_CLEAR');
  await cmd('PLAYLIST_PLAY', { playlistId: conan.id, startItemId: items[4].id });
  // The bookmark is written after the command commits (best-effort, non-blocking).
  await new Promise((resolve) => setTimeout(resolve, 250));

  const mine = await playlists.getPlaylist({ userId: owner.id, playlistId: conan.id });
  assert.equal(mine.progress.itemId, items[4].id);
  assert.equal(mine.progress.episodeNumber, 5);

  // Another entitled account has its own bookmark, not the owner's.
  const other = await playlists.getPlaylist({ userId: member.id, playlistId: conan.id });
  assert.equal(other.progress, null);

  // Resuming uses the same engine: the bookmarked episode becomes current.
  const resumed = await cmd('PLAYLIST_PLAY', { playlistId: conan.id, startItemId: mine.progress.itemId });
  assert.equal(resumed.state.video.videoId, items[4].videoId);
  assert.equal(resumed.state.playlist.currentItemId, items[4].id);
});
