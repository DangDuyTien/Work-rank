'use strict';

const { ValidationError } = require('./errors');

/**
 * Kiểm tra ảnh tải lên ở tầng server (server authority):
 * - giới hạn dung lượng
 * - xác thực magic bytes (không tin Content-Type / tên file client khai)
 * - đọc kích thước thật từ header
 * - chặn ảnh quá lớn gây memory spike
 *
 * Hỗ trợ PNG / JPEG / WebP — đúng bộ định dạng canvas của Drawing Game xuất ra.
 */

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_DIMENSION = 4096;
const MIN_DIMENSION = 1;

const ALLOWED_MIME = Object.freeze({
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
});

const ALLOWED_MIME_LIST = Object.freeze(['image/png', 'image/jpeg', 'image/webp']);

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function detectPng(buffer) {
  if (buffer.length < 24) return null;
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return {
    mime: 'image/png',
    ext: 'png',
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function detectJpeg(buffer) {
  if (buffer.length < 4) return null;
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer[2] !== 0xff) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    // marker không có length field
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (segmentLength < 2) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame) {
      return {
        mime: 'image/jpeg',
        ext: 'jpg',
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

function detectWebp(buffer) {
  if (buffer.length < 30) return null;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return null;
  if (buffer.toString('ascii', 8, 12) !== 'WEBP') return null;

  const chunk = buffer.toString('ascii', 12, 16);

  if (chunk === 'VP8 ') {
    return {
      mime: 'image/webp',
      ext: 'webp',
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunk === 'VP8L') {
    const b0 = buffer[21];
    const b1 = buffer[22];
    const b2 = buffer[23];
    const b3 = buffer[24];
    return {
      mime: 'image/webp',
      ext: 'webp',
      width: 1 + (((b1 & 0x3f) << 8) | b0),
      height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
    };
  }

  if (chunk === 'VP8X') {
    return {
      mime: 'image/webp',
      ext: 'webp',
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  return null;
}

function detectImageType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;
  return detectPng(buffer) || detectJpeg(buffer) || detectWebp(buffer);
}

function normalizeMime(mime) {
  const value = String(mime || '').trim().toLowerCase();
  return value === 'image/jpg' ? 'image/jpeg' : value;
}

/**
 * @param {Buffer} buffer
 * @param {{ declaredMime?: string }} [options]
 * @returns {{ mime: string, ext: string, width: number, height: number, sizeBytes: number }}
 * @throws {ValidationError}
 */
function inspectImageBuffer(buffer, { declaredMime } = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new ValidationError('Ảnh tác phẩm rỗng hoặc không đọc được.');
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Ảnh vượt quá giới hạn ${Math.round(MAX_UPLOAD_BYTES / (1024 * 1024))}MB.`
    );
  }

  const detected = detectImageType(buffer);
  if (!detected) {
    throw new ValidationError(
      'File không phải ảnh hợp lệ (chỉ chấp nhận PNG, JPEG, WebP).'
    );
  }

  const declared = normalizeMime(declaredMime);
  if (declared && ALLOWED_MIME[declared] && declared !== detected.mime) {
    throw new ValidationError(
      'Nội dung file không khớp với định dạng khai báo (chữ ký ảnh không hợp lệ).'
    );
  }

  const { width, height } = detected;
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < MIN_DIMENSION ||
    height < MIN_DIMENSION
  ) {
    throw new ValidationError('Kích thước ảnh không hợp lệ.');
  }
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new ValidationError(
      `Ảnh quá lớn: tối đa ${MAX_DIMENSION}×${MAX_DIMENSION}px (nhận được ${width}×${height}).`
    );
  }

  return {
    mime: detected.mime,
    ext: detected.ext,
    width,
    height,
    sizeBytes: buffer.length,
  };
}

module.exports = {
  MAX_UPLOAD_BYTES,
  MAX_DIMENSION,
  ALLOWED_MIME,
  ALLOWED_MIME_LIST,
  detectImageType,
  inspectImageBuffer,
  normalizeMime,
};
