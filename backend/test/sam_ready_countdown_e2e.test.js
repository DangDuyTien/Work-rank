'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  User,
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const samGameService = require('../src/services/samGame.service');

test('Sam Lốc Ready & 5-Second Server Authoritative Countdown E2E Suite', async (t) => {
  let hostUser, player2, adminUser;
  let hostToken, token2, adminToken;
  let roomId = null;
  let botRoomId = null;

  before(async () => {
    await SamRoom.sync();
    await SamPlayer.sync();
    await SamAction.sync();
    await SamResult.sync();
    await SamUserStat.sync();

    const ts = Date.now();
    hostUser = await User.create({
      name: `Host Ready ${ts}`,
      email: `host_ready_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Game Master',
      department: 'Phòng Media',
    });

    player2 = await User.create({
      name: `Player2 Ready ${ts}`,
      email: `p2_ready_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Developer',
      department: 'Phòng Kỹ Thuật',
    });

    adminUser = await User.create({
      name: `Admin Ready ${ts}`,
      email: `admin_ready_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
      jobTitle: 'Super Admin',
      department: 'Ban Giám Đốc',
    });

    hostToken = jwt.sign({ sub: hostUser.id, role: hostUser.role }, env.jwtSecret);
    token2 = jwt.sign({ sub: player2.id, role: player2.role }, env.jwtSecret);
    adminToken = jwt.sign({ sub: adminUser.id, role: adminUser.role }, env.jwtSecret);
  });

  after(async () => {
    if (roomId) {
      samGameService.clearStartCountdown(roomId);
      samGameService.clearBotTimers(roomId);
      samGameService.clearSamPhaseTimer(roomId);
    }
    if (botRoomId) {
      samGameService.clearStartCountdown(botRoomId);
      samGameService.clearBotTimers(botRoomId);
      samGameService.clearSamPhaseTimer(botRoomId);
    }
  });

  await t.test('1. Create Room: initial state is WAITING and player isReady defaults to false', async () => {
    const res = await request(app)
      .post('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ title: 'Phòng Test Ready & Countdown', maxPlayers: 4 });

    assert.equal(res.status, 201);
    assert.ok(res.body.room);
    roomId = res.body.room.id;
    assert.equal(res.body.room.status, 'WAITING');
    assert.equal(res.body.room.samPhase, 'WAITING');
    assert.equal(res.body.room.startAt, null);

    const hostPlayer = res.body.players.find((p) => Number(p.userId) === Number(hostUser.id));
    assert.ok(hostPlayer);
    assert.equal(hostPlayer.isReady, false);
  });

  await t.test('2. Player 2 joins: both players have isReady = false', async () => {
    const res = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.players.length, 2);
    assert.equal(res.body.players[0].isReady, false);
    assert.equal(res.body.players[1].isReady, false);
    assert.equal(res.body.room.status, 'WAITING');
  });

  await t.test('3. Only 1 player ready: room status remains WAITING, no countdown triggered', async () => {
    const res = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: true });

    assert.equal(res.status, 200);
    const p2 = res.body.players.find((p) => Number(p.userId) === Number(player2.id));
    const host = res.body.players.find((p) => Number(p.userId) === Number(hostUser.id));
    assert.equal(p2.isReady, true);
    assert.equal(host.isReady, false);
    assert.equal(res.body.room.status, 'WAITING');
    assert.equal(res.body.room.samPhase, 'WAITING');
    assert.equal(res.body.room.startAt, null);
  });

  await t.test('4. All players ready: triggers 5-second countdown (status=STARTING, startAt set ~5s in future)', async () => {
    const nowBefore = Date.now();
    const res = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ isReady: true });

    assert.equal(res.status, 200);
    assert.equal(res.body.room.status, 'STARTING');
    assert.equal(res.body.room.samPhase, 'STARTING');
    assert.ok(res.body.room.startAt);

    const startAtMs = new Date(res.body.room.startAt).getTime();
    assert.ok(startAtMs >= nowBefore + 3500 && startAtMs <= nowBefore + 6500, `startAtMs=${startAtMs} not ~5s ahead`);

    // Verify all players are ready
    assert.ok(res.body.players.every((p) => p.isReady === true));
  });

  await t.test('5. Reconnect / Refresh during countdown: preserves STARTING and returns valid startAt and serverTime', async () => {
    const res = await request(app)
      .get(`/api/games/sam/rooms/${roomId}`)
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.room.status, 'STARTING');
    assert.equal(res.body.room.samPhase, 'STARTING');
    assert.ok(res.body.room.startAt);
    assert.ok(res.body.room.serverTime);

    // Client calculates remaining time without resetting to 5s
    const deadline = new Date(res.body.room.startAt).getTime();
    const serverTime = new Date(res.body.room.serverTime).getTime();
    const remainingMs = deadline - serverTime;
    assert.ok(remainingMs > 0 && remainingMs <= 5000, `Remaining ms=${remainingMs} should be between 0 and 5000`);
  });

  await t.test('6. In countdown, player cancels ready: countdown aborts, status reverts to WAITING and startAt=null', async () => {
    const res = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: false });

    assert.equal(res.status, 200);
    assert.equal(res.body.room.status, 'WAITING');
    assert.equal(res.body.room.samPhase, 'WAITING');
    assert.equal(res.body.room.startAt, null);

    const p2 = res.body.players.find((p) => Number(p.userId) === Number(player2.id));
    assert.equal(p2.isReady, false);
  });

  await t.test('7. In countdown, player leaves: countdown cancels and room reverts to WAITING', async () => {
    // First make player2 ready again -> triggers STARTING
    await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: true });

    const checkStarting = await request(app)
      .get(`/api/games/sam/rooms/${roomId}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(checkStarting.body.room.status, 'STARTING');

    // Player 2 leaves during countdown
    const leaveRes = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/leave`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(leaveRes.status, 200);

    const roomAfterLeave = await request(app)
      .get(`/api/games/sam/rooms/${roomId}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(roomAfterLeave.body.room.status, 'WAITING');
    assert.equal(roomAfterLeave.body.room.samPhase, 'WAITING');
    assert.equal(roomAfterLeave.body.room.startAt, null);
    assert.equal(roomAfterLeave.body.players.length, 1);
  });

  await t.test('8. Bot Test Room: Bots default to isReady=true, human ready triggers countdown', async () => {
    const botRoomRes = await request(app)
      .post('/api/games/sam/admin/bot-room')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Bot Ready Room',
        playerCount: 4,
        botCount: 3,
        includeAdmin: true,
      });

    assert.equal(botRoomRes.status, 201);
    botRoomId = botRoomRes.body.room.id;

    // Verify bots are isReady = true, admin is isReady = false
    const bots = botRoomRes.body.players.filter((p) => p.isBot);
    const adminP = botRoomRes.body.players.find((p) => !p.isBot);
    assert.equal(bots.length, 3);
    assert.ok(bots.every((b) => b.isReady === true));
    assert.equal(adminP.isReady, false);
    assert.equal(botRoomRes.body.room.status, 'WAITING');

    // Admin clicks Sẵn sàng -> ALL 4 players are now ready -> triggers STARTING countdown
    const adminReadyRes = await request(app)
      .post(`/api/games/sam/rooms/${botRoomId}/ready`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isReady: true });

    assert.equal(adminReadyRes.status, 200);
    assert.equal(adminReadyRes.body.room.status, 'STARTING');
    assert.equal(adminReadyRes.body.room.samPhase, 'STARTING');
    assert.ok(adminReadyRes.body.room.startAt);

    samGameService.clearStartCountdown(botRoomId);
  });

  await t.test('9. Host direct startMatch (backward compatibility): starts immediately, cancels pending timer and enters SAM_DECLARING', async () => {
    // Re-add player 2 to roomId
    await request(app)
      .post(`/api/games/sam/rooms/${roomId}/join`)
      .set('Authorization', `Bearer ${token2}`);

    // Set all ready to trigger STARTING
    await request(app)
      .post(`/api/games/sam/rooms/${roomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isReady: true });

    const checkStarting = await request(app)
      .get(`/api/games/sam/rooms/${roomId}`)
      .set('Authorization', `Bearer ${hostToken}`);
    assert.equal(checkStarting.body.room.status, 'STARTING');

    // Host manually calls start
    const startRes = await request(app)
      .post(`/api/games/sam/rooms/${roomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`);

    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.room.status, 'PLAYING');
    assert.equal(startRes.body.room.samPhase, 'SAM_DECLARING');
    assert.equal(startRes.body.room.startAt, null);
    assert.equal(startRes.body.myHandCards.length, 10);
  });
});
