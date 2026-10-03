'use strict';

const {
  User,
  Team,
  UserRecognition,
  CompetitionAuditLog,
  Season,
  GrandChampionship,
  SeasonFrozenResult,
  SeasonTeamMember,
} = require('../models');

const CANONICAL_JOB_TITLES = [
  'Editor',
  'Content',
  'Quản lý kênh',
  'Trưởng phòng',
  'Phó giám đốc',
  'Giám đốc',
];

/**
 * Normalizes any job title input string into one of the 6 canonical WorkRank Job Titles.
 */
function normalizeJobTitle(jobTitle) {
  if (!jobTitle) return 'Editor';
  const str = String(jobTitle).trim().toLowerCase();

  if (
    str === 'giám đốc' ||
    str === 'giam doc' ||
    str === 'director' ||
    str === 'ceo' ||
    str === 'founder' ||
    str === 'chủ tịch' ||
    str === 'tổng giám đốc' ||
    (str.includes('giám đốc') && !str.includes('phó')) ||
    (str.includes('director') && !str.includes('deputy'))
  ) {
    return 'Giám đốc';
  }

  if (
    str === 'phó giám đốc' ||
    str === 'pho giam doc' ||
    str === 'deputy director' ||
    str === 'phó gđ' ||
    str.includes('phó giám đốc') ||
    str.includes('deputy') ||
    str.includes('phó tổng')
  ) {
    return 'Phó giám đốc';
  }

  if (
    str === 'trưởng phòng' ||
    str === 'truong phong' ||
    str === 'head of department' ||
    str === 'lead' ||
    str.includes('trưởng phòng') ||
    str.includes('phó phòng') ||
    str.includes('trưởng ban') ||
    str.includes('team lead')
  ) {
    return 'Trưởng phòng';
  }

  if (
    str === 'quản lý kênh' ||
    str === 'quan ly kenh' ||
    str === 'channel manager' ||
    str === 'kênh trưởng' ||
    str.includes('quản lý kênh') ||
    str.includes('channel') ||
    str.includes('kênh')
  ) {
    return 'Quản lý kênh';
  }

  if (
    str === 'content' ||
    str === 'content creator' ||
    str.includes('content') ||
    str.includes('kịch bản') ||
    str.includes('copywriter') ||
    str.includes('nội dung')
  ) {
    return 'Content';
  }

  return 'Editor';
}

/**
 * Get all recognitions and badges for a user.
 */
async function getUserRecognitions(userId) {
  const user = await User.findByPk(userId);
  if (!user) return null;

  const rawAwards = await UserRecognition.findAll({
    where: { userId },
    order: [['awardedAt', 'DESC'], ['id', 'DESC']],
    include: [
      { model: Season, as: 'season', attributes: ['id', 'name', 'status'], required: false },
      { model: GrandChampionship, as: 'grand', attributes: ['id', 'name', 'status', 'year'], required: false },
    ],
  });

  const championAwards = rawAwards.filter((a) => a.awardType === 'champion');
  const mvpAwards = rawAwards.filter((a) => a.awardType === 'mvp');

  return {
    userId: user.id,
    jobTitle: normalizeJobTitle(user.jobTitle) || 'Editor',
    department: user.department || 'Media & Content',
    teamId: user.teamId,
    badges: {
      verified: {
        active: Boolean(user.isVerified),
        label: 'Đã xác minh',
        type: 'verified',
      },
      dev: {
        active: Boolean(user.isDev),
        label: 'Developer',
        type: 'dev',
      },
      champion: {
        active: championAwards.length > 0,
        count: championAwards.length,
        label: 'Vô địch giải đấu',
        type: 'champion',
        awards: championAwards.map((a) => ({
          id: a.id,
          title: a.title,
          seasonId: a.seasonId,
          grandId: a.grandId,
          reason: a.reason,
          awardedAt: a.awardedAt,
          awardedBy: a.awardedBy,
        })),
      },
      mvp: {
        active: mvpAwards.length > 0,
        count: mvpAwards.length,
        label: 'Nhân viên xuất sắc',
        type: 'mvp',
        awards: mvpAwards.map((a) => ({
          id: a.id,
          title: a.title,
          seasonId: a.seasonId,
          grandId: a.grandId,
          reason: a.reason,
          awardedAt: a.awardedAt,
          awardedBy: a.awardedBy,
        })),
      },
    },
    awards: rawAwards.map((a) => ({
      id: a.id,
      awardType: a.awardType,
      title: a.title,
      seasonId: a.seasonId,
      seasonName: a.season?.name || null,
      grandId: a.grandId,
      grandName: a.grand?.name || null,
      reason: a.reason,
      awardedAt: a.awardedAt,
      awardedBy: a.awardedBy,
    })),
  };
}

