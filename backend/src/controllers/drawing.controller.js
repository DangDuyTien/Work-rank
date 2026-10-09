'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const drawingService = require('../services/drawing.service');
const { ValidationError } = require('../utils/errors');

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, '../../uploads/drawings');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const ALLOWED_MIMES = ['image/png', 'image/jpeg', 'image/webp'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const cleanExt = ALLOWED_MIMES.includes(file.mimetype) ? ext : '.png';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
    cb(null, `drawing-${uniqueSuffix}${cleanExt}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ValidationError('Chỉ chấp nhận các định dạng ảnh hợp lệ: PNG, JPG, WEBP'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
});

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
    const { page, limit, visibility, filter } = req.query;

    const result = await drawingService.getGallery({
      page,
      limit,
      currentUserId,
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
    const currentUserId = req.user?.id || null;
    const { id } = req.params;

    const drawing = await drawingService.getById(id, currentUserId);
    res.json({
      success: true,
      drawing,
    });
  },

  /**
   * POST /api/drawings
   */
  async create(req, res) {
    const userId = req.user.id;
    const { title, width, height, visibility, metadata, imageBase64 } = req.body;

    let imageUrl = '';

    if (req.file) {
      imageUrl = `/uploads/drawings/${req.file.filename}`;
    } else if (imageBase64 && typeof imageBase64 === 'string') {
      // Support direct base64 payload as fallback
      const match = imageBase64.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
      if (match) {
        const ext = `.${match[1].toLowerCase()}`;
        const data = Buffer.from(match[2], 'base64');
        const filename = `drawing-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
        const filePath = path.join(uploadDir, filename);
        fs.writeFileSync(filePath, data);
        imageUrl = `/uploads/drawings/${filename}`;
      }
    }

    if (!imageUrl) {
      throw new ValidationError('Vui lòng gửi file ảnh tác phẩm hợp lệ.');
    }

    let parsedMeta = {};
    if (metadata) {
      try {
        parsedMeta = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      } catch (_) {
        parsedMeta = {};
      }
    }

    const created = await drawingService.createDrawing({
      userId,
      title,
      imageUrl,
      width,
      height,
      visibility,
      metadata: parsedMeta,
    });

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
    const { userId } = req.params;
    const { page, limit } = req.query;

    const result = await drawingService.getUserDrawings({
      userId: parseInt(userId, 10),
      currentUserId,
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
