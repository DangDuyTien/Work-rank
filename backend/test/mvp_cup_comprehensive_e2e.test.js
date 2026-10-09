const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  sequelize,
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  ScoreLedger,
  CompetitionUserSummary,
  UserRecognition,
  CompetitionAuditLog,
} = require('../src/models');
const rankingService = require('../src/services/ranking/ranking.service');

test('MVP Cup Comprehensive End-to-End Test Suite', async (t) => {
  let adminUser;
  let normalUser1;
  let normalUser2;
  let inactiveUser;
  let testTeam;
  let adminToken;
  let userToken;
  let timestamp;

  let seasonA;
  let seasonEmpty;
  let seasonTied;
  let seasonConcurrent;
  let seasonArchived;

  before(async () => {
    timestamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // Create team
    testTeam = await Team.create({
      name: `MVP Test Team ${timestamp}`,
      code: `TEAM_${timestamp.slice(-5)}`,
      status: 'active',
    });

    // Create users
    adminUser = await User.create({
      name: `Admin MVP Tester ${timestamp}`,
      email: `admin_mvp_${timestamp}@workrank.io`,
      passwordHash: 'hashed_admin_pass',
      role: 'admin',
      status: 'active',
      isVerified: true,
      jobTitle: 'Quản Trị Viên',
      department: 'Ban Giám Đốc',
      teamId: testTeam.id,
    });

    normalUser1 = await User.create({
      name: `Candidate Alice ${timestamp}`,
      email: `alice_${timestamp}@workrank.io`,
      passwordHash: 'hashed_alice_pass',
      role: 'user',
      status: 'active',
      isVerified: true,
      jobTitle: 'Content Creator',
      department: 'Media & Content',
      teamId: testTeam.id,
    });

    normalUser2 = await User.create({
      name: `Candidate Bob ${timestamp}`,
      email: `bob_${timestamp}@workrank.io`,
      passwordHash: 'hashed_bob_pass',
      role: 'user',
      status: 'active',
      isVerified: false,
      jobTitle: 'Video Editor',
      department: 'Media & Content',
      teamId: testTeam.id,
    });

    inactiveUser = await User.create({
      name: `Inactive Charlie ${timestamp}`,
      email: `charlie_${timestamp}@workrank.io`,
      passwordHash: 'hashed_charlie_pass',
      role: 'user',
      status: 'inactive',
      isVerified: false,
      jobTitle: 'Staff',
      department: 'Media & Content',
      teamId: testTeam.id,
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, id: adminUser.id, userId: adminUser.id, email: adminUser.email, role: 'admin' },
      env.jwtSecret,
      { expiresIn: '2h' }
    );

    userToken = jwt.sign(
      { sub: normalUser1.id, id: normalUser1.id, userId: normalUser1.id, email: normalUser1.email, role: 'user' },
      env.jwtSecret,
      { expiresIn: '2h' }
    );

    // Create Seasons
    seasonA = await Season.create({
      name: `Season A MVP ${timestamp}`,
      slug: `season-a-mvp-${timestamp}`,
      status: 'ACTIVE',
      seasonType: 'MONTHLY',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    seasonEmpty = await Season.create({
      name: `Season Empty ${timestamp}`,
      slug: `season-empty-${timestamp}`,
      status: 'ACTIVE',
      seasonType: 'MONTHLY',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    seasonTied = await Season.create({
      name: `Season Tied ${timestamp}`,
      slug: `season-tied-${timestamp}`,
      status: 'ACTIVE',
      seasonType: 'MONTHLY',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    seasonConcurrent = await Season.create({
      name: `Season Concurrent ${timestamp}`,
      slug: `season-concurrent-${timestamp}`,
      status: 'ACTIVE',
      seasonType: 'MONTHLY',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    seasonArchived = await Season.create({
      name: `Season Archived ${timestamp}`,
      slug: `season-archived-${timestamp}`,
      status: 'ARCHIVED',
      seasonType: 'MONTHLY',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    // Register team and members for seasonA, seasonTied, seasonConcurrent
    for (const s of [seasonA, seasonTied, seasonConcurrent]) {
      await SeasonTeam.create({
        seasonId: s.id,
        teamId: testTeam.id,
        teamNameSnapshot: testTeam.name,
        teamColorSnapshot: '#3b82f6',
        isEligible: true,
      });
      await SeasonTeamMember.create({ seasonId: s.id, teamId: testTeam.id, userId: normalUser1.id });
      await SeasonTeamMember.create({ seasonId: s.id, teamId: testTeam.id, userId: normalUser2.id });
    }
  });

  after(async () => {
    // Cleanup created test records
    try {
      const seasonIds = [seasonA?.id, seasonEmpty?.id, seasonTied?.id, seasonConcurrent?.id, seasonArchived?.id].filter(Boolean);
      await UserRecognition.destroy({ where: { seasonId: seasonIds } });
      await ScoreLedger.destroy({ where: { seasonId: seasonIds } });
      await SeasonTeamMember.destroy({ where: { seasonId: seasonIds } });
      await SeasonTeam.destroy({ where: { seasonId: seasonIds } });
      await Season.destroy({ where: { id: seasonIds } });
      if (adminUser || normalUser1 || normalUser2 || inactiveUser) {
        const uids = [adminUser?.id, normalUser1?.id, normalUser2?.id, inactiveUser?.id].filter(Boolean);
        await CompetitionAuditLog.destroy({
          where: {
            entityType: 'RECOGNITION',
            entityId: uids.map(String),
          },
        });
        await CompetitionUserSummary.destroy({ where: { userId: uids } });
        await User.destroy({ where: { id: uids } });
      }
      if (testTeam) await testTeam.destroy();
    } catch (e) {
      console.warn('Cleanup warning:', e.message);
    }
  });

  await t.test('Case A: Happy Path - Preview and Award MVP Cup', async () => {
    // 1. Add scores to Season A: Alice gets 1200 points, Bob gets 800 points
    await ScoreLedger.create({
      seasonId: seasonA.id,
      userId: normalUser1.id,
      eventId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      effectType: 'STANDARD',
      pointsDelta: 1200,
      scoredAt: new Date(),
    });

    await ScoreLedger.create({
      seasonId: seasonA.id,
      userId: normalUser2.id,
      eventId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      effectType: 'STANDARD',
      pointsDelta: 800,
      scoredAt: new Date(),
    });

    // 2. Call Preview API
    const previewRes = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(previewRes.status, 200);
    assert.equal(previewRes.body.status, 'READY');
    assert.equal(previewRes.body.isTied, false);
    assert.equal(previewRes.body.candidate.userId, normalUser1.id);
    assert.equal(previewRes.body.candidate.score, 1200);
    assert.ok(previewRes.body.suggestedTitle.includes(seasonA.name));
    assert.ok(previewRes.body.suggestedReason.includes('Xếp hạng #1') || previewRes.body.suggestedReason.includes('Hạng #1'));

    // 3. Award MVP Cup via API
    const awardRes = await request(app)
      .post('/api/competition/admin/mvp/award')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        seasonId: seasonA.id,
        userId: normalUser1.id,
        title: previewRes.body.suggestedTitle,
        reason: previewRes.body.suggestedReason,
      });

    assert.equal(awardRes.status, 201);
    assert.equal(awardRes.body.recognition.awardType, 'mvp');
    assert.equal(awardRes.body.recognition.seasonId, seasonA.id);
    assert.equal(awardRes.body.recognition.userId, normalUser1.id);
    assert.ok(awardRes.body.recognition.metadata);
    assert.equal(awardRes.body.recognition.metadata.score, 1200);
    assert.equal(awardRes.body.recognition.metadata.rank, 1);

    // 4. Verify Database Integrity
    const savedRec = await UserRecognition.findOne({
      where: { seasonId: seasonA.id, awardType: 'mvp' },
    });
    assert.ok(savedRec);
    assert.equal(savedRec.userId, normalUser1.id);

    // 5. Verify CompetitionAuditLog
    const auditLog = await CompetitionAuditLog.findOne({
      where: {
        action: 'MVP_AWARDED',
        entityType: 'RECOGNITION',
        entityId: String(normalUser1.id),
      },
    });
    assert.ok(auditLog);

    // 6. Verify CompetitionUserSummary mvpCount
    const summary = await CompetitionUserSummary.findOne({
      where: { userId: normalUser1.id },
    });
    assert.ok(summary);
    assert.equal(summary.metadata?.mvpCount, 1);

    // 7. Verify Ranking Service (Hall of Fame) includes this MVP
    const topPerformers = await rankingService.getTopPerformers({ limit: 500 });
    assert.ok(Array.isArray(topPerformers.seasonMvps));
    const mvpEntry = topPerformers.seasonMvps.find((m) => m.userId === normalUser1.id);
    assert.ok(mvpEntry, 'Top performers Hall of Fame should include Alice with MVP award');
    assert.ok(mvpEntry.mvpCount >= 1);

    // 8. Subsequent preview returns ALREADY_AWARDED
    const previewAfter = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(previewAfter.status, 200);
    assert.equal(previewAfter.body.status, 'ALREADY_AWARDED');
    assert.equal(previewAfter.body.existingAward.userId, normalUser1.id);
  });

  await t.test('Case B: Empty Season with 0 points returns NO_CANDIDATE', async () => {
    const res = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonEmpty.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'NO_CANDIDATE');
    assert.equal(res.body.candidate, null);
  });

  await t.test('Case C: Tied Winner - Canonical tie-breaker selects earlier timestamp', async () => {
    const tEarly = new Date(Date.now() - 5000);
    const tLate = new Date(Date.now() - 1000);

    // Alice scores 500 at earlier timestamp
    await ScoreLedger.create({
      seasonId: seasonTied.id,
      userId: normalUser1.id,
      eventId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      effectType: 'STANDARD',
      pointsDelta: 500,
      scoredAt: tEarly,
    });

    // Bob scores 500 at later timestamp
    await ScoreLedger.create({
      seasonId: seasonTied.id,
      userId: normalUser2.id,
      eventId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      effectType: 'STANDARD',
      pointsDelta: 500,
      scoredAt: tLate,
    });

    const res = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonTied.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'READY');
    assert.equal(res.body.isTied, true);
    assert.equal(res.body.candidate.userId, normalUser1.id); // Alice is Rank #1 due to earlier timestamp
  });

  await t.test('Case D: Duplicate MVP Award on same season returns 409 Conflict', async () => {
    // Attempting to award Season A again must return 409 Conflict (already awarded to Alice in Case A)
    const res = await request(app)
      .post('/api/competition/admin/mvp/award')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        seasonId: seasonA.id,
        userId: normalUser2.id,
        reason: 'Attempt duplicate award',
      });

    assert.equal(res.status, 409);
    assert.ok(res.body.message.includes('đã được trao MVP'));
  });

  await t.test('Case E & F: Double-Click / Concurrent Award - exactly 1 succeeds', async () => {
    // Score points in seasonConcurrent for Bob
    await ScoreLedger.create({
      seasonId: seasonConcurrent.id,
      userId: normalUser2.id,
      eventId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      effectType: 'STANDARD',
      pointsDelta: 950,
      scoredAt: new Date(),
    });

    // Launch 2 simultaneous award calls
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/competition/admin/mvp/award')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          seasonId: seasonConcurrent.id,
          userId: normalUser2.id,
          reason: 'Concurrent Attempt 1',
        }),
      request(app)
        .post('/api/competition/admin/mvp/award')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          seasonId: seasonConcurrent.id,
          userId: normalUser2.id,
          reason: 'Concurrent Attempt 2',
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    assert.deepEqual(statuses, [201, 409], 'Exactly one request must succeed (201) and one must be rejected (409)');

    // Verify DB has exactly 1 award record
    const count = await UserRecognition.count({
      where: { seasonId: seasonConcurrent.id, awardType: 'mvp' },
    });
    assert.equal(count, 1, 'Database must contain exactly 1 MVP record for the season');
  });

  await t.test('Case J: RBAC - Normal member token receives 403 Forbidden', async () => {
    const previewRes = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonA.id}`)
      .set('Authorization', `Bearer ${userToken}`);

    assert.equal(previewRes.status, 403);

    const awardRes = await request(app)
      .post('/api/competition/admin/mvp/award')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        seasonId: seasonA.id,
        userId: normalUser1.id,
        reason: 'Unauthorized award attempt',
      });

    assert.equal(awardRes.status, 403);
  });

  await t.test('Case L: Inactive user cannot be awarded MVP', async () => {
    const res = await request(app)
      .post('/api/competition/admin/mvp/award')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        seasonId: seasonTied.id,
        userId: inactiveUser.id,
        reason: 'Inactive user award attempt',
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('vô hiệu hóa') || res.body.message.includes('không hợp lệ') || res.body.message.includes('không hoạt động'));
  });

  await t.test('Case N: Archived season cannot be awarded MVP', async () => {
    const res = await request(app)
      .post('/api/competition/admin/mvp/award')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        seasonId: seasonArchived.id,
        userId: normalUser1.id,
        reason: 'Archived season award attempt',
      });

    assert.equal(res.status, 400);
    assert.ok(res.body.message.includes('trạng thái ARCHIVED'));
  });

  await t.test('Case W: Revoke MVP decrements count, logs audit, and allows re-award', async () => {
    // Season A was awarded to Alice in Case A.
    const recA = await UserRecognition.findOne({
      where: { seasonId: seasonA.id, awardType: 'mvp' },
    });
    assert.ok(recA);

    // Call Revoke endpoint
    const revokeRes = await request(app)
      .delete(`/api/users/admin/recognitions/${recA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(revokeRes.status, 200);

    // Verify record removed from DB
    const recCheck = await UserRecognition.findByPk(recA.id);
    assert.equal(recCheck, null);

    // Verify Audit Log has MVP_REVOKED
    const revokeAudit = await CompetitionAuditLog.findOne({
      where: {
        action: 'MVP_REVOKED',
        entityType: 'RECOGNITION',
        entityId: String(normalUser1.id),
      },
    });
    assert.ok(revokeAudit);

    // Verify mvpCount in summary decremented to 0
    const summaryAfter = await CompetitionUserSummary.findOne({
      where: { userId: normalUser1.id },
    });
    assert.equal(summaryAfter.metadata?.mvpCount || 0, 0);

    // Verify preview returns READY again
    const previewAfterRevoke = await request(app)
      .get(`/api/competition/admin/mvp/preview/${seasonA.id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    assert.equal(previewAfterRevoke.status, 200);
    assert.equal(previewAfterRevoke.body.status, 'READY');
  });
});
