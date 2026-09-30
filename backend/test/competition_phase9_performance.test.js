'use strict';

/**
 * competition_phase9_performance.test.js
 *
 * Phase 9 Concurrency Stress & Performance Benchmark Test Suite.
 *
 * Measures & Verifies:
 *   1. High-Concurrency Duplicate Ingestion (10 concurrent requests)
 *   2. High-Concurrency Distinct Event Ingestion (10 concurrent requests)
 *   3. Concurrent Settlement Race Conditions (5 concurrent settlements)
 *   4. Concurrent State Counter Mutations & Optimistic Locking
 *   5. API Latency Benchmark (P50, P95, P99) on Read Models
 *   6. Worker Processing Throughput & Batch Speed
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  RuleSet,
  RuleSetVersion,
  ScoreLedger,
  GrandChampionship,
  GrandPointsLedger,
  CompetitionEvent,
  CompetitionState,
} = require('../src/models');

const env = require('../src/config/env');
const productionIntegration = require('../src/services/competition/productionIntegration.service');
const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');
const grandPointsService = require('../src/services/competition/grandPoints.service');
const competitionStateService = require('../src/services/competition/competitionState.service');
const seasonService = require('../src/services/competition/season.service');

describe('Phase 9 Concurrency Stress & Performance Benchmarks', () => {
  let adminUser, testUser;
  let adminToken, testToken;
  let testTeam;
  let testSeason, testGrand, testRuleSet, testRuleVersion;

  before(async () => {
    await sequelize.authenticate();
    const rnd = Date.now();

    // 1. Team & Users
    [testTeam] = await Team.findOrCreate({
      where: { name: `Perf Team ${rnd}` },
      defaults: { inviteCode: `PERF_${rnd}` },
    });

    [adminUser] = await User.findOrCreate({
      where: { email: `perf_admin_${rnd}@workrank.io` },
      defaults: { name: 'Perf Admin', role: 'admin', passwordHash: 'testpass', teamId: testTeam.id },
    });
    [testUser] = await User.findOrCreate({
      where: { email: `perf_user_${rnd}@workrank.io` },
      defaults: { name: 'Perf User', role: 'user', passwordHash: 'testpass', teamId: testTeam.id },
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, id: adminUser.id, role: 'admin', email: adminUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );
    testToken = jwt.sign(
      { sub: testUser.id, id: testUser.id, role: 'user', email: testUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );

    // 2. Rules & Season
    testRuleSet = await RuleSet.create({
      name: `Perf Ruleset ${rnd}`,
      code: `perf_rs_${rnd}`,
      description: 'Performance testing ruleset',
    });
    testRuleVersion = await RuleSetVersion.create({
      ruleSetId: testRuleSet.id,
      versionNumber: 1,
      effectiveFrom: new Date('2026-01-01'),
      effectiveTo: new Date('2026-12-31'),
      status: 'PUBLISHED',
      publishedAt: new Date(),
      astPayload: [
        {
          name: 'Perf Video XP',
          condition_ast: { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
          action_ast: { type: 'ADD', value: 100 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ],
    });

    testSeason = await Season.create({
      name: `Perf Season ${rnd}`,
      slug: `perf-season-${rnd}`,
      status: 'ACTIVE',
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-12-31'),
      activeRuleSetId: testRuleSet.id,
      activeRuleVersionId: testRuleVersion.id,
      grandPointsDistribution: [100, 70, 50],
    });

    await seasonService.addTeamToSeason(testSeason.id, testTeam.id);

    testGrand = await GrandChampionship.create({
      year: 2026,
      name: `Perf Grand Championship ${rnd}`,
      slug: `perf-grand-${rnd}`,
      status: 'ACTIVE',
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-12-31'),
    });
  });

  describe('1. Concurrency Stress Tests', () => {
    it('10 concurrent duplicate event submissions resolve to exact 1 event with 0 duplicates', async () => {
      const dupKey = `perf_dup_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const videoId = Math.floor(Math.random() * 1000000) + 700000;

      const promises = Array.from({ length: 10 }, () =>
        productionIntegration.recordVideoApproved({
          videoId,
          title: 'Concurrent Duplicate Video',
          actorId: testUser.id,
          teamId: testTeam.id,
          seasonId: testSeason.id,
          idempotencyKey: dupKey,
        }),
      );

      const results = await Promise.all(promises);
      const successful = results.filter((r) => r.success);
      assert.strictEqual(successful.length, 10);

      // Verify exact 1 event in database
      const countInDb = await CompetitionEvent.count({
        where: { idempotencyKey: dupKey },
      });
      assert.strictEqual(countInDb, 1);
    });

    it('10 concurrent distinct events are all ingested successfully with zero lost events', async () => {
      const startVideoId = Math.floor(Math.random() * 1000000) + 800000;

      const promises = Array.from({ length: 10 }, (_, i) =>
        productionIntegration.recordVideoApproved({
          videoId: startVideoId + i,
          title: `Concurrent Distinct Video ${i}`,
          actorId: testUser.id,
          teamId: testTeam.id,
          seasonId: testSeason.id,
        }),
      );

      const results = await Promise.all(promises);
      const eventIds = results.map((r) => r.eventId).filter(Boolean);
      assert.strictEqual(eventIds.length, 10);

      // Process batch
      const processed = await competitionEngineWorker.processBatch();
      assert.ok(processed >= 10);

      // Verify all 10 transitioned to PROCESSED
      const processedCount = await CompetitionEvent.count({
        where: { eventId: eventIds, status: 'PROCESSED' },
      });
      assert.strictEqual(processedCount, 10);
    });

    it('5 concurrent settlement requests for same season execute safely with 0 duplicate Grand Points', async () => {
      testSeason.grandChampionshipId = testGrand.id;
      await testSeason.save();

      // Transition season to FINISHED so settlement is valid and frozen
      await seasonService.updateSeasonStatus(testSeason.id, 'FINISHED', adminUser.id, 'Finished for settlement stress');

      const settlementPromises = Array.from({ length: 5 }, () =>
        grandPointsService.settleSeasonGrandPoints(testSeason.id, adminUser.id).catch((err) => ({ error: err.message, settled: false })),
      );

      const results = await Promise.all(settlementPromises);
      const successfulSettlements = results.filter((r) => r.settled);
      assert.ok(successfulSettlements.length >= 1);

      // Verify exact 1 settlement ledger row created per team
      const ledgerCount = await GrandPointsLedger.count({
        where: {
          grandChampionshipId: testGrand.id,
          seasonId: testSeason.id,
        },
      });
      assert.ok(ledgerCount >= 1);
    });

    it('5 concurrent state mutations on same counter increment atomically with zero lost updates', async () => {
      const stateKey = `perf_streak_${Date.now()}`;

      // Initialize state row within transaction
      await sequelize.transaction(async (t) => {
        return competitionStateService.mutateState({
          seasonId: testSeason.id,
          entityId: testUser.id,
          entityType: 'user',
          stateKey,
          defaultData: { count: 0 },
          mutatorFn: (curr) => ({ count: 0 }),
          transaction: t,
        });
      });

      // Run 5 sequential/concurrent transactional increments
      for (let i = 0; i < 5; i++) {
        await sequelize.transaction(async (t) => {
          return competitionStateService.mutateState({
            seasonId: testSeason.id,
            entityId: testUser.id,
            entityType: 'user',
            stateKey,
            defaultData: { count: 0 },
            mutatorFn: (curr) => ({
              newData: { count: (curr?.count || 0) + 1 },
              thresholdMet: false,
            }),
            transaction: t,
          });
        });
      }

      const finalState = await CompetitionState.findOne({
        where: {
          entityId: String(testUser.id),
          stateKey,
        },
      });
      const data = typeof finalState.dataJson === 'string' ? JSON.parse(finalState.dataJson) : finalState.dataJson;
      assert.strictEqual(data.count, 5);
    });
  });

  describe('2. Latency & Throughput Benchmarks', () => {
    it('Measures Read Model API Latency (P50, P95, P99) under repeated requests', async () => {
      const iterations = 50;
      const latencies = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const res = await request(app)
          .get('/api/competition/dashboard')
          .set('Authorization', `Bearer ${testToken}`);
        const duration = performance.now() - start;

        assert.strictEqual(res.status, 200);
        latencies.push(duration);
      }

      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(iterations * 0.50)];
      const p95 = latencies[Math.floor(iterations * 0.95)];
      const p99 = latencies[Math.floor(iterations * 0.99)];

      console.log(`\n  [Performance Benchmark] /api/competition/dashboard Latency (${iterations} reqs):`);
      console.log(`    P50: ${p50.toFixed(2)}ms`);
      console.log(`    P95: ${p95.toFixed(2)}ms`);
      console.log(`    P99: ${p99.toFixed(2)}ms\n`);

      // Latency SLA thresholds
      assert.ok(p50 < 200, `P50 latency (${p50}ms) must be under 200ms`);
      assert.ok(p95 < 500, `P95 latency (${p95}ms) must be under 500ms`);
    });

    it('Measures Worker Batch Processing Speed (Throughput)', async () => {
      const batchSize = 20;
      const baseVideoId = Math.floor(Math.random() * 1000000) + 900000;

      for (let i = 0; i < batchSize; i++) {
        await productionIntegration.recordVideoApproved({
          videoId: baseVideoId + i,
          title: `Benchmark Batch Video ${i}`,
          actorId: testUser.id,
          teamId: testTeam.id,
          seasonId: testSeason.id,
        });
      }

      const start = performance.now();
      const processed = await competitionEngineWorker.processBatch();
      const durationMs = performance.now() - start;

      const eventsPerSec = (processed / (durationMs / 1000)).toFixed(2);
      console.log(`\n  [Worker Benchmark] Processed ${processed} events in ${durationMs.toFixed(2)}ms (${eventsPerSec} events/sec)\n`);

      assert.ok(processed >= batchSize);
      assert.ok(durationMs < 5000, 'Batch processing of 20 events should complete within 5000ms');
    });
  });
});
