'use strict';

/**
 * competitionDashboard.service.js
 *
 * Query-Only Service for User Competition Dashboard, Team View & Activity Feed.
 * Fast, indexed, bounded queries against Phase 6 Read Model projections.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  User,
  Team,
  Season,
  GrandChampionship,
  ScoreLedger,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  CompetitionActivityProjection,
} = require('../../models');

const projector = require('./competitionReadModel.projector');

async function getUserDashboard(userId) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'role', 'teamId'],
    include: [{ model: Team, attributes: ['id', 'name'] }],
  });
  if (!user) throw new Error(`User #${userId} not found`);

  // 1. Fetch or Project User Summary
  let userSummary = await CompetitionUserSummary.findByPk(userId);
  if (!userSummary) {
    userSummary = await projector.projectUserSummary(userId);
  }

  // 2. Fetch or Project Team Summary
  let teamSummary = null;
  if (user.teamId) {
    teamSummary = await CompetitionTeamSummary.findByPk(user.teamId);
    if (!teamSummary) {
      teamSummary = await projector.projectTeamSummary(user.teamId);
    }
  }

  // 3. Active Season info & Top 3 Leaders (Team & Individual)
  let activeSeason = null;
  let seasonLeaders = [];
  let seasonIndividualLeaders = [];
  const currentSeasonId = userSummary?.currentSeasonId;

  if (currentSeasonId) {
    activeSeason = await Season.findByPk(currentSeasonId, {
      attributes: ['id', 'name', 'slug', 'seasonType', 'status', 'startAt', 'endAt'],
    });

    seasonLeaders = await SeasonLeaderboardProjection.findAll({
      where: { seasonId: currentSeasonId },
      order: [['rank', 'ASC']],
      limit: 3,
    });

    seasonIndividualLeaders = await SeasonIndividualLeaderboardProjection.findAll({
      where: { seasonId: currentSeasonId },
      order: [['rank', 'ASC']],
      limit: 3,
    });
  }

  // 4. Grand Championship info & Top 3 Leaders (Team & Individual)
  let grandChampionship = null;
  let grandLeaders = [];
  let grandIndividualLeaders = [];
  const grandId = userSummary?.grandChampionshipId;

  if (grandId) {
    grandChampionship = await GrandChampionship.findByPk(grandId, {
      attributes: ['id', 'name', 'year', 'status', 'startAt', 'endAt'],
    });

    grandLeaders = await GrandLeaderboardProjection.findAll({
      where: { grandId },
      order: [['rank', 'ASC']],
      limit: 3,
    });

    grandIndividualLeaders = await GrandIndividualLeaderboardProjection.findAll({
      where: { grandId },
      order: [['rank', 'ASC']],
      limit: 3,
    });
  }

  // 5. Recent Activities (Personal + Team + Global Season)
  const activityWhere = [];
  activityWhere.push({ actorUserId: userId });
  if (user.teamId) activityWhere.push({ teamId: user.teamId });
  if (currentSeasonId) activityWhere.push({ seasonId: currentSeasonId });

  const recentActivities = await CompetitionActivityProjection.findAll({
    where: { [Op.or]: activityWhere },
    order: [['occurred_at', 'DESC']],
    limit: 10,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      team: user.Team ? { id: user.Team.id, name: user.Team.name } : null,
    },
    userSummary: userSummary ? {
      currentSeasonRank: userSummary.currentSeasonRank,
      currentSeasonScore: userSummary.currentSeasonScore,
      grandRank: userSummary.grandRank,
      grandPoints: userSummary.grandPoints,
      seasonWins: userSummary.seasonWins,
      podiumCount: userSummary.podiumCount,
      currentStreak: userSummary.currentStreak,
      weeklyProgress: userSummary.weeklyProgress,
      recentScoreDelta: userSummary.recentScoreDelta,
      lastActivityAt: userSummary.lastActivityAt,
    } : null,
    teamSummary: teamSummary ? {
      teamId: teamSummary.teamId,
      teamName: teamSummary.teamName,
      teamColor: teamSummary.teamColor,
      currentSeasonRank: teamSummary.currentSeasonRank,
      currentSeasonScore: teamSummary.currentSeasonScore,
      grandRank: teamSummary.grandRank,
      grandPoints: teamSummary.grandPoints,
      membersCount: teamSummary.membersCount,
    } : null,
    activeSeason: activeSeason ? {
      id: activeSeason.id,
      name: activeSeason.name,
      status: activeSeason.status,
      startAt: activeSeason.startAt,
      endAt: activeSeason.endAt,
      leaders: seasonLeaders.map((l) => ({
        rank: l.rank,
        teamId: l.teamId,
        teamName: l.teamName,
        score: l.score,
        trend: l.trend,
      })),
      individualLeaders: seasonIndividualLeaders.map((l) => ({
        rank: l.rank,
        userId: l.userId,
        userName: l.userName,
        teamName: l.teamName,
        points: l.points,
        trend: l.trend,
      })),
      individualChampion: seasonIndividualLeaders[0] || null,
    } : null,
    grandChampionship: grandChampionship ? {
      id: grandChampionship.id,
      name: grandChampionship.name,
      year: grandChampionship.year,
      status: grandChampionship.status,
      leaders: grandLeaders.map((l) => ({
        rank: l.rank,
        teamId: l.teamId,
        teamName: l.teamName,
        grandPoints: l.grandPoints,
        trend: l.trend,
      })),
      individualLeaders: grandIndividualLeaders.map((l) => ({
        rank: l.rank,
        userId: l.userId,
        userName: l.userName,
        teamName: l.teamName,
        grandPoints: l.grandPoints,
        trend: l.trend,
      })),
      individualChampion: grandIndividualLeaders[0] || null,
    } : null,
    recentActivities: recentActivities.map((a) => ({
      id: a.id,
      type: a.activityType,
      title: a.title,
      metadata: a.metadata,
      occurredAt: a.occurredAt,
    })),
  };
}

async function getTeamSummary(teamId) {
  const team = await Team.findByPk(teamId, {
    include: [{ model: User, attributes: ['id', 'name', 'role'] }],
  });
  if (!team) throw new Error(`Team #${teamId} not found`);

  let teamSummary = await CompetitionTeamSummary.findByPk(teamId);
  if (!teamSummary) {
    teamSummary = await projector.projectTeamSummary(teamId);
  }

  // Get member summaries
  const memberIds = (team.Users || []).map((u) => u.id);
  const memberSummaries = await CompetitionUserSummary.findAll({
    where: { userId: { [Op.in]: memberIds.length > 0 ? memberIds : [0] } },
  });

  const memberSummaryMap = new Map();
  for (const m of memberSummaries) {
    memberSummaryMap.set(Number(m.userId), m);
  }

  const membersList = (team.Users || []).map((u) => {
    const s = memberSummaryMap.get(Number(u.id));
    return {
      userId: u.id,
      name: u.name,
      seasonScore: s?.currentSeasonScore || 0,
      seasonRank: s?.currentSeasonRank || 0,
      currentStreak: s?.currentStreak || 0,
    };
  }).sort((a, b) => b.seasonScore - a.seasonScore);

  // Recent team activities
  const recentActivities = await CompetitionActivityProjection.findAll({
    where: { teamId },
    order: [['occurred_at', 'DESC']],
    limit: 10,
  });

  return {
    team: {
      id: team.id,
      name: team.name,
      color: team.color,
      avatar: team.avatar,
    },
    summary: teamSummary,
    members: membersList,
    recentActivities,
  };
}

async function getSeasonLeaderboardProjection(seasonId, options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const { rows, count } = await SeasonLeaderboardProjection.findAndCountAll({
    where: { seasonId },
    order: [['rank', 'ASC']],
    limit,
    offset,
  });

  return {
    seasonId: Number(seasonId),
    scope: 'team',
    page,
    limit,
    totalTeams: count,
    totalPages: Math.ceil(count / limit),
    rankings: rows,
  };
}

async function getSeasonIndividualLeaderboardProjection(seasonId, options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const where = { seasonId };
  if (options.teamId) {
    where.teamId = options.teamId;
  }
  if (options.search && options.search.trim()) {
    where.userName = { [Op.like]: `%${options.search.trim()}%` };
  }

  const { rows, count } = await SeasonIndividualLeaderboardProjection.findAndCountAll({
    where,
    order: [['rank', 'ASC']],
    limit,
    offset,
  });

  const champion = await SeasonIndividualLeaderboardProjection.findOne({
    where: { seasonId, rank: 1 },
  });

  return {
    seasonId: Number(seasonId),
    scope: 'individual',
    page,
    limit,
    totalIndividuals: count,
    totalPages: Math.ceil(count / limit),
    seasonIndividualChampion: champion,
    rankings: rows,
  };
}

async function getGrandLeaderboardProjection(grandId, options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const { rows, count } = await GrandLeaderboardProjection.findAndCountAll({
    where: { grandId },
    order: [['rank', 'ASC']],
    limit,
    offset,
  });

  return {
    grandId: Number(grandId),
    scope: 'team',
    page,
    limit,
    totalTeams: count,
    totalPages: Math.ceil(count / limit),
    standings: rows,
  };
}

async function getGrandIndividualLeaderboardProjection(grandId, options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 50)));
  const offset = (page - 1) * limit;

  const where = { grandId };
  if (options.teamId) {
    where.teamId = options.teamId;
  }
  if (options.search && options.search.trim()) {
    where.userName = { [Op.like]: `%${options.search.trim()}%` };
  }

  const { rows, count } = await GrandIndividualLeaderboardProjection.findAndCountAll({
    where,
    order: [['rank', 'ASC']],
    limit,
    offset,
  });

  const champion = await GrandIndividualLeaderboardProjection.findOne({
    where: { grandId, rank: 1 },
  });

  return {
    grandId: Number(grandId),
    scope: 'individual',
    page,
    limit,
    totalIndividuals: count,
    totalPages: Math.ceil(count / limit),
    grandIndividualChampion: champion,
    standings: rows,
  };
}

async function getTopPerformers(options = {}) {
  let { seasonId, grandId } = options;

  if (!seasonId) {
    const activeSeason = await Season.findOne({
      where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } },
      order: [['start_at', 'DESC']],
    });
    if (activeSeason) seasonId = activeSeason.id;
  }

  if (!grandId) {
    const activeGrand = await GrandChampionship.findOne({
      where: { status: { [Op.in]: ['ACTIVE', 'CALCULATING'] } },
      order: [['year', 'DESC']],
    });
    if (activeGrand) grandId = activeGrand.id;
  }

  let seasonTeamChampion = null;
  let seasonIndividualChampion = null;
  let top3SeasonIndividuals = [];

  if (seasonId) {
    seasonTeamChampion = await SeasonLeaderboardProjection.findOne({
      where: { seasonId, rank: 1 },
    });
    seasonIndividualChampion = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId, rank: 1 },
    });
    top3SeasonIndividuals = await SeasonIndividualLeaderboardProjection.findAll({
      where: { seasonId, rank: { [Op.lte]: 3 } },
      order: [['rank', 'ASC']],
    });
  }

  let grandTeamChampion = null;
  let grandIndividualChampion = null;
  let top3GrandIndividuals = [];

  if (grandId) {
    grandTeamChampion = await GrandLeaderboardProjection.findOne({
      where: { grandId, rank: 1 },
    });
    grandIndividualChampion = await GrandIndividualLeaderboardProjection.findOne({
      where: { grandId, rank: 1 },
    });
    top3GrandIndividuals = await GrandIndividualLeaderboardProjection.findAll({
      where: { grandId, rank: { [Op.lte]: 3 } },
      order: [['rank', 'ASC']],
    });
  }

  return {
    seasonId,
    grandId,
    seasonTeamChampion,
    seasonIndividualChampion,
    top3SeasonIndividuals,
    grandTeamChampion,
    grandIndividualChampion,
    top3GrandIndividuals,
  };
}

async function getEmployeeBreakdown(userId, options = {}) {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'name', 'email', 'role', 'teamId'],
    include: [{ model: Team, attributes: ['id', 'name'] }],
  });
  if (!user) throw new Error(`User #${userId} not found`);

  const where = { userId };
  if (options.seasonId) where.seasonId = options.seasonId;

  // 1. Calculate Lifetime vs Season Points
  const lifetimePoints = await ScoreLedger.sum('points_delta', { where: { userId } }) || 0;
  let seasonPoints = 0;
  if (options.seasonId) {
    seasonPoints = await ScoreLedger.sum('points_delta', { where: { userId, seasonId: options.seasonId } }) || 0;
  }

  // 2. Score breakdown by Effect Type
  const breakdownRows = await ScoreLedger.findAll({
    attributes: [
      'effect_type',
      [sequelize.fn('SUM', sequelize.col('points_delta')), 'totalPoints'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'entryCount'],
    ],
    where,
    group: ['effect_type'],
    raw: true,
  });

  const categories = breakdownRows.map((r) => ({
    effectType: r.effect_type,
    points: Number(r.totalPoints || 0),
    count: Number(r.entryCount || 0),
  }));

  // 3. Recent scoring events
  const recentEntries = await ScoreLedger.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit: 15,
  });

  return {
    user: {
      id: user.id,
      name: user.name,
      avatarUrl: null,
      team: user.Team ? { id: user.Team.id, name: user.Team.name, color: '#0284c7' } : null,
    },
    lifetimePoints: Number(lifetimePoints),
    seasonPoints: Number(seasonPoints),
    breakdown: categories,
    recentScores: recentEntries.map((e) => ({
      id: e.id,
      pointsDelta: e.pointsDelta,
      effectType: e.effectType,
      reason: e.reason,
      createdAt: e.createdAt,
    })),
  };
}

async function getActivityFeed(options = {}) {
  const page = Math.max(1, Number(options.page || 1));
  const limit = Math.min(100, Math.max(1, Number(options.limit || 20)));
  const offset = (page - 1) * limit;

  const where = {};
  if (options.userId) where.actorUserId = options.userId;
  if (options.teamId) where.teamId = options.teamId;
  if (options.seasonId) where.seasonId = options.seasonId;
  if (options.grandId) where.grandId = options.grandId;
  if (options.activityType) where.activityType = options.activityType;

  const { rows, count } = await CompetitionActivityProjection.findAndCountAll({
    where,
    order: [['occurred_at', 'DESC']],
    limit,
    offset,
  });

  return {
    page,
    limit,
    totalActivities: count,
    totalPages: Math.ceil(count / limit),
    activities: rows,
  };
}

async function getCompanyOverview() {
  const activeSeason = await Season.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } },
    order: [['start_at', 'DESC']],
  });

  const activeGrand = await GrandChampionship.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'CALCULATING'] } },
    order: [['year', 'DESC']],
  });

  let topSeasonTeams = [];
  let topSeasonIndividuals = [];
  if (activeSeason) {
    topSeasonTeams = await SeasonLeaderboardProjection.findAll({
      where: { seasonId: activeSeason.id },
      order: [['rank', 'ASC']],
      limit: 5,
    });
    topSeasonIndividuals = await SeasonIndividualLeaderboardProjection.findAll({
      where: { seasonId: activeSeason.id },
      order: [['rank', 'ASC']],
      limit: 5,
    });
  }

  let topGrandTeams = [];
  let topGrandIndividuals = [];
  if (activeGrand) {
    topGrandTeams = await GrandLeaderboardProjection.findAll({
      where: { grandId: activeGrand.id },
      order: [['rank', 'ASC']],
      limit: 5,
    });
    topGrandIndividuals = await GrandIndividualLeaderboardProjection.findAll({
      where: { grandId: activeGrand.id },
      order: [['rank', 'ASC']],
      limit: 5,
    });
  }

  const recentCompanyActivities = await CompetitionActivityProjection.findAll({
    order: [['occurred_at', 'DESC']],
    limit: 10,
  });

  return {
    activeSeason: activeSeason ? {
      id: activeSeason.id,
      name: activeSeason.name,
      status: activeSeason.status,
      startAt: activeSeason.startAt,
      endAt: activeSeason.endAt,
      topTeams: topSeasonTeams,
      topIndividuals: topSeasonIndividuals,
      individualChampion: topSeasonIndividuals[0] || null,
    } : null,
    activeGrand: activeGrand ? {
      id: activeGrand.id,
      name: activeGrand.name,
      year: activeGrand.year,
      status: activeGrand.status,
      topTeams: topGrandTeams,
      topIndividuals: topGrandIndividuals,
      individualChampion: topGrandIndividuals[0] || null,
    } : null,
    recentActivities: recentCompanyActivities,
  };
}

module.exports = {
  getUserDashboard,
  getTeamSummary,
  getSeasonLeaderboardProjection,
  getSeasonIndividualLeaderboardProjection,
  getGrandLeaderboardProjection,
  getGrandIndividualLeaderboardProjection,
  getTopPerformers,
  getEmployeeBreakdown,
  getActivityFeed,
  getCompanyOverview,
};
