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

  // 1. Resolve the season shown on the homepage.
  // An active/calculating season always wins over a frozen historical season;
  // otherwise an award from the past can leak into the current spotlight.
  let season = await Season.findOne({
    where: { status: { [Op.in]: ['ACTIVE', 'PAUSED', 'SCHEDULED', 'CALCULATING'] } },
    order: [
      ['start_at', 'ASC'],
      ['id', 'DESC'],
    ],
  });

  let frozenResult = null;
  if (season) {
    frozenResult = await SeasonFrozenResult.findOne({
      where: { seasonId: season.id },
    });
  } else {
    // With no live season, show the newest completed season as the current view.
    frozenResult = await SeasonFrozenResult.findOne({
      include: [
        {
          model: Season,
          as: 'season',
          where: { status: { [Op.in]: ['FINISHED', 'ARCHIVED'] } },
          required: true,
        },
      ],
      order: [
        ['frozenAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
    season = frozenResult?.season || await Season.findOne({
      where: { status: 'FINISHED' },
      order: [
        ['end_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    if (season && !frozenResult) {
      frozenResult = await SeasonFrozenResult.findOne({ where: { seasonId: season.id } });
    }
  }

  let finalRankings = frozenResult?.finalRankings;
  const metadata = frozenResult?.metadata || {};

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

  const spotlightSeasonId = Number.isSafeInteger(Number(season.id)) ? Number(season.id) : null;
  const currentSeasonAwardWhere = spotlightSeasonId
    ? {
        // New awards are always linked to a season. Keep recent legacy awards
        // without seasonId visible until they are re-saved with a season.
        [Op.or]: [
          { seasonId: spotlightSeasonId },
          ...(season.startAt ? [{ seasonId: null, awardedAt: { [Op.gte]: season.startAt } }] : []),
        ],
      }
    : { seasonId: null };

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
      where: { awardType: 'champion', ...currentSeasonAwardWhere },
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
      where: { awardType: 'mvp', ...currentSeasonAwardWhere },
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
      where: spotlightSeasonId ? { currentSeasonId: spotlightSeasonId } : {},
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
      order: [['currentSeasonScore', 'DESC'], ['userId', 'DESC']],
    });
    if (topSummary?.user) {
      mvpUser = topSummary.user;
      mvpScore = Number(topSummary.currentSeasonScore || topSummary.totalScore || 0);
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
      const summary = await CompetitionUserSummary.findOne({
        where: {
          userId: mvpUser.id,
          ...(spotlightSeasonId ? { currentSeasonId: spotlightSeasonId } : {}),
        },
      });
      mvpScore = Number(summary?.currentSeasonScore || summary?.totalScore || summary?.score || 0);
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
    archives: await getPublicArchives(),
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

// ══════════════════════════════════════════════════════════════════════════
// HISTORICAL ARCHIVE — Admin-managed list of past season winners
// Stored in SystemSetting key: public_spotlight_archives
// Schema: Array of { id, year, label, championTeam, mvp, frozenAt }
// ══════════════════════════════════════════════════════════════════════════

const ARCHIVE_KEY = 'public_spotlight_archives';

/**
 * Get all archived seasons (public, sanitized).
 * Returns sorted descending by year.
 */
async function getPublicArchives() {
  const setting = await SystemSetting.findOne({ where: { settingKey: ARCHIVE_KEY } });
  const list = Array.isArray(setting?.settingValue) ? setting.settingValue : [];
  // Sort newest first, remove internal-only fields
  const entries = list
    .slice()
    .sort((a, b) => Number(b.year) - Number(a.year))
    .map(sanitizeArchiveEntry);
  return resolveArchiveUsers(entries);
}

// Keep historical titles/scores while resolving portraits from linked accounts.
async function resolveArchiveUsers(entries, { includeImages = true, validate = false } = {}) {
  const linkedRecords = entries.flatMap((entry) => [
    ...(Array.isArray(entry.championTeam?.members) ? entry.championTeam.members : []),
    entry.mvp,
  ]).filter((record) => record?.userId != null);
  const ids = [...new Set(linkedRecords.map((record) => Number(record.userId)))];
  if (!ids.length) return entries;
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    const err = new Error('ID thành viên không hợp lệ');
    err.status = 400;
    throw err;
  }
  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified'],
    ...(includeImages ? { include: [{ model: UserProfilePreference, attributes: ['avatarData'] }] } : {}),
  });
  const byId = new Map(users.map((user) => [Number(user.id), user]));
  if (validate && ids.some((id) => !byId.has(id))) {
    const err = new Error('Thành viên được chọn không còn tồn tại');
    err.status = 400;
    throw err;
  }
  const mvpIds = [...new Set(entries.map((entry) => Number(entry.mvp?.userId)).filter((id) => byId.has(id)))];
  const gallery = includeImages && mvpIds.length ? await UserProfileImage.findAll({
    where: { userId: { [Op.in]: mvpIds } },
    attributes: ['userId', 'slot', 'imageData'],
    order: [['slot', 'ASC']],
  }) : [];
  const galleries = new Map();
  for (const image of gallery) {
    if (!image.imageData) continue;
    const id = Number(image.userId);
    if (!galleries.has(id)) galleries.set(id, []);
    galleries.get(id).push(image.imageData);
  }
  const resolve = (record, isMvp = false) => {
    const user = byId.get(Number(record?.userId));
    if (!user) return record;
    const pref = user.UserProfilePreference || user.userProfilePreference;
    const resolved = { ...record, userId: user.id, name: user.name,
      jobTitle: record.jobTitle || user.jobTitle, department: record.department || user.department,
      // Linked archive entries follow the user's current verification status.
      // This keeps historical MVP entries in sync when an admin grants or revokes the badge later.
      isVerified: record.userId != null ? Boolean(user.isVerified) : Boolean(record.isVerified) };
    if (includeImages) {
      resolved.avatarData = pref?.avatarData || null;
      resolved.avatarUrl = resolved.avatarData;
      if (isMvp) resolved.galleryImages = galleries.get(Number(user.id)) || [];
    }
    return resolved;
  };
  return entries.map((entry) => ({
    ...entry,
    ...(entry.championTeam ? { championTeam: { ...entry.championTeam,
      members: (entry.championTeam.members || []).map((member) => resolve(member)) } } : {}),
    ...(entry.mvp ? { mvp: resolve(entry.mvp, true) } : {}),
  }));
}

/**
 * Get all archived seasons for admin (unsanitized).
 */
async function adminGetArchives() {
  const setting = await SystemSetting.findOne({ where: { settingKey: ARCHIVE_KEY } });
  const list = Array.isArray(setting?.settingValue) ? setting.settingValue : [];
  return list.slice().sort((a, b) => Number(b.year) - Number(a.year));
}

/**
 * Save (upsert) a single archive entry.
 * @param {object} entry  Must include { year } at minimum.
 */
async function adminSaveArchiveEntry(entry) {
  if (!entry || !entry.year) throw new Error('year là bắt buộc');
  const year = Number(entry.year);

  const setting = await SystemSetting.findOne({ where: { settingKey: ARCHIVE_KEY } });
  let list = Array.isArray(setting?.settingValue) ? [...setting.settingValue] : [];

  const idx = list.findIndex((e) => Number(e.year) === year);
  const [resolved] = await resolveArchiveUsers([entry], { includeImages: false, validate: true });
  const normalized = { ...resolved, year, updatedAt: new Date().toISOString() };
  if (!normalized.id) normalized.id = `archive-${year}-${Date.now()}`;

  if (idx >= 0) {
    list[idx] = normalized;
  } else {
    list.push(normalized);
  }

  if (setting) {
    setting.settingValue = list;
    await setting.save();
  } else {
    await SystemSetting.create({
      settingKey: ARCHIVE_KEY,
      settingValue: list,
      description: 'Danh sách vinh danh lịch sử theo năm — hiển thị trên Trang Chủ',
    });
  }
  return normalized;
}

/**
 * Delete an archive entry by year.
 */
async function adminDeleteArchiveEntry(year) {
  const yr = Number(year);
  const setting = await SystemSetting.findOne({ where: { settingKey: ARCHIVE_KEY } });
  if (!setting) return false;
  const list = Array.isArray(setting.settingValue) ? setting.settingValue : [];
  const newList = list.filter((e) => Number(e.year) !== yr);
  setting.settingValue = newList;
  await setting.save();
  return true;
}

/**
 * Get all active company members for public showcase marquee.
 */
async function getPublicMembers(options = {}) {
  const limit = Math.min(100, Math.max(1, Number(options.limit || 80)));
  const users = await User.findAll({
    where: {
      status: 'active',
      isSimulated: { [Op.ne]: true },
    },
    attributes: ['id', 'name', 'jobTitle', 'department', 'isVerified', 'role'],
    include: [
      {
        model: Team,
        attributes: ['id', 'name'],
        required: false,
      },
      {
        model: UserProfilePreference,
        attributes: ['avatarData', 'featuredBadges'],
        required: false,
      },
      {
        model: CompetitionUserSummary,
        as: 'competitionSummary',
        attributes: ['currentSeasonScore', 'grandPoints', 'seasonWins', 'metadata'],
        required: false,
      },
    ],
    order: [
      ['isVerified', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limit * 2,
  });

  const userIds = users.map((u) => u.id);
  const mvpAwards = userIds.length > 0 ? await UserRecognition.findAll({
    where: {
      userId: { [Op.in]: userIds },
      awardType: 'mvp',
    },
    attributes: ['userId'],
    raw: true,
  }) : [];

  const mvpMap = new Map();
  for (const award of mvpAwards) {
    const id = Number(award.userId);
    mvpMap.set(id, (mvpMap.get(id) || 0) + 1);
  }

  const seenNames = new Set();
  const distinctUsers = [];
  for (const user of users) {
    const clean = String(user.name || '').trim().toLowerCase();
    if (!clean || seenNames.has(clean)) continue;
    seenNames.add(clean);
    distinctUsers.push(user);
    if (distinctUsers.length >= limit) break;
  }
  const listToMap = distinctUsers.length >= 5 ? distinctUsers : users.slice(0, limit);

  return listToMap.map((u) => {
    const pref = u.UserProfilePreference || u.userProfilePreference;
    const summary = u.competitionSummary || u.CompetitionUserSummary;
    const mvpCountFromRec = mvpMap.get(Number(u.id)) || 0;
    const mvpCountFromSummary = Number(summary?.metadata?.mvpCount || 0);
    const score = Number(summary?.currentSeasonScore || 0);

    return {
      userId: u.id,
      id: u.id,
      name: u.name,
      jobTitle: u.jobTitle || 'Nhân viên',
      department: u.department || 'Media & Content',
      teamName: u.Team?.name || null,
      isVerified: Boolean(u.isVerified),
      avatarData: pref?.avatarData || null,
      score,
      mvpCount: Math.max(mvpCountFromRec, mvpCountFromSummary),
      role: u.role || 'user',
    };
  });
}

/**
 * Strip internal IDs / updatedAt before sending to public endpoint.
 */
function sanitizeArchiveEntry(entry) {
  const { id: _id, updatedAt: _upd, ...rest } = entry;
  return rest;
}

module.exports = {
  getPublicSpotlight,
  getSpotlightConfig,
  setSpotlightConfig,
  getPublicArchives,
  getPublicMembers,
  adminGetArchives,
  adminSaveArchiveEntry,
  adminDeleteArchiveEntry,
};
