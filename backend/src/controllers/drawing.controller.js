'use strict';

const multer = require('multer');
const crypto = require('node:crypto');
const drawingService = require('../services/drawing.service');
const { ValidationError, StorageError } = require('../utils/errors');
const { resolveStorageConfig } = require('../config/storage');
const {
  buildDrawingStorageKey,
  getDrawingStorage,
  getStorageStatus,
} = require('../services/storage/drawingStorage.service');
const {
  MAX_UPLOAD_BYTES,
  ALLOWED_MIME_LIST,
  inspectImageBuffer,
} = require('../utils/imageValidation');

/**
 * Upload đi qua memoryStorage: file chỉ được ghi vào object storage sau khi
 * đã xác thực chữ ký ảnh, và không bao giờ chạm filesystem production.
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
    fields: 12,
  },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_LIST.includes(String(file.mimetype || '').toLowerCase())) {
      cb(null, true);
    } else {
      cb(new ValidationError('Chỉ chấp nhận các định dạng ảnh hợp lệ: PNG, JPG, WEBP'), false);
    }
  },
});

function decodeBase64Image(imageBase64) {
  if (typeof imageBase64 !== 'string') return null;
  const match = imageBase64.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return Buffer.from(match[2], 'base64');
}


const drawingController = {
  uploadMiddleware: upload.single('image'),

  /**
   * GET /api/drawings/settings
   */
  async getSettings(req, res) {
    const settings = await drawingService.getSettings();
    res.json({
      success: true,
      settings,
      publishing: { available: resolveStorageConfig().ok && resolveStorageConfig().provider === 's3', persistent: resolveStorageConfig().provider === 's3' },
    });
  },

  /**
   * GET /api/drawings/storage/status (Admin Only)
   * Trả tên biến env còn thiếu — KHÔNG trả giá trị secret.
   */
  async getStorageStatus(req, res) {
    const status = getStorageStatus();
    res.json({
      success: true,
      storage: {
        provider: status.provider,
        nodeEnv: status.nodeEnv,
        ready: status.ok,
        missingEnv: status.missingEnv,
      },
    });
  },

  /**
   * PATCH /api/drawings/settings (Admin Only)
   */
  async updateSettings(req, res) {
    const { homeVisible, gameEnabled } = req.body;
    const settings = await drawingService.updateSettings({
      homeVisible,
      gameEnabled,
    });

    // Realtime broadcast settings update
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('drawing:settings_updated', settings);
      }
    } catch (e) {
      console.warn('[DrawingController] Realtime broadcast error:', e.message);
    }

    res.json({
      success: true,
      settings,
    });
  },

  /**
   * GET /api/drawings
   */
  async getGallery(req, res) {
    const currentUserId = req.user?.id || null;
    const currentUserTeamId = req.user?.teamId || null;
    const isAdmin = req.user?.role === 'admin';
    const { page, limit, visibility, filter } = req.query;
    const result = await drawingService.getGallery({
      page,
      limit,
      currentUserId,
      currentUserTeamId,
      isAdmin,
      visibility,
      filter,
    });

    res.json({
      success: true,
      ...result,
    });
  },

  /**
   * GET /api/drawings/:id
   */
  async getById(req, res) {
    const userId = req.user?.id || null;
    const teamId = req.user?.teamId || null;
    const isAdmin = req.user?.role === 'admin';
    const { id } = req.params;

    const drawing = await drawingService.getById(id, { userId, teamId, isAdmin });
    res.json({
      success: true,
      drawing,
    });
  },

  /**
   * POST /api/drawings
   *
   * Server authority: quyết định định dạng, kích thước, storage key và quyền sở hữu.
   * Client không thể gửi `imageUrl`/`storageKey` tuỳ ý.
   */
  async create(req, res) {
    const userId = req.user.id;
    const { title, visibility, metadata, imageBase64 } = req.body;

    let buffer = null;
    let declaredMime = null;

    if (req.file && Buffer.isBuffer(req.file.buffer)) {
      buffer = req.file.buffer;
      declaredMime = req.file.mimetype;
    } else if (imageBase64) {
      buffer = decodeBase64Image(imageBase64);
      if (!buffer) {
        throw new ValidationError('Dữ liệu ảnh base64 không hợp lệ.');
      }
    }

    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Vui lòng gửi file ảnh tác phẩm hợp lệ.');
    }

    const inspected = inspectImageBuffer(buffer, { declaredMime });

    // Cấu hình storage sai → fail rõ ràng, tuyệt đối không ghi local để "chạy được"
    const storageConfig = resolveStorageConfig();
    if (!storageConfig.ok || (storageConfig.provider !== 's3' && storageConfig.nodeEnv !== 'test')) {
      throw new StorageError('Chưa có kho ảnh bền vững. Tác phẩm chưa được đăng; bản nháp của bạn vẫn còn.', {
        status: 503,
        code: 'STORAGE_UNAVAILABLE',
        details: storageConfig.missingEnv,
      });
    }

    const storage = getDrawingStorage();
    const publicationId = req.body.publicationId || crypto.randomUUID();
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(publicationId)) throw new ValidationError('Mã xuất bản không hợp lệ.');
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');
    const key = buildDrawingStorageKey({ userId, ext: inspected.ext, prefix: storageConfig.s3.keyPrefix, uniqueToken: `${publicationId}-${checksum.slice(0,12)}` });
    let parsedMeta = {};
    if (metadata) { try { parsedMeta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata; } catch { /* Optional metadata. */ } }
    const created = await drawingService.createDrawing({ userId, teamId: req.user.teamId || null, title, visibility, metadata: parsedMeta,
      imageUrl: storage.getPublicUrl(key), storageKey: key, storageProvider: storage.provider,
      mimeType: inspected.mime, sizeBytes: inspected.sizeBytes, width: inspected.width, height: inspected.height,
      publicationId, checksum, buffer, storage });

    // Realtime broadcast to all connected clients
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('drawing:created', created);
      }
    } catch (e) {
      console.warn('[DrawingController] Realtime broadcast error:', e.message);
    }

    res.status(201).json({
      success: true,
      drawing: created,
    });
  },

  /**
   * POST /api/drawings/:id/like
   */
  async toggleLike(req, res) {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await drawingService.toggleLike({
      drawingId: parseInt(id, 10),
      userId,
      teamId: req.user.teamId || null,
      isAdmin: req.user.role === 'admin',
    });

    // Realtime broadcast like update
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('drawing:liked', {
          drawingId: result.drawingId,
          likesCount: result.likesCount,
        });
      }
    } catch (e) {
      console.warn('[DrawingController] Realtime broadcast error:', e.message);
    }

    res.json({
      success: true,
      ...result,
    });
  },

  /**
   * DELETE /api/drawings/:id
   */
  async remove(req, res) {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';
    const { id } = req.params;

    const result = await drawingService.deleteDrawing({
      drawingId: parseInt(id, 10),
      userId,
      isAdmin,
    });

    // Realtime broadcast deletion
    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('drawing:deleted', { drawingId: parseInt(id, 10) });
      }
    } catch (e) {
      console.warn('[DrawingController] Realtime broadcast error:', e.message);
    }

    res.json({
      success: true,
      ...result,
    });
  },

  /**
   * GET /api/drawings/user/:userId
   */
  async getUserDrawings(req, res) {
    const currentUserId = req.user?.id || null;
    const currentUserTeamId = req.user?.teamId || null;
    const isAdmin = req.user?.role === 'admin';
    const { userId } = req.params;
    const { page, limit } = req.query;

    const result = await drawingService.getUserDrawings({
      userId: parseInt(userId, 10),
      currentUserId,
      currentUserTeamId,
      isAdmin,
      page,
      limit,
    });

    res.json({
      success: true,
      ...result,
    });
  },
};

module.exports = drawingController;
