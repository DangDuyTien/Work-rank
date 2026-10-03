'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  GameCatalog,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Game Catalog Coming Soon Test Suite', async (t) => {
  let adminUser, normalUser;
  let adminToken, userToken;

  before(async () => {
    await sequelize.sync();

    await GameCatalog.bulkCreate([
      { gameKey: 'capital_board', name: 'Cờ Thủ Đô', route: '/games/capital-board', status: 'AVAILABLE', enabled: true, sortOrder: 1 },
      { gameKey: 'game_2048', name: '2048 Vô Địch', route: '/games/2048', status: 'AVAILABLE', enabled: true, sortOrder: 2 },
      { gameKey: 'quiz', name: 'Đấu Trí Tri Thức', route: '/games/quiz', status: 'AVAILABLE', enabled: true, sortOrder: 3 },
      { gameKey: 'sam', name: 'Sâm Lốc', route: '/games/sam', status: 'AVAILABLE', enabled: true, sortOrder: 4 },
    ]);

    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Game Tester ${ts}`,
      email: `admin_game_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'admin',
      jobTitle: 'Quản trị viên',
    });

    normalUser = await User.create({
      name: `Regular Member ${ts}`,
      email: `member_game_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Nhân viên',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret);
    userToken = jwt.sign({ sub: normalUser.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Game Catalog: Public catalog returns games with status', async () => {
    const res = await request(app)
      .get('/api/games/catalog');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.games));
    assert.ok(res.body.games.length >= 4);

    const keys = res.body.games.map((g) => g.gameKey);
    assert.ok(keys.includes('capital_board'));
    assert.ok(keys.includes('game_2048'));
    assert.ok(keys.includes('quiz'));
    assert.ok(keys.includes('sam'));
  });

  await t.test('2. Game Coming Soon Enforcement: Non-admin blocked when game is COMING_SOON, Admin allowed', async () => {
    // 1. Admin sets 2048 to COMING_SOON
    const patchRes = await request(app)
      .patch('/api/admin/games/game_2048')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMING_SOON' });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.status, 'COMING_SOON');

    // 2. Regular user attempts to start 2048 session -> BLOCKED with 403 GAME_COMING_SOON
    const blockedRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.body.error, 'GAME_COMING_SOON');

    // 3. Admin attempts to start 2048 session -> ALLOWED (preview/testing privilege)
    const adminStartRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    assert.equal(adminStartRes.status, 200);
    assert.ok(adminStartRes.body.data?.gameSessionId || adminStartRes.body.gameSessionId);

    // 4. Admin reverts 2048 to AVAILABLE
    const revertRes = await request(app)
      .patch('/api/admin/games/game_2048')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' });

    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.body.status, 'AVAILABLE');

    // 5. Regular user can now start 2048 session
    const allowedRes = await request(app)
      .post('/api/games/2048/start')
      .set('Authorization', `Bearer ${userToken}`)
      .send({});

    assert.equal(allowedRes.status, 200);
    assert.ok(allowedRes.body.data?.gameSessionId || allowedRes.body.gameSessionId);
  });
});
