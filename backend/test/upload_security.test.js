'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User } = require('../src/models');

describe('Quiz Upload Security Test Suite', () => {
  let adminUser, adminToken;

  before(async () => {
    const ts = Date.now();
    adminUser = await User.create({
      name: `Admin Upload ${ts}`,
      email: `admin_upload_${ts}@workrank.io`,
      passwordHash: 'hash',
      role: 'admin',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });
  });

  after(async () => {
    await User.destroy({ where: { id: adminUser.id } });
  });

  it('1. Rejects SVG file upload with forbidden error', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
    const res = await request(app)
      .post('/api/admin/quiz/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from(svgContent), { filename: 'malicious.svg', contentType: 'image/svg+xml' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message || JSON.stringify(res.body), /không hỗ trợ SVG|Chỉ chấp nhận các định dạng ảnh hợp lệ/i);
  });

  it('2. Rejects fake PNG file with invalid magic bytes (e.g. text/html masquerading as image)', async () => {
    const fakePngContent = '<html><body>Phishing payload</body></html>';
    const res = await request(app)
      .post('/api/admin/quiz/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', Buffer.from(fakePngContent), { filename: 'fake.png', contentType: 'image/png' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /không phải hình ảnh hợp lệ/i);
  });

  it('3. Accepts valid PNG file with legitimate header bytes', async () => {
    // 8-byte PNG signature: 89 50 4E 47 0D 0A 1A 0A + 8 bytes padding
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    const res = await request(app)
      .post('/api/admin/quiz/upload-image')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('image', validPngHeader, { filename: 'valid.png', contentType: 'image/png' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.url.startsWith('/uploads/quiz/quiz-'));
    assert.ok(res.body.url.endsWith('.png'));
  });

  it('4. Rejects fake MP3 audio file with invalid magic bytes', async () => {
    const fakeAudio = 'This is not an audio file';
    const res = await request(app)
      .post('/api/admin/quiz/upload-audio')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', Buffer.from(fakeAudio), { filename: 'fake.mp3', contentType: 'audio/mpeg' });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /không hợp lệ/i);
  });

  it('5. Accepts valid MP3 file with ID3 magic bytes', async () => {
    // ID3 header: 49 44 33
    const validMp3Header = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    const res = await request(app)
      .post('/api/admin/quiz/upload-audio')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('audio', validMp3Header, { filename: 'sound.mp3', contentType: 'audio/mpeg' });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.url.startsWith('/uploads/quiz/quiz-'));
    assert.ok(res.body.url.endsWith('.mp3'));
  });
});
