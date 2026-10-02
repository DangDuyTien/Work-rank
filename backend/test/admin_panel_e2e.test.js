const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  Team,
  YouTubeChannel,
  UserRecognition,
  Season,
  CompetitionAuditLog,
  CompetitionEventStore,
} = require('../src/models');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');

test('Comprehensive Admin Panel E2E Test Suite', async (t) => {
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;
  let testTeam;
  let createdEmployeeId;

  before(async () => {
    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    adminUser = await User.create({
      name: `Admin Commander ${timestamp}`,
      email: `admin_${timestamp}@workrank.io`,
      passwordHash: 'hashed_pw',
      role: 'admin',
      isVerified: true,
      isDev: true,
      jobTitle: 'Giám Đốc Điều Hành',
      department: 'Ban Giám Đốc',
    });

    regularUser = await User.create({
      name: `Regular Staff ${timestamp}`,
      email: `staff_${timestamp}@workrank.io`,
      passwordHash: 'hashed_pw',
      role: 'user',
      isVerified: false,
      isDev: false,
      jobTitle: 'Nhân viên dựng phim',
      department: 'Media & Content',
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: 'admin' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    userToken = jwt.sign(
      { sub: regularUser.id, email: regularUser.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    testTeam = await Team.create({
      name: `Admin Test Team ${timestamp}`,
      description: 'Test Department Team',
      department: 'Phòng Sản Xuất Video',
      brandColor: '#0284c7',
    });
  });

  after(async () => {
    if (createdEmployeeId) {
      await User.destroy({ where: { id: createdEmployeeId } }).catch(() => {});
    }
    if (adminUser) await User.destroy({ where: { id: adminUser.id } }).catch(() => {});
    if (regularUser) await User.destroy({ where: { id: regularUser.id } }).catch(() => {});
    if (testTeam) await Team.destroy({ where: { id: testTeam.id } }).catch(() => {});
  });

  await t.test('1. RBAC: Non-admin users are strictly rejected from Admin endpoints with 403', async () => {
    // Attempt to create user as regular user
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'Unauthorized User',
        email: 'unauth@test.com',
        password: 'password123',
      });
    assert.equal(createRes.status, 403);

    // Attempt to delete user as regular user
    const deleteRes = await request(app)
      .delete(`/api/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${userToken}`);
    assert.equal(deleteRes.status, 403);

    // Attempt to update job profile as regular user
    const jobRes = await request(app)
      .patch(`/api/users/admin/users/${regularUser.id}/job-profile`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ jobTitle: 'CEO' });
    assert.equal(jobRes.status, 403);

    // Attempt to award MVP as regular user
    const awardRes = await request(app)
      .post('/api/users/admin/recognitions/mvp')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ userId: regularUser.id, reason: 'Self award' });
    assert.equal(awardRes.status, 403);

    // Attempt to trigger projections rebuild as regular user
    const rebuildRes = await request(app)
      .post('/api/competition/admin/projections/rebuild')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ reason: 'Unauthorized rebuild' });
    assert.equal(rebuildRes.status, 403);
  });

  await t.test('2. People Management: Admin creates, edits, assigns badges and removes employee', async () => {
    const timestamp = Date.now();
    // A. Create Employee
    const createRes = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `New Recruit ${timestamp}`,
        email: `recruit_${timestamp}@workrank.io`,
        password: 'Password@123',
        role: 'user',
        jobTitle: 'Motion Designer',
        department: 'Media & Content',
      });

    assert.equal(createRes.status, 201);
    assert.ok(createRes.body.user);
    assert.equal(createRes.body.user.name, `New Recruit ${timestamp}`);
    createdEmployeeId = createRes.body.user.id;

    // B. Admin updates employee profile & badges
    const updateRes = await request(app)
      .patch(`/api/users/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Lead Designer ${timestamp}`,
        jobTitle: 'Senior Motion Designer',
        department: 'Phòng Sản Xuất Video',
        isVerified: true,
        isDev: true,
        status: 'active',
        reason: 'Promotion by Admin',
      });

    assert.equal(updateRes.status, 200);
    assert.equal(updateRes.body.user.name, `Lead Designer ${timestamp}`);
    assert.equal(updateRes.body.user.jobTitle, 'Senior Motion Designer');
    assert.equal(updateRes.body.user.isVerified, true);
    assert.equal(updateRes.body.user.isDev, true);

    // C. Admin awards MVP Recognition
    const mvpRes = await request(app)
      .post('/api/users/admin/recognitions/mvp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        userId: createdEmployeeId,
        title: 'MVP Thiết Kế Xuất Sắc',
        reason: 'Hoàn thành xuất sắc 10 animation videos',
      });

    assert.equal(mvpRes.status, 201);
    assert.ok(mvpRes.body.recognition);
    assert.equal(mvpRes.body.recognition.awardType, 'mvp');

    // D. Admin deletes user
    const delRes = await request(app)
      .delete(`/api/users/${createdEmployeeId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.ok([200, 204].includes(delRes.status));
    createdEmployeeId = null;
  });

  await t.test('3. Teams & YouTube Channels: Admin assigns team members and manages channels', async () => {
    // Assign regularUser to testTeam via admin update
    const assignRes = await request(app)
      .patch(`/api/users/${regularUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: testTeam.id });

    assert.equal(assignRes.status, 200);

    // Create a YouTube channel mapped to team
    const ytTimestamp = Date.now();
    const ytRes = await request(app)
      .post('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        channelId: `UC_test_${ytTimestamp}`,
        title: `WorkRank Studio ${ytTimestamp}`,
        customUrl: `@workrank_studio_${ytTimestamp}`,
        teamId: testTeam.id,
      });

    assert.equal(ytRes.status, 201);
    assert.ok(ytRes.body.id || ytRes.body.channelId);

    // Query admin channels list
    const listRes = await request(app)
      .get('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(listRes.status, 200);
    assert.ok(Array.isArray(listRes.body.items || listRes.body.data || listRes.body));

    // Check YouTube Admin health
    const healthRes = await request(app)
      .get('/api/youtube/admin/health')
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(healthRes.status, 200);
    assert.ok(healthRes.body);
  });

  await t.test('4. Operations & Audit Logs: Admin views audit logs and inspects system health', async () => {
    // Query audit logs
    const auditRes = await request(app)
      .get('/api/users/admin/recognitions/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ limit: 10 });

    assert.equal(auditRes.status, 200);
    assert.ok(Array.isArray(auditRes.body.logs));

    // Admin Projections rebuild drift check / trigger
    const rebuildRes = await request(app)
      .post('/api/competition/admin/projections/rebuild')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Routine Admin Integrity Maintenance' });

    assert.equal(rebuildRes.status, 200);
    assert.ok(rebuildRes.body);
  });
});
