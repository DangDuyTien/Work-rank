const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { Op } = require('sequelize');
const {
  User,
  Team,
  UserProfileImage,
  UserProfilePreference,
  CompetitionUserSummary,
  SeasonIndividualLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  Season,
  SeasonTeamMember,
  TeamYouTubeSummary,
  CompetitionAuditLog,
} = require('../models');
const sanitizeUser = require('../utils/sanitizeUser');
const { decorateUserPresence } = require('../services/userPresence.service');
const profileLikeService = require('../services/profileLike.service');
const recognitionService = require('../services/recognition.service');
const competitionRealtime = require('../services/competition/competitionRealtime.service');
const userDeletionService = require('../services/userDeletion.service');

const GALLERY_SLOT_COUNT = 6;
const FEATURED_BADGE_LIMIT = 12;
const MAX_PROFILE_IMAGE_CHARS = 5_000_000;
const MAX_AVATAR_IMAGE_CHARS = 5_000_000;
const DEFAULT_USER_LIST_LIMIT = 50;
const MAX_USER_LIST_LIMIT = 100;
const ADMIN_PRIVILEGE_BADGE_LABELS = new Set([
  'Tích xanh đặc quyền',
  'Dev',
  'Dev đặc quyền',
  'Người đóng góp',
  'Nhà sáng lập',
  'Thành viên VIP',
  'Đối tác WorkRank',
  'Người nổi bật',
]);

function canCustomizeUserProfile(req, userId) {
  return req.user?.role === 'admin' || String(req.user?.id || '') === String(userId);
}

function parseGallerySlot(value) {
  const raw = String(value ?? '');
  if (!/^\d+$/.test(raw)) return null;
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot >= GALLERY_SLOT_COUNT) return null;
  return slot;
}

function validateImageData(value, maxLength = 5_000_000) {
  const imageData = String(value || '').trim();
  if (!imageData) return { error: 'Missing image data' };
  if (
    !imageData.startsWith('data:image/') &&
    !imageData.startsWith('http://') &&
    !imageData.startsWith('https://') &&
    !imageData.startsWith('/')
  ) {
    return { error: 'Image data must be a valid image data URL or HTTP URL' };
  }
  if (imageData.length > maxLength) return { error: 'Image data is too large (max 5MB)' };
  return { value: imageData };
}

function uniqueBadgeLabels(value) {
  return (Array.isArray(value) ? value : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index);
}

function normalizeFeaturedBadges(value, { existingLabels = [], isAdmin = false } = {}) {
  if (value === undefined) return { value: undefined };
  if (!Array.isArray(value)) return { error: 'Featured badges must be an array' };
  let labels = uniqueBadgeLabels(value);
  if (!isAdmin) {
    const existingPrivilegeLabels = uniqueBadgeLabels(existingLabels)
      .filter((label) => ADMIN_PRIVILEGE_BADGE_LABELS.has(label));
    const requestedPrivilegeLabels = labels
      .filter((label) => ADMIN_PRIVILEGE_BADGE_LABELS.has(label));
    const unauthorized = requestedPrivilegeLabels
      .filter((label) => !existingPrivilegeLabels.includes(label));
    if (unauthorized.length > 0) return { error: 'Privilege badges can only be managed by admins' };
    labels = [
      ...existingPrivilegeLabels,
      ...labels.filter((label) => !ADMIN_PRIVILEGE_BADGE_LABELS.has(label)),
    ];
  }
  labels = labels.slice(0, FEATURED_BADGE_LIMIT);
  if (labels.some((label) => label.length > 80)) return { error: 'Featured badge label is too long' };
  return { value: labels };
}

function serializeProfilePreference(preference) {
  return {
    avatarData: preference?.avatarData || null,
    featuredBadges: Array.isArray(preference?.featuredBadges) ? preference.featuredBadges : [],
    hasFeaturedBadgesPreference: Array.isArray(preference?.featuredBadges),
  };
}

function serializeUserWithProfile(user) {
  const plain = sanitizeUser(user);
  const preference = plain.UserProfilePreference || plain.userProfilePreference || null;
  delete plain.UserProfilePreference;
  delete plain.userProfilePreference;
  return decorateUserPresence({
    ...plain,
    avatarData: preference?.avatarData || null,
  });
}

