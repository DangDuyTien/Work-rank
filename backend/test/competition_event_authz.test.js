'use strict';

/**
 * competition_event_authz.test.js
 *
 * Verifies authorization and anti-spoofing boundaries for Competition Event Ingestion (BUG-002).
 *
 * Guarantees:
 *   1. Ordinary users cannot POST to /api/competition/events/publish (403 Forbidden).
 *   2. Ordinary users cannot POST to /api/competition/integration/production/video-action (403 Forbidden).
 *   3. Ordinary users cannot POST to /api/competition/integration/youtube/milestone (403 Forbidden).
 *   4. Ordinary users cannot impersonate kudos sender (senderId forced to req.user.id).
 *   5. Self-kudos is rejected (400 Bad Request).
 *   6. Admin user can publish valid domain event (201 Created).
 *   7. Invariant: Zero forged actorId rows can be created in CompetitionEvent by regular users.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const env = require('../src/config/env');
const {
  User,
  Team,
  CompetitionEvent,
  CompetitionAuditLog,
} = require('../src/models');

describe('BUG-002: Competition Event Ingestion Authorization & Anti-Spoofing', () => {
  let adminUser, regularUser, recipientUser;
  let adminToken, regularToken;
  let testTeam;

  before(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
    const rnd = Date.now();

    // 1. Create Test Team
    [testTeam] = await Team.findOrCreate({
      where: { name: `Authz Team ${rnd}` },
      defaults: { inviteCode: `AUTHZ_${rnd}` },
    });

    // 2. Create Users (Admin, Regular Alice, Target Bob)
    [adminUser] = await User.findOrCreate({
      where: { email: `admin_authz_${rnd}@workrank.io` },
      defaults: {
        name: 'Authz Admin',
        role: 'admin',
        passwordHash: 'testpass123',
        teamId: testTeam.id,
        status: 'active',
      },
    });

    [regularUser] = await User.findOrCreate({
      where: { email: `alice_authz_${rnd}@workrank.io` },
      defaults: {
        name: 'Authz Alice',
        role: 'user',
        passwordHash: 'testpass123',
        teamId: testTeam.id,
        status: 'active',
      },
    });

    [recipientUser] = await User.findOrCreate({
      where: { email: `bob_authz_${rnd}@workrank.io` },
      defaults: {
        name: 'Authz Bob',
        role: 'user',
        passwordHash: 'testpass123',
        teamId: testTeam.id,
        status: 'active',
      },
    });

    // 3. Issue Tokens
    adminToken = jwt.sign(
      { sub: adminUser.id, id: adminUser.id, role: 'admin', email: adminUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );

    regularToken = jwt.sign(
      { sub: regularUser.id, id: regularUser.id, role: 'user', email: regularUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );
  });

  after(async () => {
    // Cleanup created test records
    await CompetitionEvent.destroy({
      where: {
        idempotencyKey: [
          'authz-test-admin-publish-1',
          'authz-test-regular-attempt-1',
          'authz-test-forged-prod-1',
        ],
      },
    }).catch(() => {});
  });

  it('1. Rejects ordinary user attempting POST /api/competition/events/publish with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/competition/events/publish')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        contractKey: 'production.video.approved',
        aggregateId: 10001,
        actorId: adminUser.id,
        teamId: testTeam.id,
        idempotencyKey: 'authz-test-regular-attempt-1',
        payload: {
          videoId: 10001,
          qualityScore: 100,
        },
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Forbidden');
  });

  it('2. Rejects ordinary user attempting POST /api/competition/integration/production/video-action with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/competition/integration/production/video-action')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        action: 'video_approved',
        videoId: 10002,
        actorId: adminUser.id,
        idempotencyKey: 'authz-test-forged-prod-1',
        qualityScore: 100,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Forbidden');
  });

  it('3. Rejects ordinary user attempting POST /api/competition/integration/youtube/milestone with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/competition/integration/youtube/milestone')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        type: 'view',
        youtubeVideoId: 'yt_fake_video_1',
        views: 1000000,
        actorId: adminUser.id,
      });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.message, 'Forbidden');
  });

  it('4. Enforces senderId = req.user.id on kudos and prevents spoofing senderId to admin', async () => {
    const res = await request(app)
      .post('/api/competition/integration/community/kudos')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        recipientId: recipientUser.id,
        senderId: adminUser.id, // Attacker attempts to spoof admin as sender
        senderTeamId: 9999,      // Attacker attempts to spoof sender team
        reason: 'Outstanding performance!',
        kudosType: 'achievement',
      });

    assert.strictEqual(res.status, 201);
    assert.ok(res.body.sentResult?.success);
    assert.ok(res.body.receivedResult?.success);

    // Verify in database that the KUDOS_SENT event has actorId = regularUser.id, NOT adminUser.id
    const sentEvent = await CompetitionEvent.findByPk(res.body.sentResult.eventId);
    assert.ok(sentEvent, 'Sent event must be recorded');
    assert.strictEqual(Number(sentEvent.actorId), Number(regularUser.id), 'actorId must be forced to caller req.user.id');
    assert.strictEqual(Number(sentEvent.teamId), Number(testTeam.id), 'teamId must be forced to caller req.user.teamId');

    // Verify received event has recipientId = recipientUser.id
    const recvEvent = await CompetitionEvent.findByPk(res.body.receivedResult.eventId);
    assert.ok(recvEvent, 'Received event must be recorded');
    assert.strictEqual(Number(recvEvent.actorId), Number(recipientUser.id));
  });

  it('5. Rejects self-kudos with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/competition/integration/community/kudos')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        recipientId: regularUser.id, // Self kudos
        reason: 'Giving myself kudos',
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Không thể tự gửi kudos/);
  });

  it('6. Rejects kudos when recipient does not exist or is inactive with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/competition/integration/community/kudos')
      .set('Authorization', `Bearer ${regularToken}`)
      .send({
        recipientId: 999999999, // Non-existent user
        reason: 'Ghost kudos',
      });

    assert.strictEqual(res.status, 400);
    assert.match(res.body.message, /Người nhận không tồn tại/);
  });

  it('7. Allows Admin user to publish valid domain event and records audit log', async () => {
    const res = await request(app)
      .post('/api/competition/events/publish')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        contractKey: 'production.video.approved',
        aggregateId: 88888,
        actorId: adminUser.id,
        teamId: testTeam.id,
        idempotencyKey: 'authz-test-admin-publish-1',
        payload: {
          videoId: 88888,
          qualityScore: 90,
          title: 'Admin Approved Documentary',
        },
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.eventId);

    // Verify CompetitionAuditLog record was created for admin action
    const auditLog = await CompetitionAuditLog.findOne({
      where: {
        entityId: res.body.eventId,
        action: 'DOMAIN_EVENT_PUBLISHED',
      },
    });
    assert.ok(auditLog, 'Audit log must be created for admin event publication');
    assert.strictEqual(Number(auditLog.actorId), Number(adminUser.id));
  });

  it('8. Allows Admin user to trigger production action and records audit log', async () => {
    const res = await request(app)
      .post('/api/competition/integration/production/video-action')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        action: 'video_approved',
        videoId: 88889,
        actorId: adminUser.id,
        teamId: testTeam.id,
        qualityScore: 95,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.eventId);

    const auditLog = await CompetitionAuditLog.findOne({
      where: {
        entityId: res.body.eventId,
        action: 'PRODUCTION_ACTION_VIDEO_APPROVED',
      },
    });
    assert.ok(auditLog, 'Audit log must be created for admin production action');
  });

  it('9. INVARIANT: Zero unauthorized/forged events from regular users exist in Event Store', async () => {
    const forgedEvents = await CompetitionEvent.findAll({
      where: {
        idempotencyKey: [
          'authz-test-regular-attempt-1',
          'authz-test-forged-prod-1',
        ],
      },
    });
    assert.strictEqual(forgedEvents.length, 0, 'No forged event rows must exist in competition_events');
  });
});
