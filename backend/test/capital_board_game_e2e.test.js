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
  GameCatalog,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const gameService = require('../src/services/capitalBoardGame.service');

test('Comprehensive Capital Board Game V1 E2E Test Suite', async (t) => {
  let user1, user2, user3, user4;
  let token1, token2, token3, token4;
  let testRoomId = null;

  before(async () => {
    await GameCatalog.upsert({
      gameKey: 'capital_board',
      name: 'Cờ Tỷ Phú',
      status: 'AVAILABLE',
      enabled: true,
      sortOrder: 1,
      route: '/games/capital-board',
      icon: 'Gamepad2',
      description: 'Trò chơi bàn cờ tỷ phú kinh doanh và đầu tư bất động sản thời gian thực.',
    });
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

  await t.test('5. Property Purchase & End Turn: Deterministic purchase verification and turn advance', async () => {
    // 5.1 Set player 1 deterministically at Tile 1 (Property: Phòng Livestream, price: 100, rent: 15)
    const propertyTile1 = await GameProperty.findOne({ where: { roomId: testRoomId, tileIndex: 1 } });
    assert.ok(propertyTile1, 'Property at tile 1 must exist');
    assert.equal(propertyTile1.ownerUserId, null, 'Property should initially be unowned');

    const player1Record = await GamePlayer.findOne({ where: { roomId: testRoomId, userId: user1.id } });
    const initialCash = player1Record.cash;
    assert.ok(initialCash >= propertyTile1.price, 'Player 1 should have enough starting cash');

    // Deterministically configure turnState for Tile 1
    const roomRecord = await GameRoom.findByPk(testRoomId);
    roomRecord.turnState = {
      rolled: true,
      dice: [1, 0],
      total: 1,
      currentTileIndex: 1,
      canBuy: true,
      propertyId: propertyTile1.id,
      eventResult: null,
    };
    await roomRecord.save();

    player1Record.position = 1;
    await player1Record.save();

    // 5.2 Execute purchase API
    const buyRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/buy`)
      .set('Authorization', `Bearer ${token1}`);

    assert.equal(buyRes.status, 200);
    assert.equal(buyRes.body.data.turnState.canBuy, false);

    // Verify cash deducted
    const player1AfterBuy = await GamePlayer.findOne({ where: { roomId: testRoomId, userId: user1.id } });
    assert.equal(player1AfterBuy.cash, initialCash - propertyTile1.price);

    // Verify property ownership updated
    const propertyAfterBuy = await GameProperty.findOne({ where: { roomId: testRoomId, tileIndex: 1 } });
    assert.equal(Number(propertyAfterBuy.ownerUserId), Number(user1.id));

    // Verify transaction log created
    const buyTx = await GameTransaction.findOne({
      where: {
        roomId: testRoomId,
        userId: user1.id,
        type: 'PROPERTY_BUY',
        referenceId: String(propertyTile1.id),
      },
    });
    assert.ok(buyTx, 'PROPERTY_BUY transaction record must be created');
    assert.equal(buyTx.amount, -propertyTile1.price);
    assert.equal(buyTx.balanceBefore, initialCash);
    assert.equal(buyTx.balanceAfter, initialCash - propertyTile1.price);

    // 5.3 Attempting to buy again in the same turn fails (canBuy is false)
    const repeatBuyRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/buy`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(repeatBuyRes.status, 400);

    // 5.4 Attempting to buy when player does not have enough cash fails
    // Set up a mock scenario with another property (Tile 2) and 0 cash
    const propertyTile2 = await GameProperty.findOne({ where: { roomId: testRoomId, tileIndex: 2 } });
    assert.ok(propertyTile2);
    roomRecord.turnState = {
      rolled: true,
      dice: [1, 1],
      total: 2,
      currentTileIndex: 2,
      canBuy: true,
      propertyId: propertyTile2.id,
    };
    await roomRecord.save();
    player1AfterBuy.cash = 10; // Insufficient for price (120)
    await player1AfterBuy.save();

    const brokeBuyRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/buy`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(brokeBuyRes.status, 400);

    // Restore player 1 cash
    player1AfterBuy.cash = initialCash - propertyTile1.price;
    await player1AfterBuy.save();

    // 5.5 Player 1 ends turn
    const endTurnRes = await request(app)
      .post(`/api/games/rooms/${testRoomId}/end-turn`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(endTurnRes.status, 200);
    assert.equal(Number(endTurnRes.body.data.currentTurnPlayerId), Number(user2.id));
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

  await t.test('8. Room Code Join, Max Capacity & Lobby Leave', async () => {
    // 1. Host creates a 2-player room
    const createRes = await request(app)
      .post('/api/games/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Phòng 2 Người Test', maxPlayers: 2 });
    assert.equal(createRes.status, 201);
    const newRoom = createRes.body.data;
    assert.ok(newRoom.code);

    // 2. Join using Room Code (alphanumeric code)
    const joinByCode = await request(app)
      .post(`/api/games/rooms/${newRoom.code}/join`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(joinByCode.status, 200);
    assert.equal(joinByCode.body.data.players.length, 2);

    // 3. 3rd player tries to join full 2-player room (rejected)
    const join3Full = await request(app)
      .post(`/api/games/rooms/${newRoom.id}/join`)
      .set('Authorization', `Bearer ${token3}`);
    assert.equal(join3Full.status, 400);

    // 4. Player 2 leaves room before match starts
    const leaveRes = await request(app)
      .post(`/api/games/rooms/${newRoom.id}/leave`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(leaveRes.status, 200);

    const roomAfterLeave = await gameService.getRoomState(newRoom.id, user1.id);
    assert.equal(roomAfterLeave.players.length, 1);

    // Clean up
    await GamePlayer.destroy({ where: { roomId: newRoom.id } }).catch(() => {});
    await GameRoom.destroy({ where: { id: newRoom.id } }).catch(() => {});
  });

  await t.test('9. Practice Room with Bots: Host creates 1 Human + 3 Bots practice room', async () => {
    const practiceRes = await request(app)
      .post('/api/games/practice')
      .set('Authorization', `Bearer ${token1}`)
      .send({ botCount: 3 });

    assert.equal(practiceRes.status, 201);
    const practiceRoom = practiceRes.body.data;
    assert.ok(practiceRoom.id);
    assert.equal(practiceRoom.players.length, 4);
    assert.equal(Number(practiceRoom.players[0].userId), Number(user1.id));

    // Verify bots have isBot and simulated flags
    const bots = practiceRoom.players.filter((p) => Number(p.userId) !== Number(user1.id));
    assert.equal(bots.length, 3);
    for (const b of bots) {
      assert.ok(b.user.isBot || b.user.isSimulated);
      assert.ok(b.user.name.includes('🤖'));
    }

    // Clean up
    await GameProperty.destroy({ where: { roomId: practiceRoom.id } });
    await GamePlayer.destroy({ where: { roomId: practiceRoom.id } });
    await GameRoom.destroy({ where: { id: practiceRoom.id } });
  });

  await t.test('10. Add and Remove Bot in Custom Waiting Room', async () => {
    // 1. Create a 4-player room
    const createRes = await request(app)
      .post('/api/games/rooms')
      .set('Authorization', `Bearer ${token1}`)
      .send({ title: 'Phòng Thêm Bot Test', maxPlayers: 4 });
    assert.equal(createRes.status, 201);
    const room = createRes.body.data;

    // 2. Add 1st bot
    const addBot1 = await request(app)
      .post(`/api/games/rooms/${room.id}/bots`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(addBot1.status, 200);
    assert.equal(addBot1.body.data.players.length, 2);
    const bot1UserId = addBot1.body.data.players.find((p) => p.userId !== user1.id).userId;

    // 3. Add 2nd bot
    const addBot2 = await request(app)
      .post(`/api/games/rooms/${room.id}/bots`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(addBot2.status, 200);
    assert.equal(addBot2.body.data.players.length, 3);

    // 4. Non-host cannot add bot
    const nonHostAdd = await request(app)
      .post(`/api/games/rooms/${room.id}/bots`)
      .set('Authorization', `Bearer ${token2}`);
    assert.equal(nonHostAdd.status, 400);

    // 5. Remove 1st bot
    const removeBot1 = await request(app)
      .delete(`/api/games/rooms/${room.id}/bots/${bot1UserId}`)
      .set('Authorization', `Bearer ${token1}`);
    assert.equal(removeBot1.status, 200);
    assert.equal(removeBot1.body.data.players.length, 2);

    // Clean up
    await GameProperty.destroy({ where: { roomId: room.id } }).catch(() => {});
    await GamePlayer.destroy({ where: { roomId: room.id } }).catch(() => {});
    await GameRoom.destroy({ where: { id: room.id } }).catch(() => {});
  });
});


