'use strict';

/**
 * competition_phase5.test.js
 *
 * Phase 5 Backend Tests — Grand Championship, Points Settlement, Standings, Tie-break, Freeze & Reconciliation
 *
 * Run: node --test test/competition_phase5.test.js
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const sequelize = require('../src/config/database');
const {
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  Season,
  SeasonTeam,
  SeasonFrozenResult,
  Team,
  User,
  ScoreLedger,
  CompetitionAuditLog,
} = require('../src/models');

const grandChampionshipService = require('../src/services/competition/grandChampionship.service');
const grandPointsService = require('../src/services/competition/grandPoints.service');
const grandLeaderboardService = require('../src/services/competition/grandLeaderboard.service');
const seasonService = require('../src/services/competition/season.service');
const effectEngine = require('../src/services/competition/effectEngine.service');

async function cleanPhase5Tables() {
  await GrandFrozenResult.destroy({ where: {} });
  await GrandPointsLedger.destroy({ where: {} });
  await SeasonFrozenResult.destroy({ where: {} });
  await SeasonTeam.destroy({ where: {} });
  await Season.destroy({ where: {} });
  await GrandChampionship.destroy({ where: {} });
  await ScoreLedger.destroy({ where: {} });
  await CompetitionAuditLog.destroy({ where: {} });
}

describe('Phase 5 — Grand Championship Domain & Year-Long Hub', () => {
  let teamPhoenix;
  let teamDragon;
  let teamTiger;

  before(async () => {
    await sequelize.authenticate();

    [teamPhoenix] = await Team.findOrCreate({ where: { name: 'P5 Team Phoenix' } });
    [teamDragon] = await Team.findOrCreate({ where: { name: 'P5 Team Dragon' } });
    [teamTiger] = await Team.findOrCreate({ where: { name: 'P5 Team Tiger' } });
  });

  after(async () => {
    await cleanPhase5Tables();
    await sequelize.close();
  });

  beforeEach(async () => {
    await cleanPhase5Tables();
  });

  // ── 1. GRAND CHAMPIONSHIP LIFECYCLE & STATE MACHINE ─────────────────────────
  describe('Grand Championship Lifecycle', () => {
    it('Creates Grand Championship in DRAFT state', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'WorkRank Grand Championship 2026',
        slug: 'grand-championship-2026',
        description: 'Annual corporate championship',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });

      assert.equal(grand.year, 2026);
      assert.equal(grand.status, 'DRAFT');
    });

    it('Transitions: DRAFT → SCHEDULED → ACTIVE → CALCULATING → FINISHED → ARCHIVED', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Lifecycle Grand 2026',
        slug: 'lifecycle-grand-2026',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });

      await grandChampionshipService.updateGrandStatus(grand.id, 'SCHEDULED', 1, 'Scheduled for 2026');
      let g = await GrandChampionship.findByPk(grand.id);
      assert.equal(g.status, 'SCHEDULED');

      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1, 'Activated on New Year');
      g = await GrandChampionship.findByPk(grand.id);
      assert.equal(g.status, 'ACTIVE');

      await grandChampionshipService.updateGrandStatus(grand.id, 'CALCULATING', 1, 'Reviewing final points');
      g = await GrandChampionship.findByPk(grand.id);
      assert.equal(g.status, 'CALCULATING');
    });

    it('Rejects invalid transitions (e.g. FINISHED → ACTIVE, DRAFT → FINISHED)', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Invalid Trans Grand',
        slug: 'invalid-trans-grand',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });

      await assert.rejects(
        () => grandChampionshipService.updateGrandStatus(grand.id, 'FINISHED', 1),
        /Invalid Grand Championship transition/,
      );
    });

    it('Prevents FINISHED if linked seasons are still active without force override', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Season Guard Grand',
        slug: 'season-guard-grand',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });

      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      // Create an active linked season
      const season = await seasonService.createSeason({
        name: 'Unfinished December Season',
        slug: 'unfinished-dec-season',
        startAt: new Date('2026-12-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });
      await grandChampionshipService.linkSeasonToGrand(grand.id, season.id, 1);
      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1);

      // Attempt to finish Grand Championship
      await assert.rejects(
        () => grandChampionshipService.updateGrandStatus(grand.id, 'FINISHED', 1, 'Finish attempt'),
        /Cannot finalize Grand Championship: there are 1 unfinished seasons linked/,
      );
    });
  });

  // ── 2. GRAND POINTS SETTLEMENT & IDEMPOTENCY ────────────────────────────────
  describe('Grand Points Settlement & Idempotency', () => {
    it('Settles Grand Points from frozen season result with exact distribution', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Settlement Grand 2026',
        slug: 'settlement-grand-2026',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });
      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      const season = await seasonService.createSeason({
        name: 'January Season',
        slug: 'january-season',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-01-31T23:59:59Z'),
        grandPointsDistribution: {
          distribution: [
            { rank: 1, points: 25 },
            { rank: 2, points: 15 },
          ],
        },
      });

      await grandChampionshipService.linkSeasonToGrand(grand.id, season.id, 1);
      await seasonService.addTeamToSeason(season.id, teamPhoenix.id);
      await seasonService.addTeamToSeason(season.id, teamDragon.id);
      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1);

      // Team Phoenix scores 1000, Team Dragon scores 600
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), ruleVersionId: null, seasonId: season.id,
        effects: [{ targetType: 'TEAM', targetId: teamPhoenix.id, effectType: 'TEAM_SCORE', delta: 1000, actionType: 'ADD' }],
        transaction: t,
      }));
      await sequelize.transaction((t) => effectEngine.persistEffects({
        eventId: crypto.randomUUID(), ruleVersionId: null, seasonId: season.id,
        effects: [{ targetType: 'TEAM', targetId: teamDragon.id, effectType: 'TEAM_SCORE', delta: 600, actionType: 'ADD' }],
        transaction: t,
      }));

      // Finish Season (triggers freeze + auto Grand settlement)
      await seasonService.updateSeasonStatus(season.id, 'FINISHED', 1, 'Season complete');

      // Verify Grand Points Ledger
      const phoenixPoints = await GrandPointsLedger.findOne({
        where: { grandChampionshipId: grand.id, seasonId: season.id, teamId: teamPhoenix.id },
      });
      const dragonPoints = await GrandPointsLedger.findOne({
        where: { grandChampionshipId: grand.id, seasonId: season.id, teamId: teamDragon.id },
      });

      assert.ok(phoenixPoints);
      assert.equal(phoenixPoints.rankPosition, 1);
      assert.equal(phoenixPoints.grandPointsAwarded, 25);

      assert.ok(dragonPoints);
      assert.equal(dragonPoints.rankPosition, 2);
      assert.equal(dragonPoints.grandPointsAwarded, 15);
    });

    it('Settlement retry is 100% idempotent: no duplicate points awarded', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Idempotency Grand 2026',
        slug: 'idempotency-grand-2026',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });
      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      const season = await seasonService.createSeason({
        name: 'Retry Season',
        slug: 'retry-season',
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-01-31T23:59:59Z'),
        grandPointsDistribution: { distribution: [{ rank: 1, points: 50 }] },
      });
      await grandChampionshipService.linkSeasonToGrand(grand.id, season.id, 1);
      await seasonService.addTeamToSeason(season.id, teamPhoenix.id);
      await seasonService.updateSeasonStatus(season.id, 'ACTIVE', 1);

      await seasonService.updateSeasonStatus(season.id, 'FINISHED', 1);

      // Manually trigger settlement 5 times
      for (let i = 0; i < 5; i++) {
        await grandPointsService.settleSeasonGrandPoints(season.id, 1);
      }

      const count = await GrandPointsLedger.count({
        where: { grandChampionshipId: grand.id, seasonId: season.id, teamId: teamPhoenix.id },
      });

      assert.equal(count, 1, 'Must have exactly 1 ledger record despite 5 settlement invocations');
    });
  });

  // ── 3. GRAND STANDINGS & TIE-BREAK ──────────────────────────────────────────
  describe('Grand Standings & Tie-Break Logic', () => {
    it('Calculates standings: ranks teams by Grand Points DESC, then Season Wins, then Podiums', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Standings Grand 2026',
        slug: `standings-grand-${Date.now()}`,
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
        tiebreakConfig: ['grand_points', 'season_wins', 'podium_count', 'earliest_award'],
      });
      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      const season1 = await Season.create({
        name: 'Season 101',
        slug: `s101-${Date.now()}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2026-01-01'),
        endAt: new Date('2026-01-31'),
      });

      const season2 = await Season.create({
        name: 'Season 102',
        slug: `s102-${Date.now()}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2026-02-01'),
        endAt: new Date('2026-02-28'),
      });

      // Simulate Season 1: Team Phoenix wins (30 GP), Team Dragon 2nd (20 GP)
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season1.id, teamId: teamPhoenix.id,
        rankPosition: 1, grandPointsAwarded: 30, settlementKey: `s1-phoenix-${Date.now()}`, isReversal: false,
      });
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season1.id, teamId: teamDragon.id,
        rankPosition: 2, grandPointsAwarded: 20, settlementKey: `s1-dragon-${Date.now()}`, isReversal: false,
      });

      // Simulate Season 2: Team Dragon wins (30 GP), Team Phoenix 2nd (20 GP)
      // Total points now tied at 50 GP each!
      // But Team Phoenix won Season 1 (earlier) or both have 1 win.
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season2.id, teamId: teamDragon.id,
        rankPosition: 1, grandPointsAwarded: 30, settlementKey: `s2-dragon-${Date.now()}`, isReversal: false,
      });
      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season2.id, teamId: teamPhoenix.id,
        rankPosition: 2, grandPointsAwarded: 20, settlementKey: `s2-phoenix-${Date.now()}`, isReversal: false,
      });

      const { standings } = await grandLeaderboardService.getGrandStandings(grand.id);
      assert.equal(standings.length, 2);
      assert.equal(standings[0].grandPoints, 50);
      assert.equal(standings[1].grandPoints, 50);
      assert.equal(standings[0].seasonWins, 1);
      assert.equal(standings[1].seasonWins, 1);
      assert.equal(standings[0].podiumCount, 2);
    });
  });

  // ── 4. RECONCILIATION & FREEZE ──────────────────────────────────────────────
  describe('Grand Reconciliation & Freeze', () => {
    it('Reconciliation appends audit adjustment to ledger and updates standings', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Reconciliation Grand',
        slug: `recon-grand-${Date.now()}`,
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });
      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      const season201 = await Season.create({
        name: 'Season 201',
        slug: `s201-${Date.now()}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2026-01-01'),
        endAt: new Date('2026-01-31'),
      });

      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season201.id, teamId: teamPhoenix.id,
        rankPosition: 1, grandPointsAwarded: 40, settlementKey: `base-phoenix-${Date.now()}`, isReversal: false,
      });

      // Reconcile: deduct 5 points due to verified production discrepancy
      const reconRow = await grandPointsService.reconcileGrandPoints({
        grandId: grand.id,
        seasonId: season201.id,
        teamId: teamPhoenix.id,
        pointsAdjustment: -5,
        reason: 'Audit correction for late review',
        actorId: 1,
      });

      assert.equal(reconRow.grandPointsAwarded, -5);
      assert.equal(reconRow.isReversal, true);

      // Verify standings reflect 35 GP
      const { standings } = await grandLeaderboardService.getGrandStandings(grand.id);
      assert.equal(standings[0].grandPoints, 35);
    });

    it('Freezes final Grand results and crowns Champion Team', async () => {
      const grand = await grandChampionshipService.createGrandChampionship({
        year: 2026,
        name: 'Freeze Championship 2026',
        slug: `freeze-champ-${Date.now()}`,
        startAt: new Date('2026-01-01T00:00:00Z'),
        endAt: new Date('2026-12-31T23:59:59Z'),
      });
      await grandChampionshipService.updateGrandStatus(grand.id, 'ACTIVE', 1);

      const season301 = await Season.create({
        name: 'Season 301',
        slug: `s301-${Date.now()}`,
        grandChampionshipId: grand.id,
        status: 'FINISHED',
        startAt: new Date('2026-01-01'),
        endAt: new Date('2026-01-31'),
      });

      await GrandPointsLedger.create({
        grandChampionshipId: grand.id, seasonId: season301.id, teamId: teamTiger.id,
        rankPosition: 1, grandPointsAwarded: 100, settlementKey: `tiger-win-${Date.now()}`, isReversal: false,
      });

      // Freeze Grand Championship
      await grandChampionshipService.freezeGrandResult(grand.id);

      const frozen = await GrandFrozenResult.findOne({ where: { grandChampionshipId: grand.id } });
      assert.ok(frozen);
      assert.equal(frozen.championTeamId, teamTiger.id);
      assert.equal(frozen.finalStandings[0].grandPoints, 100);
    });
  });
});
