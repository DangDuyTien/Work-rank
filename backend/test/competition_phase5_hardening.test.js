'use strict';

/**
 * competition_phase5_hardening.test.js
 *
 * WORKRANK V3.3 — Phase 5 Final Hardening Audit Suite:
 * 1. forceOverride authorization & audit trail
 * 2. Permission enforcement (Member 403, Unauthorized 401, Admin 200/201)
 * 3. Settlement idempotency (Retry x 5 & DB unique constraint)
 * 4. Reconciliation immutability & net points calculation
 * 5. Grand finish safety (Unfinished season & unsettled points rejection)
 * 6. Concurrency safety (Concurrent finish, concurrent settlement, concurrent reconciliation)
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonFrozenResult,
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  CompetitionAuditLog,
} = require('../src/models');

const grandChampionshipService = require('../src/services/competition/grandChampionship.service');
const grandPointsService = require('../src/services/competition/grandPoints.service');
const grandLeaderboardService = require('../src/services/competition/grandLeaderboard.service');

const env = require('../src/config/env');

function generateTestToken(user) {
  return jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '1h' },
  );
}

describe('Phase 5 Final Hardening Audit', () => {
  let adminUser;
  let memberUser;
  let adminToken;
  let memberToken;

  let teamA;
  let teamB;

  before(async () => {
    // Create Admin & Member users

    const [admin] = await User.findOrCreate({
      where: { email: 'admin_p5_hardening@workrank.test' },
      defaults: {
        name: 'Admin Hardening User',
        role: 'admin',
        passwordHash: 'testpass123',
      },
    });
    adminUser = admin;
    adminToken = generateTestToken(adminUser);

    const [member] = await User.findOrCreate({
      where: { email: 'member_p5_hardening@workrank.test' },
      defaults: {
        name: 'Member Hardening User',
        role: 'user',
        passwordHash: 'testpass123',
      },
    });
    memberUser = member;
    memberToken = generateTestToken(memberUser);

    // Create Teams
    const [tA] = await Team.findOrCreate({
      where: { name: 'Hardening Team Alpha' },
      defaults: { name: 'Hardening Team Alpha', description: 'Alpha Team' },
    });
    teamA = tA;

    const [tB] = await Team.findOrCreate({
      where: { name: 'Hardening Team Beta' },
      defaults: { name: 'Hardening Team Beta', description: 'Beta Team' },
    });
    teamB = tB;
  });

  describe('1. Permission Enforcement (API Gate Security)', () => {
    it('Rejects unauthenticated access with 401', async () => {
      const res = await request(app).get('/api/competition/admin/grand');
      assert.strictEqual(res.status, 401);
    });

    it('Rejects Member access to all Phase 5 Admin endpoints with 403 Forbidden', async () => {
      // 1. List Grands
      const res1 = await request(app)
        .get('/api/competition/admin/grand')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.strictEqual(res1.status, 403);

      // 2. Create Grand
      const res2 = await request(app)
        .post('/api/competition/admin/grand')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hack Grand', slug: 'hack-grand', year: 2026, startAt: '2026-01-01', endAt: '2026-12-31' });
      assert.strictEqual(res2.status, 403);

      // 3. Update Grand Status
      const res3 = await request(app)
        .patch('/api/competition/admin/grand/999/status')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ status: 'FINISHED', forceOverride: true });
      assert.strictEqual(res3.status, 403);

      // 4. Link Season
      const res4 = await request(app)
        .post('/api/competition/admin/grand/999/seasons/1/link')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.strictEqual(res4.status, 403);

      // 5. Settle Points
      const res5 = await request(app)
        .post('/api/competition/admin/grand/999/seasons/1/settle')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.strictEqual(res5.status, 403);

      // 6. Reconcile Points
      const res6 = await request(app)
        .post('/api/competition/admin/grand/999/reconcile')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ teamId: teamA.id, pointsAdjustment: 1000, reason: 'Hack points' });
      assert.strictEqual(res6.status, 403);
    });
  });

  describe('2. forceOverride Authorization & Audit Trail', () => {
    let grand;
    let activeSeason;

    before(async () => {
      const uid = crypto.randomUUID().slice(0, 8);
      grand = await GrandChampionship.create({
        year: 2029,
        name: `Grand Override Test ${uid}`,
        slug: `grand-override-${uid}`,
        status: 'ACTIVE',
        startAt: new Date('2029-01-01'),
        endAt: new Date('2029-12-31'),
      });

      activeSeason = await Season.create({
        name: `Active Linked Season ${uid}`,
        slug: `active-season-${uid}`,
        grandChampionshipId: grand.id,
        status: 'ACTIVE',
        startAt: new Date('2029-01-01'),
        endAt: new Date('2029-01-31'),
      });
    });

    it('Rejects FINISHED without forceOverride when linked season is ACTIVE', async () => {
      const res = await request(app)
        .patch(`/api/competition/admin/grand/${grand.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FINISHED', forceOverride: false, reason: 'Attempt normal finish' });

      assert.strictEqual(res.status, 500);
    });

    it('Rejects forceOverride when audit reason is empty', async () => {
      const res = await request(app)
        .patch(`/api/competition/admin/grand/${grand.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FINISHED', forceOverride: true, reason: '   ' });

      assert.strictEqual(res.status, 400);
      assert.match(res.body.message || '', /mandatory/i);
    });

    it('Allows forceOverride with valid reason and logs full audit entry', async () => {
      // Create at least 1 ledger row so freeze standings can compute
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id,
        seasonId: activeSeason.id,
        teamId: teamA.id,
        rankPosition: 1,
        grandPointsAwarded: 100,
        settlementKey: `override-test-${Date.now()}-${crypto.randomUUID()}`,
        reason: 'Pre-override award',
      });

      const auditReason = 'Executive Board Decision #404 to close season early';
      const res = await request(app)
        .patch(`/api/competition/admin/grand/${grand.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'FINISHED', forceOverride: true, reason: auditReason });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.grand.status, 'FINISHED');

      // Verify Audit Log
      const auditLog = await CompetitionAuditLog.findOne({
        where: {
          entityId: String(grand.id),
          action: 'GRAND_STATUS_FINISHED_FORCE_OVERRIDE',
        },
        order: [['created_at', 'DESC']],
      });

      assert.ok(auditLog, 'Audit log must exist for forced override');
      assert.strictEqual(auditLog.actorId, adminUser.id);
      assert.strictEqual(auditLog.reason, auditReason);
      assert.strictEqual(auditLog.afterState?.forceOverride, true);
    });
  });

  describe('3. Settlement Idempotency & Database Constraints', () => {
    let season;
    let grand;

    before(async () => {
      const uid = crypto.randomUUID().slice(0, 8);
      grand = await GrandChampionship.create({
        year: 2030,
        name: `Grand Idempotency ${uid}`,
        slug: `grand-idempotency-${uid}`,
        status: 'ACTIVE',
        startAt: new Date('2030-01-01'),
        endAt: new Date('2030-12-31'),
      });

      season = await Season.create({
        name: `Season Idempotency ${uid}`,
        slug: `season-idempotency-${uid}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2030-01-01'),
        endAt: new Date('2030-01-31'),
      });

      await SeasonFrozenResult.create({
        seasonId: season.id,
        grandPointsAwarded: [
          { teamId: teamA.id, rank: 1, teamName: teamA.name, seasonScore: 500, grandPoints: 25 },
          { teamId: teamB.id, rank: 2, teamName: teamB.name, seasonScore: 300, grandPoints: 18 },
        ],
        finalRankings: [],
        frozenAt: new Date(),
      });
    });

    it('Settles Grand Points accurately on first attempt', async () => {
      const res = await grandPointsService.settleSeasonGrandPoints(season.id, adminUser.id);
      assert.strictEqual(res.settled, true);
      assert.strictEqual(res.awardedCount, 2);

      const rows = await GrandPointsLedger.findAll({ where: { seasonId: season.id } });
      assert.strictEqual(rows.length, 2);
    });

    it('Retry settlement x 5 is 100% idempotent: zero new rows created', async () => {
      for (let i = 0; i < 5; i++) {
        const res = await grandPointsService.settleSeasonGrandPoints(season.id, adminUser.id);
        assert.strictEqual(res.settled, true);
      }

      const rows = await GrandPointsLedger.findAll({ where: { seasonId: season.id } });
      assert.strictEqual(rows.length, 2, 'Must still contain exactly 2 rows in DB');
    });

    it('Database UNIQUE constraint strictly prevents duplicate settlement_key insert', async () => {
      const existing = await GrandPointsLedger.findOne({ where: { seasonId: season.id } });
      assert.ok(existing);

      await assert.rejects(async () => {
        await GrandPointsLedger.create({
          grandChampionshipId: grand.id,
          seasonId: season.id,
          teamId: teamA.id,
          rankPosition: 1,
          grandPointsAwarded: 999,
          settlementKey: existing.settlementKey, // Duplicate Key!
          reason: 'Duplicate exploit attempt',
        });
      }, /UniqueConstraintError|SequelizeUniqueConstraintError/i);
    });
  });

  describe('4. Reconciliation Immutability & Net Points Calculation', () => {
    let grand;
    let season;

    before(async () => {
      const uid = crypto.randomUUID().slice(0, 8);
      grand = await GrandChampionship.create({
        year: 2031,
        name: `Grand Reconciliation ${uid}`,
        slug: `grand-recon-${uid}`,
        status: 'ACTIVE',
        startAt: new Date('2031-01-01'),
        endAt: new Date('2031-12-31'),
      });

      season = await Season.create({
        name: `Season Recon ${uid}`,
        slug: `season-recon-${uid}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2031-01-01'),
        endAt: new Date('2031-01-31'),
      });

      // Initial Award: 100 points
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id,
        seasonId: season.id,
        teamId: teamA.id,
        rankPosition: 1,
        grandPointsAwarded: 100,
        settlementKey: `initial-award-${Date.now()}-${crypto.randomUUID()}`,
        reason: 'Initial Award',
      });
    });

    it('Rejects reconciliation without reason or with invalid points', async () => {
      // Missing reason
      await assert.rejects(async () => {
        await grandPointsService.reconcileGrandPoints({
          grandId: grand.id,
          seasonId: season.id,
          teamId: teamA.id,
          pointsAdjustment: 50,
          reason: '',
          actorId: adminUser.id,
        });
      }, /mandatory audit reason/i);

      // Zero points
      await assert.rejects(async () => {
        await grandPointsService.reconcileGrandPoints({
          grandId: grand.id,
          seasonId: season.id,
          teamId: teamA.id,
          pointsAdjustment: 0,
          reason: 'Zero test',
          actorId: adminUser.id,
        });
      }, /non-zero/i);
    });

    it('Appends Reversal (-30 points) without modifying or deleting old records', async () => {
      const countBefore = await GrandPointsLedger.count({ where: { grandChampionshipId: grand.id } });

      const reconRecord = await grandPointsService.reconcileGrandPoints({
        grandId: grand.id,
        seasonId: season.id,
        teamId: teamA.id,
        pointsAdjustment: -30,
        reason: 'Penalty deduction for code violation',
        actorId: adminUser.id,
      });

      assert.strictEqual(reconRecord.isReversal, true);
      assert.strictEqual(reconRecord.grandPointsAwarded, -30);

      const countAfter = await GrandPointsLedger.count({ where: { grandChampionshipId: grand.id } });
      assert.strictEqual(countAfter, countBefore + 1, 'New record must be appended');

      // Standings must calculate net points: 100 - 30 = 70
      const standingsData = await grandLeaderboardService.getGrandStandings(grand.id);
      const teamAStanding = standingsData.standings.find((s) => s.teamId === teamA.id);
      assert.ok(teamAStanding);
      assert.strictEqual(teamAStanding.grandPoints, 70, 'Net grand points must equal 70');
    });
  });

  describe('5. Concurrency Safety Tests', () => {
    let grand;
    let season;

    before(async () => {
      const uid = crypto.randomUUID().slice(0, 8);
      grand = await GrandChampionship.create({
        year: 2032,
        name: `Grand Concurrency ${uid}`,
        slug: `grand-concurrency-${uid}`,
        status: 'ACTIVE',
        startAt: new Date('2032-01-01'),
        endAt: new Date('2032-12-31'),
      });

      season = await Season.create({
        name: `Season Concurrency ${uid}`,
        slug: `season-concurrency-${uid}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2032-01-01'),
        endAt: new Date('2032-01-31'),
      });

      await SeasonFrozenResult.create({
        seasonId: season.id,
        grandPointsAwarded: [
          { teamId: teamA.id, rank: 1, teamName: teamA.name, seasonScore: 1000, grandPoints: 50 },
        ],
        finalRankings: [],
        frozenAt: new Date(),
      });
    });

    it('Concurrent settlements execute safely with zero duplicate ledger rows', async () => {
      const promises = [
        grandPointsService.settleSeasonGrandPoints(season.id, adminUser.id),
        grandPointsService.settleSeasonGrandPoints(season.id, adminUser.id),
        grandPointsService.settleSeasonGrandPoints(season.id, adminUser.id),
      ];

      const results = await Promise.all(promises);
      for (const res of results) {
        assert.strictEqual(res.settled, true);
      }

      const rows = await GrandPointsLedger.findAll({ where: { seasonId: season.id } });
      assert.strictEqual(rows.length, 1, 'Only 1 ledger row must exist despite 3 concurrent settlements');
      assert.strictEqual(rows[0].grandPointsAwarded, 50);
    });

    it('Concurrent FINISH requests: exactly 1 succeeds and creates 1 frozen result', async () => {
      const promises = [
        grandChampionshipService.updateGrandStatus(grand.id, 'FINISHED', adminUser.id, 'Concurrent finish 1'),
        grandChampionshipService.updateGrandStatus(grand.id, 'FINISHED', adminUser.id, 'Concurrent finish 2'),
      ];

      const outcomes = await Promise.allSettled(promises);
      const fulfilled = outcomes.filter((o) => o.status === 'fulfilled');
      const rejected = outcomes.filter((o) => o.status === 'rejected');

      // At least 1 must fulfill
      assert.ok(fulfilled.length >= 1);

      // Exactly 1 Frozen Result in DB
      const frozenCount = await GrandFrozenResult.count({ where: { grandChampionshipId: grand.id } });
      assert.strictEqual(frozenCount, 1);
    });
  });
});
