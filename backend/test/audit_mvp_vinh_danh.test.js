'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { sequelize, User, UserRecognition, CompetitionUserSummary, Season } = require('../src/models');
const authService = require('../src/services/auth.service');
const recognitionService = require('../src/services/recognition.service');
const rankingService = require('../src/services/ranking/ranking.service');
const publicSpotlightService = require('../src/services/competition/publicSpotlight.service');

test('Comprehensive MVP & Vinh Danh Isolation and Zero-State Verification', async (t) => {
  await sequelize.authenticate();

  let userA, userB, adminUser, season;

  t.before(async () => {
    const timestamp = Date.now();

    // Create Admin
    const adminPasswordHash = await bcrypt.hash('AdminPassword123!', 10);
    adminUser = await User.create({
      name: `Admin Audit ${timestamp}`,
      email: `admin_audit_${timestamp}@workrank.test`,
      passwordHash: adminPasswordHash,
      role: 'admin',
      status: 'active',
      isVerified: true,
    });

    // Create a test season
    season = await Season.create({
      name: `Audit Season ${timestamp}`,
      slug: `audit-season-${timestamp}`,
      seasonType: 'MONTHLY',
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });
  });

  t.after(async () => {
    if (userA?.id) {
      await UserRecognition.destroy({ where: { userId: userA.id } });
      await CompetitionUserSummary.destroy({ where: { userId: userA.id } });
      await User.destroy({ where: { id: userA.id } });
    }
    if (userB?.id) {
      await UserRecognition.destroy({ where: { userId: userB.id } });
      await CompetitionUserSummary.destroy({ where: { userId: userB.id } });
      await User.destroy({ where: { id: userB.id } });
    }
    if (adminUser?.id) {
      await User.destroy({ where: { id: adminUser.id } });
    }
    if (season?.id) {
      await Season.destroy({ where: { id: season.id } });
    }
  });

  await t.test('1. Newly registered User A has strictly ZERO MVP, 0 Champion, and empty awards', async () => {
    const timestamp = Date.now();
    const regRes = await authService.register({
      name: `User A Newbie ${timestamp}`,
      email: `user_a_${timestamp}@workrank.test`,
      password: 'Password123!',
    });
    userA = regRes.user;

    const recognitions = await recognitionService.getUserRecognitions(userA.id);

    assert.equal(recognitions.userId, userA.id);
    assert.equal(recognitions.badges.verified.active, false);
    assert.equal(recognitions.badges.dev.active, false);
    assert.equal(recognitions.badges.champion.active, false);
    assert.equal(recognitions.badges.champion.count, 0);
    assert.deepEqual(recognitions.badges.champion.awards, []);
    assert.equal(recognitions.badges.mvp.active, false);
    assert.equal(recognitions.badges.mvp.count, 0);
    assert.deepEqual(recognitions.badges.mvp.awards, []);
    assert.deepEqual(recognitions.awards, []);
  });

  await t.test('2. Newly registered User B has strictly ZERO MVP, 0 Champion, and empty awards', async () => {
    const timestamp = Date.now();
    const regRes = await authService.register({
      name: `User B Newbie ${timestamp}`,
      email: `user_b_${timestamp}@workrank.test`,
      password: 'Password123!',
    });
    userB = regRes.user;

    const recognitions = await recognitionService.getUserRecognitions(userB.id);

    assert.equal(recognitions.userId, userB.id);
    assert.equal(recognitions.badges.mvp.active, false);
    assert.equal(recognitions.badges.mvp.count, 0);
    assert.deepEqual(recognitions.badges.mvp.awards, []);
    assert.deepEqual(recognitions.awards, []);
  });

  await t.test('3. When no MVP was awarded for active season, public spotlight returns null MVP (empty placeholder)', async () => {
    const spotlight = await publicSpotlightService.getPublicSpotlight();
    // If the latest season has no explicit MVP awarded, mvp should not be synthetically invented
    if (spotlight.season?.id === season.id) {
      assert.equal(spotlight.mvp, null);
    }
  });

  await t.test('4. Admin awards MVP to User A -> User A receives 1 MVP, while User B remains strictly at 0', async () => {
    const awardResult = await recognitionService.awardMVP({
      userId: userA.id,
      seasonId: season.id,
      title: 'MVP Audit Test',
      reason: 'Hoàn thành xuất sắc audit kiểm thử',
      actorId: adminUser.id,
    });

    assert.ok(awardResult.id);
    assert.equal(awardResult.userId, userA.id);
    assert.equal(awardResult.awardType, 'mvp');

    // Verify User A recognitions
    const recA = await recognitionService.getUserRecognitions(userA.id);
    assert.equal(recA.badges.mvp.active, true);
    assert.equal(recA.badges.mvp.count, 1);
    assert.equal(recA.badges.mvp.awards.length, 1);
    assert.equal(recA.badges.mvp.awards[0].title, 'MVP Audit Test');
    assert.equal(recA.awards.length, 1);

    // Verify User B is completely untouched (isolation check)
    const recB = await recognitionService.getUserRecognitions(userB.id);
    assert.equal(recB.badges.mvp.active, false);
    assert.equal(recB.badges.mvp.count, 0);
    assert.deepEqual(recB.badges.mvp.awards, []);
    assert.deepEqual(recB.awards, []);
  });

  await t.test('5. Hall of Fame shows User A in seasonMvps and does NOT show User B', async () => {
    // Set score to ensure User A ranks in top 10
    await CompetitionUserSummary.upsert({
      userId: userA.id,
      currentSeasonScore: 999999,
      metadata: { mvpCount: 1 },
    });

    const topPerformers = await rankingService.getTopPerformers();
    const mvpUserA = topPerformers.seasonMvps.find((m) => Number(m.userId) === Number(userA.id));
    const mvpUserB = topPerformers.seasonMvps.find((m) => Number(m.userId) === Number(userB.id));

    assert.ok(mvpUserA, 'User A should appear in Hall of Fame MVP list');
    assert.equal(mvpUserA.mvpCount, 1);
    assert.equal(mvpUserB, undefined, 'User B must NOT appear in Hall of Fame MVP list');
  });

  await t.test('6. Admin revokes MVP from User A -> User A returns to zero MVP state', async () => {
    const recA = await recognitionService.getUserRecognitions(userA.id);
    const awardId = recA.awards[0].id;

    const revokeRes = await recognitionService.revokeMVP({
      recognitionId: awardId,
      actorId: adminUser.id,
      reason: 'Audit cleanup revoke',
    });

    assert.equal(revokeRes.success, true);

    const recAfter = await recognitionService.getUserRecognitions(userA.id);
    assert.equal(recAfter.badges.mvp.active, false);
    assert.equal(recAfter.badges.mvp.count, 0);
    assert.deepEqual(recAfter.badges.mvp.awards, []);
    assert.deepEqual(recAfter.awards, []);
  });
});
