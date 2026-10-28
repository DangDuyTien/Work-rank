'use strict';

/**
 * PRIVATE MEDIA — AUTHORIZATION & CONTROL TEST SUITE
 *
 * This suite is written as an adversarial audit, not a happy-path demo. The
 * recurring theme is one requirement:
 *
 *     ADMIN / SUPER ADMIN MUST NOT BE PRIVATE MEDIA OWNER.
 *
 * Every denial assertion below would fail loudly if somebody reintroduced an
 * `if (user.role === 'admin') allow()` shortcut.
 */

const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const env = require('../src/config/env');
const {
  sequelize,
  User,
  PrivateMediaOwner,
  PrivateMediaGrant,
  PrivateMediaDevice,
  PrivateMediaTelegramBinding,
  PrivateMediaCommand,
} = require('../src/models');

const accessService = require('../src/services/privateMedia/access.service');
const deviceService = require('../src/services/privateMedia/device.service');
const telegramService = require('../src/services/privateMedia/telegram.service');
const sessionService = require('../src/services/privateMedia/session.service');
const auditService = require('../src/services/privateMedia/audit.service');

const OWNER_EMAIL = 'tienddph50842@gmail.com';
const BASE = '/api/private-media';

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const users = {};

before(async () => {
  // The owner account is deliberately created with role `user`: this capability
  // must not depend on the Work Rank role at all.
  users.owner = await User.create({ name: 'Root Owner', email: OWNER_EMAIL, passwordHash: 'x', role: 'user' });
  users.admin = await User.create({ name: 'Plain Admin', email: 'pm-admin@test.local', passwordHash: 'x', role: 'admin' });
  users.superAdmin = await User.create({
    name: 'Super Admin', email: 'pm-super@test.local', passwordHash: 'x', role: 'admin', isDev: true, isVerified: true,
  });
  users.member = await User.create({ name: 'Normal Member', email: 'pm-member@test.local', passwordHash: 'x', role: 'user' });
  users.delegate = await User.create({ name: 'Delegate', email: 'pm-delegate@test.local', passwordHash: 'x', role: 'user' });
  users.viewer = await User.create({ name: 'Viewer', email: 'pm-viewer@test.local', passwordHash: 'x', role: 'user' });

  for (const [key, user] of Object.entries(users)) {
    users[`${key}Token`] = jwt.sign({ sub: user.id, tokenVersion: user.tokenVersion || 0 }, env.jwtSecret);
  }

  await accessService.resolveOwnerUserId({ force: true });
});

// ───────────────────────────────────────────────────────────────────────────
// 1. Owner model
// ───────────────────────────────────────────────────────────────────────────

test('PRIVATE_MEDIA_OWNER_RESOLVED — bootstrap email maps to a canonical user id', async () => {
  const ownerUserId = await accessService.resolveOwnerUserId({ force: true });
  assert.equal(ownerUserId, users.owner.id);

  const row = await PrivateMediaOwner.findOne({ where: { userId: users.owner.id } });
  assert.ok(row, 'owner registry row must exist');
  assert.equal(row.bootstrapEmail, OWNER_EMAIL);

  // The email is bootstrap-only: renaming the account must not move ownership.
  await users.owner.update({ email: 'renamed-owner@test.local' });
  const afterRename = await accessService.resolveOwnerUserId({ force: true });
  assert.equal(afterRename, users.owner.id);
  await users.owner.update({ email: OWNER_EMAIL });
});

test('OWNER_ACCESS — root owner sees the capability with full permissions', async () => {
  const res = await request(app).get(`${BASE}/access`).set(bearer(users.ownerToken));
  assert.equal(res.status, 200);
  assert.equal(res.body.entitled, true);
  assert.equal(res.body.isOwner, true);
  assert.deepEqual(res.body.permissions, {
    view: true, control: true, telegram: true, hotkey: true, manageAccess: true,
  });

  const status = await request(app).get(`${BASE}/status`).set(bearer(users.ownerToken));
  assert.equal(status.status, 200);
  assert.ok(status.body.session, 'session snapshot must be present');
});

