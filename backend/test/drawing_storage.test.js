'use strict';

/**
 * Drawing / Góc Sáng Tạo — persistent image storage remediation test suite.
 *
 * Phạm vi:
 *  - validate ảnh (magic bytes, size, dimensions)
 *  - adapter local (upload/delete/idempotent/path traversal)
 *  - HTTP upload → storage → DB metadata
 *  - delete lifecycle (owner / unauthorized / repeat / object removal)
 *  - fail-closed khi thiếu cấu hình storage (không fallback local)
 *  - compensation khi ghi DB thất bại sau upload
 *  - migration ảnh legacy (file còn, file mất, fetch qua HTTP, rerun không duplicate)
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'wr-drawing-storage-'));
process.env.NODE_ENV = 'test';
process.env.STORAGE_PROVIDER = 'local';
process.env.STORAGE_LOCAL_DIR = STORAGE_ROOT;

const app = require('../src/app');
const env = require('../src/config/env');
const { sequelize, User, Drawing } = require('../src/models');
const drawingService = require('../src/services/drawing.service');
const { inspectImageBuffer, MAX_UPLOAD_BYTES } = require('../src/utils/imageValidation');
const {
  createLocalDrawingStorageAdapter,
} = require('../src/services/storage/localDrawingStorage.adapter');
const {
  buildDrawingStorageKey,
  buildLegacyDrawingStorageKey,
  parseStorageKey,
  resetDrawingStorage,
  setDrawingStorageForTests,
} = require('../src/services/storage/drawingStorage.service');
const { resolveStorageConfig } = require('../src/config/storage');
const { migrateDrawing } = require('../scripts/migrate-drawing-images');

/* ────────────────────────────── fixtures ────────────────────────────── */

function makePng(width, height, padding = 64) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write('IHDR', 4, 'ascii');
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = 8; // bit depth
  ihdr[17] = 6; // color type RGBA
  return Buffer.concat([signature, ihdr, Buffer.alloc(padding, 0x00)]);
}

function makeJpeg(width, height) {
  const app0 = Buffer.alloc(18);
  app0[0] = 0xff;
  app0[1] = 0xe0;
  app0.writeUInt16BE(16, 2);
  app0.write('JFIF\0', 4, 'ascii');

  const sof = Buffer.alloc(19);
  sof[0] = 0xff;
  sof[1] = 0xc0;
  sof.writeUInt16BE(17, 2);
  sof[4] = 8;
  sof.writeUInt16BE(height, 5);
  sof.writeUInt16BE(width, 7);
  sof[9] = 3;

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, sof, Buffer.from([0xff, 0xd9])]);
}

function makeWebp(width, height) {
  const buffer = Buffer.alloc(40);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(32, 4);
  buffer.write('WEBP', 8, 'ascii');
  buffer.write('VP8X', 12, 'ascii');
  buffer.writeUInt32LE(10, 16);
  buffer.writeUIntLE(width - 1, 24, 3);
  buffer.writeUIntLE(height - 1, 27, 3);
  return buffer;
}

function createFakeStorage() {
  const objects = new Map();
  let uploads = 0;
  const getPublicUrl = (key) => `https://cdn.test/${key}`;

  return {
    provider: 's3',
    persistent: true,
    getPublicUrl,
    async upload({ key, buffer, contentType }) {
      uploads += 1;
      objects.set(key, { buffer, contentType });
      return { key, url: getPublicUrl(key), provider: 's3', contentType, sizeBytes: buffer.length };
    },
    async delete({ key }) {
      const existed = objects.delete(key);
      return { key, deleted: existed, alreadyMissing: !existed };
    },
    async exists({ key }) {
      return objects.has(key);
    },
    _stats: () => ({ uploads, size: objects.size }),
    _keys: () => Array.from(objects.keys()),
  };
}

function countFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    total += entry.isDirectory() ? countFilesRecursive(target) : 1;
  }
  return total;
}

/* ────────────────────────────── suite ────────────────────────────── */

