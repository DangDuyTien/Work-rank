function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const message = statusCode === 500 ? 'Internal server error' : error.message;
  if (statusCode === 500) console.error(error);
  res.status(statusCode).json({ message, errors: error.errors || undefined });
}

module.exports = { notFound, errorHandler };
