const crypto = require('crypto');

function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || crypto.randomUUID();
  res.set('X-Correlation-ID', correlationId);

  const statusCode = error.statusCode || error.status || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const message = statusCode === 500 && isProduction ? 'Internal server error' : error.message;

  if (statusCode >= 500) {
    console.error(`[Server Error][${correlationId}] ${req.method} ${req.originalUrl}:`, error.stack || error);
  }

  res.status(statusCode).json({
    success: false,
    message,
    code: error.code || undefined,
    correlationId,
    errors: error.errors || error.validationErrors || undefined,
  });
}

module.exports = { notFound, errorHandler };