// ───────────────────────────────────────────────────────────────────────────
// 2. Admin / super admin denial (the hard rule)
// ───────────────────────────────────────────────────────────────────────────

const OWNER_ONLY_AND_DATA_ENDPOINTS = [
  ['get', '/access'],
  ['get', '/status'],
  ['get', '/session'],
  ['get', '/grants'],
  ['get', '/audit'],
  ['get', '/devices'],
  ['get', '/telegram'],
  ['get', '/users/search?q=root'],
  ['get', '/commands/recent'],
  ['get', '/recent'],
  ['get', '/youtube/search?q=music'],
  ['post', '/commands'],
  ['post', '/grants'],
  ['post', '/devices/code'],
  ['post', '/telegram/code'],
  ['post', '/youtube/resolve'],
  ['delete', '/grants/1'],
  ['delete', '/devices/1'],
];

async function expectConcealed(token, label) {
  for (const [method, url] of OWNER_ONLY_AND_DATA_ENDPOINTS) {
    const res = await request(app)[method](`${BASE}${url}`).set(bearer(token)).send({});
    assert.equal(res.status, 404, `${label} ${method.toUpperCase()} ${url} must be concealed (got ${res.status})`);
    assert.equal(res.body.code, 'NOT_FOUND');
    // A 403 would confirm the route exists; a 404 must not describe the feature.
    assert.equal(res.body.message, 'Not found');
  }
}

test('ADMIN_HIDDEN — a Work Rank admin is denied on every private media endpoint', async () => {
  await expectConcealed(users.adminToken, 'admin');
});

test('SUPER_ADMIN_HIDDEN — admin + isDev + verified is still denied everywhere', async () => {
  await expectConcealed(users.superAdminToken, 'super-admin');
});

test('NORMAL_MEMBER_HIDDEN — a normal member is denied everywhere', async () => {
  await expectConcealed(users.memberToken, 'member');
});