function serializeUserListItem(user) {
  const plain = sanitizeUser(user);
  const preference = plain.UserProfilePreference || plain.userProfilePreference || null;
  const team = plain.Team || plain.team || null;
  delete plain.UserProfilePreference;
  delete plain.userProfilePreference;
  delete plain.Team;
  delete plain.team;
  return decorateUserPresence({
    ...plain,
    avatarData: preference?.avatarData || null,
    jobTitle: plain.jobTitle || 'Nhân viên',
    department: plain.department || 'Media & Content',
    team: team ? { id: team.id, name: team.name, ownerId: team.ownerId } : null,
    teamId: plain.teamId || team?.id || null,
    teamName: team?.name || null,
    isTeamLeader: team ? String(team.ownerId || '') === String(plain.id) : false,
    featuredBadges: Array.isArray(preference?.featuredBadges) ? preference.featuredBadges : [],
  });
}

function clampPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function serializeProfileImage(image) {
  return {
    slot: image.slot,
    imageData: image.imageData,
  };
}

async function list(req, res) {
  const limit = clampPositiveInt(req.query.limit, DEFAULT_USER_LIST_LIMIT, MAX_USER_LIST_LIMIT);
  const page = clampPositiveInt(req.query.page, 1, 1000000);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const department = String(req.query.department || '').trim();
  const hasTeam = req.query.hasTeam;
  const withCount = req.query.withCount !== '0' && req.query.withCount !== 'false';
  const where = {};
  if (!req.query.status) {
    where.status = 'active';
  } else if (req.query.status !== 'all') {
    where.status = req.query.status;
  }
  if (search) {
    const idMatch = search.match(/^WR-?0*(\d+)$/i) || search.match(/^#?0*(\d+)$/);
    const searchClauses = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { jobTitle: { [Op.like]: `%${search}%` } },
      { department: { [Op.like]: `%${search}%` } },
    ];
    if (idMatch) searchClauses.push({ id: Number(idMatch[1]) });
    where[Op.or] = searchClauses;
  }
  if (department && department !== 'all') {
    where.department = department;
  }
  if (hasTeam === 'true') {
    where.teamId = { [Op.ne]: null };
  } else if (hasTeam === 'false') {
    where.teamId = null;
  }

  const queryOptions = {
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    include: [
      { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      { model: Team, attributes: ['id', 'name', 'ownerId'], required: false },
    ],
  };
  const { count, rows } = withCount
    ? await User.findAndCountAll(queryOptions)
    : { count: null, rows: await User.findAll(queryOptions) };
  res.json({
    data: rows.map(serializeUserListItem),
    pagination: withCount ? {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      hasNextPage: offset + rows.length < count,
    } : null,
  });
}

async function getById(req, res) {
  const user = await User.findByPk(req.params.id, {
    include: [
      { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
      { model: Team, attributes: ['id', 'name', 'description'], required: false },
      { model: CompetitionUserSummary, as: 'competitionSummary', required: false },
    ],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });

  // 1. Historical Season Participations (Bảo toàn lịch sử thi đấu & team snapshot khi user chuyển đội)
  let historicalProjections = [];
  try {
    historicalProjections = await SeasonIndividualLeaderboardProjection.findAll({
      where: { userId: user.id },
      order: [['seasonId', 'DESC']],
    });
  } catch (err) {
    historicalProjections = [];
  }

  // 2. Team YouTube Context (Chỉ trả về nếu viewer là admin hoặc cùng team với user)
  let youtubeSummary = null;
  const isViewerAdmin = req.user?.role === 'admin';
  const isSameTeam = user.teamId && req.user?.teamId && Number(user.teamId) === Number(req.user.teamId);
  if (user.teamId && (isViewerAdmin || isSameTeam)) {
    try {
      const ytRow = await TeamYouTubeSummary.findOne({ where: { teamId: user.teamId } });
      if (ytRow) {
        youtubeSummary = {
          teamId: ytRow.teamId,
          teamName: ytRow.teamName,
          channelsCount: ytRow.channelsCount,
          totalViews: ytRow.totalViews,
          totalSubscribers: ytRow.totalSubscribers,
          viewsGrowth30dPct: ytRow.viewsGrowth30dPct,
          rankByViews: ytRow.rankByViews,
          topVideoTitle: ytRow.topVideoTitle,
          topVideoViews: ytRow.topVideoViews,
        };
      }
    } catch (err) {
      youtubeSummary = null;
    }
  }

  // 3. Official Recognitions & Badges
  let recognitions = null;
  try {
    recognitions = await recognitionService.getUserRecognitions(user.id);
  } catch (err) {
    recognitions = null;
  }

  const serialized = serializeUserWithProfile(user);
  const competition = user.competitionSummary ? {
    currentSeasonRank: user.competitionSummary.currentSeasonRank || null,
    currentSeasonScore: Number(user.competitionSummary.currentSeasonScore || 0),
    grandRank: user.competitionSummary.grandRank || null,
    grandPoints: Number(user.competitionSummary.grandPoints || 0),
    seasonWins: Number(user.competitionSummary.seasonWins || 0),
    podiumCount: Number(user.competitionSummary.podiumCount || 0),
    currentStreak: Number(user.competitionSummary.currentStreak || 0),
    mvpCount: Number(user.competitionSummary.metadata?.mvpCount || 0),
  } : null;

  return res.json({
    user: serialized,
    team: user.Team ? { id: user.Team.id, name: user.Team.name, description: user.Team.description } : null,
    competition,
    historicalSeasons: historicalProjections.map((p) => ({
      seasonId: p.seasonId,
      teamId: p.teamId,
      teamName: p.teamName,
      rank: p.rank,
      points: Number(p.points || 0),
      trend: p.trend,
      lastScoredAt: p.lastScoredAt,
    })),
    youtubeSummary,
    recognitions,
  });
}

async function create(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, env.bcryptRounds);
  const user = await User.create({ ...req.body, passwordHash });
  res.status(201).json({ user: sanitizeUser(user) });
}

async function syncUserAcrossReadModelsAndRealtime(req, user, oldTeamId) {
  if (!user?.id) return null;
  try {
    const refreshed = await User.findByPk(user.id, {
      include: [
        { model: UserProfilePreference, attributes: ['avatarData', 'featuredBadges'], required: false },
        { model: Team, attributes: ['id', 'name', 'ownerId'], required: false },
        { model: CompetitionUserSummary, as: 'competitionSummary', required: false },
      ],
    });
    if (!refreshed) return null;

    const teamChanged = oldTeamId !== undefined && (
      (oldTeamId === null && refreshed.teamId !== null) ||
      (oldTeamId !== null && refreshed.teamId === null) ||
      (Number(oldTeamId) !== Number(refreshed.teamId))
    );

    // 1. If team membership changed, sync SeasonTeamMember and projection records for active seasons
    if (teamChanged) {
      try {
        const activeSeasons = await Season.findAll({
          where: { status: { [Op.in]: ['ACTIVE', 'PAUSED'] } },
        });

        for (const season of activeSeasons) {
          if (refreshed.teamId) {
            const existingMember = await SeasonTeamMember.findOne({
              where: { seasonId: season.id, userId: refreshed.id },
            });
            if (existingMember) {
              await existingMember.update({
                teamId: refreshed.teamId,
                roleSnapshot: refreshed.Team && String(refreshed.Team.ownerId) === String(refreshed.id) ? 'leader' : 'member',
                leftAt: null,
              });
            } else {
              await SeasonTeamMember.create({
                seasonId: season.id,
                teamId: refreshed.teamId,
                userId: refreshed.id,
                roleSnapshot: refreshed.Team && String(refreshed.Team.ownerId) === String(refreshed.id) ? 'leader' : 'member',
              });
            }
          } else {
            await SeasonTeamMember.update(
              { leftAt: new Date() },
              { where: { seasonId: season.id, userId: refreshed.id } }
            );
          }
        }
      } catch (err) {
        console.error('[syncUserAcrossReadModelsAndRealtime] Error updating SeasonTeamMember:', err);
      }
    }

    // 2. Sync Projections (Preserve historical team snapshots, update display name)
    try {
      await SeasonIndividualLeaderboardProjection.update(
        { userName: refreshed.name },
        { where: { userId: refreshed.id } }
      );
      await GrandIndividualLeaderboardProjection.update(
        { userName: refreshed.name },
        { where: { userId: refreshed.id } }
      );
    } catch (err) {
      console.error('[syncUserAcrossReadModelsAndRealtime] Error updating projections:', err);
    }

    // 3. Serialize user for broadcast
    const serialized = serializeUserWithProfile(refreshed);
    const pref = refreshed.UserProfilePreference;

    const broadcastPayload = {
      userId: refreshed.id,
      user: {
        ...serialized,
        avatarData: pref?.avatarData || null,
        userAvatar: pref?.avatarData || null,
        jobTitle: refreshed.jobTitle || 'Nhân viên',
        department: refreshed.department || 'Media & Content',
        teamId: refreshed.teamId || null,
        teamName: refreshed.Team?.name || null,
        isVerified: Boolean(refreshed.isVerified),
        isDev: Boolean(refreshed.isDev),
      },
    };

    // 4. Broadcast via Socket.IO
    const io = req?.app?.get('io') || competitionRealtime.getIo();
    if (io) {
      io.emit('user:updated', broadcastPayload);
      io.to(`user:${refreshed.id}`).emit('user:updated', broadcastPayload);

      if (teamChanged) {
        const teamPayload = {
          userId: refreshed.id,
          oldTeamId: oldTeamId || null,
          newTeamId: refreshed.teamId || null,
          teamName: refreshed.Team?.name || null,
        };
        io.emit('team:membership:updated', teamPayload);
        if (oldTeamId) io.to(`team:${oldTeamId}`).emit('team:membership:updated', teamPayload);
        if (refreshed.teamId) io.to(`team:${refreshed.teamId}`).emit('team:membership:updated', teamPayload);
      }

      io.emit('competition:leaderboard_updated', {
        userId: refreshed.id,
        teamId: refreshed.teamId,
        timestamp: new Date().toISOString(),
      });
    }

    return refreshed;
  } catch (err) {
    console.error('[syncUserAcrossReadModelsAndRealtime] Failed:', err);
    return null;
  }
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const isAdmin = req.user?.role === 'admin';
  const isSelf = String(req.user?.id || '') === String(user.id);
  const oldTeamId = user.teamId;

  if (!isAdmin && !isSelf) {
    return res.status(403).json({ message: 'Forbidden' });
  }

  // Nếu là user thường cập nhật hồ sơ chính mình
  if (!isAdmin && isSelf) {
    const allowed = {};
    if (req.body.name !== undefined) allowed.name = req.body.name;
    if (req.body.bio !== undefined) allowed.bio = req.body.bio;
    if (req.body.phone !== undefined) allowed.phone = req.body.phone;

    // Ngăn chặn leo thang đặc quyền / đổi vị trí công việc / huy hiệu
    if (
      (req.body.role !== undefined && req.body.role !== user.role) ||
      (req.body.jobTitle !== undefined && req.body.jobTitle !== user.jobTitle) ||
      (req.body.department !== undefined && req.body.department !== user.department) ||
      (req.body.teamId !== undefined && Number(req.body.teamId) !== Number(user.teamId)) ||
      (req.body.isVerified !== undefined && Boolean(req.body.isVerified) !== Boolean(user.isVerified)) ||
      (req.body.isDev !== undefined && Boolean(req.body.isDev) !== Boolean(user.isDev)) ||
      (req.body.status !== undefined && req.body.status !== user.status)
    ) {
      return res.status(403).json({
        message: 'Bạn không có quyền chỉnh sửa chức danh, phòng ban, đội nhóm hoặc phân quyền/huy hiệu hệ thống. Vui lòng liên hệ Admin.',
      });
    }

    await user.update(allowed);

    if (req.body.avatarData !== undefined) {
      const avatarVal = req.body.avatarData === '' || req.body.avatarData === null ? null : req.body.avatarData;
      let pref = await UserProfilePreference.findByPk(user.id);
      if (pref) {
        await pref.update({ avatarData: avatarVal });
      } else {
        await UserProfilePreference.create({ userId: user.id, avatarData: avatarVal });
      }
    }

    const reloaded = await syncUserAcrossReadModelsAndRealtime(req, user, oldTeamId);
    return res.json({ user: serializeUserWithProfile(reloaded || user) });
  }

  // Nếu là Admin
  const actorId = req.user?.id;
  const reason = req.body.reason || 'Admin updated employee profile';

  // Audit job title changes if any
  if (
    (req.body.jobTitle !== undefined && req.body.jobTitle !== user.jobTitle) ||
    (req.body.department !== undefined && req.body.department !== user.department) ||
    (req.body.teamId !== undefined && Number(req.body.teamId) !== Number(user.teamId))
  ) {
    await recognitionService.setJobTitle({
      userId: user.id,
      jobTitle: req.body.jobTitle !== undefined ? req.body.jobTitle : user.jobTitle,
      department: req.body.department !== undefined ? req.body.department : user.department,
      teamId: req.body.teamId !== undefined ? req.body.teamId : user.teamId,
      actorId,
      reason,
    });
  }

  // Audit verified changes if any
  if (req.body.isVerified !== undefined && Boolean(req.body.isVerified) !== Boolean(user.isVerified)) {
    await recognitionService.setVerified({
      userId: user.id,
      isVerified: req.body.isVerified,
      actorId,
      reason,
    });
  }

  // Audit dev badge changes if any
  if (req.body.isDev !== undefined && Boolean(req.body.isDev) !== Boolean(user.isDev)) {
    await recognitionService.setDevBadge({
      userId: user.id,
      isDev: req.body.isDev,
      actorId,
      reason,
    });
  }

  const adminPayload = { ...req.body };
  delete adminPayload.reason;
  if (adminPayload.password) {
    adminPayload.passwordHash = await bcrypt.hash(adminPayload.password, env.bcryptRounds);
    delete adminPayload.password;
  }

  const avatarPayload = adminPayload.avatarData;
  delete adminPayload.avatarData;

  await user.update(adminPayload);

  if (avatarPayload !== undefined) {
    const avatarVal = avatarPayload === '' || avatarPayload === null ? null : avatarPayload;
    let pref = await UserProfilePreference.findByPk(user.id);
    if (pref) {
      await pref.update({ avatarData: avatarVal });
    } else {
      await UserProfilePreference.create({ userId: user.id, avatarData: avatarVal });
    }
  }

  const reloaded = await syncUserAcrossReadModelsAndRealtime(req, user, oldTeamId);
  return res.json({ user: serializeUserWithProfile(reloaded || user) });
}

async function remove(req, res) {
  const result = await userDeletionService.deleteUserAccount({
    targetUserId: req.params.id,
    actorUser: req.user,
    isSelfDelete: false,
    req,
  });
  return res.json({ message: 'Đã xóa tài khoản nhân sự thành công.', ...result });
}

async function selfDelete(req, res) {
  const password = req.body?.password || req.body?.currentPassword;
  const result = await userDeletionService.deleteUserAccount({
    targetUserId: req.user.id,
    actorUser: req.user,
    isSelfDelete: true,
    password,
    req,
  });
  return res.json({ message: 'Tài khoản của bạn đã được xóa thành công.', ...result });
}

async function getRecognitions(req, res) {
  const data = await recognitionService.getUserRecognitions(req.params.id);
  if (!data) return res.status(404).json({ message: 'User not found' });
  return res.json({ data });
}

async function adminAwardMVP(req, res) {
  const { userId, seasonId, grandId, title, reason, metadata } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId is required' });
  try {
    const recognition = await recognitionService.awardMVP({
      userId: Number(userId),
      seasonId: seasonId ? Number(seasonId) : null,
      grandId: grandId ? Number(grandId) : null,
      title,
      reason,
      metadata,
      actorId: req.user?.id,
    });
    const updatedUser = await User.findByPk(userId);
    if (updatedUser) await syncUserAcrossReadModelsAndRealtime(req, updatedUser);
    return res.status(201).json({ recognition });
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ message: err.message });
  }
}

