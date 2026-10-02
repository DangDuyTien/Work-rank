'use strict';

/**
 * ranking.service.js
 *
 * Canonical Unified Ranking Service for WorkRank V3.3.
 * Consolidates all ranking dimensions (Team, Individual, Season, Grand, YouTube, Top Performers)
 * into a single unified query layer without altering underlying scoring calculation engines.
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const {
  User,
  UserProfilePreference,
  Team,
  Season,
  SeasonTeam,
  GrandChampionship,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  TeamYouTubeSummary,
  ActivitySummary,
} = require('../../models');

const seasonService = require('../competition/season.service');
const grandLeaderboardService = require('../competition/grandLeaderboard.service');
const youtubeAggregationService = require('../youtube/youtubeAggregation.service');
const projector = require('../competition/competitionReadModel.projector');

/**
 * 1. GET RANKING OVERVIEW (Company-wide snapshot)
 */
async function getRankingOverview() {
  // 1. Current Active Season & Top 3 Team / Individual
  let activeSeason = await Season.findOne({
    where: { status: 'ACTIVE' },
    order: [['id', 'DESC']],
  });
  if (!activeSeason) {
    activeSeason = await Season.findOne({
      order: [['id', 'DESC']],
    });
  }

  let seasonTopTeams = [];
  let seasonTopIndividuals = [];
  if (activeSeason) {
    let rawTeams = await SeasonLeaderboardProjection.findAll({
      where: { seasonId: activeSeason.id },
      order: [['rank', 'ASC']],
      limit: 3,
    });
    if (rawTeams.length === 0) {
      await projector.projectSeasonLeaderboard(activeSeason.id);
      rawTeams = await SeasonLeaderboardProjection.findAll({
        where: { seasonId: activeSeason.id },
        order: [['rank', 'ASC']],
        limit: 3,
      });
    }

    seasonTopTeams = rawTeams.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      totalScore: Number(t.score || 0),
      rank: t.rank,
      wins: t.wins,
      podiums: t.podiums,
    }));

    let rawIndivs = await SeasonIndividualLeaderboardProjection.findAll({
      where: { seasonId: activeSeason.id },
      order: [['rank', 'ASC']],
      limit: 3,
    });
    if (rawIndivs.length === 0) {
      await projector.projectSeasonIndividualLeaderboard(activeSeason.id);
      rawIndivs = await SeasonIndividualLeaderboardProjection.findAll({
        where: { seasonId: activeSeason.id },
        order: [['rank', 'ASC']],
        limit: 3,
      });
    }

    seasonTopIndividuals = rawIndivs.map((i) => ({
      userId: i.userId,
      userName: i.userName,
      teamId: i.teamId,
      teamName: i.teamName,
      score: Number(i.points || 0),
      rank: i.rank,
      trend: i.trend,
    }));
  }

  // 2. Current Grand Championship & Top 3 Team / Individual
  let currentGrand = await GrandChampionship.findOne({
    where: { status: 'ACTIVE' },
    order: [['year', 'DESC']],
  });
  if (!currentGrand) {
    currentGrand = await GrandChampionship.findOne({
      order: [['year', 'DESC']],
    });
  }

  let grandTopTeams = [];
  let grandTopIndividuals = [];
  if (currentGrand) {
    let rawGrandTeams = await GrandLeaderboardProjection.findAll({
      where: { grandId: currentGrand.id },
      order: [['rank', 'ASC']],
      limit: 3,
    });
    if (rawGrandTeams.length === 0) {
      await projector.projectGrandLeaderboard(currentGrand.id);
      rawGrandTeams = await GrandLeaderboardProjection.findAll({
        where: { grandId: currentGrand.id },
        order: [['rank', 'ASC']],
        limit: 3,
      });
    }

    grandTopTeams = rawGrandTeams.map((t) => ({
      teamId: t.teamId,
      teamName: t.teamName,
      grandPoints: Number(t.grandPoints || 0),
      rank: t.rank,
      seasonsWon: t.seasonsWon,
      podiumCount: t.podiumCount,
    }));

    let rawGrandIndivs = await GrandIndividualLeaderboardProjection.findAll({
      where: { grandId: currentGrand.id },
      order: [['rank', 'ASC']],
      limit: 3,
    });
    if (rawGrandIndivs.length === 0) {
      await projector.projectGrandIndividualLeaderboard(currentGrand.id);
      rawGrandIndivs = await GrandIndividualLeaderboardProjection.findAll({
        where: { grandId: currentGrand.id },
        order: [['rank', 'ASC']],
        limit: 3,
      });
    }

    grandTopIndividuals = rawGrandIndivs.map((i) => ({
      userId: i.userId,
      userName: i.userName,
      teamId: i.teamId,
      teamName: i.teamName,
      grandPoints: Number(i.grandPoints || 0),
      rank: i.rank,
    }));
  }

  // 3. YouTube Top Team / Channel
  let topYouTubeTeam = null;
  try {
    const topYt = await TeamYouTubeSummary.findOne({
      order: [['totalViews', 'DESC']],
      include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }],
    });
    if (topYt) {
      topYouTubeTeam = {
        teamId: topYt.teamId,
        teamName: topYt.team?.name || `Team ${topYt.teamId}`,
        totalViews: Number(topYt.totalViews || 0),
        totalSubscribers: Number(topYt.totalSubscribers || 0),
        viewsGrowth30dPct: Number(topYt.viewsGrowth30dPct || 0),
      };
    }
  } catch {
    // Model query fallback
  }

  // 4. Overall Top Team & Top Individual
  let topAllTimeTeam = null;
  try {
    const topTeamSummary = await CompetitionTeamSummary.findOne({
      order: [['currentSeasonScore', 'DESC'], ['seasonWins', 'DESC']],
    });
    if (topTeamSummary) {
      topAllTimeTeam = {
        teamId: topTeamSummary.teamId,
        teamName: topTeamSummary.teamName,
        totalScore: Number(topTeamSummary.currentSeasonScore || 0),
        seasonsWon: Number(topTeamSummary.seasonWins || 0),
      };
    }
  } catch {
    // Safe fallback
  }

  let topAllTimeIndividual = null;
  try {
    const topUserSummary = await CompetitionUserSummary.findOne({
      order: [['currentSeasonScore', 'DESC']],
    });
    if (topUserSummary) {
      topAllTimeIndividual = {
        userId: topUserSummary.userId,
        userName: topUserSummary.metadata?.userName || `User #${topUserSummary.userId}`,
        teamName: topUserSummary.metadata?.teamName,
        lifetimeScore: Number(topUserSummary.currentSeasonScore || 0),
        seasonsParticipated: Number(topUserSummary.seasonWins || 0),
      };
    }
  } catch {
    // Safe fallback
  }

  // 5. Aggregate Platform Stats
  const totalTeams = await Team.count();
  const totalUsers = await User.count();
  const totalSeasons = await Season.count();
  const totalGrands = await GrandChampionship.count();

  return {
    activeSeason: activeSeason ? {
      id: activeSeason.id,
      name: activeSeason.name,
      slug: activeSeason.slug,
      status: activeSeason.status,
      startAt: activeSeason.startAt,
      endAt: activeSeason.endAt,
      topTeams: seasonTopTeams,
      topIndividuals: seasonTopIndividuals,
    } : null,
    currentGrand: currentGrand ? {
      id: currentGrand.id,
      name: currentGrand.name,
      year: currentGrand.year,
      status: currentGrand.status,
      topTeams: grandTopTeams,
      topIndividuals: grandTopIndividuals,
    } : null,
    topYouTubeTeam,
    topAllTimeTeam,
    topAllTimeIndividual,
    stats: {
      totalTeams,
      totalUsers,
      totalSeasons,
      totalGrands,
    },
  };
}