test('Drawing persistent storage remediation', async (t) => {
  let userA;
  let userB;
  let tokenA;
  let tokenB;
  let uploadedDrawingId = null;
  let uploadedKey = null;

  before(async () => {
    const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    userA = await User.create({
      name: `Storage Owner ${stamp}`,
      email: `storage_owner_${stamp}@workrank.io`,
      passwordHash: 'hashed_pass',
      role: 'user',
      status: 'active',
      isVerified: true,
    });
    userB = await User.create({
      name: `Storage Intruder ${stamp}`,
      email: `storage_intruder_${stamp}@workrank.io`,
      passwordHash: 'hashed_pass',
      role: 'user',
      status: 'active',
      isVerified: false,
    });

    tokenA = jwt.sign({ sub: userA.id, email: userA.email, role: 'user' }, env.jwtSecret, {
      expiresIn: '1h',
    });
    tokenB = jwt.sign({ sub: userB.id, email: userB.email, role: 'user' }, env.jwtSecret, {
      expiresIn: '1h',
    });
  });

  after(async () => {
    try {
      fs.rmSync(STORAGE_ROOT, { recursive: true, force: true });
    } catch (_) {
      /* ignore */
    }
  });

  /* ── 1. validation ── */
  await t.test('validates image signature, size and dimensions', () => {
    const png = inspectImageBuffer(makePng(1200, 700), { declaredMime: 'image/png' });
    assert.equal(png.mime, 'image/png');
    assert.equal(png.ext, 'png');
    assert.equal(png.width, 1200);
    assert.equal(png.height, 700);

    const jpeg = inspectImageBuffer(makeJpeg(800, 600), { declaredMime: 'image/jpeg' });
    assert.equal(jpeg.mime, 'image/jpeg');
    assert.equal(jpeg.ext, 'jpg');
    assert.equal(jpeg.width, 800);
    assert.equal(jpeg.height, 600);

    const webp = inspectImageBuffer(makeWebp(320, 240), { declaredMime: 'image/webp' });
    assert.equal(webp.mime, 'image/webp');
    assert.equal(webp.width, 320);
    assert.equal(webp.height, 240);

    // Không phải ảnh (script núp bóng ảnh)
    assert.throws(
      () => inspectImageBuffer(Buffer.from('<script>alert(1)</script>'), { declaredMime: 'image/png' }),
      /không phải ảnh hợp lệ/i
    );

    // Chữ ký PNG nhưng khai báo JPEG
    assert.throws(
      () => inspectImageBuffer(makePng(10, 10), { declaredMime: 'image/jpeg' }),
      /không khớp/i
    );

    // Quá dung lượng
    const oversized = Buffer.concat([makePng(10, 10), Buffer.alloc(MAX_UPLOAD_BYTES + 16)]);
    assert.throws(() => inspectImageBuffer(oversized), /vượt quá giới hạn/i);

    // Quá kích thước
    assert.throws(() => inspectImageBuffer(makePng(5000, 100)), /quá lớn/i);
  });

  /* ── 2. local adapter ── */
  await t.test('local adapter uploads, deletes and is idempotent', async () => {
    const adapter = createLocalDrawingStorageAdapter({
      rootDir: path.join(STORAGE_ROOT, 'adapter-test'),
      publicPrefix: '/uploads',
    });

    const result = await adapter.upload({
      key: 'drawings/1/sample.png',
      buffer: makePng(4, 4),
      contentType: 'image/png',
    });
    assert.equal(result.url, '/uploads/drawings/1/sample.png');
    assert.ok(fs.existsSync(path.join(STORAGE_ROOT, 'adapter-test', 'drawings/1/sample.png')));

    const firstDelete = await adapter.delete({ key: 'drawings/1/sample.png' });
    assert.equal(firstDelete.deleted, true);
    assert.equal(fs.existsSync(path.join(STORAGE_ROOT, 'adapter-test', 'drawings/1/sample.png')), false);

    const secondDelete = await adapter.delete({ key: 'drawings/1/sample.png' });
    assert.equal(secondDelete.alreadyMissing, true);
  });

  await t.test('local adapter blocks path traversal', async () => {
    const adapter = createLocalDrawingStorageAdapter({
      rootDir: path.join(STORAGE_ROOT, 'traversal'),
      publicPrefix: '/uploads',
    });
    await assert.rejects(
      () => adapter.upload({ key: '../../etc/passwd', buffer: makePng(2, 2), contentType: 'image/png' }),
      /path traversal/i
    );
  });

  await t.test('storage key is server-generated and traversal-safe', () => {
    const key = buildDrawingStorageKey({ userId: 42, ext: 'png' });
    assert.match(key, /^drawings\/42\/\d+-[a-f0-9]{16}\.png$/);

    const dirty = buildDrawingStorageKey({ userId: '../../evil', ext: 'png' });
    assert.ok(!dirty.includes('..'), 'userId không được tạo path traversal');

    const legacy = buildLegacyDrawingStorageKey({
      userId: 7,
      drawingId: 99,
      ext: 'jpg',
      checksum: 'abcdef1234567890',
    });
    assert.equal(legacy, 'drawings/legacy/7/99-abcdef123456.jpg');
    // Tất định: gọi lại cho cùng kết quả
    assert.equal(
      legacy,
      buildLegacyDrawingStorageKey({ userId: 7, drawingId: 99, ext: 'jpg', checksum: 'abcdef1234567890' })
    );
  });

  await t.test('parseStorageKey understands legacy and public URLs', () => {
    assert.equal(parseStorageKey('/uploads/drawings/a.png'), 'drawings/a.png');
    assert.equal(
      parseStorageKey('https://cdn.test/drawings/9/b.png', { publicBaseUrl: 'https://cdn.test' }),
      'drawings/9/b.png'
    );
    assert.equal(parseStorageKey('data:image/png;base64,AAA'), null);
  });

  /* ── 3. upload → DB ── */
  await t.test('POST /api/drawings persists object + storage metadata', async () => {
    const res = await request(app)
      .post('/api/drawings')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('title', 'Tác phẩm kiểm thử storage')
      .field('visibility', 'PUBLIC')
      .attach('image', makePng(640, 480), { filename: 'artwork.png', contentType: 'image/png' });

    assert.equal(res.status, 201, JSON.stringify(res.body));
    assert.ok(res.body.drawing.imageUrl.startsWith('/uploads/drawings/'), res.body.drawing.imageUrl);

    const row = await Drawing.findByPk(res.body.drawing.id);
    assert.equal(row.storageProvider, 'local');
    assert.equal(row.mimeType, 'image/png');
    assert.ok(row.sizeBytes > 0);
    assert.match(row.storageKey, new RegExp(`^drawings/${userA.id}/`));
    assert.equal(row.width, 640);
    assert.equal(row.height, 480);

    assert.ok(
      fs.existsSync(path.join(STORAGE_ROOT, row.storageKey)),
      'object phải tồn tại trong storage root'
    );

    uploadedDrawingId = row.id;
    uploadedKey = row.storageKey;
  });

  await t.test('GET /api/drawings exposes the stored artwork', async () => {
    const res = await request(app).get('/api/drawings').query({ page: 1, limit: 50, visibility: 'PUBLIC' });
    assert.equal(res.status, 200);
    const found = res.body.drawings.find((d) => d.id === uploadedDrawingId);
    assert.ok(found, 'tác phẩm phải xuất hiện trong gallery');
    assert.ok(found.imageUrl.includes('/uploads/drawings/'));
  });

  /* ── 4. authorization + delete lifecycle ── */
  await t.test('non-owner cannot delete another artwork', async () => {
    const res = await request(app)
      .delete(`/api/drawings/${uploadedDrawingId}`)
      .set('Authorization', `Bearer ${tokenB}`);
    assert.equal(res.status, 403);

    const row = await Drawing.findByPk(uploadedDrawingId);
    assert.equal(row.status, 'ACTIVE');
    assert.ok(fs.existsSync(path.join(STORAGE_ROOT, uploadedKey)), 'object không được bị xóa');
  });

  await t.test('owner delete removes DB record and storage object', async () => {
    const res = await request(app)
      .delete(`/api/drawings/${uploadedDrawingId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.alreadyDeleted, false);

    const row = await Drawing.findByPk(uploadedDrawingId);
    assert.equal(row.status, 'DELETED');
    assert.equal(
      fs.existsSync(path.join(STORAGE_ROOT, uploadedKey)),
      false,
      'object phải bị xóa khỏi storage'
    );
  });

  await t.test('repeated delete is idempotent (no 500)', async () => {
    const res = await request(app)
      .delete(`/api/drawings/${uploadedDrawingId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.alreadyDeleted, true);
  });

  await t.test('delete still succeeds when the object is already missing', async () => {
    const created = await Drawing.create({
      userId: userA.id,
      title: 'Object đã mất trước khi xóa',
      imageUrl: 'https://cdn.test/drawings/ghost.png',
      storageKey: 'drawings/ghost.png',
      storageProvider: 's3',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    });

    // A local adapter must never pretend to delete a cloud object.
    const rejected = await request(app).delete(`/api/drawings/${created.id}`).set('Authorization', `Bearer ${tokenA}`);
    assert.equal(rejected.status, 502);
    assert.equal((await Drawing.findByPk(created.id)).metadata.deletionPending, true);
    setDrawingStorageForTests(createFakeStorage());
    const res = await request(app)
      .delete(`/api/drawings/${created.id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const row = await Drawing.findByPk(created.id);
    assert.equal(row.status, 'DELETED');
    resetDrawingStorage();
  });

  /* ── 5. validation ở HTTP layer ── */
  await t.test('rejects non-image payloads', async () => {
    const res = await request(app)
      .post('/api/drawings')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('title', 'Fake image')
      .attach('image', Buffer.from('MZ not an image'), {
        filename: 'evil.png',
        contentType: 'image/png',
      });

    assert.equal(res.status, 400, JSON.stringify(res.body));
    assert.match(res.body.message, /không phải ảnh hợp lệ/i);
  });

  await t.test('rejects oversize payloads with 413', async () => {
    const oversized = Buffer.concat([makePng(10, 10), Buffer.alloc(MAX_UPLOAD_BYTES + 1024)]);
    const res = await request(app)
      .post('/api/drawings')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('title', 'Too big')
      .attach('image', oversized, { filename: 'big.png', contentType: 'image/png' });

    assert.equal(res.status, 413, JSON.stringify(res.body));
  });

  /* ── 6. fail-closed ── */
  await t.test('upload fails closed (503) when storage config is invalid — no local fallback', async () => {
    const previousProvider = process.env.STORAGE_PROVIDER;
    process.env.STORAGE_PROVIDER = 's3';
    delete process.env.STORAGE_BUCKET;
    resetDrawingStorage();

    const beforeCount = countFilesRecursive(STORAGE_ROOT);
    const rowsBefore = await Drawing.count();

    try {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('title', 'Không được lưu local')
        .attach('image', makePng(20, 20), { filename: 'artwork.png', contentType: 'image/png' });

      assert.equal(res.status, 503, JSON.stringify(res.body));
      assert.equal(res.body.code, 'STORAGE_UNAVAILABLE');
      assert.ok(Array.isArray(res.body.details), 'phải trả danh sách env còn thiếu');
      assert.ok(res.body.details.includes('STORAGE_BUCKET'));
    } finally {
      process.env.STORAGE_PROVIDER = previousProvider;
      resetDrawingStorage();
    }

    assert.equal(countFilesRecursive(STORAGE_ROOT), beforeCount, 'không được ghi file local');
    assert.equal(await Drawing.count(), rowsBefore, 'không được tạo record');
  });

  await t.test('DB failure after upload rolls the object back (no orphan)', async () => {
    const beforeCount = countFilesRecursive(STORAGE_ROOT);
    const originalCreate = drawingService.createDrawing;
    drawingService.createDrawing = async () => {
      throw new Error('simulated DB failure');
    };

    try {
      const res = await request(app)
        .post('/api/drawings')
        .set('Authorization', `Bearer ${tokenA}`)
        .field('title', 'DB sẽ fail')
        .attach('image', makePng(64, 64), { filename: 'artwork.png', contentType: 'image/png' });

      assert.equal(res.status, 500, JSON.stringify(res.body));
    } finally {
      drawingService.createDrawing = originalCreate;
    }

    assert.equal(
      countFilesRecursive(STORAGE_ROOT),
      beforeCount,
      'object vừa upload phải bị rollback'
    );
  });

  await t.test('development cannot publish to local filesystem and claim durable storage', async () => {
    const previous = process.env.NODE_ENV; process.env.NODE_ENV = 'development';
    try {
      const res = await request(app).post('/api/drawings').set('Authorization', `Bearer ${tokenA}`).attach('image', makePng(20,20), {filename:'art.png',contentType:'image/png'});
      assert.equal(res.status,503); assert.equal(res.body.code,'STORAGE_UNAVAILABLE');
    } finally { process.env.NODE_ENV = previous; }
  });

  /* ── 7. legacy migration ── */
  await t.test('legacy migration uploads existing local file then skips on rerun', async () => {
    const storage = createFakeStorage();
    const storageConfig = resolveStorageConfig();

    const legacyDir = path.join(STORAGE_ROOT, 'drawings');
    fs.mkdirSync(legacyDir, { recursive: true });
    const legacyName = `drawing-legacy-${Date.now()}.png`;
    fs.writeFileSync(path.join(legacyDir, legacyName), makePng(300, 200));

    const row = await Drawing.create({
      userId: userA.id,
      title: 'Legacy có file',
      imageUrl: `/uploads/drawings/${legacyName}`,
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    });

    const first = await migrateDrawing(row, { storage, storageConfig, dryRun: false });
    assert.equal(first.status, 'migrated');
    assert.match(first.key, /^drawings\/legacy\//);

    await row.reload();
    assert.equal(row.storageKey, first.key);
    assert.equal(row.storageProvider, 's3');
    assert.equal(row.mimeType, 'image/png');
    assert.ok(row.imageUrl.startsWith('https://cdn.test/'));

    const uploadsAfterFirst = storage._stats().uploads;

    const second = await migrateDrawing(row, { storage, storageConfig, dryRun: false });
    assert.equal(second.status, 'skipped-has-key');
    assert.equal(storage._stats().uploads, uploadsAfterFirst, 'không được upload trùng');
    assert.equal(storage._stats().size, 1, 'không được tạo object trùng');
  });

  await t.test('migration moves nested local-adapter keys and verifies cloud objects on rerun', async () => {
    const storage=createFakeStorage(), storageConfig=resolveStorageConfig();
    const key=`drawings/${userA.id}/nested-local.png`;
    fs.mkdirSync(path.dirname(path.join(STORAGE_ROOT,key)),{recursive:true});fs.writeFileSync(path.join(STORAGE_ROOT,key),makePng(40,30));
    const row=await Drawing.create({userId:userA.id,title:'Nested local',imageUrl:`/uploads/${key}`,storageKey:key,storageProvider:'local'});
    assert.equal((await migrateDrawing(row,{storage,storageConfig,dryRun:false})).status,'migrated');
    await row.reload();assert.equal(row.storageProvider,'s3');assert.equal((await migrateDrawing(row,{storage,storageConfig,dryRun:false})).status,'skipped-has-key');
    await storage.delete({key:row.storageKey});
    assert.equal((await migrateDrawing(row,{storage,storageConfig,dryRun:false})).status,'missing-object');await row.reload();assert.equal(row.metadata.imageMissing,true);
  });

  await t.test('legacy migration marks missing files without deleting the record', async () => {
    const storage = createFakeStorage();
    const storageConfig = resolveStorageConfig();

    const row = await Drawing.create({
      userId: userA.id,
      title: 'Legacy mất file',
      imageUrl: '/uploads/drawings/khong-ton-tai-123.png',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
    });

    const result = await migrateDrawing(row, { storage, storageConfig, dryRun: false });
    assert.equal(result.status, 'missing-local-file');

    await row.reload();
    assert.equal(row.status, 'ACTIVE', 'record lịch sử không được xóa');
    assert.equal(row.storageKey, null);
    assert.equal(row.metadata.imageMissing, true);
    assert.equal(storage._stats().uploads, 0);
  });

  await t.test('legacy migration can re-fetch files from the old deployment over HTTP', async () => {
    const storage = createFakeStorage();
    const storageConfig = resolveStorageConfig();
    const payload = makePng(120, 90);

    const server = http.createServer((req, res) => {
      if (req.url === '/uploads/drawings/remote-only.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(payload);
        return;
      }
      res.writeHead(404);
      res.end();
    });

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();

    try {
      const row = await Drawing.create({
        userId: userA.id,
        title: 'Legacy chỉ còn trên instance cũ',
        imageUrl: '/uploads/drawings/remote-only.png',
        status: 'ACTIVE',
        visibility: 'PUBLIC',
      });

      const result = await migrateDrawing(row, {
        storage,
        storageConfig,
        dryRun: false,
        legacyBaseUrl: `http://127.0.0.1:${port}`,
      });

      assert.equal(result.status, 'migrated');
      assert.equal(result.source, 'legacy-http');

      await row.reload();
      assert.ok(row.storageKey);
      assert.ok(row.imageUrl.startsWith('https://cdn.test/'));
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});

test('sequelize connection is usable for this suite', async () => {
  await sequelize.authenticate();
});
