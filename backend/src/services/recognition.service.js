const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  User,
  Team,
  UserRecognition,
  CompetitionAuditLog,
  Season,
  GrandChampionship,
  SeasonFrozenResult,
  SeasonTeamMember,
  CompetitionUserSummary,
  UserProfilePreference,
  ScoreLedger,
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

  const serializeAward = (a) => ({
    id: a.id,
    awardType: a.awardType,
    title: a.title,
    seasonId: a.seasonId,
    seasonName: a.season?.name || null,
    seasonStatus: a.season?.status || null,
    grandId: a.grandId,
    grandName: a.grand?.name || null,
    grandStatus: a.grand?.status || null,
    reason: a.reason || null,
    awardedAt: a.awardedAt,
    awardedBy: a.awardedBy,
    metadata: a.metadata || null,
    provenance: {
      state: 'official',
      sourceType: a.seasonId ? 'season' : a.grandId ? 'grand' : 'recognition_record',
      sourceId: a.seasonId || a.grandId || a.id,
    },
  });

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
        awards: championAwards.map(serializeAward),
      },
      mvp: {
        active: mvpAwards.length > 0,
        count: mvpAwards.length,
        label: 'Nhân viên xuất sắc',
        type: 'mvp',
        awards: mvpAwards.map(serializeAward),
      },
    },
    awards: rawAwards.map(serializeAward),
  };
}

/**
 * Admin awards MVP to a user.
 * Guaranteed ATOMIC, IDEMPOTENT (no duplicates per season), and records full snapshot metadata.
 */