/**
 * 2. GET TEAM RANKINGS
 * @param {Object} params - { scope: 'season'|'grand'|'all-time', seasonId, grandId, limit, page }
 */
async function getTeamRankings(params = {}) {
  const { scope = 'season', seasonId, grandId, limit = 50, page = 1 } = params;
  const numLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;

  if (scope === 'grand' || grandId) {
    let targetGrandId = grandId;
    if (!targetGrandId) {
      const activeGrand = await GrandChampionship.findOne({
        where: { status: 'ACTIVE' },
        order: [['year', 'DESC']],
      });
      targetGrandId = activeGrand?.id;
    }

    if (!targetGrandId) {
      return { scope: 'grand', grandId: null, items: [], total: 0, page: numPage, limit: numLimit, totalPages: 0 };
    }

    const { rows, count } = await GrandLeaderboardProjection.findAndCountAll({
      where: { grandId: targetGrandId },
      order: [['rank', 'ASC']],
      limit: numLimit,
      offset,
    });

    const grand = await GrandChampionship.findByPk(targetGrandId, {
      attributes: ['id', 'name', 'year', 'status'],
    });

    return {
      scope: 'grand',
      grand,
      grandId: Number(targetGrandId),
      items: rows.map((r) => ({
        rank: r.rank,
        teamId: r.teamId,
        teamName: r.teamName,
        grandPoints: Number(r.grandPoints || 0),
        seasonsWon: Number(r.seasonsWon || 0),
        podiumCount: Number(r.podiumCount || 0),
        trend: r.trend || 'SAME',
        gap: Math.max(0, Number(rows[0]?.grandPoints || 0) - Number(r.grandPoints || 0)),
      })),
      total: count,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(count / numLimit),
    };
  }

  if (scope === 'all-time') {
    const { rows, count } = await CompetitionTeamSummary.findAndCountAll({
      order: [['currentSeasonScore', 'DESC'], ['seasonWins', 'DESC']],
      limit: numLimit,
      offset,
    });

    const leaderScore = Number(rows[0]?.currentSeasonScore || 0);
    const items = rows.map((r, idx) => ({
      rank: offset + idx + 1,
      teamId: r.teamId,
      teamName: r.teamName,
      totalScore: Number(r.currentSeasonScore || 0),
      seasonsWon: Number(r.seasonWins || 0),
      grandPoints: Number(r.grandPoints || 0),
      activeMembersCount: Number(r.membersCount || 0),
      lastActivityAt: r.lastActivityAt,
      trend: 'SAME',
      gap: Math.max(0, leaderScore - Number(r.currentSeasonScore || 0)),
    }));

    return {
      scope: 'all-time',
      items,
      total: count,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(count / numLimit),
    };
  }

  // Default: scope === 'season'
  let targetSeasonId = seasonId;
  if (!targetSeasonId) {
    const activeSeason = await Season.findOne({
      where: { status: 'ACTIVE' },
      order: [['startAt', 'DESC']],
    });
    targetSeasonId = activeSeason?.id;
  }

  if (!targetSeasonId) {
    const latestSeason = await Season.findOne({ order: [['startAt', 'DESC']] });
    targetSeasonId = latestSeason?.id;
  }

  if (!targetSeasonId) {
    return { scope: 'season', seasonId: null, items: [], total: 0, page: numPage, limit: numLimit, totalPages: 0 };
  }

  let { rows, count } = await SeasonLeaderboardProjection.findAndCountAll({
    where: { seasonId: targetSeasonId },
    order: [['rank', 'ASC']],
    limit: numLimit,
    offset,
  });

  if (count === 0) {
    await projector.projectSeasonLeaderboard(targetSeasonId);
    const refreshed = await SeasonLeaderboardProjection.findAndCountAll({
      where: { seasonId: targetSeasonId },
      order: [['rank', 'ASC']],
      limit: numLimit,
      offset,
    });
    rows = refreshed.rows;
    count = refreshed.count;
  }

  const season = await Season.findByPk(targetSeasonId, {
    attributes: ['id', 'name', 'slug', 'status', 'startAt', 'endAt'],
  });

  return {
    scope: 'season',
    season,
    seasonId: Number(targetSeasonId),
    items: rows.map((r) => ({
      rank: r.rank,
      teamId: r.teamId,
      teamName: r.teamName,
      totalScore: Number(r.score || 0),
      wins: r.wins,
      podiums: r.podiums,
      activeMembersCount: r.activeMembersCount || 0,
      trend: r.trend || 'SAME',
      gap: Math.max(0, Number(rows[0]?.score || 0) - Number(r.score || 0)),
    })),
    total: count,
    page: numPage,
    limit: numLimit,
    totalPages: Math.ceil(count / numLimit),
  };
}

