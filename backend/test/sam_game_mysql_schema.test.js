'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
  GameCatalog,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const samGameService = require('../src/services/samGame.service');

test('BUG-006: Sâm Lốc MySQL Schema & Tri-State Column Nullability Test Suite', async (t) => {
  let hostUser, player2;
  let hostToken, token2;
  let createdRoomId = null;

  before(async () => {
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.sync();
    }

    // Ensure Sâm Lốc is available in game catalog
    await GameCatalog.upsert({
      gameKey: 'sam',
      name: 'Sâm Lốc',
      status: 'AVAILABLE',
      enabled: true,
      sortOrder: 1,
      route: '/games/sam',
      icon: 'Spade',
      description: 'Trò chơi đánh bài Sâm Lốc dân gian.',
    });

    const ts = Date.now();
    hostUser = await User.create({
      name: `Host Sâm MySQL ${ts}`,
      email: `sam_host_mysql_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Game Lead',
      department: 'Phòng Media',
    });

    player2 = await User.create({
      name: `Player Two MySQL ${ts}`,
      email: `sam_p2_mysql_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'user',
      jobTitle: 'Developer',
      department: 'Phòng Công Nghệ',
    });

    hostToken = jwt.sign(
      { sub: hostUser.id, email: hostUser.email, role: 'user', tokenVersion: 0 },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    token2 = jwt.sign(
      { sub: player2.id, email: player2.email, role: 'user', tokenVersion: 0 },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (createdRoomId) {
      samGameService.clearSamPhaseTimer(createdRoomId);
      await SamAction.destroy({ where: { roomId: createdRoomId } }).catch(() => {});
      await SamPlayer.destroy({ where: { roomId: createdRoomId } }).catch(() => {});
      await SamRoom.destroy({ where: { id: createdRoomId } }).catch(() => {});
    }
    if (hostUser) await hostUser.destroy().catch(() => {});
    if (player2) await player2.destroy().catch(() => {});
  });

  await t.test('1. Database schema: sam_players.has_declared_sam allows NULL and defaults to NULL', async () => {
    const queryInterface = sequelize.getQueryInterface();
    const tableDesc = await queryInterface.describeTable('sam_players');

    assert.ok(tableDesc.has_declared_sam, 'sam_players table must contain has_declared_sam column');
    assert.strictEqual(
      tableDesc.has_declared_sam.allowNull,
      true,
      'has_declared_sam must allow NULL to support business tri-state contract'
    );
  });

  await t.test('2. POST /api/games/sam/rooms creates room without "cannot be null" error', async () => {
    const res = await request(app)
      .post('/api/games/sam/rooms')
      .set('Authorization', `Bearer ${hostToken}`)
      .send({
        title: 'Phòng Đánh Sâm MySQL Test',
        maxPlayers: 4,
      });

    assert.strictEqual(res.status, 201, `Expected 201 Created but got ${res.status}: ${JSON.stringify(res.body)}`);
    assert.ok(res.body.room, 'Response should contain room object');
    assert.strictEqual(res.body.room.status, 'WAITING');
    createdRoomId = res.body.room.id;

    // Verify host player was created in database with hasDeclaredSam === null
    const hostPlayer = await SamPlayer.findOne({
      where: { roomId: createdRoomId, userId: hostUser.id },
    });
    assert.ok(hostPlayer, 'Host player must exist in database');
    assert.strictEqual(hostPlayer.seatIndex, 0);
    assert.strictEqual(
      hostPlayer.hasDeclaredSam,
      null,
      'New player hasDeclaredSam must be null (undecided) in waiting state'
    );
  });

  await t.test('3. Tri-state persistence lifecycle: null on deal -> boolean on declaration', async () => {
    // Player 2 joins room
    const joinRes = await request(app)
      .post(`/api/games/sam/rooms/${createdRoomId}/join`)
      .set('Authorization', `Bearer ${token2}`)
      .send({});
    assert.strictEqual(joinRes.status, 200);

    const p2Record = await SamPlayer.findOne({
      where: { roomId: createdRoomId, userId: player2.id },
    });
    assert.ok(p2Record, 'Player 2 must be in room');
    assert.strictEqual(p2Record.hasDeclaredSam, null, 'Joined player must have hasDeclaredSam === null');

    // Both players toggle ready
    await request(app)
      .post(`/api/games/sam/rooms/${createdRoomId}/ready`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    await request(app)
      .post(`/api/games/sam/rooms/${createdRoomId}/ready`)
      .set('Authorization', `Bearer ${token2}`)
      .send({});

    // Host starts match -> p.hasDeclaredSam = null is saved on all players
    const startRes = await request(app)
      .post(`/api/games/sam/rooms/${createdRoomId}/start`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({});
    assert.strictEqual(startRes.status, 200, `Expected match start to succeed: ${JSON.stringify(startRes.body)}`);

    // Verify both players in DB have hasDeclaredSam = null during SAM_DECLARING window
    const playersPostStart = await SamPlayer.findAll({ where: { roomId: createdRoomId } });
    for (const p of playersPostStart) {
      assert.strictEqual(
        p.hasDeclaredSam,
        null,
        `Player seat ${p.seatIndex} must have hasDeclaredSam = null on match start`
      );
    }

    // Host declares Sâm (true)
    const declareRes = await request(app)
      .post(`/api/games/sam/rooms/${createdRoomId}/declare-sam`)
      .set('Authorization', `Bearer ${hostToken}`)
      .send({ declare: true });
    assert.strictEqual(declareRes.status, 200);

    const hostAfterDeclare = await SamPlayer.findOne({
      where: { roomId: createdRoomId, userId: hostUser.id },
    });
    assert.strictEqual(
      Boolean(hostAfterDeclare.hasDeclaredSam),
      true,
      'Host hasDeclaredSam must persist as true after declaring Sâm'
    );
  });
});
