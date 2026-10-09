'use strict';

/**
 * Regression suite for the multiplayer "stuck / desynced after join" defect.
 *
 * Root cause: the client emitted `typing:joinRoom` / `sam:joinRoom` from the URL
 * before the HTTP join completed. The socket was rejected (non-player in a
 * WAITING room) and never re-subscribed, so the joiner silently missed every
 * later broadcast (ready / starting / started).
 *
 * Fix: the server now pushes an authoritative `typing:roomState` / `sam:roomState`
 * snapshot to a socket right after it joins the room channel. Combined with the
 * client only subscribing after authoritative membership is known, a late joiner
 * or a reconnecting socket always converges on the current room state.
 */

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const request = require('supertest');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const ioClient = require('../../frontend/node_modules/socket.io-client');

const app = require('../src/app');
const env = require('../src/config/env');
const registerSockets = require('../src/sockets');
const typingRealtime = require('../src/services/typingRealtime.service');
const samRealtime = require('../src/services/samRealtime.service');
const {
  sequelize,
  User,
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
  TypingRoom,
  TypingPlayer,
  TypingMatchResult,
  TypingUserStat,
} = require('../src/models');

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '1h' });
}

function waitForEvent(socket, event, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timed out waiting for socket event "${event}"`));
    }, timeoutMs);
    const handler = (payload) => {
      clearTimeout(timer);
      resolve(payload);
    };
    socket.once(event, handler);
  });
}

function emitWithAck(socket, event, payload, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ack of "${event}"`)), timeoutMs);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack);
    });
  });
}

function connectClient(url, token) {
  const socket = ioClient(url, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('socket connect timeout')), 3000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

test('Typing Battle & Sâm socket room state sync (late join / reconnect)', async (t) => {
  let hostUser;
  let joinerUser;
  let hostToken;
  let joinerToken;

  let server;
  let serverPort;
  let io;

  before(async () => {
    await SamRoom.sync();
    await SamPlayer.sync();
    await SamAction.sync();
    await SamResult.sync();
    await SamUserStat.sync();
    await TypingRoom.sync();
    await TypingPlayer.sync();
    await TypingMatchResult.sync();
    await TypingUserStat.sync();

    const stamp = Date.now();
    hostUser = await User.create({
      email: `sync_host_${stamp}@workrank.io`,
      passwordHash: 'hash',
      name: `Sync Host ${stamp}`,
      role: 'user',
      status: 'active',
    });
    joinerUser = await User.create({
      email: `sync_joiner_${stamp}@workrank.io`,
      passwordHash: 'hash',
      name: `Sync Joiner ${stamp}`,
      role: 'user',
      status: 'active',
    });
    hostToken = tokenFor(hostUser);
    joinerToken = tokenFor(joinerUser);

    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });
    registerSockets(io);
    typingRealtime.setIo(io);
    samRealtime.setIo(io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        serverPort = server.address().port;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
    const userIds = [hostUser?.id, joinerUser?.id].filter(Boolean);
    if (userIds.length) {
      await TypingPlayer.destroy({ where: { userId: userIds } }).catch(() => {});
      await SamPlayer.destroy({ where: { userId: userIds } }).catch(() => {});
      await User.destroy({ where: { id: userIds } }).catch(() => {});
    }
    await sequelize.close().catch(() => {});
  });

  await t.test('Typing: connect-before-join is rejected, then converges with authoritative state', async () => {
    const url = `http://127.0.0.1:${serverPort}`;

    // Host creates a 1v1 room through the API (source of truth = database)
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Socket Sync 1v1', mode: '1V1', durationLimitSeconds: 60 });
    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    const joinerSocket = await connectClient(url, joinerToken);

    // 1. Socket tries to subscribe BEFORE the HTTP join exists -> must be rejected.
    const earlyAck = await emitWithAck(joinerSocket, 'typing:joinRoom', { roomId });
    assert.equal(earlyAck.ok, false, 'Non-player must not be allowed into the socket room yet');

    // 2. Client performs the authoritative HTTP join.
    const joinRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .send();
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.players.length, 2);

    // 3. After membership exists, subscribing succeeds AND pushes the full state.
    const statePromise = waitForEvent(joinerSocket, 'typing:roomState');
    const lateAck = await emitWithAck(joinerSocket, 'typing:joinRoom', { roomId });
    assert.equal(lateAck.ok, true, 'Registered player must be allowed into the socket room');
    assert.equal(lateAck.isSpectator, false);

    const state = await statePromise;
    assert.ok(state?.room, 'typing:roomState must carry the room');
    assert.equal(Number(state.room.id), Number(roomId));
    assert.equal(state.room.status, 'WAITING');
    assert.ok(
      state.players.some((p) => Number(p.userId) === Number(joinerUser.id)),
      'Authoritative snapshot must include the joiner'
    );

    // 4. The subscribed socket receives later broadcasts (ready/started).
    const readyPromise = waitForEvent(joinerSocket, 'typing:playerReady');
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ isReady: true });
    const readyEvent = await readyPromise;
    assert.equal(Number(readyEvent.userId), Number(hostUser.id));

    const startedPromise = waitForEvent(joinerSocket, 'typing:started');
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send();
    const startedEvent = await startedPromise;
    assert.equal(startedEvent.room.status, 'PLAYING');

    // 5. Reconnect: a brand new socket must re-sync to the authoritative state.
    joinerSocket.disconnect();
    const reconnected = await connectClient(url, joinerToken);
    const resyncPromise = waitForEvent(reconnected, 'typing:roomState');
    const reAck = await emitWithAck(reconnected, 'typing:joinRoom', { roomId });
    assert.equal(reAck.ok, true);
    const resynced = await resyncPromise;
    assert.equal(resynced.room.status, 'PLAYING', 'Reconnect must recover current status, not stale WAITING');
    reconnected.disconnect();

    // Finalize so the server-side match deadline timer is cleared (keeps the suite fast).
    const typingGameService = require('../src/services/typingGame.service');
    await typingGameService.finalizeMatch(roomId).catch(() => {});
  });

  await t.test('Sâm: connect-before-join is rejected, then converges with authoritative state', async () => {
    const url = `http://127.0.0.1:${serverPort}`;

    const createRes = await request(app)
      .post('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Socket Sync Sam', maxPlayers: 4 });
    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    const joinerSocket = await connectClient(url, joinerToken);

    const earlyAck = await emitWithAck(joinerSocket, 'sam:joinRoom', { roomId });
    assert.equal(earlyAck.ok, false, 'Non-player must not be allowed into the Sâm socket room yet');

    const joinRes = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${joinerToken}`)
      .send();
    assert.equal(joinRes.status, 200);

    const statePromise = waitForEvent(joinerSocket, 'sam:roomState');
    const lateAck = await emitWithAck(joinerSocket, 'sam:joinRoom', { roomId });
    assert.equal(lateAck.ok, true, 'Registered player must be allowed into the Sâm socket room');

    const state = await statePromise;
    assert.ok(state?.room);
    assert.equal(Number(state.room.id), Number(roomId));
    assert.ok(
      state.players.some((p) => Number(p.userId) === Number(joinerUser.id)),
      'Sâm snapshot must include the joiner'
    );

    // Subscribed socket receives later broadcasts (ready).
    const readyPromise = waitForEvent(joinerSocket, 'sam:playerReady');
    await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ isReady: true });
    const readyEvent = await readyPromise;
    assert.equal(Number(readyEvent.userId), Number(hostUser.id));

    joinerSocket.disconnect();
  });
});