/**
 * 3. GET INDIVIDUAL RANKINGS
 * @param {Object} params - { scope: 'season'|'grand'|'all-time', seasonId, grandId, teamId, search, limit, page }
 */
async function getIndividualRankings(params = {}) {
  const { scope = 'all-time', seasonId, grandId, teamId, search, limit = 50, page = 1 } = params;
  const numLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const numPage = Math.max(1, Number(page) || 1);
  const offset = (numPage - 1) * numLimit;

  if (scope === 'grand' || grandId) {
    let targetGrandId = grandId;
    if (!targetGrandId) {
      const activeGrand = await GrandChampionship.findOne({
        where: { status: 'ACTIVE' },
        order: [['year', 'DESC']],
      });
      targetGrandId = activeGrand?.id;
    }

    if (!targetGrandId) {
      return { scope: 'grand', grandId: null, items: [], total: 0, page: numPage, limit: numLimit, totalPages: 0 };
    }

    const where = { grandId: targetGrandId };
    if (teamId) where.teamId = teamId;
    if (search && search.trim()) {
      where[Op.or] = [
        { userName: { [Op.like]: `%${search.trim()}%` } },
        { userEmail: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    let { rows, count } = await GrandIndividualLeaderboardProjection.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified', 'isDev'],
          include: [
            { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
          ],
          required: false,
        },
      ],
      order: [['rank', 'ASC']],
      limit: numLimit,
      offset,
    });

    if (count === 0 && !teamId && !search) {
      await projector.projectGrandIndividualLeaderboard(targetGrandId);
      const refreshed = await GrandIndividualLeaderboardProjection.findAndCountAll({
        where,
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified', 'isDev'],
            include: [
              { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
            ],
            required: false,
          },
        ],
        order: [['rank', 'ASC']],
        limit: numLimit,
        offset,
      });
      rows = refreshed.rows;
      count = refreshed.count;
    }

    const grand = await GrandChampionship.findByPk(targetGrandId, {
      attributes: ['id', 'name', 'year', 'status'],
    });

    return {
      scope: 'grand',
      grand,
      grandId: Number(targetGrandId),
      items: rows.map((r) => {
        const u = r.user;
        const pref = u?.UserProfilePreference || u?.userProfilePreference;
        return {
          rank: r.rank,
          userId: r.userId,
          userName: u?.name || r.userName,
          userEmail: r.userEmail,
          jobTitle: u?.jobTitle || 'Nhân viên',
          department: u?.department || 'Media & Content',
          isVerified: Boolean(u?.isVerified),
          isDev: Boolean(u?.isDev),
          userAvatar: pref?.avatarData || r.userAvatar || null,
          avatarData: pref?.avatarData || null,
          featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
          teamId: r.teamId,
          teamName: r.teamName,
          grandPoints: Number(r.grandPoints || 0),
          score: Number(r.grandPoints || 0),
          totalScore: Number(r.grandPoints || 0),
          trend: r.trend || 'SAME',
          gap: Math.max(0, Number(rows[0]?.grandPoints || 0) - Number(r.grandPoints || 0)),
        };
      }),
      total: count,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(count / numLimit) || 1,
    };
  }

  if (scope === 'all-time') {
    const userWhere = { status: { [Op.ne]: 'inactive' } };
    if (teamId) userWhere.teamId = teamId;
    if (search && search.trim()) {
      userWhere[Op.or] = [
        { name: { [Op.like]: `%${search.trim()}%` } },
        { email: { [Op.like]: `%${search.trim()}%` } },
      ];
    }

    const allUsers = await User.findAll({
      where: userWhere,
      attributes: ['id', 'name', 'email', 'role', 'teamId', 'jobTitle', 'department', 'isVerified', 'isDev', 'createdAt'],
      include: [
        { model: Team, attributes: ['id', 'name'] },
        { model: CompetitionUserSummary, as: 'competitionSummary', required: false },
        { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      ],
    });

    allUsers.sort((a, b) => {
      const aScore = Number(a.competitionSummary?.currentSeasonScore || 0);
      const bScore = Number(b.competitionSummary?.currentSeasonScore || 0);
      if (bScore !== aScore) return bScore - aScore;

      const aWins = Number(a.competitionSummary?.seasonWins || 0);
      const bWins = Number(b.competitionSummary?.seasonWins || 0);
      if (bWins !== aWins) return bWins - aWins;

      const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (aCreated !== bCreated) return aCreated - bCreated;

      return Number(a.id) - Number(b.id);
    });

    const total = allUsers.length;
    const paginated = allUsers.slice(offset, offset + numLimit);
    const leaderScore = Number(allUsers[0]?.competitionSummary?.currentSeasonScore || 0);

    const items = paginated.map((u, idx) => {
      const summary = u.competitionSummary;
      const pref = u.UserProfilePreference || u.userProfilePreference;
      const score = Number(summary?.currentSeasonScore || 0);
      const rank = offset + idx + 1;
      return {
        rank,
        userId: u.id,
        userName: u.name,
        userEmail: u.email,
        jobTitle: u.jobTitle || 'Nhân viên',
        department: u.department || 'Media & Content',
        isVerified: Boolean(u.isVerified),
        isDev: Boolean(u.isDev),
        userAvatar: pref?.avatarData || null,
        avatarData: pref?.avatarData || null,
        featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
        teamId: u.teamId,
        teamName: u.Team ? u.Team.name : '—',
        score,
        totalScore: score,
        lifetimeScore: score,
        seasonsWon: Number(summary?.seasonWins || 0),
        mvpCount: Number(summary?.metadata?.mvpCount || 0),
        trend: 'SAME',
        gap: Math.max(0, leaderScore - score),
      };
    });

    return {
      scope: 'all-time',
      items,
      total,
      page: numPage,
      limit: numLimit,
      totalPages: Math.ceil(total / numLimit) || 1,
    };
  }

  // Default: scope === 'season'
  let targetSeasonId = seasonId;
  if (!targetSeasonId) {
    const activeSeason = await Season.findOne({
      where: { status: 'ACTIVE' },
      order: [['startAt', 'DESC']],
    });
    targetSeasonId = activeSeason?.id;
  }

  if (!targetSeasonId) {
    const latestSeason = await Season.findOne({ order: [['startAt', 'DESC']] });
    targetSeasonId = latestSeason?.id;
  }

  if (!targetSeasonId) {
    return { scope: 'season', seasonId: null, items: [], total: 0, page: numPage, limit: numLimit, totalPages: 0 };
  }

  const where = { seasonId: targetSeasonId };
  if (teamId) where.teamId = teamId;
  if (search && search.trim()) {
    where.userName = { [Op.like]: `%${search.trim()}%` };
  }

  let { rows, count } = await SeasonIndividualLeaderboardProjection.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified', 'isDev'],
        include: [
          { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
        ],
        required: false,
      },
    ],
    order: [['rank', 'ASC']],
    limit: numLimit,
    offset,
  });

  if (count === 0 && !teamId && !search) {
    await projector.projectSeasonIndividualLeaderboard(targetSeasonId);
    const refreshed = await SeasonIndividualLeaderboardProjection.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified', 'isDev'],
          include: [
            { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
          ],
          required: false,
        },
      ],
      order: [['rank', 'ASC']],
      limit: numLimit,
      offset,
    });
    rows = refreshed.rows;
    count = refreshed.count;
  }

  const season = await Season.findByPk(targetSeasonId, {
    attributes: ['id', 'name', 'slug', 'status', 'startAt', 'endAt'],
  });

  return {
    scope: 'season',
    season,
    seasonId: Number(targetSeasonId),
    items: rows.map((r) => {
      const u = r.user;
      const pref = u?.UserProfilePreference || u?.userProfilePreference;
      return {
        rank: r.rank,
        userId: r.userId,
        userName: u?.name || r.userName,
        jobTitle: u?.jobTitle || 'Nhân viên',
        department: u?.department || 'Media & Content',
        isVerified: Boolean(u?.isVerified),
        isDev: Boolean(u?.isDev),
        userAvatar: pref?.avatarData || r.userAvatar || null,
        avatarData: pref?.avatarData || null,
        featuredBadges: Array.isArray(pref?.featuredBadges) ? pref.featuredBadges : [],
        teamId: r.teamId,
        teamName: r.teamName,
        score: Number(r.points || 0),
        points: Number(r.points || 0),
        totalScore: Number(r.points || 0),
        userLevel: Number(r.metadata?.userLevel || 1),
        trend: r.trend || 'SAME',
        gap: Math.max(0, Number(rows[0]?.points || 0) - Number(r.points || 0)),
      };
    }),
    total: count,
    page: numPage,
    limit: numLimit,
    totalPages: Math.ceil(count / numLimit) || 1,
  };
}

