'use strict';

const { Op } = require('sequelize');
const {
  Season,
  SeasonFrozenResult,
  SeasonTeam,
  SeasonLeaderboardProjection,
  UserRecognition,
  User,
  UserProfilePreference,
  UserProfileImage,
  Team,
  SystemSetting,
  ScoreLedger,
  CompetitionUserSummary,
} = require('../../models');
const sequelize = require('../../config/database');

/**
 * Get current custom spotlight setting if set by Admin.
 */
async function getSpotlightConfig() {
  const setting = await SystemSetting.findOne({
    where: { settingKey: 'public_spotlight_custom' },
  });
  return setting?.settingValue || { teamId: null, userId: null, teamTitle: null, mvpTitle: null, mvpReason: null };
}

/**
 * Set custom spotlight for Homepage (Admin only).
 */
async function setSpotlightConfig(payload = {}) {
  if (payload.clear === true) {
    await SystemSetting.destroy({
      where: { settingKey: 'public_spotlight_custom' },
    });
    return { teamId: null, userId: null, teamTitle: null, mvpTitle: null, mvpReason: null };
  }

  const existing = await SystemSetting.findOne({
    where: { settingKey: 'public_spotlight_custom' },
  });

  const prevValue = existing?.settingValue || {};
  const nextValue = {
    teamId: payload.teamId !== undefined ? (payload.teamId ? Number(payload.teamId) : null) : prevValue.teamId,
    userId: payload.userId !== undefined ? (payload.userId ? Number(payload.userId) : null) : prevValue.userId,
    teamTitle: payload.teamTitle !== undefined ? payload.teamTitle : prevValue.teamTitle,
    mvpTitle: payload.mvpTitle !== undefined ? payload.mvpTitle : prevValue.mvpTitle,
    mvpReason: payload.mvpReason !== undefined ? payload.mvpReason : prevValue.mvpReason,
    updatedAt: new Date().toISOString(),
  };

  if (existing) {
    existing.settingValue = nextValue;
    await existing.save();
  } else {
    await SystemSetting.create({
      settingKey: 'public_spotlight_custom',
      settingValue: nextValue,
      description: 'Cấu hình vinh danh Đội Nhóm Quán Quân và MVP hiển thị trên Trang Chủ',
    });
  }

  return nextValue;
}

/**
 * Public Spotlight Service: Fetches the latest finalized/frozen or Admin-honored Season Champion Team and MVP.
 * Sanitized for unauthenticated public showcase on the homepage.
 */
