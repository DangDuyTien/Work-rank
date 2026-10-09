'use strict';

/**
 * teamSync.service.js
 *
 * Canonical Master Data Synchronization & Consistency Service for Teams.
 *
 * Responsibilities:
 * 1. Synchronizes canonical Team updates (name, avatar, color, description) across
 *    all denormalized read models and active season snapshots.
 * 2. Preserves historical provenance: Historical frozen seasons (FINISHED/ARCHIVED)
 *    remain frozen, while all active/live seasons and projections are immediately updated.
 * 3. Invalidates backend memory caches (dashboard-overview, leaderboard, etc.).
 * 4. Emits realtime WebSocket events (team:updated, team:renamed, competition:leaderboard_updated)
 *    for instantaneous UI synchronization across all client sessions.
 * 5. Provides self-healing reconciliation tool to audit and repair existing data drift.
 */

const { Op } = require('sequelize');
const {
  Team,
  Season,
  SeasonTeam,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandChampionship,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
} = require('../models');
const cache = require('./cache.service');
const competitionRealtime = require('./competition/competitionRealtime.service');

/**
 * Synchronize a team's updated canonical data across all active read models.
 *
 * @param {number|string} teamId
 * @param {object} [extraUpdates]
 * @returns {Promise<object>} sync summary
 */
async function syncTeamAcrossReadModelsAndRealtime(teamId, extraUpdates = {}) {
  const numericTeamId = Number(teamId);
  if (!numericTeamId) return { success: false, reason: 'Invalid team ID' };

  const team = await Team.findByPk(numericTeamId);
  if (!team) return { success: false, reason: 'Team not found' };

  const activeSeasonStatusWhere = {
    status: { [Op.notIn]: ['FINISHED', 'ARCHIVED'] },
  };

  const activeSeasons = await Season.findAll({
    where: activeSeasonStatusWhere,
    attributes: ['id'],
  });
  const activeSeasonIds = activeSeasons.map((s) => s.id);

  // 1. Synchronize SeasonTeam snapshots for non-frozen seasons
  let updatedSeasonTeams = 0;
  if (activeSeasonIds.length > 0) {
    const [stCount] = await SeasonTeam.update(
      {
        teamNameSnapshot: team.name,
        teamAvatarSnapshot: team.avatar || null,
        teamColorSnapshot: team.color || '#0284c7',
      },
      {
        where: {
          teamId: numericTeamId,
          seasonId: { [Op.in]: activeSeasonIds },
        },
      }
    );
    updatedSeasonTeams = stCount;
  }

  // 2. Synchronize CompetitionTeamSummary
  let updatedTeamSummaries = 0;
  try {
    const [ctsCount] = await CompetitionTeamSummary.update(
      {
        teamName: team.name,
        teamColor: team.color || '#0284c7',
      },
      {
        where: { teamId: numericTeamId },
      }
    );
    updatedTeamSummaries = ctsCount;
  } catch (err) {
    // Non-fatal if table doesn't have record yet
  }

  // 3. Synchronize Season Leaderboard Projections (Team & Individual) for active seasons
  let updatedSeasonProjections = 0;
  let updatedSeasonIndivProjections = 0;
  if (activeSeasonIds.length > 0) {
    const [slpCount] = await SeasonLeaderboardProjection.update(
      {
        teamName: team.name,
        teamAvatar: team.avatar || null,
        teamColor: team.color || '#0284c7',
      },
      {
        where: {
          teamId: numericTeamId,
          seasonId: { [Op.in]: activeSeasonIds },
        },
      }
    );
    updatedSeasonProjections = slpCount;

    const [siCount] = await SeasonIndividualLeaderboardProjection.update(
      {
        teamName: team.name,
        teamColor: team.color || '#0284c7',
      },
      {
        where: {
          teamId: numericTeamId,
          seasonId: { [Op.in]: activeSeasonIds },
        },
      }
    );
    updatedSeasonIndivProjections = siCount;
  }

  // 4. Synchronize Grand Championship Projections (Team & Individual) for active grands
  let updatedGrandProjections = 0;
  let updatedGrandIndivProjections = 0;
  const activeGrands = await GrandChampionship.findAll({
    where: { status: { [Op.notIn]: ['FINISHED', 'ARCHIVED'] } },
    attributes: ['id'],
  });
  const activeGrandIds = activeGrands.map((g) => g.id);

  if (activeGrandIds.length > 0) {
    const [glpCount] = await GrandLeaderboardProjection.update(
      {
        teamName: team.name,
      },
      {
        where: {
          teamId: numericTeamId,
          grandId: { [Op.in]: activeGrandIds },
        },
      }
    );
    updatedGrandProjections = glpCount;

    const [giCount] = await GrandIndividualLeaderboardProjection.update(
      {
        teamName: team.name,
      },
      {
        where: {
          teamId: numericTeamId,
          grandId: { [Op.in]: activeGrandIds },
        },
      }
    );
    updatedGrandIndivProjections = giCount;
  }

  // 5. Invalidate Backend In-Memory Cache
  cache.clear();

  // 6. Broadcast Realtime WebSocket Events
  competitionRealtime.emitLeaderboardUpdated({ seasonId: null, grandId: null });
  competitionRealtime.emitDashboardUpdated({ teamId: numericTeamId });

  const io = competitionRealtime.getIo();
  if (io) {
    const payload = {
      teamId: numericTeamId,
      name: team.name,
      description: team.description,
      avatar: team.avatar || null,
      color: team.color || '#0284c7',
      timestamp: new Date().toISOString(),
    };
    io.emit('team:updated', payload);
    io.emit('team:renamed', payload);
    io.to(`team:${numericTeamId}`).emit('team:info_updated', payload);
  }

  return {
    success: true,
    teamId: numericTeamId,
    teamName: team.name,
    updatedSeasonTeams,
    updatedTeamSummaries,
    updatedSeasonProjections,
    updatedSeasonIndivProjections,
    updatedGrandProjections,
    updatedGrandIndivProjections,
  };
}