/**
 * 4. GET AVAILABLE SEASONS
 */
async function getAvailableSeasons() {
  return await Season.findAll({
    attributes: ['id', 'name', 'slug', 'seasonType', 'status', 'startAt', 'endAt'],
    order: [['startAt', 'DESC']],
  });
}

/**
 * 5. GET AVAILABLE GRANDS
 */
async function getAvailableGrands() {
  return await GrandChampionship.findAll({
    attributes: ['id', 'name', 'year', 'status', 'startAt', 'endAt'],
    order: [['year', 'DESC']],
  });
}

/**
 * 6. GET YOUTUBE RANKINGS (Supports both channel-level and team-level leaderboards)
 */
async function getYouTubeRankings(params = {}) {
  const { view } = params;
  if (view === 'channels') {
    return await youtubeAggregationService.getYouTubeChannelLeaderboard(params);
  }
  // Default or view === 'teams': returns team leaderboard
  return await youtubeAggregationService.getYouTubeTeamLeaderboard(params);
}

/**
 * 7. GET TOP PERFORMERS / AWARDS
 */
async function getTopPerformers() {
  // 1. Season Top MVP candidates
  const seasonMvps = await CompetitionUserSummary.findAll({
    order: [['seasonWins', 'DESC'], ['currentSeasonScore', 'DESC']],
    limit: 10,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });

  // 2. High Scorers
  const highScorers = await CompetitionUserSummary.findAll({
    order: [['currentSeasonScore', 'DESC']],
    limit: 10,
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email'] }],
  });

  // 3. Top Championship Teams
  const championTeams = await CompetitionTeamSummary.findAll({
    order: [['seasonWins', 'DESC'], ['grandPoints', 'DESC']],
    limit: 10,
  });

  return {
    seasonMvps: seasonMvps.map((m) => ({
      userId: m.userId,
      userName: m.user?.name || m.metadata?.userName || `User #${m.userId}`,
      teamName: m.metadata?.teamName || '',
      mvpCount: Number(m.seasonWins || m.metadata?.mvpCount || 1),
      lifetimeScore: Number(m.currentSeasonScore || 0),
    })),
    highScorers: highScorers.map((s) => ({
      userId: s.userId,
      userName: s.user?.name || s.metadata?.userName || `User #${s.userId}`,
      teamName: s.metadata?.teamName || '',
      score: Number(s.currentSeasonScore || 0),
    })),
    championTeams: championTeams.map((c) => ({
      teamId: c.teamId,
      teamName: c.teamName,
      seasonsWon: Number(c.seasonWins || 0),
      grandPoints: Number(c.grandPoints || 0),
    })),
  };
}

module.exports = {
  getRankingOverview,
  getTeamRankings,
  getIndividualRankings,
  getAvailableSeasons,
  getAvailableGrands,
  getYouTubeRankings,
  getTopPerformers,
};
