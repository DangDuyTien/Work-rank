'use strict';

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const {
  sequelize,
  User,
  ComputerActivityEvent,
  ComputerDailyStat,
} = require('../src/models');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const computerActivityService = require('../src/services/computerActivity.service');
const LocalIpcServer = require('../../desktop-agent/core/LocalIpcServer');

test('Computer Activity Tracking & Leaderboard Test Suite', async (t) => {
  let adminUser, userA, userB;
  let adminToken, userAToken, userBToken;

  before(async () => {
    await ComputerActivityEvent.sync();
    await ComputerDailyStat.sync();

    // Clean previous test records
    await ComputerActivityEvent.destroy({ where: {} });
    await ComputerDailyStat.destroy({ where: {} });

    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Computer ${ts}`,
      email: `admin_comp_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'admin',
      jobTitle: 'Hệ thống Quản trị',
    });

    userA = await User.create({
      name: `Dev Lead Alex ${ts}`,
      email: `alex_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Software Engineer',
    });

    userB = await User.create({
      name: `Video Editor Bob ${ts}`,
      email: `bob_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Video Editor',
    });

    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret);
    userAToken = jwt.sign({ sub: userA.id, role: 'user' }, env.jwtSecret);
    userBToken = jwt.sign({ sub: userB.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Scoring Formula: Restored WorkRank Focus & Activity Score formula', () => {
    // Test calculateFocusScore
    const focus100 = computerActivityService.calculateFocusScore(3600, 0);
    assert.strictEqual(focus100, 100);

    const focus50 = computerActivityService.calculateFocusScore(1800, 1800);
    assert.strictEqual(focus50, 52);

    // Test calculateRankScore: total clicks + keystrokes
    // actions = 100 clicks + 50 keystrokes = 150 pts.
    const score = computerActivityService.calculateRankScore({
      activeSeconds: 3600,
      idleSeconds: 0,
      mouseClicks: 100,
      keyboardCount: 50,
      focusScore: 100,
    });
    assert.strictEqual(score, 150);
  });

  await t.test('2. Ingestion: Ingests batches of OS-level activity for User A (VS Code)', async () => {
    const payload = {
      sessionId: `session-alex-1`,
      devicePlatform: 'macos',
      events: [
        {
          state: 'ACTIVE',
          activeApp: 'Visual Studio Code',
          appCategory: 'DEVELOPMENT',
          context: 'COMPUTER',
          activeSeconds: 900,
          idleSeconds: 60,
          mouseClicks: 40,
          keyboardCount: 120,
          occurredAt: new Date().toISOString(),
        },
        {
          state: 'ACTIVE',
          activeApp: 'Visual Studio Code',
          appCategory: 'DEVELOPMENT',
          context: 'COMPUTER',
          activeSeconds: 900,
          idleSeconds: 30,
          mouseClicks: 30,
          keyboardCount: 150,
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    const res = await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userAToken}`)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.received, 2);
    assert.strictEqual(res.body.processed, 2);

    // Verify stored events
    const count = await ComputerActivityEvent.count({ where: { userId: userA.id } });
    assert.strictEqual(count, 2);
  });

  await t.test('3. Ingestion: Ingests batch for User B (Adobe Premiere Pro)', async () => {
    const payload = {
      sessionId: `session-bob-1`,
      devicePlatform: 'macos',
      events: [
        {
          state: 'ACTIVE',
          activeApp: 'Adobe Premiere Pro',
          appCategory: 'DESIGN_VIDEO',
          context: 'COMPUTER',
          activeSeconds: 600,
          idleSeconds: 120,
          mouseClicks: 80,
          keyboardCount: 20,
          occurredAt: new Date().toISOString(),
        },
      ],
    };

    const res = await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userBToken}`)
      .send(payload);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.processed, 1);
  });

  await t.test('4. Leaderboard: GET /api/activity/rankings returns Độ Năng Động ranks', async () => {
    const res = await request(app)
      .get('/api/activity/rankings?period=today')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.rankings));
    assert.strictEqual(res.body.rankings.length >= 2, true);

    const first = res.body.rankings[0];
    const second = res.body.rankings[1];

    assert.strictEqual(first.rank, 1);
    assert.strictEqual(second.rank, 2);
    assert.ok(first.activityScore >= second.activityScore);

    // Check user info included
    assert.ok(first.user);
    assert.ok(first.user.name || first.user.fullName);
    assert.ok(first.activeMinutes > 0);
  });

  await t.test('5. Summary: GET /api/activity/my-summary returns user rank widget data', async () => {
    const res = await request(app)
      .get('/api/activity/my-summary')
      .set('Authorization', `Bearer ${userAToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.rank, 1);
    assert.ok(res.body.data.activityScore > 0);
    assert.strictEqual(res.body.data.topApp, 'Visual Studio Code');
  });

  await t.test('6. Admin Overview: GET /api/activity/admin/overview returns system analytics', async () => {
    const res = await request(app)
      .get('/api/activity/admin/overview?period=today')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.overview.totalActiveUsers >= 2);
    assert.ok(res.body.overview.totalActivityScore > 0);
    assert.ok(Array.isArray(res.body.overview.topApps));
  });

  await t.test('7. Privacy & Security: Strictly NO raw keystroke logging, NO suspicious penalties', async () => {
    const events = await ComputerActivityEvent.findAll({ where: { userId: userA.id } });
    for (const ev of events) {
      assert.strictEqual(ev.metadata?.loggedKeys, undefined);
      assert.strictEqual(ev.metadata?.keystrokeContent, undefined);
      assert.strictEqual(ev.metadata?.screenCapture, undefined);
    }
  });

  await t.test('8. Local IPC Server: Desktop Agent IPC handshake and status check', async () => {
    const testPort = 43199;
    let pairedData = null;
    const server = new LocalIpcServer({
      port: testPort,
      getStatusData: () => ({ currentState: 'ACTIVE', currentApp: 'Visual Studio Code' }),
      onPair: (data) => {
        pairedData = data;
      },
    });

    await server.start();

    // 1. Check status
    const statusRes = await fetch(`http://127.0.0.1:${testPort}/status`);
    const statusJson = await statusRes.json();
    assert.strictEqual(statusJson.success, true);
    assert.strictEqual(statusJson.running, true);
    assert.strictEqual(statusJson.currentApp, 'Visual Studio Code');

    // 2. Pair
    const pairRes = await fetch(`http://127.0.0.1:${testPort}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: userAToken,
        user: { id: userA.id, name: userA.name },
        backendUrl: 'http://localhost:5001',
      }),
    });
    const pairJson = await pairRes.json();
    assert.strictEqual(pairJson.success, true);
    assert.strictEqual(pairedData?.token, userAToken);

    // 3. Status after pairing
    const statusAfter = await (await fetch(`http://127.0.0.1:${testPort}/status`)).json();
    assert.strictEqual(statusAfter.paired, true);

    // 4. Logout
    const logoutRes = await fetch(`http://127.0.0.1:${testPort}/logout`, { method: 'POST' });
    const logoutJson = await logoutRes.json();
    assert.strictEqual(logoutJson.success, true);

    server.stop();
  });
});
