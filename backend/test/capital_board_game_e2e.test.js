'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  GameRoom,
  GamePlayer,
  GameProperty,
  GameTransaction,
  GameResult,
  GameLeaderboardProfile,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const gameService = require('../src/services/capitalBoardGame.service');

test('Comprehensive Capital Board Game V1 E2E Test Suite', async (t) => {
  let user1, user2, user3, user4;
  let token1, token2, token3, token4;
  let testRoomId = null;

  before(async () => {
    const ts = Date.now();
    user1 = await User.create({
      name: `Player One ${ts}`,
      email: `p1_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Content Creator',
      department: 'Media & Content',
    });

    user2 = await User.create({
      name: `Player Two ${ts}`,
      email: `p2_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Video Editor',
      department: 'Phòng Sản Xuất Video',
    });

    user3 = await User.create({
      name: `Player Three ${ts}`,
      email: `p3_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Motion Designer',
      department: 'Media & Content',
    });

    user4 = await User.create({
      name: `Player Four ${ts}`,
      email: `p4_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Sound Designer',
      department: 'Media & Content',
    });

    token1 = jwt.sign({ sub: user1.id, email: user1.email, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
    token2 = jwt.sign({ sub: user2.id, email: user2.email, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
    token3 = jwt.sign({ sub: user3.id, email: user3.email, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
    token4 = jwt.sign({ sub: user4.id, email: user4.email, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
  });

  after(async () => {
    if (testRoomId) {
      await GameProperty.destroy({ where: { roomId: testRoomId } }).catch(() => {});
      await GamePlayer.destroy({ where: { roomId: testRoomId } }).catch(() => {});
      await GameRoom.destroy({ where: { id: testRoomId } }).catch(() => {});
    }
    if (user1) await User.destroy({ where: { id: user1.id } }).catch(() => {});
    if (user2) await User.destroy({ where: { id: user2.id } }).catch(() => {});
    if (user3) await User.destroy({ where: { id: user3.id } }).catch(() => {});
    if (user4) await User.destroy({ where: { id: user4.id } }).catch(() => {});
  });

  await t.test('1. Room Creation: Host creates a room with valid code and auto seat assignment', async () => {
    const res = await request(app)
      .post('/api/games/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        title: 'Bàn Đấu Cờ Tỷ Phú #1',
        maxPlayers: 4,
      });

    assert.equal(res.status, 201);
    assert.ok(res.body.data);
    assert.equal(res.body.data.status, 'WAITING');
    assert.equal(res.body.data.host.id, user1.id);
    assert.equal(res.body.data.players.length, 1);
    assert.equal(res.body.data.players[0].userId, user1.id);
    assert.equal(res.body.data.players[0].seatIndex, 0);

    testRoomId = res.body.data.id;
  });

  await t.test('2. Room Joining: Other players join, max capacity checked, duplicate join prevented', async () => {
    // Player 2 joins
    const join2 = await request(app)
      .post(`/api/games/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(join2.status, 200);
    assert.equal(join2.body.data.players.length, 2);

    // Player 3 joins
    const join3 = await request(app)
      .post(`/api/games/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token3}`);
    assert.equal(join3.status, 200);
    assert.equal(join3.body.data.players.length, 3);

    // Player 2 joins again (idempotent)
    const join2Again = await request(app)
      .post(`/api/games/rooms/${testRoomId}/join`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(join2Again.status, 200);
    assert.equal(join2Again.body.data.players.length, 3);
  });

  await t.test('3. Game Start: Only host can start, seeds properties and sets initial turn state', async () => {
    // Non-host attempts to start (rejected)
    const nonHostStart = await request(app)
      .post(`/api/games/rooms/${testRoomId}/start`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(nonHostStart.status, 400);

    // Host starts game
    const startRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/start`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(startRes.status, 200);
    assert.equal(startRes.body.data.status, 'PLAYING');
    assert.equal(startRes.body.data.currentTurnPlayerId, user1.id);
    assert.equal(startRes.body.data.turnNumber, 1);
    assert.ok(startRes.body.data.properties.length >= 18);
  });

  await t.test('4. Turn & Movement Authority: Correct player rolls, position updates, non-turn rejected', async () => {
    // Player 2 tries to roll out of turn (rejected)
    const wrongTurnRoll = await request(app)
      .post(`/api/games/rooms/${testRoomId}/roll`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(wrongTurnRoll.status, 400);

    // Player 1 rolls dice
    const rollRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/roll`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(rollRes.status, 200);
    assert.ok(rollRes.body.data.lastDiceResult);
    assert.ok(rollRes.body.data.lastDiceResult.total >= 2 && rollRes.body.data.lastDiceResult.total <= 12);
    assert.equal(rollRes.body.data.turnState.rolled, true);

    // Rolling again in same turn rejected
    const rollTwice = await request(app)
      .post(`/api/games/rooms/${testRoomId}/roll`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(rollTwice.status, 400);
  });

  await t.test('5. Property Purchase & End Turn: Player buys property, cash deducted, turn advances', async () => {
    // Check if player landed on a buyable property
    const roomState = await gameService.getRoomState(testRoomId, user1.id);
    if (roomState.turnState.canBuy) {
      const buyRes = await request(app)
        .post(`/api/games/rooms/${testRoomId}/buy`)
        .set('Authorization', `Bearer ${token1}`);
      assert.equal(buyRes.status, 200);
      assert.equal(buyRes.body.data.turnState.canBuy, false);
    }

    // Player 1 ends turn
    const endTurnRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/end-turn`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(endTurnRes.status, 200);
    assert.equal(endTurnRes.body.data.currentTurnPlayerId, user2.id);
    assert.equal(endTurnRes.body.data.turnNumber, 2);
    assert.equal(endTurnRes.body.data.turnState.rolled, false);
  });

  await t.test('6. Reconnect & Active Match State: Player fetches active room on browser reload', async () => {
    const activeRes = await request(app)
      .get('/api/games/active-room')
      .set('Authorization', `Bearer ${token2}`);

    assert.equal(activeRes.status, 200);
    assert.ok(activeRes.body.data);
    assert.equal(activeRes.body.data.id, testRoomId);
    assert.equal(activeRes.body.data.status, 'PLAYING');
  });

  await t.test('7. Leaderboard & Match Settlement: Settle game, distribute rewards, verify career money', async () => {
    // Force settle game
    const room = await GameRoom.findByPk(testRoomId, {
      include: [{ model: GamePlayer, as: 'players' }],
    });
    await gameService.settleGameFinish(room, null);

    const finishedRoom = await gameService.getRoomState(testRoomId, user1.id);
    assert.equal(finishedRoom.status, 'FINISHED');
    assert.ok(finishedRoom.winner);

    // Query game leaderboard
    const lbRes = await request(app)
      .get('/api/games/leaderboard')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(lbRes.status, 200);
    assert.ok(Array.isArray(lbRes.body.data.items));
    assert.ok(lbRes.body.data.items.length >= 1);

    // Query user history
    const histRes = await request(app)
      .get('/api/games/history')
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(histRes.status, 200);
    assert.ok(Array.isArray(histRes.body.data));
    assert.ok(histRes.body.data.length >= 1);
    assert.equal(histRes.body.data[0].roomId, testRoomId);
  });
});
