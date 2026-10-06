'use strict';

/**
 * competition_phase6_read_model.test.js
 *
 * Phase 6 Backend Tests:
 *   - Read Model Projections (User Summary, Team Summary, Season Leaderboard, Grand Leaderboard, Activity)
 *   - Idempotency & Determinism
 *   - Rebuild from Source of Truth
 *   - Consistency & Drift Detection
 *   - Query Services & Pagination
 *   - Admin Controls & Concurrency Safety
 *
 * Run: node --test test/competition_phase6_read_model.test.js
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  SeasonFrozenResult,
  ScoreLedger,
  CompetitionState,
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  CompetitionAuditLog,
  CompetitionEvent,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  GrandLeaderboardProjection,
  CompetitionActivityProjection,
  ProjectionCheckpoint,
} = require('../src/models');

const projector = require('../src/services/competition/competitionReadModel.projector');
const consistencyService = require('../src/services/competition/readModelConsistency.service');
const dashboardService = require('../src/services/competition/competitionDashboard.service');
const analyticsService = require('../src/services/competition/competitionAnalytics.service');
const seasonService = require('../src/services/competition/season.service');
const grandChampionshipService = require('../src/services/competition/grandChampionship.service');
const effectEngine = require('../src/services/competition/effectEngine.service');

async function cleanPhase6Tables() {
  await CompetitionActivityProjection.destroy({ where: {} });
  await GrandLeaderboardProjection.destroy({ where: {} });
  await SeasonLeaderboardProjection.destroy({ where: {} });
  await CompetitionTeamSummary.destroy({ where: {} });
  await CompetitionUserSummary.destroy({ where: {} });
  await ProjectionCheckpoint.destroy({ where: {} });
  await GrandFrozenResult.destroy({ where: {} });
  await GrandPointsLedger.destroy({ where: {} });
  await SeasonFrozenResult.destroy({ where: {} });
  await SeasonTeamMember.destroy({ where: {} });
  await SeasonTeam.destroy({ where: {} });
  await ScoreLedger.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
  await CompetitionAuditLog.destroy({ where: {} });
  await CompetitionState.destroy({ where: {} });
  await Season.destroy({ where: {} });
  await GrandChampionship.destroy({ where: {} });
}

describe('Phase 6 — Read Models & Competition Projections', () => {
  let userAlice;
  let userBob;
  let teamAlpha;
  let teamBeta;
  let grandChamp;
  let activeSeason;

  before(async () => {
    await sequelize.authenticate();

    [teamAlpha] = await Team.findOrCreate({
      where: { name: 'P6 Team Alpha' },
      defaults: { name: 'P6 Team Alpha' },
    });
    [teamBeta] = await Team.findOrCreate({
      where: { name: 'P6 Team Beta' },
      defaults: { name: 'P6 Team Beta' },
    });

    [userAlice] = await User.findOrCreate({
      where: { email: 'alice_p6@workrank.test' },
      defaults: { name: 'Alice P6', email: 'alice_p6@workrank.test', passwordHash: 'dummy_hash', role: 'user', teamId: teamAlpha.id },
    });
    [userBob] = await User.findOrCreate({
      where: { email: 'bob_p6@workrank.test' },
      defaults: { name: 'Bob P6', email: 'bob_p6@workrank.test', passwordHash: 'dummy_hash', role: 'user', teamId: teamBeta.id },
    });

    userAlice.teamId = teamAlpha.id;
    await userAlice.save();
    userBob.teamId = teamBeta.id;
    await userBob.save();
  });

  after(async () => {
    await cleanPhase6Tables();
    await sequelize.close();
  });

  beforeEach(async () => {
    await cleanPhase6Tables();

    // Create Grand 2026
    grandChamp = await grandChampionshipService.createGrandChampionship({
      year: 2026,
      name: 'P6 Grand Championship 2026',
      slug: `p6-grand-${Date.now()}`,
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-12-31'),
    });
    await grandChampionshipService.updateGrandStatus(grandChamp.id, 'ACTIVE', 1);

    // Create Active Season
    activeSeason = await seasonService.createSeason({
      name: 'P6 Season 1 - Sprint',
      slug: `p6-season-${Date.now()}`,
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-01-31'),
    });
    await grandChampionshipService.linkSeasonToGrand(grandChamp.id, activeSeason.id, 1);
    await seasonService.addTeamToSeason(activeSeason.id, teamAlpha.id);
    await seasonService.addTeamToSeason(activeSeason.id, teamBeta.id);
    await seasonService.updateSeasonStatus(activeSeason.id, 'ACTIVE', 1);
  });

  // ── 1. PROJECTION DETERMINISM & IDEMPOTENCY ──────────────────────────────────
  describe('1. Projection Determinism & Idempotency', () => {
    it('Projects Season Leaderboard accurately and idempotently', async () => {
      // Score: Team Alpha 300, Team Beta 150
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [
          { targetType: 'TEAM', targetId: teamAlpha.id, delta: 300, effectType: 'TEAM_SCORE' },
          { targetType: 'USER', targetId: userAlice.id, delta: 300, effectType: 'INDIVIDUAL_XP' },
          { targetType: 'TEAM', targetId: teamBeta.id, delta: 150, effectType: 'TEAM_SCORE' },
        ],
        transaction: t,
      }));

      // Project Season Leaderboard
      const projs = await projector.projectSeasonLeaderboard(activeSeason.id);
      assert.equal(projs.length, 2);

      const alphaProj = await SeasonLeaderboardProjection.findOne({ where: { seasonId: activeSeason.id, teamId: teamAlpha.id } });
      const betaProj = await SeasonLeaderboardProjection.findOne({ where: { seasonId: activeSeason.id, teamId: teamBeta.id } });

      assert.equal(alphaProj.rank, 1);
      assert.equal(alphaProj.score, 300);
      assert.equal(betaProj.rank, 2);
      assert.equal(betaProj.score, 150);

      // Re-projecting 3 times produces zero new rows and identical scores
      await projector.projectSeasonLeaderboard(activeSeason.id);
      await projector.projectSeasonLeaderboard(activeSeason.id);
      await projector.projectSeasonLeaderboard(activeSeason.id);

      const count = await SeasonLeaderboardProjection.count({ where: { seasonId: activeSeason.id } });
      assert.equal(count, 2);
    });

    it('Projects User Summary & Team Summary accurately', async () => {
      // Alice scores 250 in season, has streak count 3
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [{ targetType: 'USER', targetId: userAlice.id, delta: 250, effectType: 'INDIVIDUAL_XP' }],
        transaction: t,
      }));

      await CompetitionState.create({
        entityType: 'user',
        entityId: userAlice.id,
        seasonId: activeSeason.id,
        stateKey: 'video_approved_streak',
        dataJson: { count: 3 },
        version: 1,
      });

      const userSummary = await projector.projectUserSummary(userAlice.id);
      assert.ok(userSummary);
      assert.equal(userSummary.currentSeasonScore, 250);
      assert.equal(userSummary.currentStreak, 3);
      assert.equal(userSummary.weeklyProgress, 50); // 250 / 500 = 50%

      const teamSummary = await projector.projectTeamSummary(teamAlpha.id);
      assert.ok(teamSummary);
      assert.equal(teamSummary.teamId, teamAlpha.id);
    });

    it('Projects Grand Leaderboard accurately', async () => {
      await GrandPointsLedger.create({
        grandChampionshipId: grandChamp.id,
        seasonId: activeSeason.id,
        teamId: teamAlpha.id,
        rankPosition: 1,
        grandPointsAwarded: 25,
        settlementKey: `p6-settle-alpha-${Date.now()}`,
      });

      const grandProjs = await projector.projectGrandLeaderboard(grandChamp.id);
      assert.equal(grandProjs.length, 1);
      assert.equal(grandProjs[0].rank, 1);
      assert.equal(grandProjs[0].grandPoints, 25);
    });

    it('Projects Activity idempotently with unique activityKey', async () => {
      const actKey = `activity:test:${Date.now()}`;
      const act1 = await projector.projectActivity({
        activityKey: actKey,
        activityType: 'SCORE_AWARDED',
        actorUserId: userAlice.id,
        teamId: teamAlpha.id,
        seasonId: activeSeason.id,
        title: '+100 XP awarded for Video Approved',
      });

      assert.ok(act1);
      assert.equal(act1.activityKey, actKey);

      // Attempting to project same activityKey returns existing row without error
      const act2 = await projector.projectActivity({
        activityKey: actKey,
        activityType: 'SCORE_AWARDED',
        actorUserId: userAlice.id,
        teamId: teamAlpha.id,
        seasonId: activeSeason.id,
        title: '+100 XP awarded for Video Approved',
      });

      assert.equal(act1.id, act2.id);
      const totalActs = await CompetitionActivityProjection.count({ where: { activityKey: actKey } });
      assert.equal(totalActs, 1);
    });
  });

  // ── 2. REBUILD MECHANISM & REPROJECTION ─────────────────────────────────────
  describe('2. Rebuild Mechanism from Source of Truth', () => {
    it('Destroys read models and rebuilds 100% identically from source of truth', async () => {
      // 1. Establish source of truth
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [
          { targetType: 'TEAM', targetId: teamAlpha.id, delta: 500, effectType: 'TEAM_SCORE' },
          { targetType: 'USER', targetId: userAlice.id, delta: 500, effectType: 'INDIVIDUAL_XP' },
          { targetType: 'TEAM', targetId: teamBeta.id, delta: 200, effectType: 'TEAM_SCORE' },
        ],
        transaction: t,
      }));

      await GrandPointsLedger.create({
        grandChampionshipId: grandChamp.id,
        seasonId: activeSeason.id,
        teamId: teamAlpha.id,
        rankPosition: 1,
        grandPointsAwarded: 50,
        settlementKey: `rebuild-test-alpha-${Date.now()}`,
      });

      // 2. Initial projection
      await projector.projectSeasonLeaderboard(activeSeason.id);
      await projector.projectGrandLeaderboard(grandChamp.id);
      await projector.projectUserSummary(userAlice.id);
      await projector.projectTeamSummary(teamAlpha.id);

      // Verify initial projection values
      let alphaSeason = await SeasonLeaderboardProjection.findOne({ where: { seasonId: activeSeason.id, teamId: teamAlpha.id } });
      assert.equal(alphaSeason.score, 500);

      // 3. Clear / destroy all projection tables
      await SeasonLeaderboardProjection.destroy({ where: {} });
      await GrandLeaderboardProjection.destroy({ where: {} });
      await CompetitionUserSummary.destroy({ where: {} });
      await CompetitionTeamSummary.destroy({ where: {} });

      assert.equal(await SeasonLeaderboardProjection.count(), 0);
      assert.equal(await GrandLeaderboardProjection.count(), 0);

      // 4. Trigger Rebuild
      const rebuildRes = await projector.rebuildReadModels({
        actorId: 1,
        reason: 'Verification rebuild test',
      });

      assert.equal(rebuildRes.status, 'SUCCESS');

      // 5. Verify restored projections
      alphaSeason = await SeasonLeaderboardProjection.findOne({ where: { seasonId: activeSeason.id, teamId: teamAlpha.id } });
      const alphaGrand = await GrandLeaderboardProjection.findOne({ where: { grandId: grandChamp.id, teamId: teamAlpha.id } });
      const aliceSummary = await CompetitionUserSummary.findByPk(userAlice.id);

      assert.ok(alphaSeason, 'Season leaderboard projection must be restored');
      assert.equal(alphaSeason.score, 500);
      assert.equal(alphaSeason.rank, 1);

      assert.ok(alphaGrand, 'Grand leaderboard projection must be restored');
      assert.equal(alphaGrand.grandPoints, 50);

      assert.ok(aliceSummary, 'User summary must be restored');
      assert.equal(aliceSummary.currentSeasonScore, 500);
    });
  });

  // ── 3. CONSISTENCY & DRIFT DETECTION ────────────────────────────────────────
  describe('3. Consistency & Drift Detection', () => {
    it('Returns PASS when projections match Source of Truth', async () => {
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [{ targetType: 'TEAM', targetId: teamAlpha.id, delta: 100, effectType: 'TEAM_SCORE' }],
        transaction: t,
      }));

      await projector.projectSeasonLeaderboard(activeSeason.id);
      await projector.projectGrandLeaderboard(grandChamp.id);

      const report = await consistencyService.checkConsistency({ seasonId: activeSeason.id, grandId: grandChamp.id });
      assert.equal(report.status, 'PASS');
      assert.equal(report.driftCount, 0);
      assert.equal(report.diffs.length, 0);
    });

    it('Detects drift if projection is tampered or diverges from Source of Truth', async () => {
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [{ targetType: 'TEAM', targetId: teamAlpha.id, delta: 100, effectType: 'TEAM_SCORE' }],
        transaction: t,
      }));

      await projector.projectSeasonLeaderboard(activeSeason.id);

      // Tamper projection row to simulate drift
      await SeasonLeaderboardProjection.update(
        { score: 999 },
        { where: { seasonId: activeSeason.id, teamId: teamAlpha.id } }
      );

      const report = await consistencyService.checkConsistency({ seasonId: activeSeason.id });
      assert.equal(report.status, 'DRIFT_FOUND');
      assert.ok(report.driftCount > 0);
      assert.equal(report.diffs[0].expected, 100);
      assert.equal(report.diffs[0].actual, 999);
    });
  });

  // ── 4. QUERY SERVICES & PAGINATION ──────────────────────────────────────────
  describe('4. Query Services & Pagination', () => {
    it('getUserDashboard returns structured summary in bounded queries', async () => {
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [{ targetType: 'USER', targetId: userAlice.id, delta: 350, effectType: 'INDIVIDUAL_XP' }],
        transaction: t,
      }));
      await projector.projectSeasonLeaderboard(activeSeason.id);
      await projector.projectUserSummary(userAlice.id);

      const dashboard = await dashboardService.getUserDashboard(userAlice.id);
      assert.ok(dashboard.user);
      assert.equal(dashboard.user.id, userAlice.id);
      assert.ok(dashboard.userSummary);
      assert.equal(dashboard.userSummary.currentSeasonScore, 350);
      assert.ok(dashboard.activeSeason);
    });

    it('getSeasonLeaderboardProjection returns paginated results', async () => {
      await projector.projectSeasonLeaderboard(activeSeason.id);

      const page1 = await dashboardService.getSeasonLeaderboardProjection(activeSeason.id, { page: 1, limit: 1 });
      assert.equal(page1.page, 1);
      assert.equal(page1.limit, 1);
      assert.equal(page1.rankings.length, 1);
      assert.equal(page1.totalTeams, 2);
      assert.equal(page1.totalPages, 2);
    });

    it('getActivityFeed returns paginated activities with filters', async () => {
      for (let i = 1; i <= 5; i++) {
        await projector.projectActivity({
          activityKey: `bulk:act:${i}:${Date.now()}`,
          activityType: 'SCORE_AWARDED',
          actorUserId: userAlice.id,
          teamId: teamAlpha.id,
          seasonId: activeSeason.id,
          title: `Activity #${i}`,
        });
      }

      const feed = await dashboardService.getActivityFeed({ userId: userAlice.id, limit: 3 });
      assert.equal(feed.activities.length, 3);
      assert.equal(feed.totalActivities, 5);
    });
  });

  // ── 5. ADMIN CONTROLS & AUDIT SAFETY ────────────────────────────────────────
  describe('5. Admin Controls & Audit Safety', () => {
    it('triggerRebuild requires non-empty reason and logs audit entry', async () => {
      await assert.rejects(
        () => analyticsService.triggerRebuild(1, ''),
        /Audit reason is required/
      );

      const res = await analyticsService.triggerRebuild(1, 'Quarterly maintenance rebuild');
      assert.equal(res.status, 'SUCCESS');

      const audit = await CompetitionAuditLog.findOne({
        where: { action: 'PROJECTIONS_REBUILT', actorId: 1 },
      });
      assert.ok(audit);
      assert.equal(audit.reason, 'Quarterly maintenance rebuild');
    });

    it('getAdminDashboard returns comprehensive system overview', async () => {
      const adminDash = await analyticsService.getAdminDashboard();
      assert.ok(adminDash.seasonStats);
      assert.ok(adminDash.grandStats);
      assert.ok(adminDash.eventMetrics);
      assert.ok(adminDash.projectionMetrics);
      assert.ok(adminDash.consistency);
    });
  });

  // ── 6. CONCURRENCY SAFETY ───────────────────────────────────────────────────
  describe('6. Concurrency Safety', () => {
    it('Concurrent projections for same entity resolve safely with zero duplication', async () => {
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), seasonId: activeSeason.id,
        effects: [{ targetType: 'TEAM', targetId: teamAlpha.id, delta: 100, effectType: 'TEAM_SCORE' }],
        transaction: t,
      }));

      // Launch 5 parallel projection jobs
      await Promise.all([
        projector.projectSeasonLeaderboard(activeSeason.id),
        projector.projectSeasonLeaderboard(activeSeason.id),
        projector.projectSeasonLeaderboard(activeSeason.id),
        projector.projectSeasonLeaderboard(activeSeason.id),
        projector.projectSeasonLeaderboard(activeSeason.id),
      ]);

      const count = await SeasonLeaderboardProjection.count({ where: { seasonId: activeSeason.id } });
      assert.equal(count, 2, 'Exactly 2 teams projected despite 5 concurrent calls');
    });
  });
});
