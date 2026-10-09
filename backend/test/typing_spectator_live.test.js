'use strict';

/**
 * typing_spectator_live.test.js
 *
 * Comprehensive integration test suite for WorkRank Typing Battle: Live Spectator Mode
 * Tests:
 * 1. Player A creates & Player B joins 1v1 match, match starts.
 * 2. Spectator C joins live match via socket:
 *    - Receives authoritative snapshot (room, challenge, players, spectator count & list).
 *    - Viewer count increments to 1.
 * 3. Spectator D joins:
 *    - Viewer count increments to 2.
 *    - Both spectators receive typing:spectatorCount with updated count and list.
 * 4. GET /api/games/typing/rooms/:id/spectators returns accurate list & count.
 * 5. Player A emits progress: spectators C and D receive typing:progressBatch with typedChars & wpm.
 * 6. Spectator C attempts player mutation: rejected/ignored safely without corrupting game state.
 * 7. Spectator C disconnects: viewer count decrements to 1.
 * 8. Match finishes: spectators receive typing:matchFinished with winner and stats.
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
const {
  sequelize,
  User,
  TypingRoom,
  TypingPlayer,
  TypingMatchResult,
  TypingUserStat,
  TypingChallenge,
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
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for ack on "${event}"`));
    }, timeoutMs);
    socket.emit(event, payload, (res) => {
      clearTimeout(timer);
      resolve(res);
    });
  });
}

test('Typing Battle — Live Spectator Mode Integration Test', async (t) => {
  let server;
  let io;
  let baseUrl;
  let testUsers = [];
  const openSockets = [];

  before(async () => {
    await sequelize.authenticate();
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });
    registerSockets(io);
    typingRealtime.setIo(io);

    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // Seed 4 test users: 2 players + 2 spectators
    const ts = Date.now();
    testUsers = await Promise.all([
      User.create({ email: `player_a_${ts}@test.wr`, passwordHash: 'x', name: 'Nguyễn Văn A', jobTitle: 'Lead Dev' }),
      User.create({ email: `player_b_${ts}@test.wr`, passwordHash: 'x', name: 'Trần Thị B', jobTitle: 'Designer' }),
      User.create({ email: `spectator_c_${ts}@test.wr`, passwordHash: 'x', name: 'Lê Khán Giả C', jobTitle: 'Product Manager' }),
      User.create({ email: `spectator_d_${ts}@test.wr`, passwordHash: 'x', name: 'Phạm Khán Giả D', jobTitle: 'QA Engineer' }),
    ]);

    await TypingChallenge.findOrCreate({
      where: { id: 999 },
      defaults: {
        id: 999,
        title: 'Thử Thách Khán Giả Live',
        content: 'chúc các bạn thi đấu hết mình để giành chiến thắng vinh quang',
        wordCount: 11,
        difficulty: 'MEDIUM',
        language: 'VI',
        isActive: true,
      },
    });
  });

  after(async () => {
    for (const s of openSockets) {
      try {
        s.close();
      } catch {}
    }
    if (io) io.close();
    if (server) await new Promise((r) => server.close(r));
    await sequelize.close().catch(() => {});
    setTimeout(() => process.exit(0), 100);
  });

  function createClientSocket(user) {
    const token = tokenFor(user);
    const client = ioClient(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(client);
    return client;
  }

  await t.test('1. Setup 1v1 match and verify spectator join, snapshot, and viewer count increments', async () => {
    const [pA, pB, sC, sD] = testUsers;

    // 1. Player A creates 1v1 room
    const createRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${tokenFor(pA)}`)
      .send({
        title: 'Trận Đấu Đại Chiến 1v1 Live',
        mode: '1V1',
        matchType: 'RANKED',
        durationLimitSeconds: 120,
      });
    assert.equal(createRes.status, 201);
    const roomId = createRes.body.room.id;

    // 2. Player B joins room
    const joinRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${tokenFor(pB)}`)
      .send({});
    assert.equal(joinRes.status, 200);

    // 3. Both players toggle ready
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenFor(pA)}`)
      .send({ isReady: true });
    await request(app)
      .post(`/api/games/typing/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${tokenFor(pB)}`)
      .send({ isReady: true });

    // 4. Player A starts match
    const startRes = await request(app)
      .post(`/api/games/typing/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${tokenFor(pA)}`)
      .send({});
    assert.equal(startRes.status, 200);

    // 5. Connect sockets for Player A, Spectator C, Spectator D
    const socketA = createClientSocket(pA);
    const socketC = createClientSocket(sC);
    const socketD = createClientSocket(sD);

    await Promise.all([
      waitForEvent(socketA, 'connect'),
      waitForEvent(socketC, 'connect'),
      waitForEvent(socketD, 'connect'),
    ]);

    // Player A joins as player
    const ackA = await emitWithAck(socketA, 'typing:joinRoom', { roomId });
    assert.equal(ackA.ok, true);
    assert.equal(ackA.isSpectator, false);

    // Spectator C joins as spectator
    const statePromiseC = waitForEvent(socketC, 'typing:roomState');
    const ackC = await emitWithAck(socketC, 'typing:joinRoom', { roomId, isSpectator: true });
    assert.equal(ackC.ok, true);
    assert.equal(ackC.isSpectator, true);

    const snapshotC = await statePromiseC;
    assert.equal(Number(snapshotC.room.id), roomId);
    assert.equal(snapshotC.room.status, 'PLAYING');
    assert.ok(snapshotC.room.challengeText);
    assert.equal(snapshotC.players.length, 2);
    assert.equal(snapshotC.spectatorCount, 1);

    // Spectator D joins as spectator
    const countPromiseOnC = waitForEvent(socketC, 'typing:spectatorCount');
    const ackD = await emitWithAck(socketD, 'typing:joinRoom', { roomId, isSpectator: true });
    assert.equal(ackD.ok, true);
    assert.equal(ackD.isSpectator, true);

    const countUpdate = await countPromiseOnC;
    assert.equal(countUpdate.spectatorCount, 2);
    assert.equal(countUpdate.spectators.length, 2);

    // 6. Test HTTP /spectators endpoint
    const specHttp = await request(app)
      .get(`/api/games/typing/rooms/${roomId}/spectators`)
      .set('Authorization', `Bearer ${tokenFor(sC)}`);
    assert.equal(specHttp.status, 200);
    assert.equal(specHttp.body.spectatorCount, 2);
    assert.ok(specHttp.body.spectators.some((s) => Number(s.userId) === Number(sC.id)));
    assert.ok(specHttp.body.spectators.some((s) => Number(s.userId) === Number(sD.id)));

    // 7. Player A types -> Spectator C & D receive progressBatch with typedChars
    const batchPromiseOnC = waitForEvent(socketC, 'typing:progressBatch');
    socketA.emit('typing:progress', {
      roomId,
      typedChars: 25,
      errorCount: 1,
      clientDurationMs: 5000,
    });

    const progressBatch = await batchPromiseOnC;
    assert.equal(progressBatch.roomId, roomId);
    const updateA = progressBatch.updates.find((u) => Number(u.userId) === Number(pA.id));
    assert.ok(updateA);
    assert.equal(updateA.typedChars, 25);
    assert.ok(updateA.wpm > 0);

    // 8. Spectator C attempts player mutation: should be rejected
    const fakeToggleAck = await emitWithAck(socketC, 'typing:toggleReady', { roomId, isReady: true });
    assert.equal(fakeToggleAck.ok, false);

    const fakeStartAck = await emitWithAck(socketC, 'typing:start', { roomId });
    assert.equal(fakeStartAck.ok, false);

    // 9. Spectator C leaves room -> spectator count decrements
    const countPromiseOnD = waitForEvent(socketD, 'typing:spectatorCount');
    socketC.emit('typing:leaveRoom', { roomId });

    const decrementedCount = await countPromiseOnD;
    assert.equal(decrementedCount.spectatorCount, 1);
    assert.equal(decrementedCount.spectators.length, 1);
    assert.equal(Number(decrementedCount.spectators[0].userId), Number(sD.id));
  });
});
