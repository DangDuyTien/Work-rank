'use strict';

const crypto = require('crypto');
const { resolveStorageConfig, describeStorageConfig } = require('../../config/storage');
const { createLocalDrawingStorageAdapter } = require('./localDrawingStorage.adapter');
const { createS3DrawingStorageAdapter } = require('./s3DrawingStorage.adapter');

/**
 * Facade lưu trữ ảnh Drawing.
 *
 * Toàn bộ phần còn lại của backend chỉ nói chuyện với interface này:
 *   upload({ key, buffer, contentType }) -> { key, url, provider, sizeBytes }
 *   delete({ key })                     -> { key, deleted, alreadyMissing }
 *   getPublicUrl(key)                   -> string
 *   exists({ key })                     -> boolean
 *   parseStorageKey(urlOrKey)           -> key | null
 *
 * Frontend không biết provider nào đang dùng: nó chỉ nhận `imageUrl` tuyệt đối.
 */

const DRAWING_KEY_ROOT = 'drawings';
const ALLOWED_KEY_SEGMENT = /^[A-Za-z0-9._-]+$/;

let cachedStorage = null;
let cachedStatus = null;

function sanitizeSegment(value, fallback = 'unknown') {
  const raw = String(value ?? '').trim();
  if (!raw) return fallback;
  const cleaned = raw.replace(/[^A-Za-z0-9._-]/g, '-').replace(/^[.-]+/, '');
  return ALLOWED_KEY_SEGMENT.test(cleaned) && cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Sinh storage key ổn định, không collision, không phụ thuộc tên file client gửi lên.
 * Dạng: `drawings/{userId}/{timestamp}-{random}.{ext}` (kèm STORAGE_KEY_PREFIX nếu có).
 */
function buildDrawingStorageKey({ userId, ext = 'png', prefix = '', uniqueToken } = {}) {
  const safeUser = sanitizeSegment(userId, 'anonymous');
  const safeExt = sanitizeSegment(ext, 'png').toLowerCase();
  const token = sanitizeSegment(
    uniqueToken || `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`,
    'object'
  );
  const parts = [];
  if (prefix) parts.push(prefix.replace(/^\/+|\/+$/g, ''));
  parts.push(DRAWING_KEY_ROOT, safeUser, `${token}.${safeExt}`);
  return parts.filter(Boolean).join('/');
}

/**
 * Sinh key tất định cho ảnh legacy: cùng drawingId + cùng nội dung → cùng key,
 * nên chạy migration nhiều lần không tạo object trùng.
 */
function buildLegacyDrawingStorageKey({ userId, drawingId, ext = 'png', checksum = '', prefix = '' } = {}) {
  const safeUser = sanitizeSegment(userId, 'anonymous');
  const safeExt = sanitizeSegment(ext, 'png').toLowerCase();
  const shortHash = sanitizeSegment(String(checksum).slice(0, 12), 'legacy');
  const parts = [];
  if (prefix) parts.push(prefix.replace(/^\/+|\/+$/g, ''));
  parts.push(DRAWING_KEY_ROOT, 'legacy', safeUser, `${sanitizeSegment(drawingId, '0')}-${shortHash}.${safeExt}`);
  return parts.filter(Boolean).join('/');
}

function createDrawingStorage(config) {
  if (!config || !config.ok) {
    const err = new Error(
      `Cấu hình lưu trữ ảnh không hợp lệ: ${(config?.errors || ['unknown error']).join(' ')}`
    );
    err.code = 'STORAGE_CONFIG_INVALID';
    err.missingEnv = config?.missingEnv || [];
    throw err;
  }

  if (config.provider === 'local') {
    return createLocalDrawingStorageAdapter(config.local);
  }
  if (config.provider === 's3') {
    return createS3DrawingStorageAdapter(config.s3);
  }

  const err = new Error(`Provider lưu trữ "${config.provider}" chưa được hỗ trợ.`);
  err.code = 'STORAGE_CONFIG_INVALID';
  throw err;
}

/**
 * Trả về adapter đang hoạt động. Không bao giờ fallback im lặng:
 * cấu hình sai → throw STORAGE_CONFIG_INVALID để tầng upload trả lỗi rõ ràng.
 */
function getDrawingStorage() {
  if (cachedStorage) return cachedStorage;
  const config = resolveStorageConfig();
  cachedStatus = describeStorageConfig(config);
  cachedStorage = createDrawingStorage(config);
  return cachedStorage;
}

function getStorageStatus() {
  if (cachedStatus) return cachedStatus;
  const config = resolveStorageConfig();
  cachedStatus = describeStorageConfig(config);
  return cachedStatus;
}

function isDrawingStorageReady() {
  return resolveStorageConfig().ok;
}

function parseStorageKey(urlOrKey, { publicBaseUrl = '' } = {}) {
  const value = String(urlOrKey || '').trim();
  if (!value) return null;

  if (value.startsWith('/uploads/')) return value.slice('/uploads/'.length);
  if (value.startsWith('uploads/')) return value.slice('uploads/'.length);

  const base = String(publicBaseUrl || '').replace(/\/+$/, '');
  if (base && value.startsWith(`${base}/`)) {
    return decodeURIComponent(value.slice(base.length + 1));
  }

  if (/^https?:\/\//i.test(value)) return null;
  if (value.startsWith('data:') || value.startsWith('blob:')) return null;

  return value.replace(/^\/+/, '');
}

/** Chỉ dùng cho test: inject adapter giả và reset singleton. */
function setDrawingStorageForTests(adapter) {
  cachedStorage = adapter;
  cachedStatus = adapter
    ? { provider: adapter.provider, nodeEnv: process.env.NODE_ENV || 'test', ok: true, missingEnv: [] }
    : null;
}

function resetDrawingStorage() {
  cachedStorage = null;
  cachedStatus = null;
}

module.exports = {
  DRAWING_KEY_ROOT,
  buildDrawingStorageKey,
  buildLegacyDrawingStorageKey,
  createDrawingStorage,
  getDrawingStorage,
  getStorageStatus,
  isDrawingStorageReady,
  parseStorageKey,
  sanitizeSegment,
  setDrawingStorageForTests,
  resetDrawingStorage,
};
