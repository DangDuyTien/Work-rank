'use strict';
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
const { User, PrivateMediaSession: Session, PrivateMediaCommand: Command } = require('../src/models');
const service = require('../src/services/privateMedia/session.service');
const access = require('../src/services/privateMedia/access.service');
const realtime = require('../src/services/privateMedia/realtime.service');
const telegram = require('../src/services/privateMedia/telegram.service');
let owner, delegate, viewer, admin, server, socketServer, base;
const sockets = [];
const token = (u) => jwt.sign({ sub: u.id, tokenVersion: u.tokenVersion || 0 }, env.jwtSecret);
const song = (name) => ({ videoId: name.repeat(11), title: name.toUpperCase(), durationSeconds: 200 });
const cmd = (action, payload = {}, user = owner, commandId = crypto.randomUUID()) => service.issueCommand({ commandId, action, payload, actorUserId: user.id, room: 'shared' });
async function end(state, errorCode) {
  if (!errorCode) await Session.update({ currentTime: 200, referenceTime: new Date() }, { where: { id: state.sessionId } });
  return service.autoAdvance({ userId: owner.id, room: 'shared', currentQueueItemId: state.currentQueueItemId, errorCode });
}
const connect = (u) => new Promise((resolve, reject) => {
  const s = io(`${base}/private-media`, { auth: { token: token(u), room: 'shared' }, transports: ['websocket'], reconnection: false });
  sockets.push(s); s.once('connect', () => resolve(s)); s.once('connect_error', reject);
});
const hello = (s) => new Promise((resolve) => s.emit('private-media:player-hello', {}, resolve));
before(async () => {
  owner = await User.create({ name: 'Owner', email: 'tienddph50842@gmail.com', passwordHash: 'x', role: 'user' });
  delegate = await User.create({ name: 'Contributor', email: 'shared-b@test.local', passwordHash: 'x', role: 'user' });
  viewer = await User.create({ name: 'Listener', email: 'shared-c@test.local', passwordHash: 'x', role: 'user' });
  admin = await User.create({ name: 'Admin', email: 'shared-admin@test.local', passwordHash: 'x', role: 'admin' });
  await access.resolveOwnerUserId({ force: true });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: delegate.id, permissions: { view: true, queue: true, telegram: true } });
  await access.grantAccess({ actorUserId: owner.id, targetUserId: viewer.id, permissions: { view: true } });
  server = http.createServer(app); socketServer = new Server(server);
  require('../src/sockets/privateMedia').registerPrivateMediaNamespace(socketServer);
  await new Promise((r) => server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => { sockets.forEach((s) => s.disconnect()); await new Promise((r) => socketServer.close(r)); });

test('FIFO, join mid-track, authoritative pause/resume and automatic A → B → C → IDLE', async () => {
  await cmd('QUEUE_CLEAR');
  const a = await cmd('LOAD_VIDEO', song('a'));
  await cmd('QUEUE_ADD', song('b'), delegate);
  const added = await cmd('QUEUE_ADD', song('c'));
  assert.equal(added.state.currentQueueItemId, a.state.currentQueueItemId);
  assert.equal(added.state.video.title, 'A');
  assert.deepEqual(added.state.queue.map((q) => q.title), ['B', 'C']);
  await cmd('SEEK', { position: 90 });
  const joined = await service.getSessionState(viewer.id, 'shared');
  assert.ok(Math.abs(joined.currentTime - 90) < 1); assert.equal(joined.status, 'PLAYING');
  const pause = await cmd('PAUSE');
  const stale = await service.syncPlayerProgress({ status: 'PLAYING', currentTime: 1, volume: 100 }, viewer.id, 'shared');
  assert.equal(stale.status, 'PAUSED'); assert.equal(stale.currentTime, pause.state.currentTime); assert.ok(!('volume' in stale));
  await cmd('PLAY');
  const b = await end(await service.getSessionState(owner.id, 'shared'));
  assert.equal(b.state.video.title, 'B'); assert.deepEqual(b.state.queue.map((q) => q.title), ['C']);
  const c = await end(b.state); assert.equal(c.state.video.title, 'C');
  const idle = await end(c.state); assert.equal(idle.state.status, 'IDLE'); assert.equal(idle.state.video, null);
});

