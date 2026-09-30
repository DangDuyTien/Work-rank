'use strict';

/**
 * readModelConsistency.service.js
 *
 * Consistency & Drift Detection Service for Phase 6 Read Models:
 *   - Verifies Projection integrity against Source of Truth (ScoreLedger, GrandPointsLedger, Frozen Results).
 *   - Does NOT mutate Source of Truth.
 *   - Reports diffs clearly with expected vs actual values.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  User,
  Team,
  Season,
  SeasonFrozenResult,
  ScoreLedger,
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  GrandLeaderboardProjection,
} = require('../../models');

const seasonService = require('./season.service');
const grandLeaderboardService = require('./grandLeaderboard.service');

async function checkConsistency(options = {}) {
  const diffs = [];
  const checkedAt = new Date();
  let totalChecks = 0;

  // ── 1. Check Season Leaderboard Projections ──────────────────────────────────
  const seasons = await Season.findAll({
    where: options.seasonId ? { id: options.seasonId } : { status: { [Op.in]: ['ACTIVE', 'PAUSED', 'CALCULATING', 'FINISHED'] } },
  });

  for (const s of seasons) {
    totalChecks++;
    // Get pure domain truth
    const truth = await seasonService.getSeasonLeaderboard(s.id);
    const truthRankings = truth.rankings || [];

    const projectedRows = await SeasonLeaderboardProjection.findAll({
      where: { seasonId: s.id },
    });
    const projMap = new Map();
    for (const p of projectedRows) {
      projMap.set(Number(p.teamId), p);
    }

    for (const tRow of truthRankings) {
      totalChecks++;
      const proj = projMap.get(Number(tRow.teamId));
      if (!proj) {
        diffs.push({
          projection: 'SeasonLeaderboardProjection',
          entityId: `season:${s.id}:team:${tRow.teamId}`,
          field: 'existence',
          expected: 'PRESENT',
          actual: 'MISSING',
          reason: `Team #${tRow.teamId} missing in Season #${s.id} projection`,
        });
      } else {
        if (proj.score !== tRow.score) {
          diffs.push({
            projection: 'SeasonLeaderboardProjection',
            entityId: `season:${s.id}:team:${tRow.teamId}`,
            field: 'score',
            expected: tRow.score,
            actual: proj.score,
            reason: `Score mismatch for Team #${tRow.teamId} in Season #${s.id}`,
          });
        }
        if (proj.rank !== tRow.rank) {
          diffs.push({
            projection: 'SeasonLeaderboardProjection',
            entityId: `season:${s.id}:team:${tRow.teamId}`,
            field: 'rank',
            expected: tRow.rank,
            actual: proj.rank,
            reason: `Rank mismatch for Team #${tRow.teamId} in Season #${s.id}`,
          });
        }
      }
    }
  }

  // ── 2. Check Grand Leaderboard Projections ───────────────────────────────────
  const grands = await GrandChampionship.findAll({
    where: options.grandId ? { id: options.grandId } : { status: { [Op.in]: ['ACTIVE', 'CALCULATING', 'FINISHED'] } },
  });

  for (const g of grands) {
    totalChecks++;
    const truth = await grandLeaderboardService.getGrandStandings(g.id);
    const truthStandings = truth.standings || [];

    const projectedRows = await GrandLeaderboardProjection.findAll({
      where: { grandId: g.id },
    });
    const projMap = new Map();
    for (const p of projectedRows) {
      projMap.set(Number(p.teamId), p);
    }

    for (const tRow of truthStandings) {
      totalChecks++;
      const proj = projMap.get(Number(tRow.teamId));
      if (!proj) {
        diffs.push({
          projection: 'GrandLeaderboardProjection',
          entityId: `grand:${g.id}:team:${tRow.teamId}`,
          field: 'existence',
          expected: 'PRESENT',
          actual: 'MISSING',
          reason: `Team #${tRow.teamId} missing in Grand #${g.id} projection`,
        });
      } else {
        if (proj.grandPoints !== tRow.grandPoints) {
          diffs.push({
            projection: 'GrandLeaderboardProjection',
            entityId: `grand:${g.id}:team:${tRow.teamId}`,
            field: 'grandPoints',
            expected: tRow.grandPoints,
            actual: proj.grandPoints,
            reason: `Grand Points mismatch for Team #${tRow.teamId} in Grand #${g.id}`,
          });
        }
        if (proj.rank !== tRow.rank) {
          diffs.push({
            projection: 'GrandLeaderboardProjection',
            entityId: `grand:${g.id}:team:${tRow.teamId}`,
            field: 'rank',
            expected: tRow.rank,
            actual: proj.rank,
            reason: `Rank mismatch for Team #${tRow.teamId} in Grand #${g.id}`,
          });
        }
      }
    }
  }

  // ── 3. Check User Summary Consistency (Sample or Filtered) ──────────────────
  if (options.userId) {
    totalChecks++;
    const userSummary = await CompetitionUserSummary.findByPk(options.userId);
    if (userSummary && userSummary.currentSeasonId) {
      const truthScore = await ScoreLedger.sum('points_delta', {
        where: { userId: options.userId, seasonId: userSummary.currentSeasonId },
      });
      const expectedScore = Number(truthScore || 0);
      if (userSummary.currentSeasonScore !== expectedScore) {
        diffs.push({
          projection: 'CompetitionUserSummary',
          entityId: `user:${options.userId}`,
          field: 'currentSeasonScore',
          expected: expectedScore,
          actual: userSummary.currentSeasonScore,
          reason: `User #${options.userId} score mismatch in Season #${userSummary.currentSeasonId}`,
        });
      }
    }
  }

  return {
    status: diffs.length === 0 ? 'PASS' : 'DRIFT_FOUND',
    checkedAt,
    totalChecks,
    driftCount: diffs.length,
    diffs,
  };
}

module.exports = {
  checkConsistency,
};
