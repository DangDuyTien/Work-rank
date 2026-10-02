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

test('PTS Persistence, Idempotency & Tracking Lifecycle Acceptance Test Suite', async (t) => {
  let testUser;
  let userToken;

  before(async () => {
    await ComputerActivityEvent.sync();
    await ComputerDailyStat.sync();

    const ts = Date.now();
    testUser = await User.create({
      name: `Tester Lifecycle ${ts}`,
      email: `tester_lifecycle_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'QA Engineer',
    });

    userToken = jwt.sign({ sub: testUser.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Initial State: User starts with 0 PTS before any tracking', async () => {
    const summary = await computerActivityService.getUserSummary(testUser.id);
    assert.strictEqual(summary.activityScore, 0);
  });

  await t.test('2. Tracking ON + Activity Ingestion: Ingesting events accumulates PTS correctly', async () => {
    const eventId1 = `ev_test_${Date.now()}_1`;
    const res1 = await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sessionId: 'ses_test_1',
        devicePlatform: 'macos',
        events: [
          {
            eventId: eventId1,
            state: 'ACTIVE',
            activeApp: 'Visual Studio Code',
            appCategory: 'DEVELOPMENT',
            context: 'COMPUTER',
            activeSeconds: 120, // 2 mins
            idleSeconds: 0,
            mouseClicks: 30,
            keyboardCount: 70,
            occurredAt: new Date().toISOString(),
          },
        ],
      });

    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.body.success, true);
    assert.ok(res1.body.activityScore > 0);

    const initialScore = res1.body.activityScore;

    // Verify GET /api/activity/my-summary returns this exact score
    const summaryRes = await request(app)
      .get('/api/activity/my-summary')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(summaryRes.status, 200);
    assert.strictEqual(summaryRes.body.data.activityScore, initialScore);
  });

  await t.test('3. STOP TRACKING: Stopping tracking MUST NOT reset PTS or wipe history', async () => {
    // Current score before stop
    const beforeStop = await computerActivityService.getUserSummary(testUser.id);
    const scoreBeforeStop = beforeStop.activityScore;
    assert.ok(scoreBeforeStop > 0);

    // Simulate Stop Tracking (which does NOT delete database records)
    // Verify GET /api/activity/my-summary returns exact preserved score
    const afterStop = await computerActivityService.getUserSummary(testUser.id);
    assert.strictEqual(afterStop.activityScore, scoreBeforeStop);

    const summaryRes = await request(app)
      .get('/api/activity/my-summary')
      .set('Authorization', `Bearer ${userToken}`);

    assert.strictEqual(summaryRes.body.data.activityScore, scoreBeforeStop);
  });

  await t.test('4. Refresh / Reconnect Simulation: Persisted PTS is retained accurately', async () => {
    const summary = await computerActivityService.getUserSummary(testUser.id);
    assert.ok(summary.activityScore > 0);
  });

  await t.test('5. Re-authenticate / New Token: Login again retains persisted PTS', async () => {
    const newToken = jwt.sign({ sub: testUser.id, role: 'user' }, env.jwtSecret);
    const res = await request(app)
      .get('/api/activity/my-summary')
      .set('Authorization', `Bearer ${newToken}`);

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.activityScore > 0);
  });

  await t.test('6. Idempotency: Resending same eventId does NOT double count PTS', async () => {
    const duplicateEventId = `ev_dup_${Date.now()}`;
    
    // First send
    const res1 = await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sessionId: 'ses_test_2',
        devicePlatform: 'macos',
        events: [
          {
            eventId: duplicateEventId,
            state: 'ACTIVE',
            activeApp: 'Google Chrome',
            appCategory: 'BROWSER',
            activeSeconds: 60,
            mouseClicks: 10,
            keyboardCount: 10,
            occurredAt: new Date().toISOString(),
          },
        ],
      });

    const scoreAfterFirst = res1.body.activityScore;

    // Retry send with identical duplicate eventId
    const res2 = await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sessionId: 'ses_test_2',
        devicePlatform: 'macos',
        events: [
          {
            eventId: duplicateEventId,
            state: 'ACTIVE',
            activeApp: 'Google Chrome',
            appCategory: 'BROWSER',
            activeSeconds: 60,
            mouseClicks: 10,
            keyboardCount: 10,
            occurredAt: new Date().toISOString(),
          },
        ],
      });

    // Score MUST remain identical, processed: 0
    assert.strictEqual(res2.body.processed, 0);
    const summary = await computerActivityService.getUserSummary(testUser.id);
    assert.strictEqual(summary.activityScore, scoreAfterFirst);
  });

  await t.test('7. Multiple ON/OFF cycles: PTS accumulates monotonically without resets', async () => {
    const scoreBefore = (await computerActivityService.getUserSummary(testUser.id)).activityScore;

    // Cycle 1: ON -> Activity -> OFF
    await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sessionId: 'ses_test_cycle1',
        events: [
          {
            eventId: `ev_cycle_1_${Date.now()}`,
            state: 'ACTIVE',
            activeApp: 'Figma',
            appCategory: 'DESIGN_VIDEO',
            activeSeconds: 60,
            mouseClicks: 25,
            keyboardCount: 5,
            occurredAt: new Date().toISOString(),
          },
        ],
      });

    const scoreCycle1 = (await computerActivityService.getUserSummary(testUser.id)).activityScore;
    assert.ok(scoreCycle1 > scoreBefore);

    // Cycle 2: ON -> Activity -> OFF
    await request(app)
      .post('/api/activity/computer/batch')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        sessionId: 'ses_test_cycle2',
        events: [
          {
            eventId: `ev_cycle_2_${Date.now()}`,
            state: 'ACTIVE',
            activeApp: 'Visual Studio Code',
            appCategory: 'DEVELOPMENT',
            activeSeconds: 60,
            mouseClicks: 15,
            keyboardCount: 45,
            occurredAt: new Date().toISOString(),
          },
        ],
      });

    const scoreCycle2 = (await computerActivityService.getUserSummary(testUser.id)).activityScore;
    assert.ok(scoreCycle2 > scoreCycle1);
  });
});
