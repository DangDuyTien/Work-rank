const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../src/app');
const env = require('../src/config/env');
const googleAuth = require('../src/services/googleAuth.service');
const { sequelize, User, GoogleAuthTicket } = require('../src/models');
const { hashToken } = require('../src/utils/token');

before(async () => {
  if (sequelize.getDialect() === 'sqlite' && sequelize.options.storage === ':memory:') {
    await sequelize.sync({ force: true });
  }
});

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

test('Google authentication creates, reuses, and safely links WorkRank accounts', async (t) => {
  const suffix = uniqueSuffix();
  const createdUsers = [];
  const testEmails = [];
  const defaultProfile = {
    sub: `google-sub-${suffix}`,
    email: `google_new_${suffix}@gmail.com`,
    name: 'Google Member',
    picture: 'https://lh3.googleusercontent.com/a/test-avatar',
  };
  testEmails.push(defaultProfile.email);

  t.after(async () => {
    const matchingUsers = await User.findAll({ where: { email: testEmails } });
    const userIds = [...new Set([...createdUsers, ...matchingUsers.map((user) => user.id)].map(String))];
    if (userIds.length) {
      await GoogleAuthTicket.destroy({ where: { userId: userIds } });
      await User.destroy({ where: { id: userIds } });
    }
  });

  await t.test('new Google identity gets a lowest-role account and a refreshable WorkRank session', async () => {
    const { ticket } = await googleAuth.beginVerifiedGoogleLogin(defaultProfile, '/leaderboard?range=weekly');
    const login = await googleAuth.exchangeTicket(ticket);
    const user = await User.unscoped().findOne({ where: { googleSub: defaultProfile.sub } });
    assert.ok(user);
    createdUsers.push(user.id);
    assert.equal(user.email, defaultProfile.email);
    assert.equal(user.role, 'user');
    assert.equal(user.profileStatus, 'incomplete');
    assert.equal(user.jobTitle, null);
    assert.equal(user.department, null);
    assert.equal(user.name, defaultProfile.name);
    assert.equal(user.avatarUrl, defaultProfile.picture);
    assert.equal(login.user.id, user.id);
    assert.equal(login.redirectTo, '/leaderboard?range=weekly');
    assert.equal(Object.hasOwn(login.user, 'googleSub'), false, 'the stable Google subject is not exposed in user payloads');

    const currentUser = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.accessToken}`);
    assert.equal(currentUser.status, 200);
    assert.equal(String(currentUser.body.user.id), String(user.id));
    assert.equal(Object.hasOwn(currentUser.body.user, 'googleSub'), false);

    const refreshed = await request(app).post('/api/auth/refresh-token').send({ refreshToken: login.refreshToken });
    assert.equal(refreshed.status, 200);
    assert.ok(refreshed.body.accessToken);
    const tokenPayload = jwt.verify(refreshed.body.accessToken, env.jwtSecret);
    assert.equal(String(tokenPayload.sub), String(user.id));

    await assert.rejects(googleAuth.exchangeTicket(ticket), (error) => error.statusCode === 401);
  });

  await t.test('an existing WorkRank email requires its password before Google can be linked', async () => {
    const existingEmail = `admin_old_${suffix}@workrank.test`;
    testEmails.push(existingEmail);
    const existingPassword = 'ExistingAdminPassword123!';
    const existing = await User.create({
      name: 'Existing WorkRank Admin',
      email: existingEmail,
      passwordHash: await bcrypt.hash(existingPassword, 10),
      role: 'admin',
      status: 'active',
      isVerified: true,
      avatarUrl: 'https://lh3.googleusercontent.com/a/old-avatar',
    });
    createdUsers.push(existing.id);
    const googleProfile = {
      sub: `google-admin-${suffix}`,
      email: existingEmail,
      name: 'Name supplied by Google',
      picture: 'https://lh3.googleusercontent.com/a/new-avatar',
    };

    const { ticket } = await googleAuth.beginVerifiedGoogleLogin(googleProfile, '/admin/privileges');
    const challenge = await googleAuth.exchangeTicket(ticket);
    assert.equal(challenge.linkRequired, true);
    assert.equal(challenge.email, existingEmail);
    assert.equal(Object.hasOwn(challenge, 'accessToken'), false);

    await assert.rejects(
      googleAuth.completeAccountLink(ticket, 'incorrect password'),
      (error) => error.statusCode === 401,
    );
    let stillUnlinked = await User.unscoped().findByPk(existing.id);
    assert.equal(stillUnlinked.googleSub, null);

    const linked = await googleAuth.completeAccountLink(ticket, existingPassword);
    const refreshed = await User.unscoped().findByPk(existing.id);
    assert.equal(linked.user.id, existing.id);
    assert.equal(refreshed.googleSub, googleProfile.sub);
    assert.equal(refreshed.role, 'admin');
    assert.equal(refreshed.name, 'Existing WorkRank Admin');
    assert.equal(refreshed.avatarUrl, 'https://lh3.googleusercontent.com/a/old-avatar');
    assert.equal(refreshed.isVerified, true);
    assert.equal(linked.redirectTo, '/admin/privileges');
    assert.equal(jwt.verify(linked.accessToken, env.jwtSecret).role, 'admin');

    const nextSignIn = await googleAuth.beginVerifiedGoogleLogin(googleProfile);
    const reused = await googleAuth.exchangeTicket(nextSignIn.ticket);
    assert.equal(String(reused.user.id), String(existing.id));
    assert.equal(reused.user.role, 'admin');
  });

  await t.test('locked accounts cannot use an existing Google link', async () => {
    const lockedEmail = `locked_${suffix}@gmail.com`;
    testEmails.push(lockedEmail);
    const locked = await User.create({
      name: 'Locked Google account',
      email: lockedEmail,
      passwordHash: await bcrypt.hash('UnusedPassword123!', 10),
      googleSub: `google-locked-${suffix}`,
      role: 'user',
      status: 'inactive',
    });
    createdUsers.push(locked.id);
    await assert.rejects(
      googleAuth.beginVerifiedGoogleLogin({ sub: locked.googleSub, email: lockedEmail, name: locked.name }),
      (error) => error.statusCode === 403 && error.code === 'ACCOUNT_LOCKED',
    );
  });

  await t.test('concurrent first sign-ins cannot create duplicate users for the same Google subject', async () => {
    const concurrentProfile = {
      sub: `google-concurrent-${suffix}`,
      email: `google_concurrent_${suffix}@gmail.com`,
      name: 'Concurrent Google User',
      picture: null,
    };
    testEmails.push(concurrentProfile.email);
    const results = await Promise.all([
      googleAuth.beginVerifiedGoogleLogin(concurrentProfile),
      googleAuth.beginVerifiedGoogleLogin(concurrentProfile),
    ]);
    const users = await User.unscoped().findAll({ where: { googleSub: concurrentProfile.sub } });
    assert.equal(users.length, 1);
    createdUsers.push(users[0].id);
    assert.equal(results.length, 2);
  });

  await t.test('redirect validation rejects external and scheme-relative destinations', async () => {
    assert.equal(googleAuth.safeInternalPath('/dashboard?tab=week#scores'), '/dashboard?tab=week#scores');
    assert.equal(googleAuth.safeInternalPath('//evil.example/path'), '/dashboard');
    assert.equal(googleAuth.safeInternalPath('https://evil.example/path'), '/dashboard');
    assert.equal(googleAuth.safeInternalPath('/\\\\evil.example/path'), '/dashboard');
  });

  await t.test('expired exchange tickets are rejected', async () => {
    const profile = { sub: `google-expired-${suffix}`, email: `expired_${suffix}@gmail.com`, name: 'Expired Ticket' };
    testEmails.push(profile.email);
    const { ticket } = await googleAuth.beginVerifiedGoogleLogin(profile);
    const row = await GoogleAuthTicket.findOne({ where: { tokenHash: hashToken(ticket) } });
    await row.update({ expiresAt: new Date(Date.now() - 1000) });
    await assert.rejects(googleAuth.exchangeTicket(ticket), (error) => error.statusCode === 401);
  });
});

test('Google OAuth setup gives a clear response when credentials are missing', { skip: googleAuth.isConfigured() }, async () => {
  const response = await request(app).get('/api/auth/google?returnTo=%2Fdashboard');
  assert.equal(response.status, 302);
  assert.match(response.headers.location, /authError=not_configured/);
});

test('Google authorization requests include a fresh OIDC state and nonce', () => {
  const originalConfig = {
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    redirectUri: env.googleRedirectUri,
  };
  try {
    env.googleClientId = 'workrank-test.apps.googleusercontent.com';
    env.googleClientSecret = 'test-only-secret';
    env.googleRedirectUri = 'http://localhost:5001/api/auth/google/callback';
    const first = googleAuth.createAuthRequest('/dashboard');
    const second = googleAuth.createAuthRequest('/dashboard');
    const url = new URL(first.url);

    assert.equal(url.origin, 'https://accounts.google.com');
    assert.equal(url.searchParams.get('client_id'), env.googleClientId);
    assert.equal(url.searchParams.get('redirect_uri'), env.googleRedirectUri);
    assert.equal(url.searchParams.get('response_type'), 'code');
    assert.equal(url.searchParams.get('state'), first.state);
    assert.equal(url.searchParams.get('nonce'), first.nonce);
    assert.notEqual(first.state, second.state);
    assert.notEqual(first.nonce, second.nonce);
    assert.deepEqual(url.searchParams.getAll('scope')[0].split(' '), ['openid', 'email', 'profile']);
    assert.equal(first.returnTo, '/dashboard');
  } finally {
    env.googleClientId = originalConfig.clientId;
    env.googleClientSecret = originalConfig.clientSecret;
    env.googleRedirectUri = originalConfig.redirectUri;
  }
});
