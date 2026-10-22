'use strict';

/**
 * Migration ảnh Drawing cũ sang persistent object storage.
 *
 *   node scripts/migrate-drawing-images.js [--dry-run] [--report <path>]
 *
 * Đặc điểm:
 * - Idempotent: bản ghi đã có `storage_key` bị bỏ qua; key legacy được sinh TẤT ĐỊNH
 *   theo (drawingId + checksum nội dung) nên chạy lại không tạo object trùng.
 * - File local còn tồn tại  → upload lên storage, cập nhật image_url + storage_key.
 * - File local đã mất       → KHÔNG fake ảnh, KHÔNG xóa record; đánh dấu
 *   `metadata.imageMissing = true` và ghi vào report để admin xử lý.
 * - Ảnh `data:` URI (PNG/JPEG/WebP) → upload; SVG inline được giữ nguyên (không đưa
 *   SVG lên bucket public vì rủi ro XSS) và ghi chú trong report.
 * - URL ngoài (https://…) không thuộc storage của mình → đánh dấu provider "external".
 *
 * Không log secret, không log base64.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Drawing } = require('../src/models');
const { sequelize } = require('../src/models');
const { resolveStorageConfig } = require('../src/config/storage');
const {
  getDrawingStorage,
  buildLegacyDrawingStorageKey,
  parseStorageKey,
} = require('../src/services/storage/drawingStorage.service');

const DEFAULT_REPORT_PATH = path.resolve(
  __dirname,
  '../../docs/audit/2026-10-21/legacy-image-migration-report.json'
);

const MIME_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function parseArgs(argv) {
  const args = { dryRun: false, reportPath: DEFAULT_REPORT_PATH, legacyBaseUrl: '' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--dry-run') args.dryRun = true;
    if (argv[i] === '--report' && argv[i + 1]) {
      args.reportPath = path.resolve(argv[i + 1]);
      i += 1;
    }
    if (argv[i] === '--legacy-base-url' && argv[i + 1]) {
      args.legacyBaseUrl = argv[i + 1].replace(/\/+$/, '');
      i += 1;
    }
  }
  return args;
}

/**
 * Tải lại file legacy qua HTTP khi bản deploy mới không còn file trên disk
 * (Render ephemeral). Chỉ dùng GET công khai, không gửi credential.
 */