test('five simultaneous ENDED reports advance once, including same-video repeats', async () => {
  await cmd('LOAD_VIDEO', song('a')); await cmd('QUEUE_ADD', song('a')); await cmd('QUEUE_ADD', song('c'));
  const state = await service.getSessionState(owner.id, 'shared');
  await Session.update({ currentTime: 200 }, { where: { id: state.sessionId } });
  const results = await Promise.all(Array.from({ length: 5 }, () => service.autoAdvance({ userId: owner.id, room: 'shared', currentQueueItemId: state.currentQueueItemId })));
  assert.equal(results.filter((r) => r.advanced).length, 1);
  const now = await service.getSessionState(owner.id, 'shared');
  assert.notEqual(now.currentQueueItemId, state.currentQueueItemId); assert.equal(now.video.title, 'A');
  assert.deepEqual(now.queue.map((q) => q.title), ['C']);
});

test('concurrent adds lose no songs; retries are scoped and do not duplicate', async () => {
  await cmd('QUEUE_CLEAR');
  const ids = Array.from({ length: 6 }, () => crypto.randomUUID());
  await Promise.all(ids.map((id, i) => cmd('QUEUE_ADD', song(String.fromCharCode(100 + i)), i % 2 ? delegate : owner, id)));
  const first = await service.getSessionState(owner.id, 'shared');
  assert.equal(first.queue.length, 6); assert.equal(new Set(first.queue.map((q) => q.id)).size, 6);
  const committed = await Command.findAll({ where: { commandId: ids }, order: [['id', 'ASC']] });
  assert.deepEqual(first.queue.map((q) => q.title), committed.map((c) => c.payload.title), 'FIFO follows server commit order');
  await Promise.all(Array.from({ length: 5 }, () => cmd('QUEUE_ADD', song('d'), owner, ids[0])));
  const last = await service.getSessionState(owner.id, 'shared');
  assert.deepEqual(last.queue, first.queue); assert.equal(last.sessionRevision, first.sessionRevision);
  await assert.rejects(cmd('QUEUE_ADD', song('d'), delegate, ids[0]), { code: 'COMMAND_ID_CONFLICT' });
});

test('queue permissions, reorder/remove, unavailable skip; volume cannot enter snapshots or journal', async () => {
  await assert.rejects(cmd('PAUSE', {}, delegate), { status: 404 });
  await assert.rejects(cmd('QUEUE_ADD', song('a'), viewer), { status: 404 });
  await assert.rejects(cmd('SET_VOLUME', { volume: 40 }), { code: 'UNKNOWN_ACTION' });
  const before = await service.getSessionState(owner.id, 'shared'); const ids = before.queue.map((q) => q.id).reverse();
  await cmd('QUEUE_REORDER', { itemIds: ids }); await cmd('QUEUE_REMOVE', { itemId: ids[0] });
  const after = await service.getSessionState(owner.id, 'shared'); assert.deepEqual(after.queue.map((q) => q.id), ids.slice(1));
  const fail = await end(after, 100); assert.equal(fail.state.video.title, after.queue[0].title); assert.equal(fail.state.lastFailure.itemId, after.currentQueueItemId);
  const staleError = await end(after, 100); assert.equal(staleError.stale, true);
  const entry = await cmd('QUEUE_ADD', { ...song('z'), volume: 99, muted: true });
  const row = await Command.findOne({ where: { commandId: entry.command.commandId } });
  assert.ok(!JSON.stringify(row.payload).includes('volume')); assert.ok(!JSON.stringify(entry).includes('volume'));
});

test('WebSocket denies admin, renders for ACCESS-only users, evicts revoked listeners immediately', async () => {
  await assert.rejects(connect(admin), /Unauthorized/);
  const a = await connect(owner), b = await connect(delegate), c = await connect(viewer);
  assert.equal((await hello(a)).ok, true); assert.equal((await hello(b)).ok, true); assert.equal((await hello(c)).ok, true);
  const state = await service.getSessionState(owner.id, 'shared'); assert.equal(state.participantCount, 3);
  const denied = await new Promise((r) => b.emit('private-media:command', { commandId: crypto.randomUUID(), action: 'PAUSE' }, r)); assert.equal(denied.ok, false);
  const received = new Promise((r) => c.once('private-media:state', r));
  const pause = await cmd('PAUSE'); realtime.broadcastState(pause.state); assert.equal((await received).status, 'PAUSED');
  const disconnected = new Promise((r) => c.once('disconnect', r));
  const res = await request(app).delete(`/api/private-media/grants/${viewer.id}`).set('Authorization', `Bearer ${token(owner)}`);
  assert.equal(res.status, 200); await disconnected; assert.equal(c.connected, false);
  const forbidden = await request(app).get('/api/private-media/session').set('X-PM-Room', 'shared').set('Authorization', `Bearer ${token(viewer)}`); assert.equal(forbidden.status, 404);
});