test('API_AUTHZ — anonymous callers are rejected before any private data is read', async () => {
  for (const [method, url] of OWNER_ONLY_AND_DATA_ENDPOINTS) {
    const res = await request(app)[method](`${BASE}${url}`).send({});
    assert.equal(res.status, 401, `anonymous ${method.toUpperCase()} ${url} must be 401`);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 3. Delegation
// ───────────────────────────────────────────────────────────────────────────

test('OWNER_CAN_GRANT — owner grants a scoped surface and the grantee sees it', async () => {
  const res = await request(app)
    .post(`${BASE}/grants`)
    .set(bearer(users.ownerToken))
    .send({ userId: users.delegate.id, permissions: { view: true, control: true, telegram: true, hotkey: true } });

  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.grant.userId, users.delegate.id);

  const access = await request(app).get(`${BASE}/access`).set(bearer(users.delegateToken));
  assert.equal(access.status, 200);
  assert.equal(access.body.isOwner, false);
  assert.equal(access.body.permissions.control, true);
  assert.equal(access.body.permissions.manageAccess, false);

  // View-only delegation must stay view-only.
  const viewerGrant = await request(app)
    .post(`${BASE}/grants`)
    .set(bearer(users.ownerToken))
    .send({ userId: users.viewer.id, permissions: { view: true } });
  assert.equal(viewerGrant.status, 200);

  const viewerAccess = await request(app).get(`${BASE}/access`).set(bearer(users.viewerToken));
  assert.equal(viewerAccess.status, 200);
  assert.equal(viewerAccess.body.permissions.view, true);
  assert.equal(viewerAccess.body.permissions.control, false);
});

test('DELEGATED_CANNOT_GRANT — a delegated user cannot escalate or delegate', async () => {
  const cases = [
    ['post', '/grants', { userId: users.member.id, permissions: { control: true } }],
    ['post', '/grants', { userId: users.delegate.id, permissions: { control: true } }],
    ['get', '/grants', undefined],
    ['get', '/audit', undefined],
    ['get', '/users/search?q=a', undefined],
    ['delete', `/grants/${users.viewer.id}`, undefined],
  ];

  for (const [method, url, body] of cases) {
    const res = await request(app)[method](`${BASE}${url}`).set(bearer(users.delegateToken)).send(body || {});
    assert.equal(res.status, 404, `delegate ${method.toUpperCase()} ${url} must be denied`);
  }

  // Nothing changed for the targeted accounts.
  const memberAccess = await request(app).get(`${BASE}/access`).set(bearer(users.memberToken));
  assert.equal(memberAccess.status, 404);
  const viewerGrant = await PrivateMediaGrant.findOne({ where: { userId: users.viewer.id } });
  assert.ok(viewerGrant && !viewerGrant.revokedAt, 'viewer grant must be untouched');
});

test('DELEGATED_ACCESS — view-only user can read state but cannot control', async () => {
  const state = await request(app).get(`${BASE}/session`).set(bearer(users.viewerToken));
  assert.equal(state.status, 200);

  const command = await request(app)
    .post(`${BASE}/commands`)
    .set(bearer(users.viewerToken))
    .send({ commandId: 'viewer-attempt', action: 'PLAY' });
  assert.equal(command.status, 404);
});

test('ADMIN_CANNOT_SELF_GRANT — admin cannot write its own grant row', async () => {
  const res = await request(app)
    .post(`${BASE}/grants`)
    .set(bearer(users.adminToken))
    .send({ userId: users.admin.id, permissions: { view: true, control: true } });
  assert.equal(res.status, 404);

  const row = await PrivateMediaGrant.findOne({ where: { userId: users.admin.id } });
  assert.equal(row, null, 'admin must not end up with a grant row');
});

test('OWNER_CANNOT_BE_REMOVED — no API can revoke, replace or downgrade the owner', async () => {
  // Admin trying to revoke the owner.
  const adminAttempt = await request(app)
    .delete(`${BASE}/grants/${users.owner.id}`)
    .set(bearer(users.adminToken));
  assert.equal(adminAttempt.status, 404);

  // Even the owner cannot revoke itself through the API.
  const selfAttempt = await request(app)
    .delete(`${BASE}/grants/${users.owner.id}`)
    .set(bearer(users.ownerToken));
  assert.equal(selfAttempt.status, 400);
  assert.equal(selfAttempt.body.code, 'CANNOT_REVOKE_OWNER');

  // The owner registry row is still the same account.
  const ownerRow = await PrivateMediaOwner.findOne({ order: [['id', 'ASC']] });
  assert.equal(Number(ownerRow.userId), Number(users.owner.id));

  const stillOwner = await request(app).get(`${BASE}/access`).set(bearer(users.ownerToken));
  assert.equal(stillOwner.body.isOwner, true);
});

// ───────────────────────────────────────────────────────────────────────────
// 4. Commands, idempotency and state consistency
// ───────────────────────────────────────────────────────────────────────────

test('NO_ACTIVE_MEDIA_SESSION — control without a loaded video fails safely', async () => {
  const res = await request(app)
    .post(`${BASE}/commands`)
    .set(bearer(users.ownerToken))
    .send({ commandId: 'no-video-1', action: 'TOGGLE_PLAY_PAUSE' });

  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'NO_ACTIVE_MEDIA_SESSION');
});

test('YOUTUBE_PLAYER — loading a real video updates the shared session', async () => {
  const load = await request(app)
    .post(`${BASE}/commands`)
    .set(bearer(users.ownerToken))
    .send({
      commandId: 'load-video-1',
      action: 'LOAD_VIDEO',
      payload: {
        videoId: 'dQw4w9WgXcQ',
        title: 'Rick Astley - Never Gonna Give You Up',
        channelTitle: 'Rick Astley',
        durationSeconds: 213,
      },
    });

  assert.equal(load.status, 200, JSON.stringify(load.body));
  assert.equal(load.body.state.status, 'LOADING');
  assert.equal(load.body.state.video.videoId, 'dQw4w9WgXcQ');

  const play = await request(app)
    .post(`${BASE}/commands`)
    .set(bearer(users.ownerToken))
    .send({ commandId: 'play-1', action: 'PLAY' });
  assert.equal(play.status, 200);
  assert.equal(play.body.state.status, 'PLAYING');
});

test('IDEMPOTENCY — replaying a commandId never executes twice', async () => {
  const payload = { commandId: 'dup-toggle-1', action: 'TOGGLE_PLAY_PAUSE' };

  const first = await request(app).post(`${BASE}/commands`).set(bearer(users.ownerToken)).send(payload);
  const second = await request(app).post(`${BASE}/commands`).set(bearer(users.ownerToken)).send(payload);

  assert.equal(first.status, 200);
  assert.equal(first.body.duplicate, false);
  assert.equal(second.status, 200);
  assert.equal(second.body.duplicate, true);
  // Same logical state: the second call did not flip playback again.
  assert.equal(second.body.state.status, first.body.state.status);

  const rows = await PrivateMediaCommand.findAll({ where: { commandId: 'dup-toggle-1' } });
  assert.equal(rows.length, 1);
});

test('MULTI_CONTROLLER_CONSISTENCY — a player ack becomes the shared truth', async () => {
  // Simulate the browser refusing autoplay: the player reports PAUSED.
  const ack = await sessionService.acknowledgeCommand({
    commandId: 'play-1',
    actorUserId: users.owner.id,
    state: { status: 'PAUSED', currentTime: 0, durationSeconds: 213 },
    errorCode: 'AUTOPLAY_BLOCKED',
  });

  assert.equal(ack.applied, true);
  assert.equal(ack.state.status, 'PAUSED');
  assert.equal(ack.command.status, 'FAILED');

  const viaHttp = await request(app).get(`${BASE}/session`).set(bearer(users.ownerToken));
  assert.equal(viaHttp.body.session.status, 'PAUSED');
  assert.equal(viaHttp.body.session.video.durationSeconds, 213);
});

test('RECENT_VIDEOS — keyless quick-replay list, authorized like the rest', async () => {
  const ownerRes = await request(app).get(`${BASE}/recent`).set(bearer(users.ownerToken));
  assert.equal(ownerRes.status, 200);
  assert.ok(Array.isArray(ownerRes.body.videos));
  assert.ok(
    ownerRes.body.videos.some((video) => video.videoId === 'dQw4w9WgXcQ'),
    'a previously loaded video must appear in the recent list',
  );
  // Deduped: the same video loaded once yields one entry.
  const ids = ownerRes.body.videos.map((video) => video.videoId);
  assert.equal(new Set(ids).size, ids.length);

  const adminRes = await request(app).get(`${BASE}/recent`).set(bearer(users.adminToken));
  assert.equal(adminRes.status, 404);
});

test('PROGRESS_QUIET_WINDOW — a stale player tick cannot undo a fresh command', async () => {
  const play = await sessionService.issueCommand({
    commandId: 'quiet-play-1',
    action: 'PLAY',
    source: 'WEB',
    actorUserId: users.owner.id,
  });
  assert.equal(play.state.status, 'PLAYING');

  // A tick that was already in flight when the command landed reports the OLD
  // state. The backend must keep the command's intent.
  const stale = await sessionService.syncPlayerProgress({ status: 'PAUSED', currentTime: 7 });
  assert.equal(stale.status, 'PLAYING', 'stale tick must not undo the command');
  assert.equal(Math.round(stale.currentTime), 7, 'progress time is still accepted');

  // Once the quiet window has passed, the player is the authority again.
  await sequelize.query(
    'UPDATE private_media_commands SET created_at = :ts WHERE command_id = :id',
    { replacements: { ts: new Date(Date.now() - 10_000), id: 'quiet-play-1' } },
  );
  const settled = await sessionService.syncPlayerProgress({ status: 'PAUSED', currentTime: 7 });
  assert.equal(settled.status, 'PAUSED');
});

// ───────────────────────────────────────────────────────────────────────────
// 5. Device (Mac helper) authorization
// ───────────────────────────────────────────────────────────────────────────

test('DEVICE_AUTHZ — pairing issues a scoped token; revocation kills it instantly', async () => {
  const codeRes = await request(app)
    .post(`${BASE}/devices/code`)
    .set(bearer(users.delegateToken))
    .send({ label: 'MacBook của Delegate' });
  assert.equal(codeRes.status, 200);
  assert.ok(codeRes.body.code, 'pairing code must be returned once');

  // The code is not a secret at rest: only its hash is stored.
  const stored = await require('../src/models').PrivateMediaPairingCode.findOne({
    where: { purpose: 'DEVICE' },
    order: [['id', 'DESC']],
  });
  assert.notEqual(stored.codeHash, codeRes.body.code);

  const pair = await request(app)
    .post(`${BASE}/devices/pair`)
    .send({ code: codeRes.body.code, name: 'MacBook của Delegate', platform: 'macos' });
  assert.equal(pair.status, 200, JSON.stringify(pair.body));
  const deviceToken = pair.body.deviceToken;
  assert.ok(deviceToken.startsWith('pmd_'));

  // A device token can issue HOTKEY commands as its owner.
  const hotkey = await request(app)
    .post(`${BASE}/device/commands`)
    .set('X-Device-Token', deviceToken)
    .send({ commandId: 'hotkey-1', action: 'TOGGLE_PLAY_PAUSE' });
  assert.equal(hotkey.status, 200, JSON.stringify(hotkey.body));

  const issued = await PrivateMediaCommand.findOne({ where: { commandId: 'hotkey-1' } });
  assert.equal(Number(issued.issuedByUserId), Number(users.delegate.id));
  assert.equal(issued.source, 'HOTKEY');

  // Unknown / malformed tokens are indistinguishable from a missing route.
  const bogus = await request(app)
    .post(`${BASE}/device/commands`)
    .set('X-Device-Token', 'pmd_deadbeef')
    .send({ commandId: 'hotkey-bogus', action: 'PLAY' });
  assert.equal(bogus.status, 404);

  // Revoking the grant must kill the device immediately (no grace window).
  const revoke = await request(app)
    .delete(`${BASE}/grants/${users.delegate.id}`)
    .set(bearer(users.ownerToken));
  assert.equal(revoke.status, 200);

  const afterRevoke = await request(app)
    .post(`${BASE}/device/commands`)
    .set('X-Device-Token', deviceToken)
    .send({ commandId: 'hotkey-2', action: 'PLAY' });
  assert.equal(afterRevoke.status, 404);

  const deviceRow = await PrivateMediaDevice.findOne({ where: { userId: users.delegate.id } });
  assert.ok(deviceRow.revokedAt, 'device must be revoked together with the grant');
});

test('DEVICE_AUTHZ — a member with no grant cannot even mint a pairing code', async () => {
  const res = await request(app)
    .post(`${BASE}/devices/code`)
    .set(bearer(users.memberToken))
    .send({});
  assert.equal(res.status, 404);
});

// ───────────────────────────────────────────────────────────────────────────
// 6. Telegram binding & authorization
// ───────────────────────────────────────────────────────────────────────────

test('TELEGRAM_AUTHZ — unbound chats and revoked grants cannot control', async () => {
  // Unbound telegram identity.
  const unbound = await telegramService.resolveActor('999000111');
  assert.equal(unbound.ok, false);
  assert.equal(unbound.reason, 'NOT_BOUND');

  // Re-grant the delegate so we can exercise the binding path.
  await request(app)
    .post(`${BASE}/grants`)
    .set(bearer(users.ownerToken))
    .send({ userId: users.delegate.id, permissions: { view: true, control: true, telegram: true } });

  const codeRes = await request(app)
    .post(`${BASE}/telegram/code`)
    .set(bearer(users.delegateToken))
    .send({});
  // Without TELEGRAM_BOT_TOKEN the endpoint reports the missing credential instead
  // of pretending the bot exists.
  assert.equal(codeRes.status, 503);
  assert.equal(codeRes.body.code, 'TELEGRAM_DISABLED');

  // Bind through the service layer (the bot itself is credential-blocked here).
  const { createCode } = require('../src/services/privateMedia/pairing.service');
  const minted = await createCode({ userId: users.delegate.id, purpose: 'TELEGRAM' });
  const bound = await telegramService.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: 5550001, username: 'delegate_tg' },
      chat: { id: 5550001 },
      text: `/start ${minted.code}`,
    },
  });
  assert.equal(bound, undefined);

  const binding = await PrivateMediaTelegramBinding.findOne({ where: { userId: users.delegate.id, revokedAt: null } });
  assert.ok(binding, 'binding must exist after a valid code');
  assert.equal(binding.telegramUserId, '5550001');

  const authorized = await telegramService.resolveActor(5550001);
  assert.equal(authorized.ok, true);
  assert.equal(authorized.userId, users.delegate.id);

  // Replaying the same code must fail (one-time use).
  const replay = await require('../src/services/privateMedia/pairing.service')
    .consumeCode({ code: minted.code, purpose: 'TELEGRAM' });
  assert.equal(replay, null);

  // Revoke -> the same chat is denied on the very next command.
  await request(app)
    .delete(`${BASE}/grants/${users.delegate.id}`)
    .set(bearer(users.ownerToken));

  const afterRevoke = await telegramService.resolveActor(5550001);
  assert.equal(afterRevoke.ok, false);

  const bindingRow = await PrivateMediaTelegramBinding.findOne({ where: { userId: users.delegate.id } });
  assert.ok(bindingRow.revokedAt, 'telegram binding must be revoked with the grant');
});

