'use strict';

const { Op } = require('sequelize');
const { Drawing, DrawingLike, User, Team, UserProfilePreference, SystemSetting } = require('../models');
const { ValidationError, NotFoundError, ForbiddenError, StorageError } = require('../utils/errors');
const { resolveStorageConfig } = require('../config/storage');
const transaction = require('./typingTransaction');
const {
  getDrawingStorage,
  parseStorageKey,
} = require('./storage/drawingStorage.service');

const CREATIVE_CORNER_SETTING_KEY = 'creative_corner_settings';

/**
 * Get current system settings for Creative Corner & Drawing Game.
 */
async function getSettings() {
  try {
    const setting = await SystemSetting.findOne({
      where: { settingKey: CREATIVE_CORNER_SETTING_KEY },
    });
    if (!setting || !setting.settingValue) {
      return {
        homeVisible: true,
        gameEnabled: true,
      };
    }
    const val = typeof setting.settingValue === 'string' ? JSON.parse(setting.settingValue) : setting.settingValue;
    return {
      homeVisible: val.homeVisible !== false,
      gameEnabled: val.gameEnabled !== false,
    };
  } catch (err) {
    console.warn('[DrawingService] getSettings error fallback:', err.message);
    return {
      homeVisible: true,
      gameEnabled: true,
    };
  }
}

/**
 * Update system settings for Creative Corner (Admin Only).
 */
async function updateSettings({ homeVisible, gameEnabled }) {
  let setting = await SystemSetting.findOne({
    where: { settingKey: CREATIVE_CORNER_SETTING_KEY },
  });

  let current = { homeVisible: true, gameEnabled: true };
  if (setting && setting.settingValue) {
    current = typeof setting.settingValue === 'string' ? JSON.parse(setting.settingValue) : setting.settingValue;
  }

  const updatedValue = {
    ...current,
    ...(typeof homeVisible === 'boolean' ? { homeVisible } : {}),
    ...(typeof gameEnabled === 'boolean' ? { gameEnabled } : {}),
  };

  if (!setting) {
    await SystemSetting.create({
      settingKey: CREATIVE_CORNER_SETTING_KEY,
      settingValue: updatedValue,
      description: 'Cấu hình hiển thị Góc Sáng Tạo trên Trang chủ và Trạng thái Game vẽ tranh',
    });
  } else {
    await setting.update({
      settingValue: updatedValue,
    });
  }

  return updatedValue;
}

/**
 * Normalizes user author object for frontend display.
 */
function formatAuthor(user) {
  if (!user) {
    return {
      id: null,
      name: 'Ẩn danh',
      avatarUrl: null,
      jobTitle: null,
      department: null,
      teamName: null,
      isVerified: false,
    };
  }
  const pref = user.UserProfilePreference || user.userProfilePreference;
  return {
    id: user.id,
    name: user.name || 'Thành viên WorkRank',
    avatarUrl: pref?.avatarData || user.avatarUrl || user.avatar_url || null,
    jobTitle: user.jobTitle || user.job_title || null,
    department: user.department || null,
    teamName: user.Team ? user.Team.name : null,
    isVerified: Boolean(user.isVerified),
  };
}

/**
 * Formats drawing object including like status.
 */
function canViewDrawing(drawing, { userId = null, teamId = null, isAdmin = false } = {}) {
  const plain = drawing.get ? drawing.get({ plain: true }) : drawing;
  if (isAdmin || plain.visibility === 'PUBLIC') return true;
  if (!userId) return false;
  if (Number(plain.userId) === Number(userId)) return true;
  return plain.visibility === 'TEAM' && teamId != null && Number(plain.author?.teamId) === Number(teamId);
}

function formatDrawing(drawing, likedDrawingIds = new Set()) {
  const plain = drawing.get ? drawing.get({ plain: true }) : drawing;
  const storageConfig = resolveStorageConfig();
  return {
    id: plain.id,
    title: plain.title || 'Tác phẩm không tên',
    imageUrl: plain.storageProvider === 's3' && plain.storageKey && storageConfig.provider === 's3' && storageConfig.ok
      ? getDrawingStorage().getPublicUrl(plain.storageKey) : plain.imageUrl || plain.image_url,
    storageProvider: plain.storageProvider || null,
    storagePersistent: plain.storageProvider === 's3',
    width: plain.width || 1200,
    height: plain.height || 700,
    visibility: plain.visibility || 'PUBLIC',
    status: plain.status || 'ACTIVE',
    likesCount: plain.likesCount || plain.likes_count || 0,
    viewsCount: plain.viewsCount || plain.views_count || 0,
    metadata: plain.metadata || {},
    createdAt: plain.createdAt || plain.created_at,
    updatedAt: plain.updatedAt || plain.updated_at,
    hasLiked: likedDrawingIds.has(plain.id),
    author: formatAuthor(plain.author),
  };
}