/**
 * Self-healing Reconciliation Tool: Audits and repairs all team read model drift across DB.
 *
 * @returns {Promise<object>} Reconciliation Report
 */
async function reconcileAllTeamReadModels() {
  const allTeams = await Team.findAll();
  const report = {
    totalTeamsChecked: allTeams.length,
    repairedSeasonTeams: 0,
    repairedSummaries: 0,
    repairedSeasonLeaderboard: 0,
    repairedSeasonIndividualLeaderboard: 0,
    repairedGrandLeaderboard: 0,
    repairedGrandIndividualLeaderboard: 0,
    details: [],
  };

  const activeSeasons = await Season.findAll({
    where: { status: { [Op.notIn]: ['FINISHED', 'ARCHIVED'] } },
    attributes: ['id'],
  });
  const activeSeasonIds = activeSeasons.map((s) => s.id);

  const activeGrands = await GrandChampionship.findAll({
    where: { status: { [Op.notIn]: ['FINISHED', 'ARCHIVED'] } },
    attributes: ['id'],
  });
  const activeGrandIds = activeGrands.map((g) => g.id);

  for (const team of allTeams) {
    const tid = Number(team.id);
    let teamRepaired = false;

    // 1. Audit & Fix SeasonTeam snapshots for non-frozen seasons
    if (activeSeasonIds.length > 0) {
      const staleSeasonTeams = await SeasonTeam.findAll({
        where: {
          teamId: tid,
          seasonId: { [Op.in]: activeSeasonIds },
          teamNameSnapshot: { [Op.ne]: team.name },
        },
      });
      if (staleSeasonTeams.length > 0) {
        await SeasonTeam.update(
          {
            teamNameSnapshot: team.name,
            teamAvatarSnapshot: team.avatar || null,
            teamColorSnapshot: team.color || '#0284c7',
          },
          {
            where: {
              teamId: tid,
              seasonId: { [Op.in]: activeSeasonIds },
            },
          }
        );
        report.repairedSeasonTeams += staleSeasonTeams.length;
        teamRepaired = true;
      }
    }

    // 2. Audit & Fix CompetitionTeamSummary
    const staleSummary = await CompetitionTeamSummary.findOne({
      where: {
        teamId: tid,
        teamName: { [Op.ne]: team.name },
      },
    });
    if (staleSummary) {
      await CompetitionTeamSummary.update(
        {
          teamName: team.name,
          teamColor: team.color || '#0284c7',
        },
        { where: { teamId: tid } }
      );
      report.repairedSummaries += 1;
      teamRepaired = true;
    }

    // 3. Audit & Fix SeasonLeaderboardProjection for active seasons
    if (activeSeasonIds.length > 0) {
      const staleSLP = await SeasonLeaderboardProjection.findAll({
        where: {
          teamId: tid,
          seasonId: { [Op.in]: activeSeasonIds },
          teamName: { [Op.ne]: team.name },
        },
      });
      if (staleSLP.length > 0) {
        await SeasonLeaderboardProjection.update(
          {
            teamName: team.name,
            teamAvatar: team.avatar || null,
            teamColor: team.color || '#0284c7',
          },
          {
            where: {
              teamId: tid,
              seasonId: { [Op.in]: activeSeasonIds },
            },
          }
        );
        report.repairedSeasonLeaderboard += staleSLP.length;
        teamRepaired = true;
      }

      // Individual Projections
      const staleSILP = await SeasonIndividualLeaderboardProjection.findAll({
        where: {
          teamId: tid,
          seasonId: { [Op.in]: activeSeasonIds },
          teamName: { [Op.ne]: team.name },
        },
      });
      if (staleSILP.length > 0) {
        await SeasonIndividualLeaderboardProjection.update(
          {
            teamName: team.name,
            teamColor: team.color || '#0284c7',
          },
          {
            where: {
              teamId: tid,
              seasonId: { [Op.in]: activeSeasonIds },
            },
          }
        );
        report.repairedSeasonIndividualLeaderboard += staleSILP.length;
        teamRepaired = true;
      }
    }

    // 4. Audit & Fix Grand Leaderboard Projections
    if (activeGrandIds.length > 0) {
      const staleGLP = await GrandLeaderboardProjection.findAll({
        where: {
          teamId: tid,
          grandId: { [Op.in]: activeGrandIds },
          teamName: { [Op.ne]: team.name },
        },
      });
      if (staleGLP.length > 0) {
        await GrandLeaderboardProjection.update(
          { teamName: team.name },
          {
            where: {
              teamId: tid,
              grandId: { [Op.in]: activeGrandIds },
            },
          }
        );
        report.repairedGrandLeaderboard += staleGLP.length;
        teamRepaired = true;
      }

      const staleGILP = await GrandIndividualLeaderboardProjection.findAll({
        where: {
          teamId: tid,
          grandId: { [Op.in]: activeGrandIds },
          teamName: { [Op.ne]: team.name },
        },
      });
      if (staleGILP.length > 0) {
        await GrandIndividualLeaderboardProjection.update(
          { teamName: team.name },
          {
            where: {
              teamId: tid,
              grandId: { [Op.in]: activeGrandIds },
            },
          }
        );
        report.repairedGrandIndividualLeaderboard += staleGILP.length;
        teamRepaired = true;
      }
    }

    if (teamRepaired) {
      report.details.push({ teamId: tid, canonicalName: team.name, status: 'REPAIRED' });
    }
  }

  // Clear memory cache after full reconciliation
  cache.clear();

  return report;
}

module.exports = {
  syncTeamAcrossReadModelsAndRealtime,
  reconcileAllTeamReadModels,
};
