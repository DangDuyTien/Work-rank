const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  UserRecognition,
  Season,
  SeasonIndividualLeaderboardProjection,
  CompetitionAuditLog,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const recognitionService = require('../src/services/recognition.service');

test('E2E Recognition, Badge & Job Title RBAC Suite', async (t) => {
  let adminUser;
  let normalUser1;
  let normalUser2;
  let adminToken;
  let user1Token;
  let testSeason;

  before(async () => {
    // Create test admin and users
    const timestamp = Date.now();
    adminUser = await User.create({
      name: `Admin Test ${timestamp}`,
      email: `admin_${timestamp}@workrank.io`,
      passwordHash: 'hashed_pw',
      role: 'admin',
      isVerified: true,
      isDev: true,
      jobTitle: 'Giám Đốc Kỹ Thuật',
      department: 'Ban Giám Đốc',
    });

    normalUser1 = await User.create({
      name: `Employee One ${timestamp}`,
      email: `emp1_${timestamp}@workrank.io`,
      passwordHash: 'hashed_pw',
      role: 'user',
      isVerified: false,
      isDev: false,
      jobTitle: 'Editor',
      department: 'Media & Content',
    });

    normalUser2 = await User.create({
      name: `Employee Two ${timestamp}`,
      email: `emp2_${timestamp}@workrank.io`,
      passwordHash: 'hashed_pw',
      role: 'user',
      isVerified: false,
      isDev: false,
      jobTitle: 'Content Creator',
      department: 'Media & Content',
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, role: adminUser.role, email: adminUser.email },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
    user1Token = jwt.sign(
      { sub: normalUser1.id, role: normalUser1.role, email: normalUser1.email },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    testSeason = await Season.create({
      name: `Recognition Test Season ${timestamp}`,
      slug: `rec-season-${timestamp}`,
      status: 'active',
      startAt: new Date('2026-01-01'),
      endAt: new Date('2026-01-31'),
    });
  });

  after(async () => {
    // Cleanup
    if (adminUser) await User.destroy({ where: { id: adminUser.id }, force: true });
    if (normalUser1) await User.destroy({ where: { id: normalUser1.id }, force: true });
    if (normalUser2) await User.destroy({ where: { id: normalUser2.id }, force: true });
    if (testSeason) await Season.destroy({ where: { id: testSeason.id }, force: true });
  });

  await t.test('1. Member is rejected with 403 when trying to modify jobTitle or isDev/isVerified', async () => {
    const res = await request(app)
      .patch(`/api/users/${normalUser1.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        jobTitle: 'Giám Đốc',
        isDev: true,
        isVerified: true,
        role: 'admin',
      });

    assert.equal(res.status, 403, 'Regular member must not self-promote or modify jobTitle/isDev/isVerified/role');
    assert.match(res.body.message, /Quyền hạn|không có quyền/i);

    // Verify database was untouched
    const freshUser = await User.findByPk(normalUser1.id);
    assert.equal(freshUser.jobTitle, 'Editor');
    assert.equal(freshUser.isDev, false);
    assert.equal(freshUser.isVerified, false);
    assert.equal(freshUser.role, 'user');
  });

  await t.test('2. Member CAN update their own name, bio, phone', async () => {
    const res = await request(app)
      .patch(`/api/users/${normalUser1.id}`)
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        name: 'Employee One Updated',
        bio: 'Senior Video Editor specializing in YouTube long-form content.',
        phone: '0901234567',
      });

    assert.equal(res.status, 200);
    const freshUser = await User.findByPk(normalUser1.id);
    assert.equal(freshUser.name, 'Employee One Updated');
    assert.equal(freshUser.bio, 'Senior Video Editor specializing in YouTube long-form content.');
    assert.equal(freshUser.phone, '0901234567');
  });

  await t.test('3. Admin updates Job Profile and audit log is created', async () => {
    const res = await request(app)
      .patch(`/api/users/admin/users/${normalUser1.id}/job-profile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        jobTitle: 'Trưởng Phòng Media',
        department: 'Media & Content',
      });

    assert.equal(res.status, 200);
    assert.equal(res.body.user.jobTitle, 'Trưởng Phòng Media');

    // Check audit log
    const auditLogs = await CompetitionAuditLog.findAll({
      where: { action: 'JOB_TITLE_CHANGED', actorId: adminUser.id },
      order: [['createdAt', 'DESC']],
    });
    assert.ok(auditLogs.length > 0, 'Audit log for JOB_TITLE_CHANGED must exist');
    assert.equal(auditLogs[0].afterState?.jobTitle, 'Trưởng Phòng Media');
  });

  await t.test('4. Admin grants Verified and Dev badges with audit logs', async () => {
    // Grant Verified & Dev
    const res = await request(app)
      .patch(`/api/users/${normalUser1.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        isVerified: true,
        isDev: true,
      });

    assert.equal(res.status, 200);
    const freshUser = await User.findByPk(normalUser1.id);
    assert.equal(freshUser.isVerified, true);
    assert.equal(freshUser.isDev, true);

    // Check audit logs
    const verifiedLog = await CompetitionAuditLog.findOne({
      where: { action: 'VERIFIED_GRANTED', entityId: String(normalUser1.id) },
    });
    const devLog = await CompetitionAuditLog.findOne({
      where: { action: 'DEV_BADGE_GRANTED', entityId: String(normalUser1.id) },
    });
    assert.ok(verifiedLog, 'VERIFIED_GRANTED audit log must exist');
    assert.ok(devLog, 'DEV_BADGE_GRANTED audit log must exist');
  });

  await t.test('5. Admin awards MVP recognition and audit log is created', async () => {
    const res = await request(app)
      .post('/api/users/admin/recognitions/mvp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: normalUser1.id,
        seasonId: testSeason.id,
        reason: 'Đạt hiệu suất biên tập vượt trội 300% chỉ tiêu mùa giải',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.recognition.awardType, 'mvp');
    assert.equal(res.body.recognition.userId, normalUser1.id);

    // Check recognition in DB
    const rec = await UserRecognition.findOne({
      where: { userId: normalUser1.id, awardType: 'mvp' },
    });
    assert.ok(rec);
    assert.equal(rec.reason, 'Đạt hiệu suất biên tập vượt trội 300% chỉ tiêu mùa giải');

    // Check audit log
    const mvpLog = await CompetitionAuditLog.findOne({
      where: { action: 'MVP_AWARDED', entityId: String(normalUser1.id) },
    });
    assert.ok(mvpLog);
  });

  await t.test('6. Admin awards Champion recognition to a user', async () => {
    const res = await request(app)
      .post('/api/users/admin/recognitions/champion')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: normalUser2.id,
        seasonId: testSeason.id,
        title: `Quán quân ${testSeason.name}`,
        reason: 'Xuất sắc giành vị trí Quán quân cá nhân',
      });

    assert.equal(res.status, 201);
    assert.equal(res.body.recognition.awardType, 'champion');
    assert.equal(res.body.recognition.userId, normalUser2.id);

    const championLog = await CompetitionAuditLog.findOne({
      where: { action: 'CHAMPION_AWARDED', entityId: String(normalUser2.id) },
    });
    assert.ok(championLog);
  });

  await t.test('7. GET /api/users/:id/recognitions returns correct badges and awards history', async () => {
    const res = await request(app)
      .get(`/api/users/${normalUser1.id}/recognitions`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.equal(res.status, 200);
    const data = res.body.data;
    assert.ok(data.badges);
    assert.equal(data.badges.verified.active, true);
    assert.equal(data.badges.dev.active, true);
    assert.equal(data.badges.mvp.active, true);
    assert.equal(data.badges.mvp.count, 1);
    assert.ok(Array.isArray(data.awards));
    assert.equal(data.awards.length, 1);
    assert.equal(data.awards[0].awardType, 'mvp');
    assert.equal(data.awards[0].seasonName, testSeason.name);
  });

  await t.test('8. Admin revokes MVP award and audit log is created', async () => {
    const rec = await UserRecognition.findOne({
      where: { userId: normalUser1.id, awardType: 'mvp' },
    });
    assert.ok(rec);

    const res = await request(app)
      .delete(`/api/users/admin/recognitions/${rec.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Thu hồi do điều chỉnh quy chế' });

    assert.equal(res.status, 200);

    const deletedRec = await UserRecognition.findByPk(rec.id);
    assert.equal(deletedRec, null);

    const revokeLog = await CompetitionAuditLog.findOne({
      where: { action: 'MVP_REVOKED', entityId: String(normalUser1.id) },
    });
    assert.ok(revokeLog);
  });

  await t.test('9. syncSeasonChampionRecognitions automatically awards Champion when season freezes', async () => {
    // Mock user individual leaderboard #1
    await SeasonIndividualLeaderboardProjection.create({
      seasonId: testSeason.id,
      userId: normalUser1.id,
      rank: 1,
      score: 5000,
      seasonPoints: 5000,
      ruleBreakdown: {},
    });

    const awarded = await recognitionService.syncSeasonChampionRecognitions(testSeason.id, adminUser.id);
    assert.ok(awarded.length > 0);

    // Verify recognition in DB
    const champRec = await UserRecognition.findOne({
      where: { userId: normalUser1.id, awardType: 'champion', seasonId: testSeason.id },
    });
    assert.ok(champRec, 'Champion recognition must be auto-awarded to rank #1');

    // Clean up projection
    await SeasonIndividualLeaderboardProjection.destroy({
      where: { seasonId: testSeason.id, userId: normalUser1.id },
      force: true,
    });
  });
});
