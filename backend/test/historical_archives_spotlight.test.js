'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const { sequelize, User, SystemSetting } = require('../src/models');
const { signAccessToken } = require('../src/utils/token');

test('Historical Archives Spotlight API Test Suite', async (t) => {
  await sequelize.authenticate();

  let adminUser, normalUser, adminToken, normalToken;

  t.before(async () => {
    const timestamp = Date.now();

    adminUser = await User.create({
      name: `Admin Archive ${timestamp}`,
      email: `admin_archive_${timestamp}@workrank.test`,
      passwordHash: 'hashed_pw',
      role: 'admin',
      status: 'active',
      isVerified: true,
    });
    adminToken = signAccessToken(adminUser);

    normalUser = await User.create({
      name: `User Normal ${timestamp}`,
      email: `user_archive_${timestamp}@workrank.test`,
      passwordHash: 'hashed_pw',
      role: 'user',
      status: 'active',
      isVerified: false,
    });
    normalToken = signAccessToken(normalUser);
  });

  t.after(async () => {
    // Clean up archive setting
    await SystemSetting.destroy({ where: { settingKey: 'public_spotlight_archives' } });
    if (adminUser?.id) await User.destroy({ where: { id: adminUser.id } });
    if (normalUser?.id) await User.destroy({ where: { id: normalUser.id } });
  });

  await t.test('1. GET /api/competition/public/spotlight/archives returns empty or current archives unauthenticated', async () => {
    const res = await request(app)
      .get('/api/competition/public/spotlight/archives')
      .expect(200);

    assert.ok(Array.isArray(res.body.archives));
  });

  await t.test('2. Non-admin cannot save or delete spotlight archives', async () => {
    await request(app)
      .post('/api/competition/admin/spotlight/archives')
      .set('Authorization', `Bearer ${normalToken}`)
      .send({ year: 2025, label: 'Mùa 2025' })
      .expect(403);

    await request(app)
      .delete('/api/competition/admin/spotlight/archives/2025')
      .set('Authorization', `Bearer ${normalToken}`)
      .expect(403);
  });

  await t.test('3. Admin saves 2025 Historical Archive entry successfully', async () => {
    const payload = {
      year: 2025,
      label: 'Mùa Giải Vinh Danh 2025',
      championTeam: {
        teamName: 'Team Sáng Tạo 2025',
        title: 'Nhà Vô Địch Mùa Giải 2025',
        members: [{ name: 'Trần Văn A' }, { name: 'Lê Thị B' }],
      },
      mvp: {
        name: 'Nguyễn Văn C',
        jobTitle: 'Video Editor & Producer',
        awardTitle: 'MVP Xuất Sắc Nhất 2025',
        score: 12500,
        reason: 'Đóng góp vượt bậc trong năm 2025',
        isVerified: true,
      },
    };

    const res = await request(app)
      .post('/api/competition/admin/spotlight/archives')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(payload)
      .expect(200);

    assert.equal(res.body.entry.year, 2025);
    assert.equal(res.body.entry.label, 'Mùa Giải Vinh Danh 2025');
  });

  await t.test('4. Public spotlight and archives endpoint include the 2025 record', async () => {
    const archRes = await request(app)
      .get('/api/competition/public/spotlight/archives')
      .expect(200);

    const found2025 = archRes.body.archives.find((a) => Number(a.year) === 2025);
    assert.ok(found2025, '2025 archive must be found');
    assert.equal(found2025.championTeam.teamName, 'Team Sáng Tạo 2025');
    assert.equal(found2025.mvp.name, 'Nguyễn Văn C');

    // Also verify that GET /api/competition/public/spotlight includes archives
    const spotRes = await request(app)
      .get('/api/competition/public/spotlight')
      .expect(200);

    assert.ok(Array.isArray(spotRes.body.archives));
    const inSpotlight = spotRes.body.archives.find((a) => Number(a.year) === 2025);
    assert.ok(inSpotlight, '2025 archive must be present in public spotlight response');
  });

  await t.test('5. Admin deletes 2025 Historical Archive entry successfully', async () => {
    await request(app)
      .delete('/api/competition/admin/spotlight/archives/2025')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const archRes = await request(app)
      .get('/api/competition/public/spotlight/archives')
      .expect(200);

    const found2025 = archRes.body.archives.find((a) => Number(a.year) === 2025);
    assert.equal(found2025, undefined);
  });
});
