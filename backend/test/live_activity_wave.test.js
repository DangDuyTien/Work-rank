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
const liveActivityWaveService = require('../src/services/liveActivityWave.service');

test('Live Activity Wave - Ocean Realtime Engine Test Suite', async (t) => {
  let userA, userB, userC;
  let userAToken, userBToken;

  before(async () => {
    await ComputerActivityEvent.sync();
    await ComputerDailyStat.sync();

    const ts = Date.now();
    userA = await User.create({
      name: `Surfer Alex ${ts}`,
      email: `surfer_alex_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Lead Architect',
    });

    userB = await User.create({
      name: `Surfer Bob ${ts}`,
      email: `surfer_bob_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'Video Animator',
    });

    userC = await User.create({
      name: `Surfer Chloe ${ts}`,
      email: `surfer_chloe_${ts}@workrank.local`,
      passwordHash: 'hashedpassword',
      role: 'user',
      jobTitle: 'UI Designer',
    });

    userAToken = jwt.sign({ sub: userA.id, role: 'user' }, env.jwtSecret);
    userBToken = jwt.sign({ sub: userB.id, role: 'user' }, env.jwtSecret);
  });

  await t.test('1. Batch Arrival Updates Surfer Realtime Registry', async () => {
    // Record batch for User A: Active high intensity
    await computerActivityService.recordBatch(userA.id, {
      sessionId: 'session-alex',
      devicePlatform: 'macos',
      events: [
        {
          activeSeconds: 58,
          idleSeconds: 2,
          mouseClicks: 140,
          keyboardCount: 220,
          activeApp: 'Code',
          appCategory: 'DEVELOPMENT',
          state: 'ACTIVE',
        },
      ],
    });

    // Record batch for User B: Moderate activity
    await computerActivityService.recordBatch(userB.id, {
      sessionId: 'session-bob',
      devicePlatform: 'macos',
      events: [
        {
          activeSeconds: 40,
          idleSeconds: 20,
          mouseClicks: 30,
          keyboardCount: 45,
          activeApp: 'Adobe Premiere Pro',
          appCategory: 'DESIGN_VIDEO',
          state: 'ACTIVE',
        },
      ],
    });

    const snapshot = await liveActivityWaveService.getWaveSnapshot('today');
    assert.ok(snapshot, 'Snapshot must be generated');
    assert.ok(Array.isArray(snapshot.surfers), 'Surfers must be an array');
    assert.ok(snapshot.surfers.length >= 2, 'Should include both active users');

    const surferA = snapshot.surfers.find((s) => Number(s.userId) === Number(userA.id));
    const surferB = snapshot.surfers.find((s) => Number(s.userId) === Number(userB.id));

    assert.ok(surferA, 'Surfer A must be present in wave');
    assert.ok(surferB, 'Surfer B must be present in wave');
    assert.equal(surferA.activityState, 'ACTIVE');
    assert.equal(surferA.currentApp, 'Code');
    assert.equal(surferA.appCategory, 'DEVELOPMENT');
    assert.ok(surferA.intensity > 0.5, 'Surfer A intensity should be high (> 0.5)');

    // Surfer A had higher active ratio and interactions, so should have higher intensity than B
    assert.ok(surferA.intensity >= surferB.intensity, 'Surfer A intensity should be >= Surfer B intensity');
  });

  await t.test('2. Intensity Calculation: Purely deterministic from real metrics (No Math.random)', () => {
    const intensityHigh = liveActivityWaveService.calculateIntensity({
      activeSeconds: 60,
      idleSeconds: 0,
      mouseClicks: 120,
      keyboardCount: 180,
    });
    assert.ok(intensityHigh >= 0.8 && intensityHigh <= 1.0, `Expected high intensity in [0.8, 1.0], got ${intensityHigh}`);

    const intensityZero = liveActivityWaveService.calculateIntensity({
      activeSeconds: 0,
      idleSeconds: 60,
      mouseClicks: 0,
      keyboardCount: 0,
    });
    assert.equal(intensityZero, 0, 'Zero activity must produce 0 intensity');
  });

  await t.test('3. REST Endpoint GET /api/activity/wave/live returns formatted wave snapshot', async () => {
    const res = await request(app)
      .get('/api/activity/wave/live?period=today')
      .expect(200);

    assert.ok(res.body.success, 'Response should indicate success');
    assert.ok(res.body.data || res.body.surfers, 'Response should contain data');
    const data = res.body.data || res.body;
    assert.ok(data.timestamp, 'Snapshot should have timestamp');
    assert.ok(typeof data.activeSurfers === 'number', 'activeSurfers count');
    assert.ok(typeof data.idleSurfers === 'number', 'idleSurfers count');
    assert.ok(Array.isArray(data.surfers), 'surfers array');

    const foundA = data.surfers.find((s) => Number(s.userId) === Number(userA.id));
    assert.ok(foundA, 'Surfer A should be listed in REST response');
    assert.ok(foundA.rank >= 1, 'Rank must be a positive integer');
    assert.ok(typeof foundA.intensity === 'number', 'Intensity must be a number');
    assert.ok(typeof foundA.wavePosition === 'number', 'wavePosition must be in [0, 1]');
  });

  await t.test('4. Surfer Status Transitions: ACTIVE -> IDLE on inactivity', async () => {
    // Record batch for User C first
    await computerActivityService.recordBatch(userC.id, {
      sessionId: 'session-chloe',
      devicePlatform: 'macos',
      events: [
        {
          activeSeconds: 30,
          idleSeconds: 0,
          mouseClicks: 20,
          keyboardCount: 10,
          activeApp: 'Figma',
          appCategory: 'DESIGN_VIDEO',
          state: 'ACTIVE',
        },
      ],
    });

    // Simulate idle decay by advancing lastBatchAt to 2 minutes ago (> 75s threshold)
    const memC = liveActivityWaveService.surfersMemory.get(Number(userC.id));
    assert.ok(memC, 'User C should be in surfersMemory');
    memC.lastBatchAt = Date.now() - 120 * 1000;
    liveActivityWaveService.lastStatsFetchTime = 0; // force cache refresh

    const snapshot = await liveActivityWaveService.getWaveSnapshot('today');
    const surferC = snapshot.surfers.find((s) => Number(s.userId) === Number(userC.id));
    assert.ok(surferC, 'Surfer C must be present');
    assert.equal(surferC.activityState, 'IDLE', 'Surfer with last activity 2m ago should transition to IDLE');
    assert.ok(surferC.intensity < 0.5, 'Idle surfer intensity should decay towards 0');
  });
});