/**
 * Admin awards MVP to a user.
 */
async function awardMVP({ userId, seasonId, grandId, title, reason, actorId, metadata }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const defaultTitle = seasonId
    ? `MVP Mùa Giải #${seasonId}`
    : grandId
      ? `MVP Grand Championship #${grandId}`
      : 'Nhân Viên Xuất Sắc (MVP)';

  const recognition = await UserRecognition.create({
    userId: user.id,
    awardType: 'mvp',
    title: title || defaultTitle,
    seasonId: seasonId ? Number(seasonId) : null,
    grandId: grandId ? Number(grandId) : null,
    reason: reason || 'Trao giải MVP cho thành tích đóng góp xuất sắc',
    awardedBy: actorId ? Number(actorId) : null,
    awardedAt: new Date(),
    metadata: metadata || null,
  });

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: 'MVP_AWARDED',
    entityType: 'RECOGNITION',
    entityId: String(user.id),
    afterState: {
      recognitionId: recognition.id,
      awardType: 'mvp',
      title: recognition.title,
      seasonId: recognition.seasonId,
      grandId: recognition.grandId,
      reason: recognition.reason,
    },
    reason: reason || 'Admin awarded MVP badge',
  });

  return recognition;
}

/**
 * Admin revokes MVP.
 */
async function revokeMVP({ recognitionId, actorId, reason }) {
  const recognition = await UserRecognition.findByPk(recognitionId);
  if (!recognition || recognition.awardType !== 'mvp') {
    throw new Error('MVP recognition not found');
  }

  const userId = recognition.userId;
  const beforeState = {
    recognitionId: recognition.id,
    awardType: recognition.awardType,
    title: recognition.title,
    seasonId: recognition.seasonId,
  };

  await recognition.destroy();

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: 'MVP_REVOKED',
    entityType: 'RECOGNITION',
    entityId: String(userId),
    beforeState,
    reason: reason || 'Admin revoked MVP badge',
  });

  return { success: true };
}

/**
 * Admin or system awards Champion badge.
 */
async function awardChampion({ userId, seasonId, grandId, title, reason, actorId, metadata }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const defaultTitle = seasonId
    ? `Quán Quân Mùa Giải #${seasonId}`
    : grandId
      ? `Vô Địch Grand Championship #${grandId}`
      : 'Vô Địch Giải Đấu';

  const recognition = await UserRecognition.create({
    userId: user.id,
    awardType: 'champion',
    title: title || defaultTitle,
    seasonId: seasonId ? Number(seasonId) : null,
    grandId: grandId ? Number(grandId) : null,
    reason: reason || 'Đạt danh hiệu vô địch giải đấu',
    awardedBy: actorId ? Number(actorId) : null,
    awardedAt: new Date(),
    metadata: metadata || null,
  });

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: 'CHAMPION_AWARDED',
    entityType: 'RECOGNITION',
    entityId: String(user.id),
    afterState: {
      recognitionId: recognition.id,
      awardType: 'champion',
      title: recognition.title,
      seasonId: recognition.seasonId,
      grandId: recognition.grandId,
      reason: recognition.reason,
    },
    reason: reason || 'Champion awarded',
  });

  return recognition;
}

/**
 * Admin updates user job title and department.
 */
async function setJobTitle({ userId, jobTitle, department, teamId, actorId, reason }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const beforeState = {
    jobTitle: user.jobTitle,
    department: user.department,
    teamId: user.teamId,
  };

  const updateFields = {};
  if (jobTitle !== undefined) updateFields.jobTitle = jobTitle;
  if (department !== undefined) {
    updateFields.department = department;
    try {
      const { Department } = require('../models');
      const deptStr = String(department || '').toLowerCase();
      const matchedDept = await Department.findOne({
        where: {
          code: deptStr.includes('edit') ? 'EDIT' : 'CONTENT',
        },
      });
      if (matchedDept) {
        updateFields.departmentId = matchedDept.id;
      }
    } catch {
      // Best-effort department mapping
    }
  }
  if (teamId !== undefined) updateFields.teamId = teamId ? Number(teamId) : null;

  await user.update(updateFields);

  const afterState = {
    jobTitle: user.jobTitle,
    department: user.department,
    teamId: user.teamId,
  };

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: 'JOB_TITLE_CHANGED',
    entityType: 'USER',
    entityId: String(user.id),
    beforeState,
    afterState,
    reason: reason || 'Admin updated employee job title / department',
  });

  return user;
}

