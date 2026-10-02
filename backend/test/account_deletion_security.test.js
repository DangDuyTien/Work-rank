const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  sequelize,
  User,
  Team,
  YouTubeChannel,
  CompetitionAuditLog,
  SeasonTeamMember,
  Season,
} = require('../src/models');

test('Account Deletion Security, RBAC & Data Integrity Test Suite', async (t) => {
  let adminUser;
  let normalUser1;
  let normalUser2;
  let testTeam;
  let testChannel;
  let adminToken;
  let user1Token;
  let user2Token;

  before(async () => {
    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    adminUser = await User.create({
      name: `Admin Deletion Tester ${timestamp}`,
      email: `admin_del_${timestamp}@workrank.io`,
      passwordHash: 'hashed_admin_pass',
      role: 'admin',
      status: 'active',
      isVerified: true,
      jobTitle: 'Giám Đốc Kỹ Thuật',
      department: 'Ban Giám Đốc',
    });

    normalUser1 = await User.create({
      name: `Member One ${timestamp}`,
      email: `member1_${timestamp}@workrank.io`,
      passwordHash: 'hashed_member1_pass',
      role: 'user',
      status: 'active',
      isVerified: false,
      jobTitle: 'Content Creator',
      department: 'Media & Content',
    });

    normalUser2 = await User.create({
      name: `Member Two ${timestamp}`,
      email: `member2_${timestamp}@workrank.io`,
      passwordHash: 'hashed_member2_pass',
      role: 'user',
      status: 'active',
      isVerified: false,
      jobTitle: 'Video Editor',
      department: 'Media & Content',
    });

    // Create Team owned by normalUser1
    testTeam = await Team.create({
      name: `Team Deletion Test ${timestamp}`,
      code: `DEL_TEAM_${timestamp.slice(-5)}`,
      status: 'active',
      ownerId: normalUser1.id,
    });

    // Create YouTubeChannel assigned to normalUser1
    testChannel = await YouTubeChannel.create({
      channelId: `UC_DEL_${timestamp.slice(-8)}`,
      title: `Test Channel ${timestamp}`,
      assignedUserId: normalUser1.id,
      teamId: testTeam.id,
      syncStatus: 'IDLE',
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: 'admin' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    user1Token = jwt.sign(
      { sub: normalUser1.id, email: normalUser1.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    user2Token = jwt.sign(
      { sub: normalUser2.id, email: normalUser2.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  await t.test('1. Unauthenticated requests to delete endpoints must return 401 Unauthorized', async () => {
    const res1 = await request(app).delete(`/api/users/${normalUser1.id}`);
    assert.strictEqual(res1.status, 401);

    const res2 = await request(app).delete('/api/auth/me/account');
    assert.strictEqual(res2.status, 401);

    const res3 = await request(app).delete('/api/users/me/account');
    assert.strictEqual(res3.status, 401);

    const res4 = await request(app).delete(`/api/admin/users/${normalUser1.id}`);
    assert.strictEqual(res4.status, 401);
  });

  await t.test('2. Member cannot delete another user via DELETE /api/users/:id (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/users/${normalUser2.id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);

    // Verify normalUser2 is still active in database
    const user2InDb = await User.findByPk(normalUser2.id);
    assert.strictEqual(user2InDb.status, 'active');
    assert.strictEqual(user2InDb.email, normalUser2.email);
  });

  await t.test('3. Member cannot access DELETE /api/admin/users/:id (403 Forbidden)', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${normalUser2.id}`)
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);

    // Verify normalUser2 remains untouched
    const user2InDb = await User.findByPk(normalUser2.id);
    assert.strictEqual(user2InDb.status, 'active');
  });

  await t.test('4. Admin cannot delete their own account from admin user management endpoint (400 Bad Request)', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /không thể.*xóa tài khoản của chính mình/i);

    // Also test via /api/users/:adminId
    const res2 = await request(app)
      .delete(`/api/users/${adminUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res2.status, 400);
    assert.match(res2.body.message, /không thể.*xóa tài khoản của chính mình/i);

    // Verify admin is still active
    const adminInDb = await User.findByPk(adminUser.id);
    assert.strictEqual(adminInDb.status, 'active');
  });

  await t.test('5. Member self-delete via DELETE /api/auth/me/account ignores any spoofed userId and deletes ONLY caller', async () => {
    // Normal user 1 attempts to pass userId of normal user 2 in body/query
    const res = await request(app)
      .delete('/api/auth/me/account?userId=' + normalUser2.id)
      .send({ userId: normalUser2.id })
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, normalUser1.id);

    // Verify normalUser1 is soft-deleted and anonymized
    const user1InDb = await User.findByPk(normalUser1.id);
    assert.strictEqual(user1InDb.status, 'inactive');
    assert.strictEqual(user1InDb.name, 'Tài khoản đã xóa');
    assert.match(user1InDb.email, /^deleted_/);
    assert.strictEqual(user1InDb.refreshTokenHash, null);

    // Verify normalUser2 is COMPLETELY UNAFFECTED!
    const user2InDb = await User.findByPk(normalUser2.id);
    assert.strictEqual(user2InDb.status, 'active');
    assert.strictEqual(user2InDb.email, normalUser2.email);
  });

  await t.test('6. Data Integrity: Deleting user unassigns YouTubeChannel without deleting the channel', async () => {
    const channelInDb = await YouTubeChannel.findByPk(testChannel.id);
    assert.ok(channelInDb, 'YouTube Channel must still exist');
    assert.strictEqual(channelInDb.assignedUserId, null, 'YouTube Channel assignedUserId must be set to null');
    assert.strictEqual(channelInDb.teamId, testTeam.id, 'YouTube Channel must still be attached to team');
  });

  await t.test('7. Data Integrity: Deleting user unsets Team ownership without deleting the team', async () => {
    const teamInDb = await Team.findByPk(testTeam.id);
    assert.ok(teamInDb, 'Team must still exist');
    assert.strictEqual(teamInDb.ownerId, null, 'Team ownerId must be set to null');
  });

  await t.test('8. Deleted user token is immediately rejected by auth middleware (403 Forbidden)', async () => {
    // Attempt to access authenticated endpoint with old token of normalUser1
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${user1Token}`);

    assert.strictEqual(res.status, 403);
    assert.match(res.body.message, /bị khóa/i);
  });

  await t.test('9. Admin deletes another user via DELETE /api/admin/users/:id', async () => {
    const res = await request(app)
      .delete(`/api/admin/users/${normalUser2.id}`)
      .send({ reason: 'Admin deletion audit test' })
      .set('Authorization', `Bearer ${adminToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, normalUser2.id);

    // Verify normalUser2 is now inactive and anonymized
    const user2InDb = await User.findByPk(normalUser2.id);
    assert.strictEqual(user2InDb.status, 'inactive');
    assert.strictEqual(user2InDb.name, 'Tài khoản đã xóa');
    assert.match(user2InDb.email, /^deleted_/);
  });

  await t.test('10. Audit log is written for both self-deletion and admin-deletion', async () => {
    const logs = await CompetitionAuditLog.findAll({
      where: {
        action: ['USER_SELF_DELETED', 'USER_DELETED_BY_ADMIN'],
      },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    assert.ok(logs.length >= 2, 'Should have at least 2 deletion audit logs');

    const adminLog = logs.find((l) => l.actorId === adminUser.id && String(l.entityId) === String(normalUser2.id));
    assert.ok(adminLog, 'Must find admin deletion log entry');
    assert.strictEqual(adminLog.action, 'USER_DELETED_BY_ADMIN');

    const selfLog = logs.find((l) => l.actorId === normalUser1.id && String(l.entityId) === String(normalUser1.id));
    assert.ok(selfLog, 'Must find self deletion log entry');
    assert.strictEqual(selfLog.action, 'USER_SELF_DELETED');
  });

  await t.test('11. Alternate self-delete route DELETE /api/users/me/account works as expected', async () => {
    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const tempUser = await User.create({
      name: `Temp Route User ${timestamp}`,
      email: `temp_route_${timestamp}@workrank.io`,
      passwordHash: 'hashed_temp_pass',
      role: 'user',
      status: 'active',
    });

    const tempToken = jwt.sign(
      { sub: tempUser.id, email: tempUser.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .delete('/api/users/me/account')
      .set('Authorization', `Bearer ${tempToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, tempUser.id);

    const userInDb = await User.findByPk(tempUser.id);
    assert.strictEqual(userInDb.status, 'inactive');
  });

  await t.test('12. Alternate self-delete route POST /api/auth/me/delete works as expected', async () => {
    const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const tempUser = await User.create({
      name: `Temp Post Route User ${timestamp}`,
      email: `temp_post_${timestamp}@workrank.io`,
      passwordHash: 'hashed_temp_pass',
      role: 'user',
      status: 'active',
    });

    const tempToken = jwt.sign(
      { sub: tempUser.id, email: tempUser.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/auth/me/delete')
      .set('Authorization', `Bearer ${tempToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, tempUser.id);

    const userInDb = await User.findByPk(tempUser.id);
    assert.strictEqual(userInDb.status, 'inactive');
  });
});