async function adminRevokeMVP(req, res) {
  const { id } = req.params;
  const { reason } = req.body || {};
  try {
    const result = await recognitionService.revokeMVP({
      recognitionId: id,
      actorId: req.user?.id,
      reason,
    });
    if (result?.userId) {
      const updatedUser = await User.findByPk(result.userId);
      if (updatedUser) await syncUserAcrossReadModelsAndRealtime(req, updatedUser);
    }
    return res.json(result);
  } catch (err) {
    const status = err.statusCode || 400;
    return res.status(status).json({ message: err.message });
  }
}

async function adminAwardChampion(req, res) {
  const { userId, seasonId, grandId, title, reason } = req.body;
  if (!userId) return res.status(400).json({ message: 'userId is required' });
  try {
    const recognition = await recognitionService.awardChampion({
      userId,
      seasonId,
      grandId,
      title,
      reason,
      actorId: req.user?.id,
    });
    const updatedUser = await User.findByPk(userId);
    if (updatedUser) await syncUserAcrossReadModelsAndRealtime(req, updatedUser);
    return res.status(201).json({ recognition });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function adminUpdateJobProfile(req, res) {
  const { id } = req.params;
  const { jobTitle, department, teamId, isVerified, isDev, reason } = req.body;
  const actorId = req.user?.id;

  let user = await User.findByPk(id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const oldTeamId = user.teamId;

  if (jobTitle !== undefined || department !== undefined || teamId !== undefined) {
    user = await recognitionService.setJobTitle({
      userId: id,
      jobTitle,
      department,
      teamId,
      actorId,
      reason,
    });
  }

  if (isVerified !== undefined && Boolean(isVerified) !== Boolean(user.isVerified)) {
    user = await recognitionService.setVerified({
      userId: id,
      isVerified,
      actorId,
      reason,
    });
  }

  if (isDev !== undefined && Boolean(isDev) !== Boolean(user.isDev)) {
    user = await recognitionService.setDevBadge({
      userId: id,
      isDev,
      actorId,
      reason,
    });
  }

  const reloaded = await syncUserAcrossReadModelsAndRealtime(req, user, oldTeamId);
  return res.json({ user: serializeUserWithProfile(reloaded || user) });
}

async function adminGetAuditLogs(req, res) {
  const { userId, action, limit = 50, page = 1 } = req.query;
  const where = {};
  if (userId) where.entityId = String(userId);
  if (action) where.action = action;

  const logs = await CompetitionAuditLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: clampPositiveInt(limit, 50, 200),
    offset: (clampPositiveInt(page, 1, 10000) - 1) * clampPositiveInt(limit, 50, 200),
  });

  return res.json({ logs });
}

async function getProfilePreferences(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const preference = await UserProfilePreference.findByPk(user.id);
  return res.json({ data: serializeProfilePreference(preference) });
}

async function updateProfilePreferences(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const values = {};
  let preference = await UserProfilePreference.findByPk(user.id);
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarData')) {
    if (req.body.avatarData === null || req.body.avatarData === '') {
      values.avatarData = null;
    } else {
      const image = validateImageData(req.body.avatarData, MAX_AVATAR_IMAGE_CHARS);
      if (image.error) return res.status(400).json({ message: image.error });
      values.avatarData = image.value;
    }
  }

  const featuredBadges = normalizeFeaturedBadges(req.body?.featuredBadges, {
    existingLabels: preference?.featuredBadges,
    isAdmin: req.user?.role === 'admin',
  });
  if (featuredBadges.error) return res.status(400).json({ message: featuredBadges.error });
  if (featuredBadges.value !== undefined) values.featuredBadges = featuredBadges.value;

  if (preference) {
    await preference.update(values);
  } else {
    preference = await UserProfilePreference.create({ userId: user.id, ...values });
  }

  await syncUserAcrossReadModelsAndRealtime(req, user);

  return res.json({ data: serializeProfilePreference(preference) });
}