/**
 * Get gallery artworks with pagination & filters.
 */
async function getGallery({
  page = 1,
  limit = 20,
  currentUserId = null,
  currentUserTeamId = null,
  isAdmin = false,
  visibility = 'PUBLIC',
  filter = 'latest',
} = {}) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClause = {
    status: 'ACTIVE',
  };

  if (visibility && visibility !== 'ALL') {
    whereClause.visibility = visibility;
  }

  if (visibility === 'PRIVATE') {
    if (!currentUserId) return { drawings: [], settings: await getSettings(), pagination: { page: safePage, limit: safeLimit, total: 0, totalPages: 0 } };
    whereClause.userId = currentUserId;
  } else if (visibility === 'ALL' || visibility === 'TEAM') {
    const allowedVisibility = [{ visibility: 'PUBLIC' }];
    if (isAdmin) {
      allowedVisibility.push({ visibility: 'PRIVATE' }, { visibility: 'TEAM' });
    } else {
      if (currentUserId) allowedVisibility.push({ visibility: 'PRIVATE', userId: currentUserId });
      if (currentUserTeamId) allowedVisibility.push({ visibility: 'TEAM', '$author.team_id$': currentUserTeamId });
    }
    whereClause[Op.or] = allowedVisibility;
    delete whereClause.visibility;
  }

  let order = [['created_at', 'DESC']];
  if (filter === 'top' || filter === 'popular') {
    order = [['likes_count', 'DESC'], ['created_at', 'DESC']];
  }

  const { rows, count } = await Drawing.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
        include: [
          {
            model: Team,
            attributes: ['id', 'name'],
            required: false,
          },
          {
            model: UserProfilePreference,
            attributes: ['avatarData'],
            required: false,
          },
        ],
      },
    ],
    order,
    limit: safeLimit,
    offset,
    distinct: true,
  });

  // Check which drawings current user has liked
  const likedSet = new Set();
  if (currentUserId && rows.length > 0) {
    const drawingIds = rows.map((r) => r.id);
    const userLikes = await DrawingLike.findAll({
      where: {
        userId: currentUserId,
        drawingId: { [Op.in]: drawingIds },
      },
      attributes: ['drawingId'],
    });
    userLikes.forEach((l) => likedSet.add(l.drawingId));
  }

  const items = rows.map((r) => formatDrawing(r, likedSet));
  const settings = await getSettings();

  return {
    drawings: items,
    settings,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
}

/**
 * Get single artwork detail by ID.
 */
async function getById(drawingId, { userId = null, teamId = null, isAdmin = false } = {}) {
  const drawing = await Drawing.findOne({
    where: {
      id: drawingId,
      status: 'ACTIVE',
    },
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
        include: [
          {
            model: Team,
            attributes: ['id', 'name'],
            required: false,
          },
          {
            model: UserProfilePreference,
            attributes: ['avatarData'],
            required: false,
          },
        ],
      },
    ],
  });

  if (!drawing) {
    throw new NotFoundError('Tác phẩm không tồn tại hoặc đã bị gỡ bỏ.');
  }
  if (!canViewDrawing(drawing, { userId, teamId, isAdmin })) {
    throw new ForbiddenError('Bạn không có quyền xem tác phẩm này.');
  }

  // Increment views count asynchronously
  drawing.increment('viewsCount').catch(() => {});

  let hasLiked = false;
  if (userId) {
    const like = await DrawingLike.findOne({
      where: {
        drawingId: drawing.id,
        userId,
      },
    });
    hasLiked = Boolean(like);
  }

  const likedSet = new Set(hasLiked ? [drawing.id] : []);
  return formatDrawing(drawing, likedSet);
}

