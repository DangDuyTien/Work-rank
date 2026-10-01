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

module.exports = {
  getPublicSpotlight,
};