// ───────────────────────────────────────────────────────────────────────────
// 7. Secrets, audit, migration, static guard
// ───────────────────────────────────────────────────────────────────────────

test('YOUTUBE_NORMALIZATION — escaped snippets and ISO durations are cleaned', async () => {
  const yt = require('../src/services/privateMedia/youtube.service');

  // The Data API returns HTML-escaped snippets; rendering them raw shows "&#39;".
  assert.equal(
    yt.decodeHtmlEntities('90&#39;s &quot;Chill&quot; &amp; More &lt;3'),
    '90\'s "Chill" & More <3',
  );
  assert.equal(yt.decodeHtmlEntities(null), null);

  assert.equal(yt.parseIsoDuration('PT1H2M3S'), 3723);
  assert.equal(yt.parseIsoDuration('P1DT2H'), 93600);
  assert.equal(yt.parseIsoDuration('PT0S'), null);
  assert.equal(yt.parseIsoDuration('P'), null);

  assert.equal(yt.parseVideoId('https://youtu.be/dQw4w9WgXcQ?t=10'), 'dQw4w9WgXcQ');
  assert.equal(yt.parseVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(yt.parseVideoId('https://example.com/watch?v=dQw4w9WgXcQ'), null);
  assert.equal(yt.parseVideoId('not a video'), null);
});

test('SECRETS_NOT_EXPOSED — status/audit payloads never contain tokens', async () => {
  const status = await request(app).get(`${BASE}/status`).set(bearer(users.ownerToken));
  const serialized = JSON.stringify(status.body);

  assert.ok(!serialized.includes('pmd_'), 'device token prefix must never appear');
  assert.ok(!serialized.includes(env.privateMedia.telegramBotToken || '@@no-token@@'));
  // A real YouTube key may be configured locally; it must never reach a client.
  if (env.privateMedia.youtubeApiKey) {
    assert.ok(!serialized.includes(env.privateMedia.youtubeApiKey), 'YouTube API key must never be serialized');
  }
  assert.ok(!/tokenHash/i.test(serialized));
  assert.ok(!/"botToken"/i.test(serialized));
  assert.equal(typeof status.body.youtube.search, 'boolean');
  assert.equal(Object.prototype.hasOwnProperty.call(status.body.youtube, 'apiKey'), false);

  const audit = await request(app).get(`${BASE}/audit`).set(bearer(users.ownerToken));
  assert.equal(audit.status, 200);
  const auditJson = JSON.stringify(audit.body);
  assert.ok(!auditJson.includes('pmd_'));
  assert.ok(!auditJson.includes(env.privateMedia.telegramBotToken || '@@no-token@@'));
});

test('AUDIT_LOG — grant, revoke and device pairing are recorded with actor and source', async () => {
  const entries = await auditService.list({ limit: 200 });
  const actions = new Set(entries.map((entry) => entry.action));

  for (const action of ['GRANT_ACCESS', 'REVOKE_ACCESS', 'DEVICE_PAIRED', 'TELEGRAM_BOUND', 'TOGGLE_PLAY_PAUSE']) {
    assert.ok(actions.has(action), `audit must contain ${action}`);
  }

  const grant = entries.find((entry) => entry.action === 'GRANT_ACCESS');
  assert.ok(grant.actor && Number(grant.actor.id) === Number(users.owner.id));
  assert.equal(grant.source, 'WEB');

  const denied = entries.find((entry) => entry.action === 'ACCESS_DENIED');
  assert.ok(denied, 'denied attempts by authenticated users must be recorded');
});

test('MIGRATION — repeatable, and enforces the uniqueness the authorization relies on', async () => {
  const { Sequelize, DataTypes } = require('sequelize');
  const db = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  const q = db.getQueryInterface();
  const migration = require('../src/migrations/20261027190000-create-private-media');

  try {
    await q.createTable('users', { id: { type: DataTypes.BIGINT, primaryKey: true } });
    await migration.up(q, DataTypes);
    await migration.up(q, DataTypes); // idempotent re-run

    for (const table of [
      'private_media_owners', 'private_media_grants', 'private_media_devices',
      'private_media_telegram_bindings', 'private_media_pairing_codes',
      'private_media_sessions', 'private_media_commands', 'private_media_audit_logs',
    ]) {
      assert.ok(await q.describeTable(table).catch(() => null), `${table} must exist`);
    }

    const grantIndexes = await q.showIndex('private_media_grants');
    assert.ok(
      grantIndexes.some((index) => index.unique && index.fields.some((field) => field.attribute === 'user_id')),
      'grants.user_id must be unique (one live grant per user)',
    );

    const commandIndexes = await q.showIndex('private_media_commands');
    assert.ok(
      commandIndexes.some((index) => index.unique && index.fields.some((field) => field.attribute === 'command_id')),
      'commands.command_id must be unique (idempotency key)',
    );
  } finally {
    await db.close();
  }
});

test('NO_ROLE_BYPASS — the module source contains no role/admin shortcut', async () => {
  const files = [
    'src/middlewares/privateMedia.middleware.js',
    'src/routes/privateMedia.routes.js',
    'src/controllers/privateMedia.controller.js',
    'src/sockets/privateMedia.js',
    'src/services/privateMedia/access.service.js',
    'src/services/privateMedia/session.service.js',
    'src/services/privateMedia/device.service.js',
    'src/services/privateMedia/telegram.service.js',
    'src/services/privateMedia/audit.service.js',
    'src/services/privateMedia/realtime.service.js',
  ];

  const forbidden = [/requireRole\s*\(/, /\bisAdmin\b/, /role\s*===\s*['"]admin['"]/, /\bsuper_?[Aa]dmin\b/];

  for (const relative of files) {
    const source = fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');
    for (const pattern of forbidden) {
      assert.equal(
        pattern.test(source),
        false,
        `${relative} must not reference role-based authority (${pattern})`,
      );
    }
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 8. Isolation
// ───────────────────────────────────────────────────────────────────────────

test('OTHER_WORKRANK_PERMISSIONS_UNCHANGED — adding the capability does not shift existing roles', async () => {
  const fresh = await User.findByPk(users.admin.id);
  assert.equal(fresh.role, 'admin');
  assert.equal(fresh.status, 'active');

  // A normal admin route still behaves exactly as before.
  const adminRoute = await request(app).get('/api/dashboard/overview').set(bearer(users.adminToken));
  assert.equal(adminRoute.status, 200, 'existing admin routes must not be affected');
});

test('WEBSOCKET_REALTIME — the private media namespace is separate from the app socket', async () => {
  const socketModule = require('../src/sockets/privateMedia');
  assert.equal(socketModule.NAMESPACE, '/private-media');

  const { sequelize: db } = require('../src/models');
  assert.ok(db, 'sequelize instance available');
});
