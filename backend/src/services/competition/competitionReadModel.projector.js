'use strict';

/**
 * competitionReadModel.projector.js
 *
 * Deterministic, idempotent Projector for Phase 6 Read Models:
 *   - User Summary: competition_user_summaries
 *   - Team Summary: competition_team_summaries
 *   - Season Leaderboard: season_leaderboard_projections
 *   - Grand Leaderboard: grand_leaderboard_projections
 *   - Activity Feed: competition_activity_projections
 *   - Checkpoints: projection_checkpoints
 *
 * Guarantees:
 *   - Pure query & upsert projection (does not alter Source of Truth).
 *   - Replayable & Rebuildable at any time from ScoreLedger, States, Frozen Results.
 *   - Idempotent upserts via deterministic primary keys and unique constraints.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
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
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  CompetitionActivityProjection,
  ProjectionCheckpoint,
} = require('../../models');

const seasonService = require('./season.service');
const grandLeaderboardService = require('./grandLeaderboard.service');
const competitionRealtime = require('./competitionRealtime.service');

const PROJECTION_VERSION = '1.0.0';

// ─── Checkpoint Helpers ───────────────────────────────────────────────────────

async function updateCheckpoint(name, { lastEventId, status = 'ACTIVE', metadata } = {}, transaction) {
  await ProjectionCheckpoint.upsert(
    {
      projectionName: name,
      projectionVersion: PROJECTION_VERSION,
      lastEventId: lastEventId || null,
      lastProcessedAt: new Date(),
      status,
      metadata: metadata || null,
    },
    { transaction }
  );
}

// ─── User Summary Projector ───────────────────────────────────────────────────

async function projectUserSummary(userId, options = {}) {
  const { transaction } = options;
  const user = await User.findByPk(userId, { transaction });
  if (!user) return null;

  // 1. Find active season for user
  let currentSeasonId = options.seasonId || null;
  if (!currentSeasonId) {
    const activeMembership = await SeasonTeamMember.findOne({
      where: { userId },
      include: [{ model: Season, as: 'season', where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } } }],
      order: [['created_at', 'DESC']],
      transaction,
    });
    if (activeMembership) {
      currentSeasonId = activeMembership.seasonId;
    }
  }

  let currentSeasonScore = 0;
  let currentSeasonRank = 0;

  if (currentSeasonId) {
    // User total score in season
    const scoreSum = await ScoreLedger.sum('points_delta', {
      where: { userId, seasonId: currentSeasonId },
      transaction,
    });
    currentSeasonScore = Number(scoreSum || 0);

    // Compute rank among members in the same season
    const higherScoresCount = await ScoreLedger.findAll({
      attributes: [
        'user_id',
        [sequelize.fn('SUM', sequelize.col('points_delta')), 'userTotal'],
      ],
      where: { seasonId: currentSeasonId, userId: { [Op.ne]: null } },
      group: ['user_id'],
      having: sequelize.literal(`SUM(points_delta) > ${currentSeasonScore}`),
      raw: true,
      transaction,
    });
    currentSeasonRank = higherScoresCount.length + 1;
  }

  // 2. Find Grand Championship info via user's team
  let grandChampionshipId = options.grandId || null;
  let grandRank = 0;
  let grandPoints = 0;
  let seasonWins = 0;
  let podiumCount = 0;

  if (user.teamId) {
    if (!grandChampionshipId) {
      const activeGrand = await GrandChampionship.findOne({
        where: { status: { [Op.in]: ['ACTIVE', 'CALCULATING', 'FINISHED'] } },
        order: [['year', 'DESC']],
        transaction,
      });
      if (activeGrand) grandChampionshipId = activeGrand.id;
    }

    if (grandChampionshipId) {
      const teamProj = await GrandLeaderboardProjection.findOne({
        where: { grandId: grandChampionshipId, teamId: user.teamId },
        transaction,
      });

      if (teamProj) {
        grandRank = teamProj.rank;
        grandPoints = teamProj.grandPoints;
        seasonWins = teamProj.seasonWins;
        podiumCount = teamProj.podiumCount;
      } else {
        // Fallback live compute
        const gpSum = await GrandPointsLedger.sum('grand_points_awarded', {
          where: { grandChampionshipId, teamId: user.teamId },
          transaction,
        });
        grandPoints = Number(gpSum || 0);
      }
    }
  }

  // 3. User Streak from CompetitionState
  const streakState = await CompetitionState.findOne({
    where: { entityType: 'user', entityId: userId, stateKey: 'video_approved_streak' },
    transaction,
  });
  const currentStreak = streakState?.dataJson?.count ?? streakState?.data?.count ?? 0;

  // 4. Recent score delta (last score event)
  const lastScore = await ScoreLedger.findOne({
    where: { userId },
    order: [['created_at', 'DESC']],
    transaction,
  });
  const recentScoreDelta = lastScore ? lastScore.pointsDelta : 0;
  const lastActivityAt = lastScore ? lastScore.createdAt : new Date();

  // Weekly progress calculation (e.g., target 500 XP = 100%)
  const weeklyTarget = 500;
  const weeklyProgress = Math.min(100, Math.round((currentSeasonScore / (weeklyTarget || 1)) * 100));

  await CompetitionUserSummary.upsert(
    {
      userId,
      currentSeasonId,
      currentSeasonRank,
      currentSeasonScore,
      grandChampionshipId,
      grandRank,
      grandPoints,
      seasonWins,
      podiumCount,
      currentStreak,
      weeklyProgress,
      recentScoreDelta,
      lastActivityAt,
      metadata: {
        teamId: user.teamId || null,
        userName: user.name || `User #${userId}`,
      },
    },
    { transaction }
  );

  return CompetitionUserSummary.findByPk(userId, { transaction });
}

// ─── Team Summary Projector ───────────────────────────────────────────────────

async function projectTeamSummary(teamId, options = {}) {
  const { transaction } = options;
  const team = await Team.findByPk(teamId, {
    include: [{ model: User }],
    transaction,
  });
  if (!team) return null;

  const membersCount = team.Users?.length || 0;

  // 1. Season info
  let currentSeasonId = options.seasonId || null;
  let currentSeasonScore = 0;
  let currentSeasonRank = 0;

  if (!currentSeasonId) {
    const activeSeasonTeam = await SeasonTeam.findOne({
      where: { teamId, isDisqualified: false },
      include: [{ model: Season, as: 'season', where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } } }],
      order: [['created_at', 'DESC']],
      transaction,
    });
    if (activeSeasonTeam) currentSeasonId = activeSeasonTeam.seasonId;
  }

  if (currentSeasonId) {
    const seasonProj = await SeasonLeaderboardProjection.findOne({
      where: { seasonId: currentSeasonId, teamId },
      transaction,
    });
    if (seasonProj) {
      currentSeasonScore = seasonProj.score;
      currentSeasonRank = seasonProj.rank;
    } else {
      const scoreSum = await ScoreLedger.sum('points_delta', {
        where: { teamId, seasonId: currentSeasonId },
        transaction,
      });
      currentSeasonScore = Number(scoreSum || 0);
    }
  }

  // 2. Grand Championship info
  let grandChampionshipId = options.grandId || null;
  let grandRank = 0;
  let grandPoints = 0;
  let seasonWins = 0;
  let podiumCount = 0;

  if (!grandChampionshipId) {
    const activeGrand = await GrandChampionship.findOne({
      where: { status: { [Op.in]: ['ACTIVE', 'CALCULATING', 'FINISHED'] } },
      order: [['year', 'DESC']],
      transaction,
    });
    if (activeGrand) grandChampionshipId = activeGrand.id;
  }

  if (grandChampionshipId) {
    const grandProj = await GrandLeaderboardProjection.findOne({
      where: { grandId: grandChampionshipId, teamId },
      transaction,
    });
    if (grandProj) {
      grandRank = grandProj.rank;
      grandPoints = grandProj.grandPoints;
      seasonWins = grandProj.seasonWins;
      podiumCount = grandProj.podiumCount;
    } else {
      const gpSum = await GrandPointsLedger.sum('grand_points_awarded', {
        where: { grandChampionshipId, teamId },
        transaction,
      });
      grandPoints = Number(gpSum || 0);
    }
  }

  await CompetitionTeamSummary.upsert(
    {
      teamId,
      teamName: team.name,
      teamColor: team.color || '#0284c7',
      currentSeasonId,
      currentSeasonRank,
      currentSeasonScore,
      grandChampionshipId,
      grandRank,
      grandPoints,
      seasonWins,
      podiumCount,
      membersCount,
      lastActivityAt: new Date(),
      metadata: {
        avatar: team.avatar || null,
      },
    },
    { transaction }
  );

  return CompetitionTeamSummary.findByPk(teamId, { transaction });
}

// ─── Season Leaderboard Projector ─────────────────────────────────────────────

async function projectSeasonLeaderboard(seasonId, options = {}) {
  const { transaction } = options;
  const season = await Season.findByPk(seasonId, { transaction });
  if (!season) return [];

  // Reuse pure domain leaderboard calculator
  const leaderboardResult = await seasonService.getSeasonLeaderboard(seasonId);
  const rankings = leaderboardResult.rankings || [];

  // Fetch existing projections to calculate trend
  const existingProjections = await SeasonLeaderboardProjection.findAll({
    where: { seasonId },
    transaction,
  });
  const prevRankMap = new Map();
  for (const p of existingProjections) {
    prevRankMap.set(Number(p.teamId), Number(p.rank));
  }

  for (const row of rankings) {
    const prevRank = prevRankMap.get(Number(row.teamId));
    let trend = 'SAME';
    if (prevRank !== undefined) {
      if (row.rank < prevRank) trend = 'UP';
      else if (row.rank > prevRank) trend = 'DOWN';
    }

    await SeasonLeaderboardProjection.upsert(
      {
        seasonId,
        teamId: row.teamId,
        rank: row.rank,
        score: row.score,
        wins: row.rank === 1 ? 1 : 0,
        podiums: row.rank <= 3 ? 1 : 0,
        trend,
        isEligible: row.isEligible !== false,
        teamName: row.teamName,
        teamAvatar: row.avatar || null,
        teamColor: row.color || '#0284c7',
        metadata: {
          isFrozen: leaderboardResult.isFrozen || false,
        },
      },
      { transaction }
    );
  }

  const projectedRows = await SeasonLeaderboardProjection.findAll({
    where: { seasonId },
    order: [['rank', 'ASC']],
    transaction,
  });

  await updateCheckpoint('season_leaderboard', { metadata: { seasonId, totalTeams: projectedRows.length } }, transaction);

  return projectedRows;
}

// ─── Season Individual Leaderboard Projector ─────────────────────────────────

async function projectSeasonIndividualLeaderboard(seasonId, options = {}) {
  const { transaction } = options;
  const season = await Season.findByPk(seasonId, { transaction });
  if (!season) return [];

  // Reuse pure domain individual leaderboard calculator
  const leaderboardResult = await seasonService.getSeasonIndividualLeaderboard(seasonId, { limit: 1000 });
  const rankings = leaderboardResult.rankings || [];

  // Fetch existing projections to calculate trend
  const existingProjections = await SeasonIndividualLeaderboardProjection.findAll({
    where: { seasonId },
    transaction,
  });
  const prevRankMap = new Map();
  for (const p of existingProjections) {
    prevRankMap.set(Number(p.userId), Number(p.rank));
  }

  for (const row of rankings) {
    const prevRank = prevRankMap.get(Number(row.userId));
    let trend = 'SAME';
    if (prevRank !== undefined) {
      if (row.rank < prevRank) trend = 'UP';
      else if (row.rank > prevRank) trend = 'DOWN';
    }

    await SeasonIndividualLeaderboardProjection.upsert(
      {
        seasonId,
        userId: row.userId,
        teamId: row.teamId || null,
        rank: row.rank,
        points: row.points || 0,
        eventsCount: row.eventsCount || 0,
        trend,
        lastScoredAt: row.lastScoredAt || null,
        userName: row.userName || null,
        userAvatar: row.userAvatar || null,
        teamName: row.teamName || null,
        teamColor: row.teamColor || '#0284c7',
        metadata: {
          isFrozen: leaderboardResult.isFrozen || false,
          isChampion: row.rank === 1,
        },
      },
      { transaction }
    );
  }

  const projectedRows = await SeasonIndividualLeaderboardProjection.findAll({
    where: { seasonId },
    order: [['rank', 'ASC']],
    transaction,
  });

  await updateCheckpoint('season_individual_leaderboard', { metadata: { seasonId, totalIndividuals: projectedRows.length } }, transaction);

  return projectedRows;
}

// ─── Grand Leaderboard Projector ──────────────────────────────────────────────

async function projectGrandLeaderboard(grandId, options = {}) {
  const { transaction } = options;
  const grand = await GrandChampionship.findByPk(grandId, { transaction });
  if (!grand) return [];

  // Reuse pure domain grand standings calculator
  const standingsResult = await grandLeaderboardService.getGrandStandings(grandId);
  const standings = standingsResult.standings || [];

  // Fetch existing projections for trend comparison
  const existingProjections = await GrandLeaderboardProjection.findAll({
    where: { grandId },
    transaction,
  });
  const prevRankMap = new Map();
  for (const p of existingProjections) {
    prevRankMap.set(Number(p.teamId), Number(p.rank));
  }

  for (const row of standings) {
    const prevRank = prevRankMap.get(Number(row.teamId));
    let trend = 'SAME';
    if (prevRank !== undefined) {
      if (row.rank < prevRank) trend = 'UP';
      else if (row.rank > prevRank) trend = 'DOWN';
    }

    await GrandLeaderboardProjection.upsert(
      {
        grandId,
        teamId: row.teamId,
        rank: row.rank,
        grandPoints: row.grandPoints,
        seasonWins: row.seasonWins || 0,
        podiumCount: row.podiumCount || 0,
        completedSeasons: row.completedSeasons || 0,
        trend,
        teamName: row.teamName,
        metadata: {
          isFrozen: standingsResult.isFrozen || false,
          championTeamId: standingsResult.championTeamId || null,
        },
      },
      { transaction }
    );
  }

  const projectedRows = await GrandLeaderboardProjection.findAll({
    where: { grandId },
    order: [['rank', 'ASC']],
    transaction,
  });

  await updateCheckpoint('grand_leaderboard', { metadata: { grandId, totalTeams: projectedRows.length } }, transaction);

  return projectedRows;
}

// ─── Grand Individual Leaderboard Projector ───────────────────────────────────

async function projectGrandIndividualLeaderboard(grandId, options = {}) {
  const { transaction } = options;
  const grand = await GrandChampionship.findByPk(grandId, { transaction });
  if (!grand) return [];

  const standingsResult = await grandLeaderboardService.getGrandIndividualStandings(grandId, { limit: 1000 });
  const standings = standingsResult.standings || [];

  const existingProjections = await GrandIndividualLeaderboardProjection.findAll({
    where: { grandId },
    transaction,
  });
  const prevRankMap = new Map();
  for (const p of existingProjections) {
    prevRankMap.set(Number(p.userId), Number(p.rank));
  }

  for (const row of standings) {
    const prevRank = prevRankMap.get(Number(row.userId));
    let trend = 'SAME';
    if (prevRank !== undefined) {
      if (row.rank < prevRank) trend = 'UP';
      else if (row.rank > prevRank) trend = 'DOWN';
    }

    await GrandIndividualLeaderboardProjection.upsert(
      {
        grandId,
        userId: row.userId,
        teamId: row.teamId || null,
        rank: row.rank,
        grandPoints: row.grandPoints || 0,
        seasonWins: row.seasonWins || 0,
        podiumCount: row.podiumCount || 0,
        eventsCount: row.eventsCount || 0,
        trend,
        lastScoredAt: row.lastScoredAt || null,
        userName: row.userName || null,
        userAvatar: row.userAvatar || null,
        teamName: row.teamName || null,
        teamColor: row.teamColor || '#0284c7',
        metadata: {
          isFrozen: standingsResult.isFrozen || false,
          isChampion: row.rank === 1,
        },
      },
      { transaction }
    );
  }

  const projectedRows = await GrandIndividualLeaderboardProjection.findAll({
    where: { grandId },
    order: [['rank', 'ASC']],
    transaction,
  });

  await updateCheckpoint('grand_individual_leaderboard', { metadata: { grandId, totalIndividuals: projectedRows.length } }, transaction);

  return projectedRows;
}

// ─── Activity Projector ───────────────────────────────────────────────────────

async function projectActivity(activityData, transaction) {
  const {
    activityKey,
    activityType,
    actorUserId,
    teamId,
    seasonId,
    grandId,
    title,
    metadata,
    occurredAt = new Date(),
  } = activityData;

  if (!activityKey || !activityType || !title) {
    throw new Error('Activity projection requires activityKey, activityType, and title');
  }

  const [activity, created] = await CompetitionActivityProjection.findOrCreate({
    where: { activityKey },
    defaults: {
      activityKey,
      activityType,
      actorUserId: actorUserId || null,
      teamId: teamId || null,
      seasonId: seasonId || null,
      grandId: grandId || null,
      title,
      metadata: metadata || null,
      occurredAt,
    },
    transaction,
  });

  return activity;
}

// ─── Incremental Projector from Event ─────────────────────────────────────────

async function projectFromEvent({ event, effects = [], stateUpdates = [] }, transaction) {
  const businessPayload = event?.toBusinessPayload ? event.toBusinessPayload() : event;
  const seasonId = businessPayload?.payload?.seasonId ?? businessPayload?.seasonId ?? null;
  const actorId = businessPayload?.actorId ?? null;
  const teamId = businessPayload?.teamId ?? null;

  // 1. Record Activity Projection for each awarded score effect
  for (let idx = 0; idx < effects.length; idx++) {
    const eff = effects[idx];
    const activityKey = `event:${event.eventId || event.id}:eff:${idx}`;
    const targetUserId = eff.targetType === 'USER' ? eff.targetId : actorId;
    const targetTeamId = eff.targetType === 'TEAM' ? eff.targetId : teamId;

    const title = eff.delta >= 0
      ? `+${eff.delta} XP awarded for ${eff.reason || event.eventType}`
      : `${eff.delta} XP applied for ${eff.reason || event.eventType}`;

    await projectActivity(
      {
        activityKey,
        activityType: 'SCORE_AWARDED',
        actorUserId: targetUserId,
        teamId: targetTeamId,
        seasonId,
        title,
        metadata: { effectType: eff.effectType, delta: eff.delta, eventType: event.eventType },
        occurredAt: businessPayload?.occurredAt || new Date(),
      },
      transaction
    );
  }

  // 2. Record Activity for State Streak milestones
  for (const st of stateUpdates) {
    if (st.thresholdMet) {
      const activityKey = `state_threshold:${st.entityType}:${st.entityId}:${st.stateKey}:${st.version}`;
      await projectActivity(
        {
          activityKey,
          activityType: 'STREAK_ACHIEVED',
          actorUserId: st.entityType === 'user' ? st.entityId : actorId,
          teamId: st.entityType === 'team' ? st.entityId : teamId,
          seasonId,
          title: `Streak milestone achieved: ${st.stateKey} count=${st.data?.count || 0}`,
          metadata: st,
          occurredAt: new Date(),
        },
        transaction
      );
    }
  }

  // 3. Update Season Leaderboards (Team + Individual)
  if (seasonId) {
    await projectSeasonLeaderboard(seasonId, { transaction });
    await projectSeasonIndividualLeaderboard(seasonId, { transaction });

    // Check if season belongs to a Grand Championship
    const seasonRecord = await Season.findByPk(seasonId, { attributes: ['id', 'grandChampionshipId'], transaction });
    const grandIdToUpdate = seasonRecord?.grandChampionshipId;
    if (grandIdToUpdate) {
      await projectGrandLeaderboard(grandIdToUpdate, { transaction });
      await projectGrandIndividualLeaderboard(grandIdToUpdate, { transaction });
    }
  }

  // 4. Update Summaries
  if (actorId) {
    await projectUserSummary(actorId, { seasonId, transaction });
  }
  if (teamId) {
    await projectTeamSummary(teamId, { seasonId, transaction });
  }

  // 5. Update Checkpoints
  await updateCheckpoint('event_projector', { lastEventId: event.eventId || String(event.id) }, transaction);
}

// ─── Rebuild All Read Models from Source of Truth ─────────────────────────────

async function rebuildReadModels(options = {}) {
  const { seasonId, grandId, full = true, actorId, reason } = options;
  const startTime = Date.now();

  console.log('[ReadModelProjector] Starting read model rebuild...', { seasonId, grandId, full });

  // Update checkpoints to REBUILDING
  await ProjectionCheckpoint.upsert({
    projectionName: 'full_rebuild',
    projectionVersion: PROJECTION_VERSION,
    status: 'REBUILDING',
    lastProcessedAt: new Date(),
    metadata: { triggeredBy: actorId, reason },
  });

  return sequelize.transaction(async (t) => {
    // 1. Rebuild Season Leaderboards (Team + Individual)
    const seasonWhere = seasonId ? { id: seasonId } : {};
    const seasons = await Season.findAll({ where: seasonWhere, transaction: t });

    for (const s of seasons) {
      await projectSeasonLeaderboard(s.id, { transaction: t });
      await projectSeasonIndividualLeaderboard(s.id, { transaction: t });
    }

    // 2. Rebuild Grand Leaderboards (Team + Individual)
    const grandWhere = grandId ? { id: grandId } : {};
    const grands = await GrandChampionship.findAll({ where: grandWhere, transaction: t });

    for (const g of grands) {
      await projectGrandLeaderboard(g.id, { transaction: t });
      await projectGrandIndividualLeaderboard(g.id, { transaction: t });
    }

    // 3. Rebuild Team Summaries
    const teams = await Team.findAll({ transaction: t });
    for (const team of teams) {
      await projectTeamSummary(team.id, { seasonId, grandId, transaction: t });
    }

    // 4. Rebuild User Summaries
    const users = await User.findAll({ transaction: t });
    for (const user of users) {
      await projectUserSummary(user.id, { seasonId, grandId, transaction: t });
    }

    // 5. Checkpoints to ACTIVE
    const durationMs = Date.now() - startTime;
    await updateCheckpoint('user_summary', { status: 'ACTIVE', metadata: { totalUsers: users.length } }, t);
    await updateCheckpoint('team_summary', { status: 'ACTIVE', metadata: { totalTeams: teams.length } }, t);
    await updateCheckpoint('season_leaderboard', { status: 'ACTIVE', metadata: { totalSeasons: seasons.length } }, t);
    await updateCheckpoint('season_individual_leaderboard', { status: 'ACTIVE', metadata: { totalSeasons: seasons.length } }, t);
    await updateCheckpoint('grand_leaderboard', { status: 'ACTIVE', metadata: { totalGrands: grands.length } }, t);
    await updateCheckpoint('grand_individual_leaderboard', { status: 'ACTIVE', metadata: { totalGrands: grands.length } }, t);
    await updateCheckpoint('full_rebuild', { status: 'ACTIVE', metadata: { durationMs, completedAt: new Date() } }, t);

    // 6. Log Audit record
    if (actorId) {
      await CompetitionAuditLog.create(
        {
          actorId,
          action: 'PROJECTIONS_REBUILT',
          entityType: 'PROJECTION',
          entityId: 'ALL',
          reason: reason || 'Manual Admin Rebuild',
          metadata: { durationMs, seasonsRebuilt: seasons.length, grandsRebuilt: grands.length },
        },
        { transaction: t }
      );
    }

    return {
      status: 'SUCCESS',
      projectionsRebuilt: [
        'user_summary',
        'team_summary',
        'season_leaderboard',
        'season_individual_leaderboard',
        'grand_leaderboard',
        'grand_individual_leaderboard',
      ],
      usersRebuilt: users.length,
      teamsRebuilt: teams.length,
      seasonsRebuilt: seasons.length,
      grandsRebuilt: grands.length,
      durationMs,
    };
  });
}

module.exports = {
  projectUserSummary,
  projectTeamSummary,
  projectSeasonLeaderboard,
  projectSeasonIndividualLeaderboard,
  projectGrandLeaderboard,
  projectGrandIndividualLeaderboard,
  projectActivity,
  projectFromEvent,
  rebuildReadModels,
  updateCheckpoint,
  PROJECTION_VERSION,
};
