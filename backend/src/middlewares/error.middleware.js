const crypto = require('crypto');
const { MAX_UPLOAD_BYTES } = require('../utils/imageValidation');

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

/**
 * Multer ném MulterError không có status → mặc định 500.
 * Map sang 413/400 để client hiển thị đúng nguyên nhân.
 */
function normalizeMulterError(error) {
  if (!error || error.name !== 'MulterError') return error;
  error.isOperational = true;
  if (error.code === 'LIMIT_FILE_SIZE') {
    error.status = 413;
    error.message = `Ảnh vượt quá giới hạn ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`;
  } else {
    error.status = 400;
    error.message = 'Tệp tải lên không hợp lệ.';
  }
  return error;
}

function errorHandler(error, req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  res.set('X-Correlation-ID', correlationId);

  normalizeMulterError(error);

  const statusCode = error.statusCode || error.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  // Chỉ che message của lỗi KHÔNG lường trước. Lỗi nghiệp vụ (isOperational) giữ
  // message an toàn để client hiển thị đúng nguyên nhân (vd: storage chưa cấu hình).
  const message =
    statusCode === 500 && isProduction && !error.isOperational
      ? 'Internal server error'
      : error.message;

  if (statusCode >= 500) {
    console.error(`[Server Error][${correlationId}] ${req.method} ${req.originalUrl}:`, error.stack || error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code: error.code || undefined,
    correlationId,
    errors: error.errors || error.validationErrors || undefined,
    details: error.details || undefined,
  });
}

module.exports = { notFound, errorHandler };