/**
 * Create a new drawing artwork.
 *
 * Server determines imageUrl/storageKey; a HIDDEN upload intent owns the key
 * before upload, and is activated only after storage succeeds.
 */
async function createDrawing({ userId, teamId = null, title, imageUrl, storageKey, storageProvider, mimeType, sizeBytes, width = 1200, height = 700, visibility = 'PUBLIC', metadata = {}, publicationId, checksum, buffer, storage }) {
  if (!userId || !imageUrl || !storageKey || !publicationId) throw new ValidationError('Thiếu thông tin xuất bản tác phẩm.');
  const row = await transaction(async (t) => {
    await User.findByPk(userId, { transaction: t, lock: t.LOCK.UPDATE });
    const existing = await Drawing.findOne({ where: { userId, 'metadata.publicationId': publicationId }, transaction: t, lock: t.LOCK.UPDATE });
    if (existing) {
      if (existing.metadata?.checksum !== checksum) throw new ValidationError('Bản nháp đã đổi. Hãy mở lại bản xem trước để đăng.');
      if (existing.status === 'DELETED' || existing.metadata?.deletionPending) throw new ValidationError('Tác phẩm này đã được yêu cầu xóa.');
      return existing;
    }
    // Persist an upload intent BEFORE talking to object storage. Interrupted
    // uploads/DB activation retain an owned row and stable key for safe retry.
    return Drawing.create({ userId, title: String(title || '').trim().slice(0,120) || 'Tác phẩm không tên', imageUrl, storageKey, storageProvider, mimeType, sizeBytes,
      width, height, visibility: ['PUBLIC','TEAM','PRIVATE'].includes(visibility) ? visibility : 'PUBLIC', status: 'HIDDEN',
      metadata: { ...metadata, publicationId, checksum, uploadState: 'PENDING' } }, { transaction: t });
  });
  if (row.status !== 'ACTIVE') {
    try { await storage.upload({ key: row.storageKey, buffer, contentType: mimeType }); }
    catch (err) { throw new StorageError('Không thể tải ảnh lên kho lưu trữ. Bản nháp vẫn còn; bạn có thể thử lại.', { status: 502, code: 'STORAGE_UPLOAD_FAILED' }); }
    await transaction(async (t) => {
      const saved = await Drawing.findByPk(row.id, { transaction: t, lock: t.LOCK.UPDATE });
      saved.status = 'ACTIVE';
      saved.metadata = { ...saved.metadata, uploadState: 'CONFIRMED', validatedAt: new Date().toISOString() };
      await saved.save({ transaction: t });
    });
  }
  // A read-back failure must never delete an already committed object's bytes.
  return getById(row.id, { userId, teamId });
}

/**
 * Toggle like on a drawing artwork.
 */
async function toggleLike({ drawingId, userId, teamId = null, isAdmin = false }) {
  const drawing = await Drawing.findOne({
    where: { id: drawingId, status: 'ACTIVE' },
    include: [{ model: User, as: 'author', attributes: ['id', 'teamId'] }],
  });

  if (!drawing) {
    throw new NotFoundError('Tác phẩm không tồn tại.');
  }
  if (!canViewDrawing(drawing, { userId, teamId, isAdmin })) {
    throw new ForbiddenError('Bạn không có quyền thích tác phẩm này.');
  }

  const existingLike = await DrawingLike.findOne({
    where: { drawingId, userId },
  });

  let hasLiked = false;
  if (existingLike) {
    await existingLike.destroy();
    hasLiked = false;
  } else {
    try {
      await DrawingLike.create({ drawingId, userId });
      hasLiked = true;
    } catch (err) {
      if (err.name === 'SequelizeUniqueConstraintError') {
        hasLiked = true;
      } else {
        throw err;
      }
    }
  }

  const exactCount = await DrawingLike.count({ where: { drawingId } });
  await drawing.update({ likesCount: exactCount });

  return {
    drawingId,
    hasLiked,
    likesCount: exactCount,
  };
}

/**
 * Delete a drawing artwork (by author or admin).
 *
 * Persist HIDDEN + deletionPending before deleting bytes. Storage failures leave
 * a durable retry intent; startup/background reconciliation completes deletion.
 */
