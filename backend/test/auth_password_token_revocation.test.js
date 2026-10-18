'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const app = require('../src/app');
const { sequelize, User } = require('../src/models');

test('BUG-003 Remediation: Refresh credentials must be revoked after password change', async (t) => {
  const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const initialPassword = 'InitialPassword123!';
  const updatedPassword = 'UpdatedPassword456!';
  const userEmail = `auth_revocation_${timestamp}@workrank.test`;

  let testUser;
  let tokenSetA;
  let tokenSetB;

  before(async () => {
    // In SQLite in-memory, sync tables. In MySQL, ensure token_version column exists.
    if (sequelize.getDialect() === 'sqlite') {
      await sequelize.sync();
    } else {
      const queryInterface = sequelize.getQueryInterface();
      try {
        const tableInfo = await queryInterface.describeTable('users');
        if (!tableInfo.token_version) {
          await queryInterface.addColumn('users', 'token_version', {
            type: sequelize.Sequelize.INTEGER.UNSIGNED,
            allowNull: false,
            defaultValue: 0,
          });
        }
      } catch {
        await User.sync();
      }
    }

    const passwordHash = await bcrypt.hash(initialPassword, 10);
    testUser = await User.create({
      name: `Revocation Tester ${timestamp}`,
      email: userEmail,
      passwordHash,
      role: 'user',
      status: 'active',
      isVerified: true,
      tokenVersion: 0,
    });
  });

  after(async () => {
    if (testUser?.id) {
      await User.destroy({ where: { id: testUser.id } }).catch(() => {});
    }
  });

  await t.test('1. User logs in with initial password and receives TokenSet A', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: initialPassword });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken, 'Must return accessToken');
    assert.ok(res.body.refreshToken, 'Must return refreshToken');

    tokenSetA = {
      accessToken: res.body.accessToken,
      refreshToken: res.body.refreshToken,
    };
  });

  await t.test('2. TokenSet A refresh token is initially valid and can issue new tokens', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: tokenSetA.refreshToken });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken, 'Must return fresh accessToken');
    assert.ok(res.body.refreshToken, 'Must return fresh refreshToken');
  });

  await t.test('3. User changes password via PATCH /api/auth/password with valid current password', async () => {
    const res = await request(app)
      .patch('/api/auth/password')
      .set('Authorization', `Bearer ${tokenSetA.accessToken}`)
      .send({
        currentPassword: initialPassword,
        newPassword: updatedPassword,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.ok, true);
    assert.ok(res.body.accessToken, 'Must return fresh accessToken for caller');
    assert.ok(res.body.refreshToken, 'Must return fresh refreshToken for caller');

    tokenSetB = {
      accessToken: res.body.accessToken,
      refreshToken: res.body.refreshToken,
    };

    // Verify user tokenVersion was incremented in the database
    const refreshedUser = await User.findByPk(testUser.id);
    assert.ok(refreshedUser.tokenVersion > 0, 'User tokenVersion must be incremented');
  });

  await t.test('4. TokenSet A refresh token MUST now be rejected with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: tokenSetA.refreshToken });

    assert.strictEqual(res.status, 401, 'Old refresh token must be rejected with 401');
    assert.match(
      res.body.message || '',
      /thu hồi|hết hạn|invalid|expired/i,
      'Error message should indicate token revocation or expiration'
    );
  });

  await t.test('5. TokenSet B refresh token (issued during password change) is valid and succeeds', async () => {
    const res = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: tokenSetB.refreshToken });

    assert.strictEqual(res.status, 200, 'Fresh refresh token must be accepted');
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
  });

  await t.test('6. Login with old password fails with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: initialPassword });

    assert.strictEqual(res.status, 401);
  });

  await t.test('7. Login with new password succeeds with 200 OK and valid tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: userEmail, password: updatedPassword });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);

    // Verify the newly obtained refresh token can refresh
    const refreshRes = await request(app)
      .post('/api/auth/refresh-token')
      .send({ refreshToken: res.body.refreshToken });

    assert.strictEqual(refreshRes.status, 200);
  });
});