/**
 * Admin toggles Verified badge.
 */
async function setVerified({ userId, isVerified, actorId, reason }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const beforeState = { isVerified: user.isVerified };
  await user.update({ isVerified: Boolean(isVerified) });
  const afterState = { isVerified: user.isVerified };

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: isVerified ? 'VERIFIED_GRANTED' : 'VERIFIED_REVOKED',
    entityType: 'USER',
    entityId: String(user.id),
    beforeState,
    afterState,
    reason: reason || `Admin ${isVerified ? 'granted' : 'revoked'} verified badge`,
  });

  return user;
}

/**
 * Admin toggles Developer badge.
 */
async function setDevBadge({ userId, isDev, actorId, reason }) {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('User not found');

  const beforeState = { isDev: user.isDev };
  await user.update({ isDev: Boolean(isDev) });
  const afterState = { isDev: user.isDev };

  await CompetitionAuditLog.create({
    actorId: actorId ? Number(actorId) : null,
    action: isDev ? 'DEV_BADGE_GRANTED' : 'DEV_BADGE_REVOKED',
    entityType: 'USER',
    entityId: String(user.id),
    beforeState,
    afterState,
    reason: reason || `Admin ${isDev ? 'granted' : 'revoked'} developer badge`,
  });

  return user;
}

async function syncSeasonChampionRecognitions(seasonId, actorId) {
  const { SeasonIndividualLeaderboardProjection, SeasonLeaderboardProjection } = require('../models');
  const awarded = [];

  const frozen = await SeasonFrozenResult.findOne({ where: { seasonId } });
  const rankings = frozen?.finalRankings;

  // 1. Team Champion from frozen or projection
  let topTeamId = null;
  let topTeamName = null;

  if (rankings) {
    const topTeam = Array.isArray(rankings)
      ? rankings.find((r) => r.rank === 1)
      : rankings.teams?.find((t) => t.rank === 1);
    if (topTeam) {
      topTeamId = topTeam.teamId;
      topTeamName = topTeam.teamName;
    }
  } else if (SeasonLeaderboardProjection) {
    const topTeamProj = await SeasonLeaderboardProjection.findOne({
      where: { seasonId, rank: 1 },
    });
    if (topTeamProj) {
      topTeamId = topTeamProj.teamId;
    }
  }

  if (topTeamId) {
    const members = await SeasonTeamMember.findAll({
      where: { seasonId, teamId: topTeamId },
    });

    for (const member of members) {
      const existing = await UserRecognition.findOne({
        where: {
          userId: member.userId,
          seasonId,
          awardType: 'champion',
        },
      });

      if (!existing) {
        const rec = await UserRecognition.create({
          userId: member.userId,
          awardType: 'champion',
          title: `Vô Địch Mùa Giải #${seasonId}`,
          seasonId,
          reason: `Thành viên đội ${topTeamName || 'Vô địch'} đạt Hạng #1 Mùa #${seasonId}`,
          awardedBy: actorId ? Number(actorId) : null,
          awardedAt: frozen?.frozenAt || new Date(),
        });
        awarded.push(rec);
      }
    }
  }

  // 2. Individual Champion
  let topUserId = null;
  if (rankings?.individuals && Array.isArray(rankings.individuals)) {
    const topInd = rankings.individuals.find((i) => i.rank === 1);
    if (topInd) topUserId = topInd.userId;
  } else if (SeasonIndividualLeaderboardProjection) {
    const topIndProj = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId, rank: 1 },
    });
    if (topIndProj) topUserId = topIndProj.userId;
  }

  if (topUserId) {
    const existing = await UserRecognition.findOne({
      where: {
        userId: topUserId,
        seasonId,
        awardType: 'champion',
      },
    });

    if (!existing) {
      const rec = await UserRecognition.create({
        userId: topUserId,
        awardType: 'champion',
        title: `Quán Quân Cá Nhân — Mùa #${seasonId}`,
        seasonId,
        reason: `Đạt Hạng #1 cá nhân Season #${seasonId}`,
        awardedBy: actorId ? Number(actorId) : null,
        awardedAt: frozen?.frozenAt || new Date(),
      });
      awarded.push(rec);
    }
  }

  return awarded;
}

module.exports = {
  CANONICAL_JOB_TITLES,
  normalizeJobTitle,
  getUserRecognitions,
  awardMVP,
  revokeMVP,
  awardChampion,
  setJobTitle,
  setVerified,
  setDevBadge,
  syncSeasonChampionRecognitions,
};
