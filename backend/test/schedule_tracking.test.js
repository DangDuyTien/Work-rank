'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');

const { isWithinWorkingSchedule, getTrackingState, getVietnamTimeParts } = require('../src/utils/schedule');
const { User, ComputerDailyStat, ComputerActivityEvent } = require('../src/models');
const computerActivityService = require('../src/services/computerActivity.service');

describe('Autonomous Schedule & Activity Tracking (08:00 - 17:30 Asia/Ho_Chi_Minh)', () => {
  let testUser = null;
  const uniqueEmail = `sched_test_${Date.now()}@workrank.test`;

  before(async () => {
    testUser = await User.create({
      name: 'Schedule Test User',
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

  describe('1. Timezone & Schedule Boundary Tests (Asia/Ho_Chi_Minh)', () => {
    test('should correctly parse Vietnam time parts', () => {
      // 2026-10-02T01:30:00.000Z is 08:30:00 in UTC+7 (Asia/Ho_Chi_Minh)
      const dateUtc = new Date('2026-10-02T01:30:00.000Z');
      const parts = getVietnamTimeParts(dateUtc);
      assert.strictEqual(parts.hours, 8);
      assert.strictEqual(parts.minutes, 30);
      assert.strictEqual(parts.dateStr, '2026-10-02');
    });

    test('should return FALSE for 07:59 (outside schedule)', () => {
      // 2026-10-02T00:59:00.000Z = 07:59:00 VN
      const d = new Date('2026-10-02T00:59:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d), false);
    });

    test('should return TRUE for 08:00 (inside schedule start)', () => {
      // 2026-10-02T01:00:00.000Z = 08:00:00 VN
      const d = new Date('2026-10-02T01:00:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d), true);
    });

    test('should return TRUE for 12:00 (mid-day work hours)', () => {
      // 2026-10-02T05:00:00.000Z = 12:00:00 VN
      const d = new Date('2026-10-02T05:00:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d), true);
    });

    test('should return TRUE for 17:29:59 (inside schedule end margin)', () => {
      // 2026-10-02T10:29:59.000Z = 17:29:59 VN
      const d = new Date('2026-10-02T10:29:59.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d), true);
    });

    test('should return FALSE for 17:30:00 (strictly outside schedule)', () => {
      // 2026-10-02T10:30:00.000Z = 17:30:00 VN
      const d = new Date('2026-10-02T10:30:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d), false);
    });

    test('should return FALSE for 18:00 and 23:00 (evening outside schedule)', () => {
      // 2026-10-02T11:00:00.000Z = 18:00:00 VN
      const d18 = new Date('2026-10-02T11:00:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d18), false);

      // 2026-10-02T16:00:00.000Z = 23:00:00 VN
      const d23 = new Date('2026-10-02T16:00:00.000Z');
      assert.strictEqual(isWithinWorkingSchedule(d23), false);
    });

    test('should return TRACKING_LOGGED_OUT when user is not logged in', () => {
      const state = getTrackingState({ isLoggedIn: false, isWebOpen: true });
      assert.strictEqual(state, 'TRACKING_LOGGED_OUT');
    });

    test('should return TRACKING_WEB_CLOSED when web is not open', () => {
      const state = getTrackingState({ isLoggedIn: true, isWebOpen: false });
      assert.strictEqual(state, 'TRACKING_WEB_CLOSED');
    });

    test('should return TRACKING_OUTSIDE_SCHEDULE outside 08:00 - 17:30', () => {
      // 2026-10-02T11:00:00.000Z = 18:00:00 VN
      const eveningDate = new Date('2026-10-02T11:00:00.000Z');
      const state = getTrackingState({ isLoggedIn: true, isWebOpen: true, date: eveningDate });
      assert.strictEqual(state, 'TRACKING_OUTSIDE_SCHEDULE');
    });

    test('should return TRACKING_ACTIVE when logged in, web open, and inside 08:00 - 17:30', () => {
      // 2026-10-02T03:00:00.000Z = 10:00:00 VN
      const morningDate = new Date('2026-10-02T03:00:00.000Z');
      const state = getTrackingState({ isLoggedIn: true, isWebOpen: true, date: morningDate });
      assert.strictEqual(state, 'TRACKING_ACTIVE');
    });
  });

  describe('2. Backend Activity Ingestion & Schedule Filtering', () => {
    test('should ingest events occurring INSIDE schedule (08:00 - 17:30) and award PTS', async () => {
      // 10:15 VN time (03:15 UTC)
      const validTime = '2026-10-02T03:15:00.000Z';
      const eventId = `sched_in_${Date.now()}`;

      const result = await computerActivityService.recordBatch(testUser.id, {
        sessionId: 'test_ses_sched_1',
        devicePlatform: 'macos',
        events: [
          {
            eventId,
            state: 'ACTIVE',
            activeApp: 'WorkRank Test',
            appCategory: 'DEVELOPMENT',
            context: 'COMPUTER',
            activeSeconds: 10,
            idleSeconds: 0,
            mouseClicks: 5,
            keyboardCount: 15,
            localPoints: 20,
            occurredAt: validTime,
          },
        ],
      });

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.processed, 1);
      assert.deepStrictEqual(result.acceptedEventIds, [eventId]);
      assert.strictEqual(result.activityScore, 20);
      assert.strictEqual(result.serverPts, 20);
      assert.strictEqual(result.mouseClicks, 5);
      assert.strictEqual(result.keyboardCount, 15);
      assert.ok(result.serverSchedule);
      assert.strictEqual(result.serverSchedule.timezone, 'Asia/Ho_Chi_Minh');
      assert.strictEqual(result.serverSchedule.startHour, 8);
      assert.strictEqual(result.serverSchedule.endHour, 17);
      assert.strictEqual(result.serverSchedule.endMinute, 30);
    });

    test('should DROP events occurring OUTSIDE schedule (e.g. 19:00 VN time) while still ACKing the eventId', async () => {
      // 19:00 VN time = 12:00 UTC
      const outsideTime = '2026-10-02T12:00:00.000Z';
      const eventId = `sched_out_${Date.now()}`;

      const result = await computerActivityService.recordBatch(testUser.id, {
        sessionId: 'test_ses_sched_2',
        devicePlatform: 'macos',
        events: [
          {
            eventId,
            state: 'ACTIVE',
            activeApp: 'WorkRank Test',
            appCategory: 'DEVELOPMENT',
            context: 'COMPUTER',
            activeSeconds: 30,
            idleSeconds: 0,
            mouseClicks: 100,
            keyboardCount: 200,
            localPoints: 300,
            occurredAt: outsideTime,
          },
        ],
      });

      assert.strictEqual(result.success, true);
      // Outside schedule events are filtered out -> processed = 0
      assert.strictEqual(result.processed, 0);
      // But acceptedEventIds contains eventId so client pending buffer does not get stuck
      assert.deepStrictEqual(result.acceptedEventIds, [eventId]);
      // Score remains at 20 from previous test (no 300 points added!)
      assert.strictEqual(result.activityScore, 20);
      assert.strictEqual(result.serverPts, 20);
      assert.strictEqual(result.mouseClicks, 5);
      assert.strictEqual(result.keyboardCount, 15);
    });

    test('should return server schedule metadata on getUserSummary', async () => {
      const summary = await computerActivityService.getUserSummary(testUser.id);

      assert.ok(summary.serverSchedule);
      assert.strictEqual(summary.serverSchedule.timezone, 'Asia/Ho_Chi_Minh');
      assert.strictEqual(summary.serverSchedule.startHour, 8);
      assert.strictEqual(summary.serverSchedule.startMinute, 0);
      assert.strictEqual(summary.serverSchedule.endHour, 17);
      assert.strictEqual(summary.serverSchedule.endMinute, 30);
      assert.strictEqual(summary.serverSchedule.workingHours, '08:00 - 17:30');
      assert.ok(typeof summary.trackingState === 'string');
      assert.strictEqual(summary.activityScore, 20);
    });
  });
});
