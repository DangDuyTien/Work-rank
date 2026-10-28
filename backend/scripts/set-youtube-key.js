#!/usr/bin/env node
'use strict';

/**
 * Gắn / kiểm tra YOUTUBE_API_KEY cho WorkRank.
 *
 *   node scripts/set-youtube-key.js AIza...     # kiểm tra rồi ghi vào backend/.env
 *   node scripts/set-youtube-key.js --check     # chỉ kiểm tra key đang có trong .env
 *
 * Key được xác thực bằng một lệnh thật tới YouTube Data API v3 (1 unit quota)
 * TRƯỚC khi ghi, nên không bao giờ ghi một key sai vào cấu hình.
 */

const fs = require('fs');
const path = require('path');

const ENV_PATH = path.resolve(__dirname, '../.env');
const PROBE_VIDEO_ID = 'dQw4w9WgXcQ'; // 1 unit: videos.list

function mask(key) {
  if (!key) return '(trống)';
  if (key.length <= 12) return `${key.slice(0, 3)}***`;
  return `${key.slice(0, 6)}…${key.slice(-4)}`;
}

function readEnvValue(source, name) {
  const line = source.split(/\r?\n/).find((entry) => entry.trim().startsWith(`${name}=`));
  if (!line) return '';
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

async function probe(key) {
  const url = new URL('https://www.googleapis.com/youtube/v3/videos');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('id', PROBE_VIDEO_ID);
  url.searchParams.set('key', key);

  let response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    return { ok: false, reason: `Không gọi được Google API: ${error.message}` };
  }

  const body = await response.json().catch(() => ({}));

  if (response.ok) {
    const title = body.items?.[0]?.snippet?.title;
    return { ok: true, reason: `Key hợp lệ — thử được video: "${title || PROBE_VIDEO_ID}"` };
  }

  const message = body?.error?.message || `HTTP ${response.status}`;
  const reason = body?.error?.errors?.[0]?.reason || '';

  if (reason === 'API_KEY_INVALID' || response.status === 400) {
    return { ok: false, reason: `Key không hợp lệ hoặc đã bị thu hồi (${message})` };
  }
  if (reason === 'SERVICE_DISABLED' || response.status === 403) {
    return {
      ok: false,
      reason: `Key đúng nhưng YouTube Data API v3 CHƯA được bật cho project này.\n`
        + `  → Mở https://console.cloud.google.com/apis/library/youtube.googleapis.com → Enable → thử lại.\n`
        + `  (${message})`,
    };
  }
  return { ok: false, reason: `Google trả về lỗi: ${message}` };
}

function writeKey(key) {
  const current = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf8') : '';
  const line = `YOUTUBE_API_KEY=${key}`;

  let next;
  if (/^\s*YOUTUBE_API_KEY\s*=/m.test(current)) {
    next = current.replace(/^\s*YOUTUBE_API_KEY\s*=.*$/m, line);
  } else {
    const suffix = current.endsWith('\n') || current === '' ? '' : '\n';
    next = `${current}${suffix}\n# ── Private Media / YouTube Data API v3 ──\n${line}\n`;
  }

  fs.writeFileSync(ENV_PATH, next, 'utf8');
  return ENV_PATH;
}

async function main() {
  const args = process.argv.slice(2);
  const checkOnly = args.includes('--check');
  const provided = args.find((arg) => !arg.startsWith('--'))?.trim();

  if (!checkOnly && !provided) {
    console.error('Cách dùng: node scripts/set-youtube-key.js AIza...   (hoặc --check)');
    process.exit(2);
  }

  const existing = fs.existsSync(ENV_PATH) ? readEnvValue(fs.readFileSync(ENV_PATH, 'utf8'), 'YOUTUBE_API_KEY') : '';
  const key = provided || existing;

  if (!key) {
    console.error('backend/.env chưa có YOUTUBE_API_KEY. Truyền key vào: node scripts/set-youtube-key.js AIza...');
    process.exit(2);
  }

  if (!/^AIza[0-9A-Za-z_-]{30,}$/.test(key)) {
    console.warn(`⚠ Key không giống định dạng Google API key (thường bắt đầu bằng "AIza"). Đang kiểm tra thật…`);
  }

  console.log(`→ Đang kiểm tra key ${mask(key)} …`);
  const result = await probe(key);

  if (!result.ok) {
    console.error(`✗ ${result.reason}`);
    if (!checkOnly) console.error('  Chưa ghi gì vào .env.');
    process.exit(1);
  }

  console.log(`✓ ${result.reason}`);

  if (checkOnly) {
    console.log(`  Nguồn: ${ENV_PATH}`);
    process.exit(0);
  }

  const written = writeKey(key);
  console.log(`✓ Đã ghi YOUTUBE_API_KEY vào ${written}`);
  console.log('');
  console.log('Bước tiếp theo:');
  console.log('  1. Restart backend (Ctrl+C rồi `npm run dev` trong backend/).');
  console.log('  2. Kiểm tra: GET /api/private-media/status → youtube.search phải là true.');
  console.log('  3. Mở Work Rank → Điều khiển media → ô tìm kiếm gõ từ khoá bất kỳ.');
}

main().catch((error) => {
  console.error('Lỗi:', error.message);
  process.exit(1);
});
