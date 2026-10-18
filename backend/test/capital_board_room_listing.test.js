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
  GameCatalog,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const capitalBoardGameService = require('../src/services/capitalBoardGame.service');

test('BUG-007: Capital Board Room Listing Ambiguity & Sorting Invariant Test Suite', async (t) => {
  let hostUser, player1, player2;
  let userToken;
  const createdRoomIds = [];

  before(async () => {
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.sync();
    }

    // Ensure Cờ Tỷ Phú is available in game catalog
    await GameCatalog.upsert({
      gameKey: 'capital_board',
      name: 'Cờ Tỷ Phú',
      status: 'AVAILABLE',
      enabled: true,
      sortOrder: 1,
      route: '/games/capital-board',
      icon: 'Gamepad2',
      description: 'Trò chơi bàn cờ tỷ phú kinh doanh bất động sản.',
    });

    const ts = Date.now();
    hostUser = await User.create({
      name: `Host Capital ${ts}`,
      email: `host_capital_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Broker',
      department: 'Phòng Kinh Doanh',
    });

    player1 = await User.create({
      name: `Player One Capital ${ts}`,
      email: `p1_capital_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Trader',
      department: 'Phòng Tài Chính',
    });

    player2 = await User.create({
      name: `Player Two Capital ${ts}`,
      email: `p2_capital_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Analyst',
      department: 'Phòng Phân Tích',
    });

    userToken = jwt.sign(
      { sub: hostUser.id, email: hostUser.email, role: 'user', tokenVersion: 0 },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (createdRoomIds.length > 0) {
      await GamePlayer.destroy({ where: { roomId: createdRoomIds } }).catch(() => {});
      await GameRoom.destroy({ where: { id: createdRoomIds } }).catch(() => {});
    }
    if (hostUser) await hostUser.destroy().catch(() => {});
    if (player1) await player1.destroy().catch(() => {});
    if (player2) await player2.destroy().catch(() => {});
  });

  await t.test('1. GET /api/games/rooms returns 200 without SQL ambiguous column error', async () => {
    const res = await request(app)
      .get('/api/games/rooms?limit=30')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200, `Expected 200 OK but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(Array.isArray(res.body.data), 'Response data must be an array of rooms');
  });

  await t.test('2. Multi-room & multi-player listing sorts WAITING rooms ahead of PLAYING rooms without collision', async () => {
    const baseCode = Math.random().toString(36).substring(2, 6).toUpperCase();

    // 1. Create a PLAYING room (created first)
    const roomPlaying = await GameRoom.create({
      code: `P${baseCode}1`,
      title: 'Phòng Đang Chơi Test',
      hostUserId: hostUser.id,
      status: 'PLAYING',
      maxPlayers: 4,
      createdAt: new Date(Date.now() - 60000), // 1 min ago
    });
    createdRoomIds.push(roomPlaying.id);

    // Add players to roomPlaying with status ACTIVE (both game_rooms and game_players have status column)
    await GamePlayer.create({
      roomId: roomPlaying.id,
      userId: hostUser.id,
      seatIndex: 0,
      status: 'ACTIVE',
      cash: 1500,
    });
    await GamePlayer.create({
      roomId: roomPlaying.id,
      userId: player1.id,
      seatIndex: 1,
      status: 'ACTIVE',
      cash: 1500,
    });

    // 2. Create an older WAITING room
    const roomWaitingOld = await GameRoom.create({
      code: `W${baseCode}1`,
      title: 'Phòng Chờ Cũ Test',
      hostUserId: hostUser.id,
      status: 'WAITING',
      maxPlayers: 4,
      createdAt: new Date(Date.now() - 30000), // 30s ago
    });
    createdRoomIds.push(roomWaitingOld.id);

    await GamePlayer.create({
      roomId: roomWaitingOld.id,
      userId: hostUser.id,
      seatIndex: 0,
      status: 'WAITING',
      cash: 1500,
    });

    // 3. Create a newer WAITING room
    const roomWaitingNew = await GameRoom.create({
      code: `W${baseCode}2`,
      title: 'Phòng Chờ Mới Test',
      hostUserId: hostUser.id,
      status: 'WAITING',
      maxPlayers: 4,
      createdAt: new Date(Date.now()), // now
    });
    createdRoomIds.push(roomWaitingNew.id);

    await GamePlayer.create({
      roomId: roomWaitingNew.id,
      userId: hostUser.id,
      seatIndex: 0,
      status: 'WAITING',
      cash: 1500,
    });
    await GamePlayer.create({
      roomId: roomWaitingNew.id,
      userId: player2.id,
      seatIndex: 1,
      status: 'WAITING',
      cash: 1500,
    });

    // Query via service directly
    const serviceRooms = await capitalBoardGameService.listRooms({ limit: 30 });
    assert.ok(Array.isArray(serviceRooms));

    // Query via HTTP endpoint
    const res = await request(app)
      .get('/api/games/rooms?limit=30')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(res.status, 200);
    const rooms = res.body.data;
    assert.ok(rooms.length >= 3);

    // Filter to our test rooms
    const testRooms = rooms.filter((r) => createdRoomIds.includes(r.id));
    assert.strictEqual(testRooms.length, 3, 'All 3 test rooms must be returned');

    // Invariant 1: All WAITING rooms must appear before any PLAYING rooms
    const firstPlayingIndex = testRooms.findIndex((r) => r.status === 'PLAYING');
    const lastWaitingIndex = testRooms.reduce((lastIdx, r, idx) => (r.status === 'WAITING' ? idx : lastIdx), -1);

    assert.ok(firstPlayingIndex > lastWaitingIndex, 'All WAITING rooms must be listed before PLAYING rooms');

    // Invariant 2: Newer WAITING room must appear before older WAITING room
    const newWaitingIndex = testRooms.findIndex((r) => r.id === roomWaitingNew.id);
    const oldWaitingIndex = testRooms.findIndex((r) => r.id === roomWaitingOld.id);
    assert.ok(newWaitingIndex < oldWaitingIndex, 'Newer WAITING room must appear before older WAITING room');

    // Invariant 3: Player data and host data are properly nested and sanitized
    const testRoomDetail = testRooms.find((r) => r.id === roomWaitingNew.id);
    assert.strictEqual(testRoomDetail.playerCount, 2);
    assert.strictEqual(testRoomDetail.host.name, hostUser.name);
    assert.strictEqual(testRoomDetail.players.length, 2);
  });
});
