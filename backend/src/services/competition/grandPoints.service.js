'use strict';

/**
 * grandPoints.service.js
 *
 * Grand Points Settlement and Reconciliation Service.
 * Idempotently awards Grand Points to teams upon Season finalization based on SeasonFrozenResult.
 */

const crypto = require('node:crypto');
const sequelize = require('../../config/database');
const {
  GrandChampionship,
  GrandPointsLedger,
  Season,
  SeasonFrozenResult,
  CompetitionAuditLog,
} = require('../../models');

const competitionRealtime = require('./competitionRealtime.service');

function buildSettlementKey(grandId, seasonId, teamId, type = 'AWARD') {
  return crypto
    .createHash('sha256')
    .update(`${grandId}|${seasonId}|${teamId}|${type}`)
    .digest('hex');
}

/**
 * Settle Grand Points for a finalized Season.
 *
 * @param {number} seasonId
 * @param {number} [actorId]
 * @returns {Promise<object>} settlement summary
 */
async function settleSeasonGrandPoints(seasonId, actorId = null) {
  const season = await Season.findByPk(seasonId);
  if (!season) throw new Error(`Season #${seasonId} not found`);

  // If season is not explicitly linked to a Grand Championship, look for an active one matching year
  let grandId = season.grandChampionshipId;
  if (!grandId) {
    const seasonYear = new Date(season.startAt).getFullYear();
    const activeGrand = await GrandChampionship.findOne({
      where: { year: seasonYear, status: 'ACTIVE' },
    });
    if (activeGrand) {
      grandId = activeGrand.id;
      season.grandChampionshipId = grandId;
      await season.save();
    }
  }

  if (!grandId) {
    return { settled: false, reason: 'Season is not linked to any Grand Championship' };
  }

  const frozenResult = await SeasonFrozenResult.findOne({ where: { seasonId } });
  if (!frozenResult) {
    throw new Error(`Cannot settle Grand Points: Season #${seasonId} has no frozen final result`);
  }

  const grandPointsList = frozenResult.grandPointsAwarded || [];
  if (grandPointsList.length === 0) {
    return { settled: true, count: 0, reason: 'No grand points distribution defined for this season' };
  }

  const settledRecords = [];

  try {
    await sequelize.transaction(async (t) => {
      for (const item of grandPointsList) {
        if (!item.grandPoints || item.grandPoints <= 0) continue;

        const settlementKey = buildSettlementKey(grandId, season.id, item.teamId, 'AWARD');

        const existing = await GrandPointsLedger.findOne({
          where: { settlementKey },
          transaction: t,
        });

        if (existing) {
          settledRecords.push(existing);
          continue;
        }

        const record = await GrandPointsLedger.create(
          {
            grandChampionshipId: grandId,
            seasonId: season.id,
            teamId: item.teamId,
            rankPosition: item.rank,
            grandPointsAwarded: item.grandPoints,
            settlementKey,
            reason: `Season ${season.name} Rank #${item.rank} Finish`,
            sourceResultId: frozenResult.id,
            isReversal: false,
            metadata: {
              seasonName: season.name,
              teamName: item.teamName,
              seasonScore: item.seasonScore,
            },
          },
          { transaction: t },
        );

        settledRecords.push(record);
      }
    });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      // Concurrent worker completed settlement in parallel
      const existingRows = await GrandPointsLedger.findAll({
        where: { seasonId: season.id, grandChampionshipId: grandId },
      });
      settledRecords.length = 0;
      settledRecords.push(...existingRows);
    } else {
      throw err;
    }
  }

  // Realtime notification after transaction commit
  const io = competitionRealtime.getIo();
  if (io) {
    io.emit('grand:season_settled', {
      grandId,
      seasonId,
      recordsCount: settledRecords.length,
      timestamp: new Date().toISOString(),
    });
    io.emit('grand:standings_updated', { grandId });
  }

  // Phase 6 — Update Grand Leaderboard Projection
  try {
    const projector = require('./competitionReadModel.projector');
    await projector.projectGrandLeaderboard(grandId);
  } catch (err) {
    console.warn('[GrandPointsService] Projection update warning:', err.message);
  }

  return {
    settled: true,
    grandId,
    seasonId,
    awardedCount: settledRecords.length,
    records: settledRecords,
  };
}

/**
 * Reconcile / adjust Grand Points with audit trace (Append-Only Reversal).
 */
async function reconcileGrandPoints({ grandId, seasonId, teamId, pointsAdjustment, reason, actorId }) {
  if (!grandId || !teamId || !pointsAdjustment || typeof pointsAdjustment !== 'number' || pointsAdjustment === 0) {
    throw new Error('Reconciliation requires grandId, teamId, and non-zero numeric pointsAdjustment');
  }

  if (!reason || !reason.trim()) {
    throw new Error('Reconciliation requires a mandatory audit reason');
  }

  const settlementKey = buildSettlementKey(grandId, seasonId || 'MANUAL', teamId, `RECON|${Date.now()}|${crypto.randomUUID()}`);

  return sequelize.transaction(async (t) => {
    const ledgerRecord = await GrandPointsLedger.create(
      {
        grandChampionshipId: grandId,
        seasonId: seasonId ?? null,
        teamId,
        rankPosition: 0,
        grandPointsAwarded: pointsAdjustment,
        settlementKey,
        reason: `[RECONCILIATION] ${reason}`,
        isReversal: pointsAdjustment < 0,
        metadata: {
          adjustedBy: actorId,
          adjustedAt: new Date().toISOString(),
          reason,
        },
      },
      { transaction: t },
    );

    await CompetitionAuditLog.create(
      {
        actorId: actorId ?? null,
        action: 'GRAND_POINTS_RECONCILED',
        entityType: 'GRAND_CHAMPIONSHIP',
        entityId: String(grandId),
        beforeState: null,
        afterState: ledgerRecord.toJSON(),
        reason,
      },
      { transaction: t },
    );

    const io = competitionRealtime.getIo();
    if (io) {
      io.emit('grand:standings_updated', { grandId });
    }

    // Phase 6 — Update Grand Leaderboard & Team Projections
    try {
      const projector = require('./competitionReadModel.projector');
      await projector.projectGrandLeaderboard(grandId);
      await projector.projectTeamSummary(teamId, { grandId });
    } catch (err) {
      console.warn('[GrandPointsService] Projection update warning:', err.message);
    }

    return ledgerRecord;
  });
}

module.exports = {
  settleSeasonGrandPoints,
  reconcileGrandPoints,
  buildSettlementKey,
};
