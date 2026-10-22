'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Adapter lưu ảnh trên filesystem cục bộ — CHỈ dùng cho development/test.
 * Production không được phép chọn adapter này (xem config/storage.js).
 */

function resolveInsideRoot(rootDir, key) {
  const safeKey = String(key || '').replace(/^\/+/, '');
  const absolute = path.resolve(rootDir, safeKey);
  const relative = path.relative(rootDir, absolute);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    const err = new Error('Storage key không hợp lệ (path traversal bị chặn).');
    err.code = 'INVALID_STORAGE_KEY';
    throw err;
  }
  return absolute;
}

function encodeKeyPath(key) {
  return String(key)
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

function createLocalDrawingStorageAdapter({ rootDir, publicPrefix = '/uploads' }) {
  if (!rootDir) throw new Error('Local storage adapter yêu cầu rootDir.');

  return {
    provider: 'local',
    persistent: false,

    getPublicUrl(key) {
      return `${publicPrefix}/${encodeKeyPath(key)}`;
    },

    async upload({ key, buffer, contentType }) {
      if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        const err = new Error('Buffer ảnh rỗng, không thể lưu.');
        err.code = 'EMPTY_UPLOAD';
        throw err;
      }
      const absolute = resolveInsideRoot(rootDir, key);
      await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
      await fs.promises.writeFile(absolute, buffer);
      return {
        key,
        url: this.getPublicUrl(key),
        provider: this.provider,
        contentType: contentType || 'application/octet-stream',
        sizeBytes: buffer.length,
      };
    },

    async delete({ key }) {
      const absolute = resolveInsideRoot(rootDir, key);
      try {
        await fs.promises.unlink(absolute);
        return { key, deleted: true, alreadyMissing: false };
      } catch (err) {
        if (err.code === 'ENOENT') {
          return { key, deleted: false, alreadyMissing: true };
        }
        throw err;
      }
    },

    async exists({ key }) {
      try {
        const absolute = resolveInsideRoot(rootDir, key);
        await fs.promises.access(absolute, fs.constants.R_OK);
        return true;
      } catch (_) {
        return false;
      }
    },
  };
}

module.exports = { createLocalDrawingStorageAdapter, resolveInsideRoot };
