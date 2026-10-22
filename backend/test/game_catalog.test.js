'use strict';

const { test, before, after } = require('node:test');
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

test('Game Catalog Test Suite (Typing Battle + Drawing + 3 Arcade games)', async (t) => {
  let adminUser, normalUser;
  let adminToken, userToken;

  before(async () => {
    await GameCatalog.bulkCreate([
      { gameKey: 'typing_battle', name: 'WorkRank Typing Battle', route: '/games/typing', status: 'AVAILABLE', enabled: true, sortOrder: 1 },
      { gameKey: 'drawing', name: 'Góc Sáng Tạo (Game Vẽ)', route: '/games/drawing', status: 'AVAILABLE', enabled: true, sortOrder: 2 },
    ], { updateOnDuplicate: ['name', 'route', 'status', 'enabled', 'sortOrder'] });

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

  await t.test('1. Public catalog exposes the five active Game Center titles', async () => {
    const res = await request(app).get('/api/games/catalog');

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.games));

    const keys = res.body.games.map((g) => g.gameKey).sort();
    assert.deepEqual(keys, ['computer_rush', 'direction_rush', 'drawing', 'memory_flash', 'typing_battle']);
  });

  await t.test('2. Coming Soon enforcement: non-admin blocked, admin allowed to preview', async () => {
    const patchRes = await request(app)
      .patch('/api/admin/games/typing_battle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'COMING_SOON' });

    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.status, 'COMING_SOON');

    const blockedRes = await request(app)
      .post('/api/games/typing/rooms')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Blocked Room', mode: '1V1' });

    assert.equal(blockedRes.status, 403);
    assert.equal(blockedRes.body.reason, 'COMING_SOON');

    const adminStatusRes = await request(app)
      .get('/api/games/typing/status')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(adminStatusRes.status, 200);
    assert.equal(adminStatusRes.body.allowed, true);

    const revertRes = await request(app)
      .patch('/api/admin/games/typing_battle')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'AVAILABLE' });

    assert.equal(revertRes.status, 200);
    assert.equal(revertRes.body.status, 'AVAILABLE');
  });

  after(async () => {
    if (adminUser) await User.destroy({ where: { id: adminUser.id } });
    if (normalUser) await User.destroy({ where: { id: normalUser.id } });
    await sequelize.close().catch(() => {});
  });
});