test('Telegram QUEUE_ADD uses the shared queue, dedupes callback and respects queue-only grant', async () => {
  const state = await service.getSessionState(owner.id, 'shared');
  assert.ok(telegram.describeQueue(state).includes('Đang chờ:')); assert.ok(!telegram.describeState(state).includes('Âm lượng'));
  const { PrivateMediaTelegramBinding } = require('../src/models');
  await PrivateMediaTelegramBinding.create({ userId: delegate.id, telegramUserId: '123456', telegramChatId: '123456' });
  assert.equal((await telegram.resolveActor('123456')).ok, true);
  const youtube = require('../src/services/privateMedia/youtube.service');
  const original = youtube.resolveVideo; youtube.resolveVideo = async () => song('t');
  try {
    const query = { id: 'shared-test-callback', data: 'pm:add:ttttttttttt', from: { id: '123456' }, message: { chat: { id: '123456' } } };
    await telegram.handleCallbackQuery(query); await telegram.handleCallbackQuery(query);
    const after = await service.getSessionState(owner.id, 'shared'); assert.equal(after.queue.filter((q) => q.title === 'T').length, 1);
    await assert.rejects(service.issueCommand({ commandId: crypto.randomUUID(), action: 'PAUSE', source: 'TELEGRAM', actorUserId: delegate.id, room: 'shared' }), { status: 404 });
  } finally { youtube.resolveVideo = original; }
});

test('hotkey device shares the listening session and still requires CONTROL', async () => {
  const devices = require('../src/services/privateMedia/device.service');
  const minted = await devices.createPairingCode({ userId: owner.id, label: 'QA' });
  const pair = await devices.pairDevice({ code: minted.code, name: 'QA', platform: 'test' });
  const before = await service.getSessionState(owner.id, 'shared');
  const res = await request(app).post('/api/private-media/device/commands').set('X-Device-Token', pair.token).send({ commandId: crypto.randomUUID(), action: 'TOGGLE_PLAY_PAUSE' });
  assert.equal(res.status, 200); assert.equal(res.body.state.sessionId, before.sessionId); assert.notEqual(res.body.state.status, before.status);
});

test('migration can be applied twice and preserves existing session/queue data', async () => {
  const { Sequelize, DataTypes } = require('sequelize');
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const q = db.getQueryInterface();
  try {
    await q.createTable('users', { id: { type: DataTypes.BIGINT, primaryKey: true } });
    await require('../src/migrations/20261027190000-create-private-media').up(q, DataTypes);
    await q.bulkInsert('private_media_sessions', [{ session_key: 'room:shared', status: 'PAUSED', title: 'Legacy', current_time: 42, queue: JSON.stringify([{ videoId: 'aaaaaaaaaaa' }]), queue_index: -1, created_at: new Date(), updated_at: new Date() }]);
    const migration = require('../src/migrations/20261030100000-private-media-shared-listening');
    await migration.up(q, DataTypes); await migration.up(q, DataTypes);
    const [rows] = await db.query('SELECT title, "current_time" AS position, queue FROM private_media_sessions');
    assert.equal(rows[0].title, 'Legacy'); assert.equal(rows[0].position, 42); assert.equal(JSON.parse(rows[0].queue)[0].videoId, 'aaaaaaaaaaa');
    const fields = await q.describeTable('private_media_sessions');
    for (const field of ['reference_time', 'revision', 'current_queue_item_id', 'last_failure']) assert.ok(fields[field]);
    assert.ok((await q.describeTable('private_media_grants')).can_queue);
  } finally { await db.close(); }
});