async function awardMVP({ userId, seasonId, grandId, title, reason, actorId, metadata }) {
  const competitionRealtime = require('./competition/competitionRealtime.service');

  const result = await sequelize.transaction(async (t) => {
    // 1. Verify User
    const user = await User.findByPk(userId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!user) {
      const err = new Error('Không tìm thấy người dùng nhận giải');
      err.statusCode = 404;
      throw err;
    }
    if (user.status === 'inactive') {
      const err = new Error('Tài khoản người dùng đã bị vô hiệu hóa hoặc không hợp lệ');
      err.statusCode = 400;
      throw err;
    }

    let season = null;
    if (seasonId) {
      season = await Season.findByPk(seasonId, {
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (!season) {
        const err = new Error(`Mùa giải #${seasonId} không tồn tại`);
        err.statusCode = 404;
        throw err;
      }
      if (['CANCELLED', 'ARCHIVED'].includes(season.status)) {
        const err = new Error(`Không thể trao giải cho mùa giải có trạng thái ${season.status}`);
        err.statusCode = 400;
        throw err;
      }

      // 2. Strict Duplicate Check per Season
      const existing = await UserRecognition.findOne({
        where: { seasonId: season.id, awardType: 'mvp' },
        lock: t.LOCK.UPDATE,
        transaction: t,
      });
      if (existing) {
        const err = new Error(
          `Mùa giải "${season.name}" (ID #${season.id}) đã được trao MVP Cup cho người nhận ID #${existing.userId}. Không thể trao trùng.`
        );
        err.statusCode = 409;
        throw err;
      }
    }

    const defaultTitle = season
      ? `MVP Mùa Giải #${season.id} — ${season.name}`
      : grandId
        ? `MVP Grand Championship #${grandId}`
        : 'Nhân Viên Xuất Sắc (MVP)';

    // 3. Build enriched snapshot metadata
    let calculatedScore = metadata?.score;
    let calculatedRank = metadata?.rank;
    if (season && (calculatedScore === undefined || calculatedRank === undefined)) {
      const scoreRow = await ScoreLedger.findOne({
        attributes: [
          [sequelize.fn('SUM', sequelize.col('points_delta')), 'totalPoints'],
          [sequelize.fn('COUNT', sequelize.fn('DISTINCT', sequelize.col('event_id'))), 'eventsCount'],
        ],
        where: { seasonId: season.id, userId: user.id },
        raw: true,
        transaction: t,
      });
      if (calculatedScore === undefined) {
        calculatedScore = Number(scoreRow?.totalPoints || 0);
      }
      if (calculatedRank === undefined) {
        calculatedRank = 1;
      }
    }

    const awardMetadata = {
      ...(metadata || {}),
      score: calculatedScore !== undefined ? calculatedScore : (metadata?.score ?? 0),
      rank: calculatedRank !== undefined ? calculatedRank : (metadata?.rank ?? 1),
      seasonName: season?.name || null,
      seasonStatus: season?.status || null,
      userName: user.name,
      jobTitle: user.jobTitle,
      department: user.department,
      teamId: user.teamId,
      awardedBy: actorId ? Number(actorId) : null,
      awardedAt: new Date().toISOString(),
    };

    // 4. Create UserRecognition record
    const recognition = await UserRecognition.create(
      {
        userId: user.id,
        awardType: 'mvp',
        title: (title && String(title).trim()) || defaultTitle,
        seasonId: season ? Number(season.id) : null,
        grandId: grandId ? Number(grandId) : null,
        reason: (reason && String(reason).trim()) || 'Trao giải MVP cho thành tích đóng góp xuất sắc',
        awardedBy: actorId ? Number(actorId) : null,
        awardedAt: new Date(),
        metadata: awardMetadata,
      },
      { transaction: t }
    );

    // 5. Synchronize CompetitionUserSummary (Profile & Hall of Fame consistency)
    const [summary] = await CompetitionUserSummary.findOrCreate({
      where: { userId: user.id },
      defaults: { userId: user.id },
      transaction: t,
    });
    const currentMeta = { ...(summary.metadata || {}) };
    const prevMvpCount = Number(currentMeta.mvpCount || 0);
    currentMeta.mvpCount = prevMvpCount + 1;
    summary.metadata = currentMeta;
    summary.changed('metadata', true);
    await summary.save({ transaction: t });

    // 6. Audit Log
    await CompetitionAuditLog.create(
      {
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
          metadata: awardMetadata,
        },
        reason: reason || 'Admin awarded MVP badge',
      },
      { transaction: t }
    );

    return { recognition, user, season };
  });

  // 7. Realtime emission after transaction commit
  try {
    const io = competitionRealtime.getIo();
    if (io) {
      io.emit('competition:mvp:awarded', {
        recognitionId: result.recognition.id,
        userId: result.user.id,
        userName: result.user.name,
        seasonId: result.recognition.seasonId,
        seasonName: result.season?.name || null,
        title: result.recognition.title,
        reason: result.recognition.reason,
        score: result.recognition.metadata?.score || 0,
        awardedAt: result.recognition.awardedAt,
      });
    }
  } catch (emitErr) {
    console.warn('[awardMVP] Realtime emission warning:', emitErr.message);
  }

  return result.recognition;
}

/**
 * Admin revokes MVP.
 * Guaranteed ATOMIC, decrements MVP count, and logs audit.
 */
async function revokeMVP({ recognitionId, actorId, reason }) {
  const competitionRealtime = require('./competition/competitionRealtime.service');

  const result = await sequelize.transaction(async (t) => {
    const recognition = await UserRecognition.findByPk(recognitionId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!recognition || recognition.awardType !== 'mvp') {
      const err = new Error('MVP recognition not found');
      err.statusCode = 404;
      throw err;
    }

    const userId = recognition.userId;
    const beforeState = {
      recognitionId: recognition.id,
      awardType: recognition.awardType,
      title: recognition.title,
      seasonId: recognition.seasonId,
      userId,
    };

    await recognition.destroy({ transaction: t });

    // Decrement CompetitionUserSummary
    const summary = await CompetitionUserSummary.findOne({
      where: { userId },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (summary) {
      const currentMeta = { ...(summary.metadata || {}) };
      currentMeta.mvpCount = Math.max(0, (Number(currentMeta.mvpCount || 0) - 1));
      summary.metadata = currentMeta;
      summary.changed('metadata', true);
      await summary.save({ transaction: t });
    }

    await CompetitionAuditLog.create(
      {
        actorId: actorId ? Number(actorId) : null,
        action: 'MVP_REVOKED',
        entityType: 'RECOGNITION',
        entityId: String(userId),
        beforeState,
        reason: reason || 'Admin revoked MVP badge',
      },
      { transaction: t }
    );

    return { success: true, recognition: beforeState, userId };
  });

  try {
    const io = competitionRealtime.getIo();
    if (io) {
      io.emit('competition:mvp:revoked', {
        recognitionId: Number(recognitionId),
        userId: result.userId,
      });
    }
  } catch (emitErr) {
    console.warn('[revokeMVP] Realtime emission warning:', emitErr.message);
  }

  return result;
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

/**
 * Preview candidate winner for a season's MVP Cup.
 */
async function previewSeasonMvpWinner(seasonId) {
  const season = await Season.findByPk(seasonId);
  if (!season) {
    const err = new Error(`Mùa giải #${seasonId} không tồn tại`);
    err.statusCode = 404;
    throw err;
  }

  // 1. Check if already awarded
  const existingAward = await UserRecognition.findOne({
    where: { seasonId: season.id, awardType: 'mvp' },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'jobTitle', 'department', 'teamId'],
        include: [{ model: UserProfilePreference, as: 'UserProfilePreference', attributes: ['avatarData'], required: false }],
      },
    ],
  });

  if (existingAward) {
    return {
      status: 'ALREADY_AWARDED',
      season: {
        id: season.id,
        name: season.name,
        status: season.status,
        startAt: season.startAt,
        endAt: season.endAt,
      },
      existingAward: {
        id: existingAward.id,
        userId: existingAward.userId,
        userName: existingAward.user?.name || `User #${existingAward.userId}`,
        userAvatar: existingAward.user?.UserProfilePreference?.avatarData || null,
        jobTitle: existingAward.user?.jobTitle || 'Nhân viên',
        department: existingAward.user?.department || 'Media & Content',
        title: existingAward.title,
        reason: existingAward.reason,
        awardedAt: existingAward.awardedAt,
        awardedBy: existingAward.awardedBy,
        metadata: existingAward.metadata,
      },
      candidate: null,
    };
  }

  // 2. Determine winner from season source of truth
  const seasonService = require('./competition/season.service');
  let candidate = null;
  let isTied = false;
  let tiedCount = 1;

  // Check if Season is FROZEN / FINISHED
  const frozen = await SeasonFrozenResult.findOne({ where: { seasonId: season.id } });
  if (frozen && frozen.metadata) {
    const indChamp = frozen.metadata.individualChampion;
    const finalRankings = frozen.metadata.finalIndividualRankings || [];

    if (indChamp && indChamp.userId) {
      candidate = indChamp;
      if (Array.isArray(finalRankings) && finalRankings.length > 1) {
        const topScore = Number(indChamp.score || indChamp.points || 0);
        const tiedUsers = finalRankings.filter((r) => Number(r.score || r.points || 0) === topScore && topScore > 0);
        if (tiedUsers.length > 1) {
          isTied = true;
          tiedCount = tiedUsers.length;
        }
      }
    } else if (Array.isArray(finalRankings) && finalRankings.length > 0) {
      candidate = finalRankings[0];
    }
  }

  // Fallback to active leaderboard calculation if not in frozen result
  if (!candidate) {
    const leaderboard = await seasonService.getSeasonIndividualLeaderboard(season.id, { limit: 50 });
    if (leaderboard.seasonIndividualChampion) {
      candidate = leaderboard.seasonIndividualChampion;
      const topScore = Number(candidate.score || candidate.points || 0);
      if (topScore > 0 && Array.isArray(leaderboard.rankings)) {
        const tiedUsers = leaderboard.rankings.filter((r) => Number(r.score || r.points || 0) === topScore);
        if (tiedUsers.length > 1) {
          isTied = true;
          tiedCount = tiedUsers.length;
        }
      }
    } else if (Array.isArray(leaderboard.rankings) && leaderboard.rankings.length > 0) {
      candidate = leaderboard.rankings[0];
    }
  }

  if (!candidate || !candidate.userId) {
    return {
      status: 'NO_CANDIDATE',
      season: {
        id: season.id,
        name: season.name,
        status: season.status,
        startAt: season.startAt,
        endAt: season.endAt,
      },
      message: 'Mùa giải này chưa có dữ liệu thành viên tham gia hoặc ghi điểm.',
      candidate: null,
    };
  }

  // Ensure full candidate profile
  const user = await User.findByPk(candidate.userId, {
    attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId', 'isVerified', 'isDev', 'status'],
    include: [
      { model: Team, attributes: ['id', 'name'] },
      { model: UserProfilePreference, as: 'UserProfilePreference', attributes: ['avatarData'], required: false },
    ],
  });

  const candScore = Number(candidate.score || candidate.points || candidate.totalScore || 0);
  const candEvents = Number(candidate.eventsCount || 0);
  const candRank = Number(candidate.rank || candidate.overallRank || 1);

  if (candScore <= 0) {
    return {
      status: 'NO_CANDIDATE',
      season: {
        id: season.id,
        name: season.name,
        status: season.status,
        startAt: season.startAt,
        endAt: season.endAt,
      },
      message: 'Mùa giải này chưa có dữ liệu ghi điểm hoặc thành viên chưa tích lũy điểm.',
      candidate: null,
    };
  }

  const suggestedTitle = `MVP Mùa Giải #${season.id} — ${season.name}`;
  const suggestedReason = candScore > 0
    ? `Xuất sắc đạt Hạng #${candRank} cá nhân toàn mùa với ${candScore.toLocaleString()} XP qua ${candEvents} lượt đóng góp nổi bật.`
    : `Vinh danh cá nhân dẫn đầu bảng xếp hạng Mùa Giải #${season.id}.`;

  return {
    status: 'READY',
    season: {
      id: season.id,
      name: season.name,
      status: season.status,
      startAt: season.startAt,
      endAt: season.endAt,
    },
    candidate: {
      userId: candidate.userId,
      name: user?.name || candidate.userName || `User #${candidate.userId}`,
      email: user?.email || candidate.userEmail || '',
      jobTitle: user?.jobTitle || candidate.jobTitle || 'Nhân viên',
      department: user?.department || candidate.department || 'Media & Content',
      teamId: user?.teamId || candidate.teamId || null,
      teamName: user?.Team?.name || candidate.teamName || 'Chưa gán đội',
      avatarData: user?.UserProfilePreference?.avatarData || candidate.avatarData || candidate.userAvatar || null,
      isVerified: Boolean(user?.isVerified || candidate.isVerified),
      isDev: Boolean(user?.isDev || candidate.isDev),
      status: user?.status || 'active',
      score: candScore,
      rank: candRank,
      eventsCount: candEvents,
      lastScoredAt: candidate.lastScoredAt || null,
    },
    suggestedTitle,
    suggestedReason,
    isTied,
    tiedCount,
  };
}

/**
 * List all seasons with their MVP Awarding status.
 */
async function listSeasonsMvpStatus() {
  const seasons = await Season.findAll({
    order: [['startAt', 'DESC'], ['id', 'DESC']],
    attributes: ['id', 'name', 'slug', 'status', 'seasonType', 'startAt', 'endAt'],
  });

  const mvpAwards = await UserRecognition.findAll({
    where: { awardType: 'mvp', seasonId: { [Op.ne]: null } },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId'],
        include: [{ model: UserProfilePreference, as: 'UserProfilePreference', attributes: ['avatarData'], required: false }],
      },
    ],
  });

  const mvpMap = new Map();
  for (const a of mvpAwards) {
    mvpMap.set(Number(a.seasonId), a);
  }

  return seasons.map((s) => {
    const existingAward = mvpMap.get(Number(s.id));
    return {
      id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      seasonType: s.seasonType,
      startAt: s.startAt,
      endAt: s.endAt,
      hasMvpAwarded: Boolean(existingAward),
      mvpAward: existingAward
        ? {
            id: existingAward.id,
            userId: existingAward.userId,
            userName: existingAward.user?.name || `User #${existingAward.userId}`,
            userAvatar: existingAward.user?.UserProfilePreference?.avatarData || null,
            jobTitle: existingAward.user?.jobTitle || 'Nhân viên',
            department: existingAward.user?.department || 'Media & Content',
            title: existingAward.title,
            reason: existingAward.reason,
            awardedAt: existingAward.awardedAt,
          }
        : null,
    };
  });
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
  previewSeasonMvpWinner,
  listSeasonsMvpStatus,
};