async function fetchLegacyFile(baseUrl, imageUrl) {
  if (!baseUrl) return null;
  const target = `${baseUrl}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(target, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timer);
    if (!res.ok) return null;
    const contentType = String(res.headers.get('content-type') || '').split(';')[0].trim();
    if (!MIME_EXT[contentType]) return null;
    const arrayBuffer = await res.arrayBuffer();
    return { buffer: Buffer.from(arrayBuffer), mime: contentType };
  } catch (err) {
    console.warn('[migrate-drawings] Fetch legacy thất bại:', target, '-', err.message);
    return null;
  }
}

function checksum(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 12);
}

function decodeDataUri(uri) {
  const match = String(uri).match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1].toLowerCase(), buffer: Buffer.from(match[2], 'base64') };
}

async function migrateDrawing(row, { storage, storageConfig, dryRun, legacyBaseUrl = '' }) {
  const imageUrl = String(row.imageUrl || '');

  if (row.storageKey) {
    return { status: 'skipped-has-key', key: row.storageKey };
  }

  // 1. Ảnh inline data URI
  if (imageUrl.startsWith('data:')) {
    if (imageUrl.startsWith('data:image/svg')) {
      return {
        status: 'skipped-inline-svg',
        note: 'SVG inline giữ nguyên trong DB (không upload SVG lên bucket public).',
      };
    }
    const decoded = decodeDataUri(imageUrl);
    if (!decoded || !MIME_EXT[decoded.mime]) {
      return { status: 'failed', reason: `data URI không hỗ trợ: ${decoded?.mime || 'unknown'}` };
    }
    const key = buildLegacyDrawingStorageKey({
      userId: row.userId,
      drawingId: row.id,
      ext: MIME_EXT[decoded.mime],
      checksum: checksum(decoded.buffer),
      prefix: storageConfig.s3.keyPrefix,
    });
    if (dryRun) return { status: 'would-upload', key, source: 'data-uri' };

    const alreadyExists = await storage.exists({ key }).catch(() => false);
    const uploaded = alreadyExists
      ? { key, url: storage.getPublicUrl(key), provider: storage.provider }
      : await storage.upload({ key, buffer: decoded.buffer, contentType: decoded.mime });

    await row.update({
      imageUrl: uploaded.url,
      storageKey: key,
      storageProvider: uploaded.provider,
      mimeType: decoded.mime,
      sizeBytes: decoded.buffer.length,
    });
    return { status: alreadyExists ? 'linked-existing' : 'migrated', key, source: 'data-uri' };
  }

  // 2. File local /uploads/drawings/*
  if (imageUrl.startsWith('/uploads/')) {
    const fileName = path.basename(imageUrl);
    const localPath = path.resolve(storageConfig.local.rootDir, 'drawings', fileName);

    let buffer = null;
    let source = 'local-file';
    let ext = path.extname(fileName).replace('.', '').toLowerCase() || 'png';
    let contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;

    if (fs.existsSync(localPath)) {
      buffer = fs.readFileSync(localPath);
    } else {
      // Deploy mới không còn file trên disk → lấy lại từ instance cũ qua HTTP
      const fetched = await fetchLegacyFile(legacyBaseUrl, imageUrl);
      if (fetched) {
        buffer = fetched.buffer;
        contentType = fetched.mime;
        ext = MIME_EXT[fetched.mime];
        source = 'legacy-http';
      }
    }

    if (!buffer) {
      if (!dryRun) {
        await row.update({
          metadata: {
            ...(row.metadata || {}),
            imageMissing: true,
            imageMissingSince: new Date().toISOString(),
          },
        });
      }
      return { status: 'missing-local-file', path: localPath, note: 'Không tìm thấy file trên disk và không fetch được qua HTTP.' };
    }

    const key = buildLegacyDrawingStorageKey({
      userId: row.userId,
      drawingId: row.id,
      ext,
      checksum: checksum(buffer),
      prefix: storageConfig.s3.keyPrefix,
    });

    if (dryRun) return { status: 'would-upload', key, source };

    const alreadyExists = await storage.exists({ key }).catch(() => false);
    const uploaded = alreadyExists
      ? { key, url: storage.getPublicUrl(key), provider: storage.provider }
      : await storage.upload({ key, buffer, contentType });

    await row.update({
      imageUrl: uploaded.url,
      storageKey: key,
      storageProvider: uploaded.provider,
      mimeType: contentType,
      sizeBytes: buffer.length,
      metadata: { ...(row.metadata || {}), imageMissing: false },
    });
    return { status: alreadyExists ? 'linked-existing' : 'migrated', key, source };
  }

  // 3. URL ngoài (CDN khác) — không di chuyển, chỉ đánh dấu
  if (/^https?:\/\//i.test(imageUrl)) {
    const ownKey = parseStorageKey(imageUrl, { publicBaseUrl: storageConfig.s3.publicBaseUrl });
    if (ownKey) {
      if (!dryRun) {
        await row.update({ storageKey: ownKey, storageProvider: storage.provider });
      }
      return { status: 'adopted-key', key: ownKey };
    }
    if (!dryRun) {
      await row.update({ storageProvider: 'external' });
    }
    return { status: 'external-url', note: 'URL ngoài storage nội bộ, giữ nguyên.' };
  }

  return { status: 'failed', reason: 'Không nhận dạng được nguồn ảnh.' };
}

async function main() {
  const { dryRun, reportPath, legacyBaseUrl } = parseArgs(process.argv.slice(2));
  const storageConfig = resolveStorageConfig();

  console.log('[migrate-drawings] provider =', storageConfig.provider, '| dryRun =', dryRun);
  if (legacyBaseUrl) console.log('[migrate-drawings] legacy base url =', legacyBaseUrl);
  if (!storageConfig.ok) {
    console.error('[migrate-drawings] Cấu hình storage không hợp lệ. Thiếu:', storageConfig.missingEnv.join(', '));
    process.exitCode = 1;
    return;
  }

  const storage = getDrawingStorage();
  const rows = await Drawing.findAll({ order: [['id', 'ASC']] });

  const report = {
    startedAt: new Date().toISOString(),
    finishedAt: null,
    dryRun,
    provider: storage.provider,
    totals: { scanned: rows.length, migrated: 0, linkedExisting: 0, skipped: 0, missing: 0, failed: 0 },
    items: [],
  };

  for (const row of rows) {
    try {
      const result = await migrateDrawing(row, { storage, storageConfig, dryRun, legacyBaseUrl });
      const entry = { drawingId: row.id, userId: Number(row.userId), title: row.title, ...result };
      report.items.push(entry);

      if (result.status === 'migrated') report.totals.migrated += 1;
      else if (result.status === 'linked-existing') report.totals.linkedExisting += 1;
      else if (result.status === 'missing-local-file') report.totals.missing += 1;
      else if (result.status === 'failed') report.totals.failed += 1;
      else report.totals.skipped += 1;

      console.log(`[migrate-drawings] #${row.id} → ${result.status}${result.key ? ` (${result.key})` : ''}`);
    } catch (err) {
      report.totals.failed += 1;
      report.items.push({ drawingId: row.id, status: 'failed', reason: err.message });
      console.error(`[migrate-drawings] #${row.id} LỖI:`, err.message);
    }
  }

  report.finishedAt = new Date().toISOString();

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('[migrate-drawings] Tổng kết:', JSON.stringify(report.totals));
  console.log('[migrate-drawings] Report:', reportPath);

  if (report.totals.failed > 0) process.exitCode = 1;
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('[migrate-drawings] Thất bại:', err.message);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close().catch(() => {}));
}

module.exports = { migrateDrawing, parseArgs };