async function gallery(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const images = await UserProfileImage.findAll({
    where: { userId: user.id },
    order: [['slot', 'ASC']],
  });
  return res.json({ data: images.map(serializeProfileImage) });
}

async function updateGalleryImage(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const slot = parseGallerySlot(req.params.slot);
  if (slot === null) return res.status(400).json({ message: 'Invalid gallery slot' });

  const image = validateImageData(req.body?.imageData, MAX_PROFILE_IMAGE_CHARS);
  if (image.error) return res.status(400).json({ message: image.error });

  const existing = await UserProfileImage.findOne({ where: { userId: user.id, slot } });
  const row = existing
    ? await existing.update({ imageData: image.value })
    : await UserProfileImage.create({ userId: user.id, slot, imageData: image.value });

  return res.json({ image: serializeProfileImage(row) });
}

async function removeGalleryImage(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const slot = parseGallerySlot(req.params.slot);
  if (slot === null) return res.status(400).json({ message: 'Invalid gallery slot' });

  await UserProfileImage.destroy({ where: { userId: user.id, slot } });
  return res.status(204).send();
}

async function getProfileLikes(req, res) {
  try {
    const data = await profileLikeService.getProfileLikes({
      viewerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.json({ data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
}

async function likeProfile(req, res) {
  try {
    const data = await profileLikeService.likeProfile({
      likerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.status(data.created ? 201 : 200).json({ data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  selfDelete,
  getRecognitions,
  adminAwardMVP,
  adminRevokeMVP,
  adminAwardChampion,
  adminUpdateJobProfile,
  adminGetAuditLogs,
  getProfilePreferences,
  updateProfilePreferences,
  gallery,
  updateGalleryImage,
  removeGalleryImage,
  getProfileLikes,
  likeProfile,
};
