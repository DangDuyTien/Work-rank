'use strict';

const { Op } = require('sequelize');
const {
  Season,
  SeasonFrozenResult,
  SeasonTeam,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  UserRecognition,
  User,
  UserProfilePreference,
} = require('../../models');
const sequelize = require('../../config/database');

/**
 * Public Spotlight Service: Fetches the latest finalized/frozen Season Champion Team and MVP.
 * Sanitized for unauthenticated public showcase on the homepage.
 */
async function getPublicSpotlight() {
  // 1. Try to find the latest finished season with a frozen result
  const frozenResult = await SeasonFrozenResult.findOne({
    include: [
      {
        model: Season,
        as: 'season',
        where: {
          status: { [Op.in]: ['FINISHED', 'ARCHIVED', 'CALCULATING', 'ACTIVE'] },
        },
        required: true,
      },
    ],
    order: [
      ['frozenAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  let season = frozenResult?.season;
  let finalRankings = frozenResult?.finalRankings;
  const metadata = frozenResult?.metadata || {};

  // If no frozen result found, try finding any FINISHED season
  if (!season) {
    season = await Season.findOne({
      where: { status: 'FINISHED' },
      order: [
        ['end_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  // If still no finished season, fallback to active season as preview if available
  if (!season) {
    season = await Season.findOne({
      where: { status: 'ACTIVE' },
      order: [
        ['start_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  if (!season) {
    return {
      hasSpotlight: false,
      season: null,
      championTeam: null,
      mvp: null,
    };
  }

  // 2. Extract Champion Team
  let championTeam = null;
  let rawChampionTeam = null;

  if (Array.isArray(finalRankings)) {
    rawChampionTeam = finalRankings.find((r) => r.rank === 1);
  } else if (Array.isArray(finalRankings?.rankings)) {
    rawChampionTeam = finalRankings.rankings.find((r) => r.rank === 1);
  } else if (Array.isArray(finalRankings?.teams)) {
    rawChampionTeam = finalRankings.teams.find((r) => r.rank === 1);
  }

  if (!rawChampionTeam && SeasonLeaderboardProjection) {
    const proj = await SeasonLeaderboardProjection.findOne({
      where: { seasonId: season.id, rank: 1 },
    });
    if (proj) {
      rawChampionTeam = {
        teamId: proj.teamId,
        teamName: proj.teamName,
        score: proj.score,
        rank: 1,
        teamAvatar: proj.teamAvatar,
      };
    }
  }

  if (rawChampionTeam) {
    const seasonTeam = await SeasonTeam.findOne({
      where: { seasonId: season.id, teamId: rawChampionTeam.teamId },
    });

    championTeam = {
      teamId: rawChampionTeam.teamId,
      teamName: seasonTeam?.teamNameSnapshot || rawChampionTeam.teamName || 'Đội Vô Địch',
      rank: 1,
      seasonScore: Number(rawChampionTeam.score || rawChampionTeam.seasonScore || 0),
      grandPoints: Number(rawChampionTeam.grandPoints || 0),
      color: seasonTeam?.teamColorSnapshot || '#0284c7',
      avatarUrl: seasonTeam?.teamAvatarSnapshot || rawChampionTeam.teamAvatar || null,
      membersCount: Number(rawChampionTeam.membersCount || 0),
      title: 'Nhà Vô Địch Mùa Giải',
    };
  }

  // 3. Extract MVP
  let mvp = null;
  // A. Check explicit MVP recognition in UserRecognition
  const mvpRec = await UserRecognition.findOne({
    where: {
      seasonId: season.id,
      awardType: { [Op.in]: ['mvp', 'champion'] },
    },
    order: [
      [sequelize.literal("CASE WHEN award_type = 'mvp' THEN 0 ELSE 1 END"), 'ASC'],
      ['id', 'DESC'],
    ],
  });

  let mvpUserId = mvpRec?.userId;
  let mvpScore = 0;
  let mvpTitle = mvpRec?.title || 'Most Valuable Player';

  // B. Check frozen metadata individual champion or top individual ranking
  if (!mvpUserId) {
    const indChamp = metadata?.individualChampion;
    if (indChamp?.userId) {
      mvpUserId = indChamp.userId;
      mvpScore = Number(indChamp.score || 0);
    } else if (Array.isArray(metadata?.finalIndividualRankings) && metadata.finalIndividualRankings.length > 0) {
      const topInd = metadata.finalIndividualRankings.find((i) => i.rank === 1) || metadata.finalIndividualRankings[0];
      if (topInd) {
        mvpUserId = topInd.userId;
        mvpScore = Number(topInd.score || 0);
      }
    }
  }

  // C. Fallback: check SeasonIndividualLeaderboardProjection rank 1
  if (!mvpUserId && SeasonIndividualLeaderboardProjection) {
    const topProj = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId: season.id, rank: 1 },
    });
    if (topProj) {
      mvpUserId = topProj.userId;
      mvpScore = Number(topProj.score || 0);
    }
  }

  if (mvpUserId) {
    const mvpUser = await User.findByPk(mvpUserId, {
      attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
    });

    const userPref = await UserProfilePreference.findOne({
      where: { userId: mvpUserId },
      attributes: ['avatarData'],
    });

    if (mvpUser) {
      mvp = {
        userId: mvpUser.id,
        name: mvpUser.name,
        jobTitle: mvpUser.jobTitle || 'Thành viên xuất sắc',
        department: mvpUser.department || 'Media & Content',
        isVerified: Boolean(mvpUser.isVerified),
        score: mvpScore,
        awardTitle: mvpTitle,
        avatarData: userPref?.avatarData || null,
        reason: mvpRec?.reason || `MVP Xuất Sắc Nhất ${season.name}`,
      };
    }
  }

  return {
    hasSpotlight: Boolean(championTeam || mvp),
    season: {
      id: season.id,
      name: season.name,
      slug: season.slug,
      seasonType: season.seasonType,
      status: season.status,
      startAt: season.startAt,
      endAt: season.endAt,
      frozenAt: frozenResult?.frozenAt || season.endAt,
    },
    championTeam,
    mvp,
  };
}

/**
 * Returns public list of all past and active seasons with spotlight summary for the archive
 */
async function getPublicSeasons() {
  const seasons = await Season.findAll({
    where: {
      status: { [Op.in]: ['FINISHED', 'ARCHIVED', 'ACTIVE', 'CALCULATING'] },
    },
    order: [
      ['startAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: 20,
  });

  const list = [];
  for (const s of seasons) {
    // Find frozen result or projection
    const frozen = await SeasonFrozenResult.findOne({
      where: { seasonId: s.id },
      order: [['id', 'DESC']],
    });

    let championTeamName = 'Đang thi đấu';
    let mvpName = 'Đang xác định';

    if (frozen?.finalRankings) {
      const champ = Array.isArray(frozen.finalRankings)
        ? frozen.finalRankings.find((r) => r.rank === 1)
        : frozen.finalRankings?.rankings?.find((r) => r.rank === 1) || frozen.finalRankings?.teams?.find((r) => r.rank === 1);
      if (champ?.teamName) championTeamName = champ.teamName;
    } else {
      const topProj = await SeasonLeaderboardProjection.findOne({ where: { seasonId: s.id, rank: 1 } });
      if (topProj?.teamName) championTeamName = topProj.teamName;
    }

    const mvpRec = await UserRecognition.findOne({
      where: { seasonId: s.id, awardType: { [Op.in]: ['mvp', 'champion'] } },
      include: [{ model: User, as: 'user', attributes: ['name'] }],
    });

    if (mvpRec?.user?.name) {
      mvpName = mvpRec.user.name;
    } else {
      const topInd = await SeasonIndividualLeaderboardProjection.findOne({
        where: { seasonId: s.id, rank: 1 },
      });
      if (topInd?.userName) mvpName = topInd.userName;
    }

    list.push({
      id: s.id,
      name: s.name,
      slug: s.slug,
      seasonType: s.seasonType,
      status: s.status,
      startAt: s.startAt,
      endAt: s.endAt,
      championTeamName,
      mvpName,
    });
  }

  return { seasons: list };
}

/**
 * Returns detailed public breakdown for a single season
 */
async function getPublicSeasonDetail(seasonId) {
  const season = await Season.findByPk(seasonId);
  if (!season) {
    const error = new Error('Không tìm thấy mùa giải');
    error.status = 404;
    throw error;
  }

  const frozen = await SeasonFrozenResult.findOne({
    where: { seasonId: season.id },
    order: [['id', 'DESC']],
  });

  let teamRankings = [];
  let individualRankings = [];

  if (frozen?.finalRankings) {
    teamRankings = Array.isArray(frozen.finalRankings)
      ? frozen.finalRankings
      : frozen.finalRankings?.rankings || frozen.finalRankings?.teams || [];
  } else {
    teamRankings = await SeasonLeaderboardProjection.findAll({
      where: { seasonId: season.id },
      order: [['rank', 'ASC']],
      limit: 10,
    });
  }

  if (frozen?.metadata?.finalIndividualRankings) {
    individualRankings = frozen.metadata.finalIndividualRankings;
  } else {
    individualRankings = await SeasonIndividualLeaderboardProjection.findAll({
      where: { seasonId: season.id },
      order: [['rank', 'ASC']],
      limit: 10,
    });
  }

  return {
    season: {
      id: season.id,
      name: season.name,
      slug: season.slug,
      seasonType: season.seasonType,
      status: season.status,
      startAt: season.startAt,
      endAt: season.endAt,
    },
    teamRankings: teamRankings.slice(0, 10).map((t, idx) => ({
      rank: t.rank || idx + 1,
      teamName: t.teamName || t.nameSnapshot || 'Đội tuyển',
      score: Number(t.score || t.seasonScore || 0),
      grandPoints: Number(t.grandPoints || 0),
      avatarUrl: t.teamAvatar || t.avatarUrl || null,
      color: t.color || '#0284c7',
    })),
    individualRankings: individualRankings.slice(0, 10).map((u, idx) => ({
      rank: u.rank || idx + 1,
      name: u.name || u.userName || 'Thành viên',
      department: u.department || 'Thành viên',
      jobTitle: u.jobTitle || 'Chuyên viên',
      score: Number(u.score || u.seasonScore || 0),
    })),
  };
}

module.exports = {
  getPublicSpotlight,
  getPublicSeasons,
  getPublicSeasonDetail,
};