async function deleteDrawing({ drawingId, userId, isAdmin = false }) {
  const drawing = await transaction(async (t) => {
    const row = await Drawing.findByPk(drawingId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!row) throw new NotFoundError('Tác phẩm không tồn tại.');
    if (Number(row.userId) !== Number(userId) && !isAdmin) throw new ForbiddenError('Bạn không có quyền xóa tác phẩm này.');
    if (row.status === 'DELETED') return row;
    if (row.metadata?.uploadState === 'PENDING') throw new ValidationError('Tác phẩm đang được lưu; hãy thử xóa lại sau khi lưu xong.');
    row.status = 'HIDDEN';
    row.metadata = { ...row.metadata, deletionPending: true };
    await row.save({ transaction: t });
    return row;
  });
  if (drawing.status === 'DELETED') return { success: true, drawingId: drawing.id, alreadyDeleted: true };
  const config = resolveStorageConfig();
  const key = drawing.storageKey || parseStorageKey(drawing.imageUrl, { publicBaseUrl: config.s3.publicBaseUrl });
  if (key && drawing.storageProvider !== 'external' && !String(drawing.imageUrl || '').startsWith('data:')) {
    try {
      const localRecord = drawing.storageProvider === 'local' || String(drawing.imageUrl || '').startsWith('/uploads/');
      const storage = localRecord ? require('./storage/localDrawingStorage.adapter').createLocalDrawingStorageAdapter(config.local) : getDrawingStorage();
      if (!localRecord && storage.provider !== 's3') throw new Error('Kho ảnh gốc chưa được cấu hình.');
      await storage.delete({ key });
    } catch (err) { throw new StorageError('Tác phẩm đã ẩn; chưa xóa được ảnh trong kho gốc. Hệ thống sẽ thử lại.', { status: 502, code: 'STORAGE_DELETE_FAILED' }); }
  }
  await transaction(async (t) => {
    const row = await Drawing.findByPk(drawing.id, { transaction: t, lock: t.LOCK.UPDATE });
    row.status = 'DELETED'; row.metadata = { ...row.metadata, deletionPending: false };
    await row.save({ transaction: t });
  });
  return { success: true, drawingId: drawing.id, alreadyDeleted: false };
}

async function retryPendingDeletes() {
  const rows = await Drawing.findAll({ where: { status: 'HIDDEN', 'metadata.deletionPending': true }, limit: 20 });
  const completed = [];
  for (const row of rows) {
    try { await deleteDrawing({ drawingId: row.id, userId: row.userId }); completed.push(row.id); }
    catch { /* Durable intent stays in DB; storage may still be unavailable. */ }
  }
  return completed;
}

/**
 * Get drawings by a specific user.
 */
async function getUserDrawings({ userId, currentUserId = null, currentUserTeamId = null, isAdmin = false, page = 1, limit = 20 }) {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const whereClause = {
    userId,
    status: 'ACTIVE',
  };

  if (!isAdmin && String(currentUserId) !== String(userId)) {
    whereClause.visibility = 'PUBLIC';
    if (currentUserTeamId) {
      const author = await User.findByPk(userId, { attributes: ['teamId'] });
      if (author?.teamId != null && String(author.teamId) === String(currentUserTeamId)) {
        whereClause.visibility = { [Op.in]: ['PUBLIC','TEAM'] };
      }
    }
  }

  const { rows, count } = await Drawing.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'name', 'jobTitle', 'department', 'teamId', 'isVerified'],
        include: [
          {
            model: Team,
            attributes: ['id', 'name'],
            required: false,
          },
          {
            model: UserProfilePreference,
            attributes: ['avatarData'],
            required: false,
          },
        ],
      },
    ],
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset,
  });

  const likedSet = new Set();
  if (currentUserId && rows.length > 0) {
    const drawingIds = rows.map((r) => r.id);
    const userLikes = await DrawingLike.findAll({
      where: {
        userId: currentUserId,
        drawingId: { [Op.in]: drawingIds },
      },
      attributes: ['drawingId'],
    });
    userLikes.forEach((l) => likedSet.add(l.drawingId));
  }

  const items = rows.map((r) => formatDrawing(r, likedSet));

  return {
    drawings: items,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total: count,
      totalPages: Math.ceil(count / safeLimit),
    },
  };
}

module.exports = {
  getSettings,
  updateSettings,
  getGallery,
  getById,
  createDrawing,
  toggleLike,
  deleteDrawing,
  retryPendingDeletes,
  getUserDrawings,
};
