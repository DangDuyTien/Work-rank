'use strict';

const path = require('path');

/**
 * Cấu hình lưu trữ ảnh tác phẩm (Drawing / Góc Sáng Tạo).
 *
 * Nguyên tắc:
 * - Development/test: `STORAGE_PROVIDER=local` (mặc định) → ghi vào `backend/uploads`.
 * - Production: chỉ chấp nhận `s3` (S3-compatible: AWS S3, Cloudflare R2, MinIO,
 *   Supabase Storage S3, Backblaze B2…). KHÔNG bao giờ fallback im lặng về local disk.
 * - Thiếu cấu hình → trả về `ok: false` kèm danh sách biến còn thiếu (chỉ tên biến,
 *   không bao giờ log giá trị) để tầng upload fail-closed.
 */

const SUPPORTED_PROVIDERS = Object.freeze(['local', 's3']);
const PRODUCTION_PROVIDERS = Object.freeze(['s3']);

const S3_REQUIRED_ENV = Object.freeze([
  'STORAGE_BUCKET',
  'STORAGE_ACCESS_KEY',
  'STORAGE_SECRET_KEY',
  'STORAGE_PUBLIC_BASE_URL',
]);

const DEFAULT_LOCAL_ROOT = path.resolve(__dirname, '../../uploads');
const DEFAULT_LOCAL_PUBLIC_PREFIX = '/uploads';

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function readLocalConfig(env) {
  const rootDir = path.resolve(env.STORAGE_LOCAL_DIR || DEFAULT_LOCAL_ROOT);
  const publicPrefix = normalizeBaseUrl(env.STORAGE_LOCAL_PUBLIC_PREFIX || DEFAULT_LOCAL_PUBLIC_PREFIX) || DEFAULT_LOCAL_PUBLIC_PREFIX;
  return { rootDir, publicPrefix };
}

function readS3Config(env) {
  const endpoint = String(env.STORAGE_ENDPOINT || '').trim();
  return {
    bucket: String(env.STORAGE_BUCKET || '').trim(),
    region: String(env.STORAGE_REGION || '').trim() || 'auto',
    endpoint: endpoint || null,
    // Endpoint tuỳ biến (R2/MinIO/Supabase) thường cần path-style
    forcePathStyle: env.STORAGE_FORCE_PATH_STYLE
      ? env.STORAGE_FORCE_PATH_STYLE === 'true'
      : Boolean(endpoint),
    accessKeyId: String(env.STORAGE_ACCESS_KEY || '').trim(),
    secretAccessKey: String(env.STORAGE_SECRET_KEY || '').trim(),
    publicBaseUrl: normalizeBaseUrl(env.STORAGE_PUBLIC_BASE_URL),
    // Tiền tố key trong bucket, ví dụ "workrank" → drawings/... nằm dưới workrank/drawings/...
    keyPrefix: String(env.STORAGE_KEY_PREFIX || '').trim().replace(/^\/+|\/+$/g, ''),
  };
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{
 *   provider: 'local'|'s3'|null,
 *   nodeEnv: string,
 *   isProduction: boolean,
 *   ok: boolean,
 *   errors: string[],
 *   missingEnv: string[],
 *   local: { rootDir: string, publicPrefix: string },
 *   s3: object
 * }}
 */
function resolveStorageConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development';
  const isProduction = nodeEnv === 'production';
  const rawProvider = String(env.STORAGE_PROVIDER || '').trim().toLowerCase();
  const provider = rawProvider || (isProduction ? '' : 'local');

  const errors = [];
  const missingEnv = [];

  if (!provider) {
    missingEnv.push('STORAGE_PROVIDER');
    errors.push(
      'STORAGE_PROVIDER chưa được cấu hình. Production bắt buộc dùng object storage bền vững (s3).'
    );
  } else if (!SUPPORTED_PROVIDERS.includes(provider)) {
    errors.push(
      `STORAGE_PROVIDER="${provider}" không hợp lệ. Giá trị hỗ trợ: ${SUPPORTED_PROVIDERS.join(', ')}.`
    );
  }

  if (isProduction && provider === 'local') {
    errors.push(
      'STORAGE_PROVIDER=local bị cấm ở production: filesystem của Render là tạm thời, ảnh sẽ mất sau redeploy.'
    );
  }

  if (isProduction && provider && !PRODUCTION_PROVIDERS.includes(provider)) {
    errors.push(
      `Production chỉ chấp nhận provider: ${PRODUCTION_PROVIDERS.join(', ')} (nhận được "${provider}").`
    );
  }

  if (provider === 's3') {
    for (const key of S3_REQUIRED_ENV) {
      if (!String(env[key] || '').trim()) {
        missingEnv.push(key);
      }
    }
    // STORAGE_REGION không bắt buộc: mặc định "auto" (Cloudflare R2) nếu để trống.
  }

  if (missingEnv.length > 0) {
    errors.push(`Thiếu biến môi trường: ${Array.from(new Set(missingEnv)).join(', ')}.`);
  }

  return {
    provider: SUPPORTED_PROVIDERS.includes(provider) ? provider : null,
    nodeEnv,
    isProduction,
    ok: errors.length === 0,
    errors,
    missingEnv: Array.from(new Set(missingEnv)),
    local: readLocalConfig(env),
    s3: readS3Config(env),
  };
}

function describeStorageConfig(config) {
  return {
    provider: config.provider,
    nodeEnv: config.nodeEnv,
    ok: config.ok,
    missingEnv: config.missingEnv,
  };
}

module.exports = {
  resolveStorageConfig,
  describeStorageConfig,
  SUPPORTED_PROVIDERS,
  PRODUCTION_PROVIDERS,
  S3_REQUIRED_ENV,
};
