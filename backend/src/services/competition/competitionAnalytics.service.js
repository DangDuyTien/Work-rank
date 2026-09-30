'use strict';

/**
 * competitionAnalytics.service.js
 *
 * Query-Only & Operations Service for Admin Competition Analytics & Projection Monitor.
 */

const { Op } = require('sequelize');
const {
  Season,
  SeasonTeam,
  SeasonTeamMember,
  GrandChampionship,
  GrandPointsLedger,
  CompetitionEvent,
  ScoreLedger,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  CompetitionActivityProjection,
  ProjectionCheckpoint,
} = require('../../models');

const projector = require('./competitionReadModel.projector');
const consistencyService = require('./readModelConsistency.service');

async function getAdminDashboard() {
  // 1. Active or Latest Season Stats
  const activeSeason = await Season.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED', 'CALCULATING'] } },
    order: [['start_at', 'DESC']],
  }) || await Season.findOne({
    order: [['start_at', 'DESC']],
  });

  let seasonStats = null;
  if (activeSeason) {
    const teamsCount = await SeasonTeam.count({ where: { seasonId: activeSeason.id, isDisqualified: false } });
    const membersCount = await SeasonTeamMember.count({ where: { seasonId: activeSeason.id } });
    const topTeam = await SeasonLeaderboardProjection.findOne({
      where: { seasonId: activeSeason.id, rank: 1 },
    });
    const topIndividual = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId: activeSeason.id, rank: 1 },
    });

    seasonStats = {
      seasonId: activeSeason.id,
      name: activeSeason.name,
      status: activeSeason.status,
      startAt: activeSeason.startAt,
      endAt: activeSeason.endAt,
      teamsCount,
      membersCount,
      leaderTeam: topTeam ? { teamId: topTeam.teamId, teamName: topTeam.teamName, score: topTeam.score } : null,
      leaderIndividual: topIndividual ? { userId: topIndividual.userId, userName: topIndividual.userName, teamName: topIndividual.teamName, points: topIndividual.points } : null,
    };
  }

  // 2. Grand Championship Stats
  const activeGrand = await GrandChampionship.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'CALCULATING', 'FINISHED'] } },
    order: [['year', 'DESC']],
  });

  let grandStats = null;
  if (activeGrand) {
    const totalGPPool = await GrandPointsLedger.sum('grand_points_awarded', {
      where: { grandChampionshipId: activeGrand.id },
    });
    const leaderTeam = await GrandLeaderboardProjection.findOne({
      where: { grandId: activeGrand.id, rank: 1 },
    });
    const leaderIndividual = await GrandIndividualLeaderboardProjection.findOne({
      where: { grandId: activeGrand.id, rank: 1 },
    });
    const linkedSeasonsCount = await Season.count({ where: { grandChampionshipId: activeGrand.id } });

    grandStats = {
      grandId: activeGrand.id,
      name: activeGrand.name,
      year: activeGrand.year,
      status: activeGrand.status,
      linkedSeasonsCount,
      totalGrandPointsAwarded: Number(totalGPPool || 0),
      leaderTeam: leaderTeam ? { teamId: leaderTeam.teamId, teamName: leaderTeam.teamName, grandPoints: leaderTeam.grandPoints } : null,
      leaderIndividual: leaderIndividual ? { userId: leaderIndividual.userId, userName: leaderIndividual.userName, teamName: leaderIndividual.teamName, grandPoints: leaderIndividual.grandPoints } : null,
    };
  }

  // 3. Event Processing Health
  const [totalEvents, pendingEvents, processedEvents, failedEvents] = await Promise.all([
    CompetitionEvent.count(),
    CompetitionEvent.count({ where: { status: 'PENDING' } }),
    CompetitionEvent.count({ where: { status: 'PROCESSED' } }),
    CompetitionEvent.count({ where: { status: 'FAILED' } }),
  ]);

  // 4. Projections Status & Row Counts
  const checkpoints = await ProjectionCheckpoint.findAll();
  const [
    userSummariesCount,
    teamSummariesCount,
    seasonProjectionsCount,
    seasonIndividualCount,
    grandProjectionsCount,
    grandIndividualCount,
    activitiesCount,
  ] = await Promise.all([
    CompetitionUserSummary.count(),
    CompetitionTeamSummary.count(),
    SeasonLeaderboardProjection.count(),
    SeasonIndividualLeaderboardProjection.count(),
    GrandLeaderboardProjection.count(),
    GrandIndividualLeaderboardProjection.count(),
    CompetitionActivityProjection.count(),
  ]);

  // 5. Quick Drift Check
  const consistencyReport = await consistencyService.checkConsistency();

  return {
    seasonStats,
    grandStats,
    eventMetrics: {
      totalEvents,
      pendingEvents,
      processedEvents,
      failedEvents,
    },
    projectionMetrics: {
      checkpoints: checkpoints.map((c) => ({
        name: c.projectionName,
        version: c.projectionVersion,
        status: c.status,
        lastProcessedAt: c.lastProcessedAt,
      })),
      counts: {
        userSummaries: userSummariesCount,
        teamSummaries: teamSummariesCount,
        seasonLeaderboards: seasonProjectionsCount,
        seasonIndividualLeaderboards: seasonIndividualCount,
        grandLeaderboards: grandProjectionsCount,
        grandIndividualLeaderboards: grandIndividualCount,
        activities: activitiesCount,
      },
    },
    consistency: {
      status: consistencyReport.status,
      driftCount: consistencyReport.driftCount,
      checkedAt: consistencyReport.checkedAt,
    },
  };
}

async function getProjectionStatus() {
  const checkpoints = await ProjectionCheckpoint.findAll({
    order: [['updated_at', 'DESC']],
  });

  const [
    usersCount,
    teamsCount,
    seasonRows,
    seasonIndivRows,
    grandRows,
    grandIndivRows,
    activitiesCount,
  ] = await Promise.all([
    CompetitionUserSummary.count(),
    CompetitionTeamSummary.count(),
    SeasonLeaderboardProjection.count(),
    SeasonIndividualLeaderboardProjection.count(),
    GrandLeaderboardProjection.count(),
    GrandIndividualLeaderboardProjection.count(),
    CompetitionActivityProjection.count(),
  ]);

  return {
    checkpoints,
    tableStats: {
      competition_user_summaries: usersCount,
      competition_team_summaries: teamsCount,
      season_leaderboard_projections: seasonRows,
      season_individual_leaderboard_projections: seasonIndivRows,
      grand_leaderboard_projections: grandRows,
      grand_individual_leaderboard_projections: grandIndivRows,
      competition_activity_projections: activitiesCount,
    },
    systemTime: new Date(),
  };
}

async function triggerRebuild(actorId, reason) {
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('Audit reason is required to trigger read model rebuild');
  }

  const result = await projector.rebuildReadModels({
    actorId,
    reason: reason.trim(),
    full: true,
  });

  return result;
}

module.exports = {
  getAdminDashboard,
  getProjectionStatus,
  triggerRebuild,
};
