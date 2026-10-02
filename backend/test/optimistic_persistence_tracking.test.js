'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const { User, ComputerDailyStat, ComputerActivityEvent } = require('../src/models');
const computerActivityService = require('../src/services/computerActivity.service');

function getWorkHourIso() {
  const d = new Date();
  // Set to 10:00:00 VN Time = 03:00:00 UTC (well within 08:00 - 17:30 schedule)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3, 0, 0)).toISOString();
}

describe('Optimistic Local + Server Persistence End-to-End Suite', () => {
  let testUser = null;
  const uniqueEmail = `opt_test_${Date.now()}@workrank.test`;

  before(async () => {
    testUser = await User.create({
      name: 'Optimistic Test User',
      email: uniqueEmail,
      passwordHash: 'dummy_hash',
      role: 'user',
      status: 'active',
      isVerified: true,
    });
  });

  after(async () => {
    if (testUser) {
      await ComputerActivityEvent.destroy({ where: { userId: testUser.id } }).catch(() => {});
      await ComputerDailyStat.destroy({ where: { userId: testUser.id } }).catch(() => {});
      await testUser.destroy().catch(() => {});
    }
  });

  test('TEST 1 & 2: Batch Ingestion calculates canonical PTS and returns acceptedEventIds', async () => {
    const events = [
      {
        eventId: 'evt_test_001',
        state: 'ACTIVE',
        activeApp: 'VS Code',
        appCategory: 'DEVELOPMENT',
        context: 'COMPUTER',
        activeSeconds: 5,
        idleSeconds: 0,
        mouseClicks: 3,
        keyboardCount: 2,
        localPoints: 5,
        occurredAt: getWorkHourIso(),
      },
    ];

    const result = await computerActivityService.recordBatch(testUser.id, {
      sessionId: 'test_ses_1',
      devicePlatform: 'macos',
      events,
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.processed, 1);
    assert.deepStrictEqual(result.acceptedEventIds, ['evt_test_001']);
    assert.strictEqual(result.activityScore, 5);
    assert.strictEqual(result.serverPts, 5);
    assert.strictEqual(result.mouseClicks, 3);
    assert.strictEqual(result.keyboardCount, 2);
  });

  test('TEST 3 & 5: Idempotency & Deduplication — Resending already accepted event does NOT double count', async () => {
    // Resend same event 'evt_test_001' (simulate network retry)
    const retryEvents = [
      {
        eventId: 'evt_test_001',
        state: 'ACTIVE',
        activeApp: 'VS Code',
        appCategory: 'DEVELOPMENT',
        context: 'COMPUTER',
        activeSeconds: 5,
        idleSeconds: 0,
        mouseClicks: 3,
        keyboardCount: 2,
        localPoints: 5,
        occurredAt: getWorkHourIso(),
      },
    ];

    const retryResult = await computerActivityService.recordBatch(testUser.id, {
      sessionId: 'test_ses_1',
      devicePlatform: 'macos',
      events: retryEvents,
    });

    assert.strictEqual(retryResult.success, true);
    assert.strictEqual(retryResult.processed, 0); // 0 new events processed
    assert.deepStrictEqual(retryResult.acceptedEventIds, ['evt_test_001']); // Still accepted so client clears pending
    assert.strictEqual(retryResult.activityScore, 5); // Score remains 5, NOT 10!
    assert.strictEqual(retryResult.serverPts, 5);
  });

  test('TEST 8: Partial Batch with mix of new and duplicate events', async () => {
    const mixedEvents = [
      {
        eventId: 'evt_test_001', // duplicate
        state: 'ACTIVE',
        activeApp: 'VS Code',
        appCategory: 'DEVELOPMENT',
        context: 'COMPUTER',
        activeSeconds: 5,
        idleSeconds: 0,
        mouseClicks: 3,
        keyboardCount: 2,
        occurredAt: getWorkHourIso(),
      },
      {
        eventId: 'evt_test_002', // new
        state: 'ACTIVE',
        activeApp: 'Chrome',
        appCategory: 'BROWSER',
        context: 'WEB',
        activeSeconds: 10,
        idleSeconds: 0,
        mouseClicks: 10,
        keyboardCount: 20,
        occurredAt: getWorkHourIso(),
      },
    ];

    const mixedResult = await computerActivityService.recordBatch(testUser.id, {
      sessionId: 'test_ses_1',
      devicePlatform: 'macos',
      events: mixedEvents,
    });

    assert.strictEqual(mixedResult.success, true);
    assert.strictEqual(mixedResult.processed, 1); // Only 1 new event processed
    assert.strictEqual(mixedResult.acceptedEventIds.length, 2); // Both accepted
    assert.strictEqual(mixedResult.activityScore, 35); // 5 (initial) + 30 (new) = 35
    assert.strictEqual(mixedResult.mouseClicks, 13); // 3 + 10 = 13
    assert.strictEqual(mixedResult.keyboardCount, 22); // 2 + 20 = 22
  });

  test('TEST 9 & 10: Summary retrieval retains total score (Persistence check)', async () => {
    const summary = await computerActivityService.getUserSummary(testUser.id);
    assert.strictEqual(summary.activityScore, 35);
    assert.strictEqual(summary.mouseClicks, 13);
    assert.strictEqual(summary.keyboardCount, 22);
    assert.ok(summary.rank >= 1);
  });
});
