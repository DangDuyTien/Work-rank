'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  ActivityEvent,
  SystemSetting,
  GameCatalog,
  ScoreLedger,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Pure Activity Tracking & Game Catalog Coming Soon Test Suite', async (t) => {
  let adminUser, normalUser;
  let adminToken, userToken;

  before(async () => {
    await ActivityEvent.sync();
    await SystemSetting.sync();
    await GameCatalog.sync();

    await ActivityEvent.destroy({ where: {} });

    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Tester ${ts}`,
      email: `admin_tracking_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'admin',
      jobTitle: 'Quản trị viên',
    });

    normalUser = await User.create({
      name: `Regular Member ${ts}`,
      email: `member_tracking_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Nhân viên',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret);
    userToken = jwt.sign({ sub: normalUser.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Activity Tracking: Ingests batch of clicks and keyboard activities', async () => {
    const events = [
      {
        eventType: 'CLICK',
        route: '/dashboard',
        occurredAt: new Date().toISOString(),
        metadata: { target: 'refresh-button', tag: 'button' },
      },
      {
        eventType: 'KEYBOARD_ACTIVITY',
        route: '/dashboard',
        occurredAt: new Date().toISOString(),
        metadata: { event: 'keypress' },
      },
    ];

    const res = await request(app)
      .post('/api/activity/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ events });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.processed, 2);

    const savedEvents = await ActivityEvent.findAll({ where: { userId: normalUser.id } });
    assert.equal(savedEvents.length, 2);
  });

  await t.test('2. Activity Tracking: Rapid clicks (100 clicks) accepted without warning, block, or flags', async () => {
    const rapidClicks = Array.from({ length: 100 }, (_, i) => ({
      eventType: 'CLICK',
      route: '/games/2048',
      occurredAt: new Date().toISOString(),
      metadata: { target: `tile-click-${i}` },
    }));

    const res = await request(app)
      .post('/api/activity/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ events: rapidClicks });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.processed, 100);

    // Verify user is NOT blocked, flagged, or locked
    const refreshedUser = await User.findByPk(normalUser.id);
    assert.equal(refreshedUser.status, 'active');
  });

  await t.test('3. Privacy: Never stores typed text, form values, or passwords in metadata', async () => {
    const privacyEvent = {
      eventType: 'KEYBOARD_ACTIVITY',
      route: '/settings',
      occurredAt: new Date().toISOString(),
      metadata: {
        rawText: 'secretpassword123',
        typedContent: 'user personal details',
        password: 'my-super-secret',
        target: 'input-box',
      },
    };

    const res = await request(app)
      .post('/api/activity/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ events: [privacyEvent] });

    assert.equal(res.status, 200);

    const saved = await ActivityEvent.findOne({
      where: { userId: normalUser.id, route: '/settings' },
    });
    assert.ok(saved);
    assert.ok(!saved.metadata.rawText, 'rawText must be stripped');
    assert.ok(!saved.metadata.typedContent, 'typedContent must be stripped');
    assert.ok(!saved.metadata.password, 'password must be stripped');
    assert.equal(saved.metadata.target, 'input-box');
  });

  await t.test('4. Score Isolation: Activity tracking never creates ScoreLedger points or modifies rankings', async () => {
    const ledgerCount = await ScoreLedger.count({ where: { userId: normalUser.id } });
    assert.equal(ledgerCount, 0, 'ScoreLedger MUST remain 0, clicks/keys must never generate XP');
  });

  await t.test('5. Admin Settings: Toggle Mouse tracking OFF drops click events', async () => {
    // Admin toggles mouse tracking OFF
    const updateRes = await request(app)
      .patch('/api/activity/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mouseTrackingEnabled: false, keyboardTrackingEnabled: true });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.mouseTrackingEnabled, false);
    assert.equal(updateRes.body.keyboardTrackingEnabled, true);

    // Send click and keyboard events
    const batchRes = await request(app)
      .post('/api/activity/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        events: [
          { eventType: 'CLICK', route: '/home' },
          { eventType: 'KEYBOARD_ACTIVITY', route: '/home' },
        ],
      });

    assert.equal(batchRes.status, 200);
    // Click was discarded, only keyboard processed
    assert.equal(batchRes.body.processed, 1);
    assert.equal(batchRes.body.discarded, 1);

    // Re-enable mouse tracking
    await request(app)
      .patch('/api/activity/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mouseTrackingEnabled: true, keyboardTrackingEnabled: true });
  });

  await t.test('6. Admin Analytics: Returns aggregated activity volume over time', async () => {
    const res = await request(app)
      .get('/api/activity/analytics?range=today')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.ok(res.body.summary);
    assert.ok(res.body.summary.totalClicks > 0);
    assert.ok(res.body.summary.totalKeyboards > 0);
    assert.ok(res.body.summary.totalActivity > 0);
    assert.ok(Array.isArray(res.body.topRoutes));
    assert.ok(Array.isArray(res.body.timeline));
  });

  await t.test('7. Game Catalog: Public catalog returns games with status', async () => {
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

  await t.test('8. Game Coming Soon Enforcement: Non-admin blocked when game is COMING_SOON, Admin allowed', async () => {
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
