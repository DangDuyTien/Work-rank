'use strict';

/**
 * grandChampionship.service.js
 *
 * Grand Championship Domain Service.
 * Manages the annual championship lifecycle, season linkage, freeze, and audit logging.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  GrandChampionship,
  GrandFrozenResult,
  GrandPointsLedger,
  Season,
  SeasonFrozenResult,
  CompetitionAuditLog,
  Team,
} = require('../../models');

const grandLeaderboardService = require('./grandLeaderboard.service');

const VALID_GRAND_TRANSITIONS = {
  DRAFT: ['SCHEDULED', 'ACTIVE', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'DRAFT', 'ARCHIVED'],
  ACTIVE: ['CALCULATING', 'FINISHED'],
  CALCULATING: ['FINISHED', 'ACTIVE'],
  FINISHED: ['ARCHIVED'],
  ARCHIVED: [],
};

function validateGrandTransition(currentStatus, targetStatus) {
  const allowed = VALID_GRAND_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new Error(`Invalid Grand Championship transition: cannot transition from ${currentStatus} to ${targetStatus}`);
  }
}

async function logGrandAudit({ actorId, action, grandId, beforeState, afterState, reason, transaction }) {
  await CompetitionAuditLog.create(
    {
      actorId: actorId ?? null,
      action,
      entityType: 'GRAND_CHAMPIONSHIP',
      entityId: String(grandId),
      beforeState: beforeState ?? null,
      afterState: afterState ?? null,
      reason: reason ?? null,
    },
    { transaction },
  );
}

async function createGrandChampionship(data, actorId) {
  const {
    year,
    name,
    slug,
    description,
    startAt,
    endAt,
    timezone = 'Asia/Ho_Chi_Minh',
    pointsConfig,
    rewardsConfig,
    tiebreakConfig = ['grand_points', 'season_wins', 'podium_count', 'earliest_award'],
  } = data;

  if (!year || !name || !slug || !startAt || !endAt) {
    throw new Error('Grand Championship requires year, name, slug, startAt, and endAt');
  }

  if (new Date(startAt) >= new Date(endAt)) {
    throw new Error('startAt must be before endAt');
  }

  return sequelize.transaction(async (t) => {
    const grand = await GrandChampionship.create(
      {
        year: Number(year),
        name,
        slug,
        description,
        status: 'DRAFT',
        startAt: new Date(startAt),
        endAt: new Date(endAt),
        timezone,
        pointsConfig: pointsConfig ?? null,
        rewardsConfig: rewardsConfig ?? null,
        tiebreakConfig: tiebreakConfig ?? null,
        createdBy: actorId ?? null,
      },
      { transaction: t },
    );

    await logGrandAudit({
      actorId,
      action: 'GRAND_CREATED',
      grandId: grand.id,
      afterState: grand.toJSON(),
      transaction: t,
    });

    return grand;
  });
}

async function linkSeasonToGrand(grandId, seasonId, actorId) {
  return sequelize.transaction(async (t) => {
    const grand = await GrandChampionship.findByPk(grandId, { transaction: t });
    if (!grand) throw new Error(`Grand Championship #${grandId} not found`);

    const season = await Season.findByPk(seasonId, { transaction: t });
    if (!season) throw new Error(`Season #${seasonId} not found`);

    season.grandChampionshipId = grand.id;
    await season.save({ transaction: t });

    await logGrandAudit({
      actorId,
      action: 'SEASON_LINKED_TO_GRAND',
      grandId: grand.id,
      afterState: { seasonId: season.id, seasonName: season.name },
      reason: `Linked Season ${season.name} to Grand Championship ${grand.name}`,
      transaction: t,
    });

    return season;
  });
}

async function updateGrandStatus(grandId, targetStatus, actorId, reason, options = {}) {
  const isOverride = Boolean(options.forceOverride);
  if (isOverride && (!reason || !reason.trim())) {
    throw new Error('Force override requires a mandatory detailed audit reason');
  }

  return sequelize.transaction(async (t) => {
    const grand = await GrandChampionship.findByPk(grandId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!grand) throw new Error(`Grand Championship #${grandId} not found`);

    validateGrandTransition(grand.status, targetStatus);

    // Prevent finishing if linked seasons are still unfinished (unless override)
    if (targetStatus === 'FINISHED') {
      if (!isOverride) {
        const unfinishedSeasons = await Season.count({
          where: {
            grandChampionshipId: grand.id,
            status: { [Op.in]: ['DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'CALCULATING'] },
          },
          transaction: t,
        });

        if (unfinishedSeasons > 0) {
          throw new Error(`Cannot finalize Grand Championship: there are ${unfinishedSeasons} unfinished seasons linked`);
        }

        // Verify settlements for finished seasons
        const finishedSeasons = await Season.findAll({
          where: {
            grandChampionshipId: grand.id,
            status: 'FINISHED',
          },
          transaction: t,
        });

        for (const s of finishedSeasons) {
          if (s.grandPointsDistribution && Object.keys(s.grandPointsDistribution).length > 0) {
            const settlementCount = await GrandPointsLedger.count({
              where: { seasonId: s.id, grandChampionshipId: grand.id },
              transaction: t,
            });
            if (settlementCount === 0) {
              throw new Error(`Cannot finalize Grand Championship: Season #${s.id} (${s.name}) has not settled Grand Points yet`);
            }
          }
        }
      }
    }

    const beforeState = grand.toJSON();
    grand.status = targetStatus;
    await grand.save({ transaction: t });

    // If FINISHED, freeze final year-end results
    if (targetStatus === 'FINISHED') {
      await freezeGrandResult(grand.id, t);
    }

    const auditAction = isOverride
      ? `GRAND_STATUS_${targetStatus}_FORCE_OVERRIDE`
      : `GRAND_STATUS_${targetStatus}`;

    await logGrandAudit({
      actorId,
      action: auditAction,
      grandId: grand.id,
      beforeState,
      afterState: {
        ...grand.toJSON(),
        forceOverride: isOverride,
      },
      reason: reason || (isOverride ? 'Forced status transition by admin' : 'Status transition'),
      transaction: t,
    });

    return grand;
  });

  // Phase 6 — Update Grand Leaderboard Projection
  try {
    const projector = require('./competitionReadModel.projector');
    await projector.projectGrandLeaderboard(grandId);
    const competitionRealtime = require('./competitionRealtime.service');
    competitionRealtime.emitLeaderboardUpdated({ grandId });
  } catch (err) {
    console.warn('[GrandChampionshipService] Projection update warning:', err.message);
  }

  return updatedGrand;
}

async function freezeGrandResult(grandId, transaction) {
  const standingsData = await grandLeaderboardService.getGrandStandings(grandId, { ignoreFrozen: true, transaction });
  const standings = standingsData.standings || [];

  if (standings.length === 0) {
    throw new Error('Cannot freeze Grand Championship with no participating teams or standings');
  }

  const championTeamId = standings[0].teamId;

  // Collect summaries of all linked seasons
  const seasons = await Season.findAll({
    where: { grandChampionshipId: grandId },
    include: [{ model: SeasonFrozenResult, as: 'frozenResult' }],
    transaction,
  });

  const seasonSummaries = seasons.map((s) => ({
    seasonId: s.id,
    name: s.name,
    status: s.status,
    winnerTeamId: s.frozenResult?.finalRankings?.[0]?.teamId || null,
    winnerTeamName: s.frozenResult?.finalRankings?.[0]?.teamName || null,
  }));

  await GrandFrozenResult.upsert(
    {
      grandChampionshipId: grandId,
      championTeamId,
      finalStandings: standings,
      seasonSummaries,
      metadata: {
        totalTeams: standings.length,
        frozenAt: new Date(),
      },
      frozenAt: new Date(),
    },
    { transaction },
  );
}

module.exports = {
  createGrandChampionship,
  linkSeasonToGrand,
  updateGrandStatus,
  freezeGrandResult,
  validateGrandTransition,
};
