'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  ScoreLedger,
  SeasonFrozenResult,
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  SeasonIndividualLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
} = require('../src/models');
const seasonService = require('../src/services/competition/season.service');
const grandLeaderboardService = require('../src/services/competition/grandLeaderboard.service');
const competitionReadModelProjector = require('../src/services/competition/competitionReadModel.projector');
const competitionDashboardService = require('../src/services/competition/competitionDashboard.service');

describe('Competition — Team vs Individual Leaderboard Separation & Scopes', () => {
  let adminToken;
  let userTokenA;
  let userTokenB;
  let userA, userB, userC, userD;
  let teamAlpha, teamBeta;
  let testSeason;
  let testGrand;

  before(async () => {
    const ts = Date.now();

    // 1. Create Admin
    const adminUser = await User.create({
      name: `Admin Leaderboard ${ts}`,
      email: `admin_lb_${ts}@example.com`,
      passwordHash: 'dummy_hash',
      role: 'admin',
      status: 'active',
    });

    // 2. Create Teams
    teamAlpha = await Team.create({
      name: `Team Alpha ${ts}`,
      description: `Alpha Team ${ts}`,
    });

    teamBeta = await Team.create({
      name: `Team Beta ${ts}`,
      description: `Beta Team ${ts}`,
    });

    // 3. Create Users
    userA = await User.create({
      name: `User A Alpha ${ts}`,
      email: `user_a_${ts}@example.com`,
      passwordHash: 'dummy',
      role: 'user',
      teamId: teamAlpha.id,
      status: 'active',
    });

    userB = await User.create({
      name: `User B Alpha ${ts}`,
      email: `user_b_${ts}@example.com`,
      passwordHash: 'dummy',
      role: 'user',
      teamId: teamAlpha.id,
      status: 'active',
    });

    userC = await User.create({
      name: `User C Beta ${ts}`,
      email: `user_c_${ts}@example.com`,
      passwordHash: 'dummy',
      role: 'user',
      teamId: teamBeta.id,
      status: 'active',
    });

    userD = await User.create({
      name: `User D Beta ${ts}`,
      email: `user_d_${ts}@example.com`,
      passwordHash: 'dummy',
      role: 'user',
      teamId: teamBeta.id,
      status: 'active',
    });

    // Generate JWT tokens with sub
    const jwt = require('jsonwebtoken');
    const env = require('../src/config/env');
    const JWT_SECRET = env.jwtSecret;
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin', email: adminUser.email }, JWT_SECRET, { expiresIn: '1h' });
    userTokenA = jwt.sign({ sub: userA.id, role: 'user', email: userA.email }, JWT_SECRET, { expiresIn: '1h' });
    userTokenB = jwt.sign({ sub: userC.id, role: 'user', email: userC.email }, JWT_SECRET, { expiresIn: '1h' });

    // 4. Create Grand Championship
    testGrand = await GrandChampionship.create({
      name: `Grand Championship 2026 ${ts}`,
      slug: `grand-championship-2026-${ts}`,
      year: 2026,
      startAt: new Date(Date.now() - 30 * 86400000),
      endAt: new Date(Date.now() + 300 * 86400000),
      status: 'ACTIVE',
      pointsCalculationConfig: {
        pointsScale: { 1: 25, 2: 18, 3: 15, 4: 12 },
      },
    });

    // 5. Create Season linked to Grand
    testSeason = await Season.create({
      name: `Season 1 Battle ${ts}`,
      slug: `season-1-battle-${ts}`,
      seasonType: 'SEASONAL',
      startAt: new Date(Date.now() - 7 * 86400000),
      endAt: new Date(Date.now() + 7 * 86400000),
      status: 'ACTIVE',
      grandChampionshipId: testGrand.id,
    });

    // Register Teams to Season
    await SeasonTeam.create({
      seasonId: testSeason.id,
      teamId: teamAlpha.id,
      teamNameSnapshot: teamAlpha.name,
      teamColorSnapshot: '#3b82f6',
      isEligible: true,
    });

    await SeasonTeam.create({
      seasonId: testSeason.id,
      teamId: teamBeta.id,
      teamNameSnapshot: teamBeta.name,
      teamColorSnapshot: '#ef4444',
      isEligible: true,
    });

    // Register Members to Season
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: teamAlpha.id, userId: userA.id });
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: teamAlpha.id, userId: userB.id });
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: teamBeta.id, userId: userC.id });
    await SeasonTeamMember.create({ seasonId: testSeason.id, teamId: teamBeta.id, userId: userD.id });
  });

  after(async () => {
    if (testSeason) {
      await ScoreLedger.destroy({ where: { seasonId: testSeason.id } });
      await SeasonIndividualLeaderboardProjection.destroy({ where: { seasonId: testSeason.id } });
      await SeasonTeamMember.destroy({ where: { seasonId: testSeason.id } });
      await SeasonTeam.destroy({ where: { seasonId: testSeason.id } });
      await SeasonFrozenResult.destroy({ where: { seasonId: testSeason.id } });
      await testSeason.destroy();
    }
    if (testGrand) {
      await GrandIndividualLeaderboardProjection.destroy({ where: { grandId: testGrand.id } });
      await GrandPointsLedger.destroy({ where: { grandChampionshipId: testGrand.id } });
      await testGrand.destroy();
    }
  });

  it('1. Score Isolation: Team Score != Individual Sum & Team Leader != Individual Leader', async () => {
    const baseTime = Date.now();

    // Team Alpha receives 500 team points directly
    await ScoreLedger.create({
      eventId: `ev_team_alpha_${baseTime}`,
      idempotencyKey: `idemp_team_alpha_${baseTime}`,
      targetType: 'TEAM',
      teamId: teamAlpha.id,
      seasonId: testSeason.id,
      pointsDelta: 500,
      effectType: 'TEAM_SCORE',
      reason: 'Team Collaboration Milestone',
      createdAt: new Date(baseTime + 1000),
    });

    // User A gets 100 XP
    await ScoreLedger.create({
      eventId: `ev_user_a_${baseTime}`,
      idempotencyKey: `idemp_user_a_${baseTime}`,
      targetType: 'USER',
      userId: userA.id,
      teamId: teamAlpha.id,
      seasonId: testSeason.id,
      pointsDelta: 100,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Quality Video Approved',
      createdAt: new Date(baseTime + 2000),
    });

    // User B gets 50 XP
    await ScoreLedger.create({
      eventId: `ev_user_b_${baseTime}`,
      idempotencyKey: `idemp_user_b_${baseTime}`,
      targetType: 'USER',
      userId: userB.id,
      teamId: teamAlpha.id,
      seasonId: testSeason.id,
      pointsDelta: 50,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Script Approved',
      createdAt: new Date(baseTime + 3000),
    });

    // User C gets 300 XP
    await ScoreLedger.create({
      eventId: `ev_user_c_${baseTime}`,
      idempotencyKey: `idemp_user_c_${baseTime}`,
      targetType: 'USER',
      userId: userC.id,
      teamId: teamBeta.id,
      seasonId: testSeason.id,
      pointsDelta: 300,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Masterpiece Video Published',
      createdAt: new Date(baseTime + 4000),
    });

    // User D gets 50 XP
    await ScoreLedger.create({
      eventId: `ev_user_d_${baseTime}`,
      idempotencyKey: `idemp_user_d_${baseTime}`,
      targetType: 'USER',
      userId: userD.id,
      teamId: teamBeta.id,
      seasonId: testSeason.id,
      pointsDelta: 50,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Community Kudos',
      createdAt: new Date(baseTime + 5000),
    });

    // Team Leaderboard Check: Team Alpha is #1 (500 direct points, isolated from individual XP)
    const teamLeaderboard = await seasonService.getSeasonLeaderboard(testSeason.id);
    assert.strictEqual(teamLeaderboard.rankings[0].teamId, Number(teamAlpha.id));
    assert.strictEqual(teamLeaderboard.rankings[0].score, 500);
    assert.strictEqual(teamLeaderboard.rankings[1].teamId, Number(teamBeta.id));
    assert.strictEqual(teamLeaderboard.rankings[1].score, 0);

    // Individual Leaderboard Check: User C is #1 (300 XP)
    const individualLeaderboard = await seasonService.getSeasonIndividualLeaderboard(testSeason.id);
    assert.ok(Array.isArray(individualLeaderboard.rankings));
    assert.strictEqual(individualLeaderboard.rankings.length, 4);

    assert.strictEqual(Number(individualLeaderboard.rankings[0].userId), Number(userC.id));
    assert.strictEqual(individualLeaderboard.rankings[0].points, 300);
    assert.strictEqual(individualLeaderboard.rankings[0].rank, 1);
    assert.strictEqual(individualLeaderboard.seasonIndividualChampion.userId, Number(userC.id));

    // Rank 2: User A (100 pts)
    assert.strictEqual(Number(individualLeaderboard.rankings[1].userId), Number(userA.id));
    assert.strictEqual(individualLeaderboard.rankings[1].points, 100);

    // Rank 3 and 4: Tie broken by lastScoredAt ASC (User B earlier than User D)
    assert.strictEqual(Number(individualLeaderboard.rankings[2].userId), Number(userB.id));
    assert.strictEqual(Number(individualLeaderboard.rankings[3].userId), Number(userD.id));
  });

  it('2. Individual Leaderboard Filtering & Pagination', async () => {
    // Filter by Team Beta
    const betaOnly = await seasonService.getSeasonIndividualLeaderboard(testSeason.id, {
      teamId: teamBeta.id,
    });
    assert.strictEqual(betaOnly.rankings.length, 2);
    assert.ok(betaOnly.rankings.every((r) => Number(r.teamId) === Number(teamBeta.id)));
    assert.strictEqual(Number(betaOnly.rankings[0].userId), Number(userC.id));

    // Filter by Search
    const searchRes = await seasonService.getSeasonIndividualLeaderboard(testSeason.id, {
      search: 'Alpha',
    });
    assert.strictEqual(searchRes.rankings.length, 2);
    assert.ok(searchRes.rankings.every((r) => r.userName.includes('Alpha')));

    // Pagination
    const page1 = await seasonService.getSeasonIndividualLeaderboard(testSeason.id, {
      page: 1,
      limit: 2,
    });
    assert.strictEqual(page1.rankings.length, 2);
    assert.strictEqual(page1.totalIndividuals, 4);
    assert.strictEqual(page1.page, 1);
    assert.strictEqual(page1.totalPages, 2);
    assert.strictEqual(Number(page1.rankings[0].userId), Number(userC.id));

    const page2 = await seasonService.getSeasonIndividualLeaderboard(testSeason.id, {
      page: 2,
      limit: 2,
    });
    assert.strictEqual(page2.rankings.length, 2);
    assert.strictEqual(page2.page, 2);
    assert.strictEqual(Number(page2.rankings[0].userId), Number(userB.id));
  });

  it('3. Read Model Projector: Generates Projections & Computes Rank Trends', async () => {
    // Project initial individual leaderboard
    const projections = await competitionReadModelProjector.projectSeasonIndividualLeaderboard(testSeason.id);
    assert.ok(Array.isArray(projections));
    assert.strictEqual(projections.length, 4);

    const proj1 = await SeasonIndividualLeaderboardProjection.findOne({
      where: { seasonId: testSeason.id, userId: userC.id },
    });
    assert.ok(proj1);
    assert.strictEqual(proj1.rank, 1);
    assert.strictEqual(proj1.points, 300);
    assert.strictEqual(proj1.trend, 'SAME');

    // Simulate User A scoring 500 XP surge to jump from rank 2 to rank 1
    await ScoreLedger.create({
      eventId: `ev_surge_${Date.now()}`,
      idempotencyKey: `idemp_surge_${Date.now()}`,
      targetType: 'USER',
      userId: userA.id,
      teamId: teamAlpha.id,
      seasonId: testSeason.id,
      pointsDelta: 500,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Surge Breakthrough',
      createdAt: new Date(),
    });

    // Re-project
    const updatedProjections = await competitionReadModelProjector.projectSeasonIndividualLeaderboard(testSeason.id);
    const projA = updatedProjections.find((p) => Number(p.userId) === Number(userA.id));
    const projC = updatedProjections.find((p) => Number(p.userId) === Number(userC.id));

    assert.strictEqual(projA.rank, 1);
    assert.strictEqual(projA.points, 600);
    assert.strictEqual(projA.trend, 'UP');

    assert.strictEqual(projC.rank, 2);
    assert.strictEqual(projC.trend, 'DOWN');
  });

  it('4. Grand Individual Standings: Aggregates Individual Season Points Across Grand Championship', async () => {
    // Project Grand Individual Standings
    const grandProj = await competitionReadModelProjector.projectGrandIndividualLeaderboard(testGrand.id);
    assert.ok(Array.isArray(grandProj));
    assert.strictEqual(grandProj.length, 4);

    const grandStandings = await grandLeaderboardService.getGrandIndividualStandings(testGrand.id);
    assert.ok(grandStandings.standings.length >= 4);

    // Top Grand Individual is User A with 600 Grand Points
    assert.strictEqual(Number(grandStandings.standings[0].userId), Number(userA.id));
    assert.strictEqual(grandStandings.standings[0].grandPoints, 600);
    assert.strictEqual(grandStandings.standings[0].rank, 1);
    assert.strictEqual(grandStandings.grandIndividualChampion.userId, Number(userA.id));

    // Second is User C with 300 Grand Points
    assert.strictEqual(Number(grandStandings.standings[1].userId), Number(userC.id));
    assert.strictEqual(grandStandings.standings[1].grandPoints, 300);
    assert.strictEqual(grandStandings.standings[1].rank, 2);
  });

  it('5. Scope Isolation: Lifetime Points != Season Points != Grand Points', async () => {
    // Add lifetime historical points
    await ScoreLedger.create({
      eventId: `ev_lifetime_extra_${Date.now()}`,
      idempotencyKey: `idemp_lifetime_extra_${Date.now()}`,
      targetType: 'USER',
      userId: userA.id,
      teamId: teamAlpha.id,
      seasonId: null, // Lifetime only
      pointsDelta: 5000,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Lifetime Historical Migration',
      createdAt: new Date(Date.now() - 100 * 86400000),
    });

    const breakdown = await competitionDashboardService.getEmployeeBreakdown(userA.id, {
      seasonId: testSeason.id,
    });

    assert.strictEqual(breakdown.seasonPoints, 600);
    assert.strictEqual(breakdown.lifetimePoints, 5600);
    assert.notStrictEqual(breakdown.seasonPoints, breakdown.lifetimePoints);

    // Verify Season Leaderboard still shows 600 pts for User A, NOT 5600
    const seasonLb = await seasonService.getSeasonIndividualLeaderboard(testSeason.id);
    const userARow = seasonLb.rankings.find((r) => Number(r.userId) === Number(userA.id));
    assert.strictEqual(userARow.points, 600);
  });

  it('6. Frozen Result Immutability: Finished Season & Grand Freeze Individual Standings', async () => {
    // Transition Season to FINISHED and Freeze Result
    await testSeason.update({ status: 'FINISHED' });
    const frozenSeason = await seasonService.freezeSeasonResult(testSeason.id);
    assert.ok(frozenSeason);
    assert.ok(frozenSeason.metadata);
    assert.ok(Array.isArray(frozenSeason.metadata.finalIndividualRankings));
    assert.strictEqual(frozenSeason.metadata.individualChampion.userId, Number(userA.id));

    // Subsequent score attempt
    await ScoreLedger.create({
      eventId: `ev_post_freeze_${Date.now()}`,
      idempotencyKey: `idemp_post_freeze_${Date.now()}`,
      targetType: 'USER',
      userId: userC.id,
      teamId: teamBeta.id,
      seasonId: testSeason.id,
      pointsDelta: 9999,
      effectType: 'INDIVIDUAL_XP',
      reason: 'Illegal Post-Freeze Score',
      createdAt: new Date(),
    });

    const frozenLb = await seasonService.getSeasonIndividualLeaderboard(testSeason.id);
    assert.strictEqual(frozenLb.isFrozen, true);
    assert.strictEqual(frozenLb.rankings[0].userId, Number(userA.id));
    assert.strictEqual(frozenLb.rankings[0].points, 600);
  });

  it('7. API Endpoints: Returns valid responses for User and Admin endpoints', async () => {
    // 1. Season Individual Leaderboard API
    const res1 = await request(app)
      .get(`/api/competition/seasons/${testSeason.id}/individual-leaderboard`)
      .set('Authorization', `Bearer ${userTokenA}`);
    assert.strictEqual(res1.status, 200);
    assert.ok(Array.isArray(res1.body.rankings));

    // 2. Grand Individual Standings API
    const res2 = await request(app)
      .get(`/api/competition/grand/${testGrand.id}/individual-standings`)
      .set('Authorization', `Bearer ${userTokenA}`);
    assert.strictEqual(res2.status, 200);
    assert.ok(Array.isArray(res2.body.standings));

    // 3. Top Performers API
    const res3 = await request(app)
      .get('/api/competition/top-performers')
      .set('Authorization', `Bearer ${userTokenA}`);
    assert.strictEqual(res3.status, 200);
    assert.ok(Array.isArray(res3.body.top3SeasonIndividuals));
    assert.ok(Array.isArray(res3.body.top3GrandIndividuals));

    // 4. User Competition Profile API
    const res4 = await request(app)
      .get(`/api/competition/users/${userA.id}/competition-profile?seasonId=${testSeason.id}`)
      .set('Authorization', `Bearer ${userTokenA}`);
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.user.id, userA.id);
    assert.strictEqual(res4.body.seasonPoints, 600);
    assert.strictEqual(res4.body.lifetimePoints, 5600);

    // 5. Admin Employee Excellence API
    const res5 = await request(app)
      .get('/api/competition/admin/employee-excellence')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(res5.status, 200);
    assert.ok(Array.isArray(res5.body.rankings));
  });
});