async function getPublicSpotlight() {
  // Read custom spotlight config if Admin set one
  const spotlightSetting = await SystemSetting.findOne({
    where: { settingKey: 'public_spotlight_custom' },
  });
  const custom = spotlightSetting?.settingValue || {};

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

  if (!season) {
    season = await Season.findOne({
      where: { status: 'FINISHED' },
      order: [
        ['end_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

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
    season = {
      id: 1,
      name: 'Mùa Giải Vinh Danh 3Win Media 2026',
      slug: 'vinh-danh-2026',
      seasonType: 'MONTHLY',
      status: 'ACTIVE',
      startAt: new Date(new Date().getFullYear(), 0, 1),
      endAt: new Date(new Date().getFullYear(), 11, 31),
      frozenAt: null,
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 2. Extract Champion Team
  // ══════════════════════════════════════════════════════════════════════════
  let championTeam = null;
  let chosenTeam = null;
  let championSource = null;
  let teamScore = 0;

  // A. Priority 1: Admin custom spotlight team
  if (custom.teamId) {
    chosenTeam = await Team.findByPk(custom.teamId);
    if (chosenTeam) championSource = 'AdminSpotlightConfig';
  }

  // B. Priority 2: Admin-awarded Champion user's team
  if (!chosenTeam) {
    const latestChampRec = await UserRecognition.findOne({
      where: { awardType: 'champion' },
      include: [
        {
          model: User,
          as: 'user',
          where: { status: 'active' },
          required: true,
        },
      ],
      order: [
        ['awardedAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    if (latestChampRec?.user?.teamId) {
      chosenTeam = await Team.findByPk(latestChampRec.user.teamId);
      if (chosenTeam) championSource = 'UserRecognition.champion';
    }
  }

  // C. Priority 3: Season frozen rankings or projection
  let rawChampionTeam = null;
  if (!chosenTeam) {
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
        };
      }
    }

    if (rawChampionTeam?.teamId) {
      chosenTeam = await Team.findByPk(rawChampionTeam.teamId);
      if (chosenTeam) {
        championSource = 'SeasonFrozenResult';
        teamScore = Number(rawChampionTeam.score || rawChampionTeam.seasonScore || 0);
      }
    }
  }

  // D. Priority 4: Fallback to the latest active team
  if (!chosenTeam) {
    chosenTeam = await Team.findOne({ order: [['id', 'DESC']] });
    if (chosenTeam) championSource = 'Team.latest';
  }

  // If a team is resolved, fetch its active members and construct payload
  if (chosenTeam) {
    const members = await User.findAll({
      where: { teamId: chosenTeam.id, status: 'active' },
      attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified'],
      include: [
        {
          model: UserProfilePreference,
          attributes: ['avatarData'],
        },
      ],
      order: [['name', 'ASC']],
      limit: 20,
    });

    const mappedMembers = members.map((m) => {
      const pref = m.UserProfilePreference || m.userProfilePreference;
      return {
        userId: m.id,
        id: m.id,
        name: m.name,
        jobTitle: m.jobTitle || 'Nhân viên',
        department: m.department || 'Media & Content',
        isVerified: Boolean(m.isVerified),
        avatarData: pref?.avatarData || null,
        avatarUrl: pref?.avatarData || null,
      };
    });

    championTeam = {
      teamId: chosenTeam.id,
      teamName: chosenTeam.name,
      rank: 1,
      seasonScore: teamScore,
      grandPoints: 0,
      color: '#0284c7',
      avatarUrl: null,
      membersCount: mappedMembers.length,
      members: mappedMembers,
      title: custom.teamTitle || (frozenResult ? 'Nhà Vô Địch Mùa Giải' : 'Đội Nhóm Quán Quân'),
    };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 3. Extract MVP
  // ══════════════════════════════════════════════════════════════════════════
  let mvp = null;
  let mvpUser = null;
  let mvpRec = null;
  let mvpScore = 0;
  let mvpSource = null;

  // A. Priority 1: Admin custom spotlight user
  if (custom.userId || custom.mvpUserId) {
    const targetUserId = custom.userId || custom.mvpUserId;
    mvpUser = await User.findByPk(targetUserId, {
      attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified', 'status'],
      include: [{ model: UserProfilePreference, attributes: ['avatarData'] }],
    });
    if (mvpUser && mvpUser.status === 'active') {
      mvpSource = 'AdminSpotlightConfig';
    } else {
      mvpUser = null;
    }
  }

  // B. Priority 2: Latest active user awarded MVP in UserRecognition
  if (!mvpUser) {
    mvpRec = await UserRecognition.findOne({
      where: { awardType: 'mvp' },
      include: [
        {
          model: User,
          as: 'user',
          where: { status: 'active' },
          required: true,
          attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
          include: [{ model: UserProfilePreference, attributes: ['avatarData'] }],
        },
      ],
      order: [
        ['awardedAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    if (mvpRec?.user) {
      mvpUser = mvpRec.user;
      mvpScore = Number(mvpRec.metadata?.score || 0);
      mvpSource = 'UserRecognition.mvp';
    }
  }

  // C. Priority 3: Check frozen metadata individual champion if recorded in finalized season
  if (!mvpUser && frozenResult) {
    const indChamp = metadata?.individualChampion;
    if (indChamp?.userId) {
      mvpUser = await User.findByPk(indChamp.userId, {
        attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified', 'status'],
        include: [{ model: UserProfilePreference, attributes: ['avatarData'] }],
      });
      if (mvpUser && mvpUser.status === 'active') {
        mvpScore = Number(indChamp.score || 0);
        mvpSource = 'SeasonFrozenResult.metadata.individualChampion';
      } else {
        mvpUser = null;
      }
    }
  }

  // D. Priority 4: Active user with highest score in CompetitionUserSummary
  if (!mvpUser) {
    const topSummary = await CompetitionUserSummary.findOne({
      include: [
        {
          model: User,
          where: { status: 'active' },
          required: true,
          attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
          include: [{ model: UserProfilePreference, attributes: ['avatarData'] }],
        },
      ],
      order: [['totalScore', 'DESC'], ['id', 'DESC']],
    });
    if (topSummary?.User) {
      mvpUser = topSummary.User;
      mvpScore = Number(topSummary.totalScore || 0);
      mvpSource = 'CompetitionUserSummary.topScore';
    }
  }

  // E. Priority 5: Fallback to the latest active non-admin or active user
  if (!mvpUser) {
    mvpUser = await User.findOne({
      where: { status: 'active' },
      order: [['id', 'DESC']],
      attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
      include: [{ model: UserProfilePreference, attributes: ['avatarData'] }],
    });
    if (mvpUser) mvpSource = 'User.fallback';
  }

  // If MVP user is found, construct payload
  if (mvpUser) {
    const pref = mvpUser.UserProfilePreference || mvpUser.userProfilePreference;
    if (!mvpScore) {
      const summary = await CompetitionUserSummary.findOne({ where: { userId: mvpUser.id } });
      mvpScore = Number(summary?.totalScore || summary?.score || 0);
    }

    // Load gallery images (6 profile secondary photos from UserProfileImage)
    const galleryRows = await UserProfileImage.findAll({
      where: { userId: mvpUser.id },
      order: [['slot', 'ASC']],
      attributes: ['slot', 'imageData'],
    });
    const galleryImages = galleryRows
      .map((r) => r.imageData)
      .filter((img) => Boolean(img) && typeof img === 'string');

    const allImages = [];
    if (pref?.avatarData) allImages.push(pref.avatarData);
    for (const g of galleryImages) {
      if (g && !allImages.includes(g)) allImages.push(g);
    }

    mvp = {
      userId: mvpUser.id,
      name: mvpUser.name,
      jobTitle: mvpUser.jobTitle || 'Nhân viên',
      department: mvpUser.department || 'Media & Content',
      isVerified: Boolean(mvpUser.isVerified),
      score: mvpScore,
      awardTitle: custom.mvpTitle || mvpRec?.title || 'MVP Mùa Giải',
      avatarData: pref?.avatarData || allImages[0] || null,
      galleryImages,
      images: allImages,
      reason: custom.mvpReason || mvpRec?.reason || 'Đóng góp xuất sắc cho sự phát triển của công ty',
    };
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
      frozenAt: frozenResult?.frozenAt || null,
    },
    championTeam,
    mvp,
    provenance: {
      resultState: frozenResult ? 'official' : championTeam || mvp ? 'projected' : 'none',
      champion: {
        state: championTeam ? (frozenResult ? 'official' : 'projected') : 'none',
        source: championSource,
        sourceId: frozenResult?.id || null,
      },
      mvp: {
        state: mvp ? (mvpRec || frozenResult ? 'official' : 'projected') : 'none',
        source: mvpSource,
        sourceId: mvpRec?.id || frozenResult?.id || null,
      },
    },
  };
}

module.exports = {
  getPublicSpotlight,
  getSpotlightConfig,
  setSpotlightConfig,
};
