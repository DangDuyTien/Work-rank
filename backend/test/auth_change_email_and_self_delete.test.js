const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  User,
  Team,
  YouTubeChannel,
  CompetitionAuditLog,
} = require('../src/models');

test('Auth Change Email and Account Self-Deletion Comprehensive Test Suite', async (t) => {
  const timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const defaultPassword = 'Password123!';
  let passwordHash;

  let userA;
  let userB;
  let tokenA;
  let tokenB;

  before(async () => {
    passwordHash = await bcrypt.hash(defaultPassword, 10);

    userA = await User.create({
      name: `User Alpha ${timestamp}`,
      email: `alpha_${timestamp}@workrank.io`,
      passwordHash,
      role: 'user',
      status: 'active',
      isVerified: false,
      jobTitle: 'Content Creator',
      department: 'Media & Content',
    });

    userB = await User.create({
      name: `User Beta ${timestamp}`,
      email: `beta_${timestamp}@workrank.io`,
      passwordHash,
      role: 'user',
      status: 'active',
      isVerified: false,
      jobTitle: 'Video Editor',
      department: 'Media & Content',
    });

    tokenA = jwt.sign(
      { sub: userA.id, email: userA.email, role: userA.role },
      env.jwtSecret,
      { expiresIn: '1h' }
    );

    tokenB = jwt.sign(
      { sub: userB.id, email: userB.email, role: userB.role },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  // ==========================================
  // SECTION 1: CHANGE EMAIL TESTS
  // ==========================================

  await t.test('1. Unauthenticated request to change email returns 401', async () => {
    const res = await request(app)
      .patch('/api/auth/email')
      .send({
        newEmail: 'new_unauth@workrank.io',
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 401);
  });

  await t.test('2. Change email fails with wrong password (400)', async () => {
    const res = await request(app)
      .patch('/api/auth/email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail: `alpha_new_${timestamp}@workrank.io`,
        currentPassword: 'WrongPassword!',
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /mật khẩu.*không chính xác/i);

    // Verify DB not changed
    const userInDb = await User.findByPk(userA.id);
    assert.strictEqual(userInDb.email, `alpha_${timestamp}@workrank.io`);
  });

  await t.test('3. Change email fails when new email is identical to current email (400)', async () => {
    const res = await request(app)
      .patch('/api/auth/email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail: `alpha_${timestamp}@workrank.io`,
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /trùng với email hiện tại/i);
  });

  await t.test('4. Change email fails when new email belongs to another user (409 Conflict)', async () => {
    const res = await request(app)
      .patch('/api/auth/email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail: `beta_${timestamp}@workrank.io`,
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 409);
    assert.match(res.body.message, /đã được sử dụng/i);
  });

  await t.test('5. Change email fails with invalid email format (400)', async () => {
    const res = await request(app)
      .patch('/api/auth/email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail: 'invalid-email-format',
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 400);
  });

  await t.test('6. User A successfully changes email with correct password', async () => {
    const newEmail = `alpha_updated_${timestamp}@workrank.io`;

    const res = await request(app)
      .patch('/api/auth/email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail,
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.user.email, newEmail);
    assert.ok(res.body.accessToken, 'Must return rotated access token');

    // Verify Database state
    const userInDb = await User.findByPk(userA.id);
    assert.strictEqual(userInDb.email, newEmail);

    // Update local reference and token
    tokenA = res.body.accessToken;
    userA.email = newEmail;
  });

  await t.test('7. Login with old email fails (401)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `alpha_${timestamp}@workrank.io`,
        password: defaultPassword,
      });

    assert.strictEqual(res.status, 401);
  });

  await t.test('8. Login with new email succeeds (200)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: userA.email,
        password: defaultPassword,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, userA.email);
    assert.strictEqual(res.body.user.id, userA.id);
  });

  await t.test('9. Alternate POST route /api/auth/change-email works', async () => {
    const newEmail2 = `alpha_changed_again_${timestamp}@workrank.io`;

    const res = await request(app)
      .post('/api/auth/change-email')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        newEmail: newEmail2,
        currentPassword: defaultPassword,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, newEmail2);

    const userInDb = await User.findByPk(userA.id);
    assert.strictEqual(userInDb.email, newEmail2);
    tokenA = res.body.accessToken;
    userA.email = newEmail2;
  });

  // ==========================================
  // SECTION 2: SELF-DELETION WITH PASSWORD
  // ==========================================

  await t.test('10. Self-deletion fails when password is wrong', async () => {
    const res = await request(app)
      .delete('/api/auth/me/account')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ password: 'IncorrectPassword' });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /mật khẩu.*không chính xác/i);

    // Verify userB is still active in database
    const userInDb = await User.findByPk(userB.id);
    assert.strictEqual(userInDb.status, 'active');
  });

  await t.test('11. User B successfully self-deletes account with correct password', async () => {
    const res = await request(app)
      .delete('/api/auth/me/account')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ password: defaultPassword });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, userB.id);

    // Verify Database state: status is inactive, PII anonymized
    const userInDb = await User.findByPk(userB.id);
    assert.strictEqual(userInDb.status, 'inactive');
    assert.strictEqual(userInDb.name, 'Tài khoản đã xóa');
    assert.match(userInDb.email, /^deleted_/);
    assert.strictEqual(userInDb.phone, null);
    assert.strictEqual(userInDb.bio, null);
  });

  await t.test('12. Inactive/deleted user cannot log in', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: `beta_${timestamp}@workrank.io`,
        password: defaultPassword,
      });

    assert.strictEqual(res.status, 401);
  });

  await t.test('13. Inactive/deleted user token is rejected on protected routes', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokenB}`);

    assert.strictEqual(res.status, 403);
  });
});
