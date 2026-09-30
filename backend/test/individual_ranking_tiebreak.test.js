'use strict';

/**
 * individual_ranking_tiebreak.test.js
 *
 * Verifies that when all users have 0 points, the individual leaderboard
 * still displays all active users and ranks them strictly by account creation date
 * (createdAt ASC, id ASC) so that earlier-created accounts rank higher (#1, #2, #3).
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const jwt = require('jsonwebtoken');
const env = require('../src/config/env');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  ScoreLedger,
  SeasonIndividualLeaderboardProjection,
  GrandChampionship,
  GrandIndividualLeaderboardProjection,
} = require('../src/models');
const rankingService = require('../src/services/ranking/ranking.service');
const seasonService = require('../src/services/competition/season.service');
const projector = require('../src/services/competition/competitionReadModel.projector');

describe('Individual Ranking 0-Points Tie-Breaker (createdAt ASC)', () => {
  let userOldest, userMiddle, userNewest;
  let testTeam;
  let testSeason;
  let authToken;

  before(async () => {
    const ts = Date.now();

    testTeam = await Team.create({
      name: `Tiebreak Team ${ts}`,
      description: 'Team for tie-breaking tests',
    });

    // Create 3 users with explicit created_at timestamps in the past
    userOldest = await User.create({
      name: `Alpha Oldest ${ts}`,
      email: `oldest_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
      createdAt: new Date(Date.now() - 3600000), // 1 hour ago
    });

    userMiddle = await User.create({
      name: `Beta Middle ${ts}`,
      email: `middle_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
      createdAt: new Date(Date.now() - 1800000), // 30 mins ago
    });

    userNewest = await User.create({
      name: `Gamma Newest ${ts}`,
      email: `newest_${ts}@workrank.local`,
      passwordHash: 'hash',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
      createdAt: new Date(Date.now() - 60000), // 1 min ago
    });

    testSeason = await Season.create({
      name: `Tiebreak Season ${ts}`,
      slug: `tiebreak-season-${ts}`,
      seasonType: 'SEASONAL',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000),
      status: 'ACTIVE',
    });

    await SeasonTeam.create({
      seasonId: testSeason.id,
      teamId: testTeam.id,
      teamNameSnapshot: testTeam.name,
      teamColorSnapshot: '#3b82f6',
      isEligible: true,
    });

    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: testTeam.id, userId: userOldest.id });
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: testTeam.id, userId: userMiddle.id });
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: testTeam.id, userId: userNewest.id });

    authToken = jwt.sign(
      { sub: userOldest.id, role: userOldest.role, email: userOldest.email },
      env.jwtSecret,
      { expiresIn: '1h' }
    );
  });

  after(async () => {
    if (testSeason) {
      await ScoreLedger.destroy({ where: { seasonId: testSeason.id } });
      await SeasonIndividualLeaderboardProjection.destroy({ where: { seasonId: testSeason.id } });
      await SeasonTeamMember.destroy({ where: { seasonId: testSeason.id } });
      await SeasonTeam.destroy({ where: { seasonId: testSeason.id } });
      await testSeason.destroy();
    }
    if (userOldest) await userOldest.destroy();
    if (userMiddle) await userMiddle.destroy();
    if (userNewest) await userNewest.destroy();
    if (testTeam) await testTeam.destroy();
  });

  it('1. Season scope: all 3 users with 0 points are returned and ordered by createdAt ASC', async () => {
    const res = await seasonService.getSeasonIndividualLeaderboard(testSeason.id);
    assert.ok(Array.isArray(res.rankings));
    assert.ok(res.rankings.length >= 3);

    const oldestRow = res.rankings.find((r) => Number(r.userId) === Number(userOldest.id));
    const middleRow = res.rankings.find((r) => Number(r.userId) === Number(userMiddle.id));
    const newestRow = res.rankings.find((r) => Number(r.userId) === Number(userNewest.id));

    assert.ok(oldestRow, 'userOldest must be in rankings');
    assert.ok(middleRow, 'userMiddle must be in rankings');
    assert.ok(newestRow, 'userNewest must be in rankings');

    assert.strictEqual(oldestRow.points, 0);
    assert.strictEqual(middleRow.points, 0);
    assert.strictEqual(newestRow.points, 0);

    // Order check: oldest < middle < newest
    assert.ok(oldestRow.rank < middleRow.rank, `Oldest (#${oldestRow.rank}) should rank before Middle (#${middleRow.rank})`);
    assert.ok(middleRow.rank < newestRow.rank, `Middle (#${middleRow.rank}) should rank before Newest (#${newestRow.rank})`);
  });

  it('2. Projection & Ranking API scope=season returns users sorted by createdAt ASC when points=0', async () => {
    await projector.projectSeasonIndividualLeaderboard(testSeason.id);

    const apiRes = await request(app)
      .get(`/api/rankings/individuals?scope=season&seasonId=${testSeason.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(apiRes.status, 200);
    assert.strictEqual(apiRes.body.success, true);
    assert.ok(Array.isArray(apiRes.body.items));

    const items = apiRes.body.items;
    const oldestItem = items.find((r) => Number(r.userId) === Number(userOldest.id));
    const middleItem = items.find((r) => Number(r.userId) === Number(userMiddle.id));
    const newestItem = items.find((r) => Number(r.userId) === Number(userNewest.id));

    assert.ok(oldestItem);
    assert.ok(middleItem);
    assert.ok(newestItem);

    assert.ok(oldestItem.rank < middleItem.rank);
    assert.ok(middleItem.rank < newestItem.rank);
  });

  it('3. All-Time scope: users with 0 points are ordered by createdAt ASC', async () => {
    const apiRes = await request(app)
      .get(`/api/rankings/individuals?scope=all-time&teamId=${testTeam.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(apiRes.status, 200);
    assert.strictEqual(apiRes.body.success, true);

    const items = apiRes.body.items;
    const oldestItem = items.find((r) => Number(r.userId) === Number(userOldest.id));
    const middleItem = items.find((r) => Number(r.userId) === Number(userMiddle.id));
    const newestItem = items.find((r) => Number(r.userId) === Number(userNewest.id));

    assert.ok(oldestItem);
    assert.ok(middleItem);
    assert.ok(newestItem);

    assert.ok(oldestItem.rank < middleItem.rank);
    assert.ok(middleItem.rank < newestItem.rank);
  });

  it('4. Score earned overrides createdAt: Newest user scores 50 XP and takes #1 rank', async () => {
    await ScoreLedger.create({
      eventId: `ev_test_${Date.now()}`,
      idempotencyKey: `idemp_test_${Date.now()}`,
      targetType: 'USER',
      userId: userNewest.id,
      teamId: testTeam.id,
      seasonId: testSeason.id,
      pointsDelta: 50,
      effectType: 'INDIVIDUAL_XP',
      reason: 'First Video Approved',
      createdAt: new Date(),
    });

    await projector.projectSeasonIndividualLeaderboard(testSeason.id);

    const apiRes = await request(app)
      .get(`/api/rankings/individuals?scope=season&seasonId=${testSeason.id}`)
      .set('Authorization', `Bearer ${authToken}`);

    assert.strictEqual(apiRes.status, 200);
    const items = apiRes.body.items;
    const newestItem = items.find((r) => Number(r.userId) === Number(userNewest.id));
    const oldestItem = items.find((r) => Number(r.userId) === Number(userOldest.id));
    const middleItem = items.find((r) => Number(r.userId) === Number(userMiddle.id));

    assert.strictEqual(newestItem.score, 50);
    assert.strictEqual(newestItem.rank, 1);

    // Remaining 0-point users still maintain tie-break order
    assert.ok(oldestItem.rank < middleItem.rank);
  });
});
