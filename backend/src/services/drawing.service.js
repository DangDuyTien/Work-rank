'use strict';

const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Drawing, DrawingLike, User, Team, UserProfilePreference, SystemSetting } = require('../models');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

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
  return {
    id: plain.id,
    title: plain.title || 'Tác phẩm không tên',
    imageUrl: plain.imageUrl || plain.image_url,
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
 */
async function createDrawing({
  userId,
  teamId = null,
  title,
  imageUrl,
  width = 1200,
  height = 700,
  visibility = 'PUBLIC',
  metadata = {},
}) {
  if (!userId) {
    throw new ValidationError('Thiếu thông tin người dùng.');
  }
  if (!imageUrl) {
    throw new ValidationError('Thiếu đường dẫn hình ảnh tác phẩm.');
  }

  let cleanTitle = String(title || '').trim();
  if (!cleanTitle) {
    cleanTitle = 'Tác phẩm không tên';
  }
  if (cleanTitle.length > 120) {
    cleanTitle = cleanTitle.substring(0, 120);
  }

  const drawing = await Drawing.create({
    userId,
    title: cleanTitle,
    imageUrl,
    width: parseInt(width, 10) || 1200,
    height: parseInt(height, 10) || 700,
    visibility: ['PUBLIC', 'TEAM', 'PRIVATE'].includes(visibility) ? visibility : 'PUBLIC',
    status: 'ACTIVE',
    likesCount: 0,
    viewsCount: 0,
    metadata: metadata || {},
  });

  const created = await getById(drawing.id, { userId, teamId });
  return created;
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
 */
async function deleteDrawing({ drawingId, userId, isAdmin = false }) {
  const drawing = await Drawing.findByPk(drawingId);

  if (!drawing) {
    throw new NotFoundError('Tác phẩm không tồn tại.');
  }

  if (drawing.userId !== userId && !isAdmin) {
    throw new ForbiddenError('Bạn không có quyền xóa tác phẩm này.');
  }

  // Soft delete status or destroy
  await drawing.update({ status: 'DELETED' });

  // Optionally remove physical image file
  if (drawing.imageUrl && drawing.imageUrl.startsWith('/uploads/drawings/')) {
    const filename = path.basename(drawing.imageUrl);
    const filePath = path.resolve(__dirname, '../../uploads/drawings', filename);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, () => {});
    }
  }

  return { success: true, drawingId };
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

  if (currentUserId !== userId && !isAdmin && currentUserTeamId) {
    const author = await User.findByPk(userId, { attributes: ['teamId'] });
    if (author?.teamId === currentUserTeamId) {
      delete whereClause.visibility;
      whereClause[Op.or] = [{ visibility: 'PUBLIC' }, { visibility: 'TEAM' }];
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
  getUserDrawings,
};
