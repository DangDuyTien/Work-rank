'use strict';

/**
 * competition_phase4.test.js
 *
 * Phase 4 Backend Tests — Season Framework, Lifecycle, Snapshots, Rules, Late Events, Leaderboard
 *
 * Run: node --test test/competition_phase4.test.js
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const sequelize = require('../src/config/database');
const {
  Season,
  SeasonTeam,
  SeasonTeamMember,
  SeasonFrozenResult,
  RuleSet,
  RuleSetVersion,
  Team,
  User,
  ScoreLedger,
  Challenge,
  CompetitionAuditLog,
  GrandPointsLedger,
  GrandFrozenResult,
} = require('../src/models');

const seasonService = require('../src/services/competition/season.service');
const ruleSetService = require('../src/services/competition/ruleSet.service');
const seasonRuleResolver = require('../src/services/competition/seasonRuleResolver.service');
const challengeService = require('../src/services/competition/challenge.service');
const effectEngine = require('../src/services/competition/effectEngine.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanPhase4Tables() {
  await GrandFrozenResult.destroy({ where: {} });
  await GrandPointsLedger.destroy({ where: {} });
  await Challenge.destroy({ where: {} });
  await SeasonFrozenResult.destroy({ where: {} });
  await SeasonTeamMember.destroy({ where: {} });
  await SeasonTeam.destroy({ where: {} });
  await Season.destroy({ where: {} });
  await RuleSetVersion.destroy({ where: {} });
  await RuleSet.destroy({ where: {} });
  await ScoreLedger.destroy({ where: {} });
  await CompetitionAuditLog.destroy({ where: {} });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Phase 4 — Season Framework & Lifecycle', () => {
  let testTeamA;
  let testTeamB;
  let testUserA;
  let testUserB;

  before(async () => {
    await sequelize.authenticate();

    [testTeamA] = await Team.findOrCreate({ where: { name: 'P4 Team Phoenix' } });
    [testTeamB] = await Team.findOrCreate({ where: { name: 'P4 Team Dragon' } });

    [testUserA] = await User.findOrCreate({
      where: { email: 'p4_user_a@workrank.test' },
      defaults: { name: 'User A', email: 'p4_user_a@workrank.test', passwordHash: 'hash', role: 'user', teamId: testTeamA.id },
    });

    [testUserB] = await User.findOrCreate({
      where: { email: 'p4_user_b@workrank.test' },
      defaults: { name: 'User B', email: 'p4_user_b@workrank.test', passwordHash: 'hash', role: 'user', teamId: testTeamB.id },
    });
  });

  after(async () => {
    await cleanPhase4Tables();
    await sequelize.close();
  });

  beforeEach(async () => {
    await cleanPhase4Tables();
  });

  // ── 1. SEASON LIFECYCLE & STATE MACHINE ─────────────────────────────────────
  describe('Season Lifecycle & State Machine', () => {
    it('Creates Season in DRAFT state', async () => {
      const season = await seasonService.createSeason({
        name: 'October Championship',
        slug: 'october-championship',
        description: 'Test season',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
      });

      assert.equal(season.status, 'DRAFT');
      assert.equal(season.name, 'October Championship');
    });

    it('Transitions: DRAFT → SCHEDULED → ACTIVE → PAUSED → ACTIVE → CALCULATING → FINISHED', async () => {
      const season = await seasonService.createSeason({
        name: 'Lifecycle Test',
        slug: 'lifecycle-test',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
      });

      await seasonService.updateSeasonStatus(season.id, 'SCHEDULED', 1, 'Scheduled by admin');
      let s = await Season.findByPk(season.id);
      assert.equal(s.status, 'SCHEDULED');

      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1, 'Auto activated');
      s = await Season.findByPk(season.id);
      assert.equal(s.status, 'ACTIVE');

      await seasonService.updateSeasonStatus(season.id, 'PAUSED', 1, 'Hold for audit');
      s = await Season.findByPk(season.id);
      assert.equal(s.status, 'PAUSED');

      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1, 'Resume');
      s = await Season.findByPk(season.id);
      assert.equal(s.status, 'ACTIVE');

      await seasonService.updateSeasonStatus(season.id, 'CALCULATING', 1, 'Reviewing final late events');
      s = await Season.findByPk(season.id);
      assert.equal(s.status, 'CALCULATING');

      await seasonService.updateSeasonStatus(season.id, 'FINISHED', 1, 'Final freeze');
      s = await Season.findByPk(season.id);
      assert.equal(s.status, 'FINISHED');
    });

    it('Rejects invalid state transitions (e.g. FINISHED → ACTIVE, DRAFT → FINISHED)', async () => {
      const season = await seasonService.createSeason({
        name: 'Invalid Transition Test',
        slug: 'invalid-trans',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
      });

      // DRAFT → FINISHED is invalid
      await assert.rejects(
        () => seasonService.updateSeasonStatus(season.id, 'FINISHED', 1, 'Invalid'),
        /Invalid season transition/,
      );

      // Fast forward to FINISHED
      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1);
      await seasonService.updateSeasonStatus(season.id, 'FINISHED', 1);

      // FINISHED → ACTIVE is invalid
      await assert.rejects(
        () => seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1, 'Invalid'),
        /Invalid season transition/,
      );
    });
  });

  // ── 2. TEAM & MEMBER SNAPSHOTTING ──────────────────────────────────────────
  describe('Team & Member Snapshotting', () => {
    it('Snapshots team name, color, and members when added to season', async () => {
      const season = await seasonService.createSeason({
        name: 'Snapshot Test',
        slug: 'snapshot-test',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
      });

      const seasonTeam = await seasonService.addTeamToSeason(season.id, testTeamA.id, {
        color: '#f97316',
      });

      assert.equal(seasonTeam.teamNameSnapshot, 'P4 Team Phoenix');
      assert.equal(seasonTeam.teamColorSnapshot, '#f97316');

      const members = await SeasonTeamMember.findAll({ where: { seasonId: season.id, teamId: testTeamA.id } });
      assert.ok(members.length >= 1, 'Should snapshot team members');
      assert.equal(members[0].userId, testUserA.id);
    });
  });

  // ── 3. RULE SETS & RULE SET VERSIONS ───────────────────────────────────────
  describe('Rule Sets & Rule Versions', () => {
    it('Creates RuleSet and validated RuleSetVersion', async () => {
      const ruleSet = await ruleSetService.createRuleSet({
        name: 'Standard Quality Battle Rules',
        code: 'QUALITY_BATTLE_V1',
        description: 'Approved videos +100, rejected -50',
      });

      const validAst = [
        {
          condition_ast: null,
          action_ast: { type: 'ADD', value: 100 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ];

      const version = await ruleSetService.createRuleSetVersion(ruleSet.id, {
        versionNumber: 1,
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        effectiveTo: new Date('2026-10-15T00:00:00Z'),
        astPayload: validAst,
      });

      assert.equal(version.status, 'DRAFT');
      assert.equal(version.versionNumber, 1);

      const published = await ruleSetService.publishRuleSetVersion(version.id, 1);
      assert.equal(published.status, 'PUBLISHED');
      assert.ok(published.publishedAt);
    });

    it('Rejects invalid AST in RuleSetVersion', async () => {
      const ruleSet = await ruleSetService.createRuleSet({ name: 'Invalid AST', code: 'INVALID_AST' });

      const badAst = [
        {
          condition_ast: { op: 'UNKNOWN_OP', field: 'event.actor_id', value: 1 },
          action_ast: { type: 'ADD', value: 100 },
          effect_type: 'INDIVIDUAL_XP',
        },
      ];

      await assert.rejects(
        () => ruleSetService.createRuleSetVersion(ruleSet.id, {
          versionNumber: 1,
          effectiveFrom: new Date('2026-10-01T00:00:00Z'),
          astPayload: badAst,
        }),
        /Rule validation failed/,
      );
    });

    it('Rejects overlapping published version windows', async () => {
      const ruleSet = await ruleSetService.createRuleSet({ name: 'Overlap Test', code: 'OVERLAP_TEST' });
      const validAst = [{ condition_ast: null, action_ast: { type: 'ADD', value: 10 }, effect_type: 'INDIVIDUAL_XP' }];

      // Version 1: 2026-10-01 to 2026-10-15 (Published)
      const v1 = await ruleSetService.createRuleSetVersion(ruleSet.id, {
        versionNumber: 1,
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        effectiveTo: new Date('2026-10-15T00:00:00Z'),
        astPayload: validAst,
      });
      await ruleSetService.publishRuleSetVersion(v1.id, 1);

      // Version 2: 2026-10-10 to 2026-10-20 (Overlaps V1)
      await assert.rejects(
        () => ruleSetService.createRuleSetVersion(ruleSet.id, {
          versionNumber: 2,
          effectiveFrom: new Date('2026-10-10T00:00:00Z'),
          effectiveTo: new Date('2026-10-20T00:00:00Z'),
          astPayload: validAst,
        }),
        /overlaps with published version/,
      );
    });
  });

  // ── 4. SEASON RULE RESOLUTION & LATE EVENT POLICY ──────────────────────────
  describe('Season Rule Resolution & Late Event Policy', () => {
    let activeSeason;
    let ruleVersion;

    beforeEach(async () => {
      const ruleSet = await ruleSetService.createRuleSet({ name: 'Resolution RS', code: 'RESOLVE_RS' });
      ruleVersion = await ruleSetService.createRuleSetVersion(ruleSet.id, {
        versionNumber: 1,
        effectiveFrom: new Date('2026-10-01T00:00:00Z'),
        effectiveTo: new Date('2026-10-31T23:59:59Z'),
        astPayload: [{ condition_ast: null, action_ast: { type: 'ADD', value: 50 }, effect_type: 'INDIVIDUAL_XP' }],
      });
      await ruleSetService.publishRuleSetVersion(ruleVersion.id, 1);

      activeSeason = await seasonService.createSeason({
        name: 'Resolution Season',
        slug: 'resolution-season',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
        gracePeriodHours: 2,
        activeRuleSetId: ruleSet.id,
      });

      await seasonService.updateSeasonStatus(activeSeason.id, 'ACTIVE', 1);
    });

    it('On-time event: matches published rule version and is eligible', async () => {
      const res = await seasonRuleResolver.resolveSeasonRules({
        seasonId: activeSeason.id,
        occurredAt: '2026-10-15T12:00:00Z',
        receivedAt: '2026-10-15T12:00:05Z',
      });

      assert.equal(res.eligible, true);
      assert.equal(res.lateStatus, 'ON_TIME');
      assert.equal(res.ruleSetVersion.id, ruleVersion.id);
      assert.equal(res.rules.length, 1);
    });

    it('Late accepted event: occurred before end_at, received within grace period (2 hrs)', async () => {
      const res = await seasonRuleResolver.resolveSeasonRules({
        seasonId: activeSeason.id,
        occurredAt: '2026-10-31T23:50:00Z', // 10 min before end
        receivedAt: '2026-11-01T01:30:00Z', // 1.5 hours after end (within 2 hr grace)
      });

      assert.equal(res.eligible, true);
      assert.equal(res.lateStatus, 'LATE_ACCEPTED');
    });

    it('Late rejected event: occurred before end_at, but received after grace period expired', async () => {
      const res = await seasonRuleResolver.resolveSeasonRules({
        seasonId: activeSeason.id,
        occurredAt: '2026-10-31T23:50:00Z',
        receivedAt: '2026-11-01T03:00:00Z', // 3 hours after end (grace is 2 hrs)
      });

      assert.equal(res.eligible, false);
      assert.equal(res.lateStatus, 'LATE_REJECTED');
    });

    it('Outside season event: occurred after end_at', async () => {
      const res = await seasonRuleResolver.resolveSeasonRules({
        seasonId: activeSeason.id,
        occurredAt: '2026-11-01T00:05:00Z',
        receivedAt: '2026-11-01T00:05:01Z',
      });

      assert.equal(res.eligible, false);
      assert.equal(res.lateStatus, 'OUTSIDE_SEASON');
    });

    it('Paused season: hold event without score evaluation', async () => {
      await seasonService.updateSeasonStatus(activeSeason.id, 'PAUSED', 1, 'Audit hold');

      const res = await seasonRuleResolver.resolveSeasonRules({
        seasonId: activeSeason.id,
        occurredAt: '2026-10-15T12:00:00Z',
        receivedAt: '2026-10-15T12:00:01Z',
      });

      assert.equal(res.isPaused, true);
      assert.equal(res.hold, true);
      assert.equal(res.eligible, false);
    });
  });

  // ── 5. LEADERBOARD & FROZEN RESULTS ─────────────────────────────────────────
  describe('Leaderboard & Frozen Results', () => {
    it('Aggregates live team scores from ScoreLedger and freezes upon FINISHED', async () => {
      const season = await seasonService.createSeason({
        name: 'Leaderboard Season',
        slug: 'lb-season',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
        grandPointsDistribution: {
          distribution: [
            { rank: 1, points: 15 },
            { rank: 2, points: 8 },
          ],
        },
      });

      await seasonService.addTeamToSeason(season.id, testTeamA.id);
      await seasonService.addTeamToSeason(season.id, testTeamB.id);
      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1);

      // Team A earns 300 points
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), ruleVersionId: null, seasonId: season.id,
        effects: [{ targetType: 'TEAM', targetId: testTeamA.id, effectType: 'TEAM_SCORE', delta: 300, actionType: 'ADD' }],
        transaction: t,
      }));

      // Team B earns 500 points
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), ruleVersionId: null, seasonId: season.id,
        effects: [{ targetType: 'TEAM', targetId: testTeamB.id, effectType: 'TEAM_SCORE', delta: 500, actionType: 'ADD' }],
        transaction: t,
      }));

      // Live leaderboard check
      const liveLb = await seasonService.getSeasonLeaderboard(season.id);
      assert.equal(liveLb.isFrozen, false);
      assert.equal(liveLb.rankings[0].teamId, testTeamB.id); // 500 pts rank 1
      assert.equal(liveLb.rankings[0].score, 500);
      assert.equal(liveLb.rankings[1].teamId, testTeamA.id); // 300 pts rank 2
      assert.equal(liveLb.rankings[1].score, 300);

      // Finish season -> Freeze results
      await seasonService.updateSeasonStatus(season.id, 'FINISHED', 1, 'Final freeze');

      const frozenLb = await seasonService.getSeasonLeaderboard(season.id);
      assert.equal(frozenLb.isFrozen, true);
      assert.equal(frozenLb.grandPoints[0].teamId, testTeamB.id);
      assert.equal(frozenLb.grandPoints[0].grandPoints, 15); // Rank 1 = 15 Grand Points
      assert.equal(frozenLb.grandPoints[1].teamId, testTeamA.id);
      assert.equal(frozenLb.grandPoints[1].grandPoints, 8);  // Rank 2 = 8 Grand Points
    });
  });

  // ── 6. CHALLENGES ──────────────────────────────────────────────────────────
  describe('Season Challenges', () => {
    it('Creates challenge and updates completion status', async () => {
      const season = await seasonService.createSeason({
        name: 'Challenge Season',
        slug: 'challenge-season',
        startAt: new Date('2026-10-01T00:00:00Z'),
        endAt: new Date('2026-10-31T23:59:59Z'),
      });

      const challenge = await challengeService.createChallenge(season.id, {
        code: 'PROD_RACE_10',
        title: 'Đua Tốc Độ 10 Video',
        description: 'Đội đầu tiên hoàn thành 10 video',
        type: 'RACE',
        targetValue: 10,
      });

      assert.equal(challenge.code, 'PROD_RACE_10');
      assert.equal(challenge.status, 'ACTIVE');

      const completed = await challengeService.updateChallengeStatus(challenge.id, 'COMPLETED', testTeamA.id);
      assert.equal(completed.status, 'COMPLETED');
      assert.equal(completed.completedByTeamId, testTeamA.id);
      assert.ok(completed.completedAt);
    });
  });
});
