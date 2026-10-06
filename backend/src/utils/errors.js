'use strict';

class AppError extends Error {
  constructor(message, status = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu không hợp lệ', code = 'VALIDATION_ERROR') {
    super(message, 400, code);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Bạn không có quyền thực hiện hành động này', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Tài nguyên không tồn tại', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu hoặc trạng thái không hợp lệ', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
};
