'use strict';

/**
 * ranking_consolidation_e2e.test.js
 *
 * Automated E2E & Integration Verification Suite for Consolidated Ranking Hub (/api/rankings).
 * Verifies:
 * 1. Overview Company Snapshot API
 * 2. Team Rankings with Scope (Season / Grand / All-Time)
 * 3. Individual Rankings with Scope (Season / Grand / All-Time), search & team filter
 * 4. Available Seasons & Grands Selectors
 * 5. YouTube Rankings Integration
 * 6. Top Performers / Hall of Fame
 * 7. RBAC & Security (401 for unauth, 200 for member/admin)
 * 8. Zero Score Ledger Mutation Guarantee
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  GrandChampionship,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  SeasonIndividualLeaderboardProjection,
  GrandLeaderboardProjection,
  GrandIndividualLeaderboardProjection,
  TeamYouTubeSummary,
  ScoreLedger,
  sequelize,
} = require('../src/models');

describe('Unified Ranking & Leaderboard Consolidation Test Suite', () => {
  let memberUser, adminUser;
  let memberToken, adminToken;
  let teamPhoenix, teamDragon;
  let activeSeason, currentGrand;

  before(async () => {
    const ts = Date.now();

    // 1. Create Test Teams
    teamPhoenix = await Team.create({
      name: `Phoenix Squad ${ts}`,
      description: 'Elite Engineering Squad',
    });
    teamDragon = await Team.create({
      name: `Dragon Squad ${ts}`,
      description: 'Media & Production Squad',
    });

    // 2. Register Users via Auth API
    const memberRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: `Ranking Member ${ts}`,
        email: `ranking_member_${ts}@workrank.test`,
        password: 'Password123!',
      });
    memberToken = memberRes.body.accessToken || memberRes.body.token || memberRes.body.data?.token;

    memberUser = await User.findOne({ where: { email: `ranking_member_${ts}@workrank.test` } });
    if (memberUser) {
      await memberUser.update({ teamId: teamPhoenix.id });
    }

    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: `Ranking Admin ${ts}`,
        email: `ranking_admin_${ts}@workrank.test`,
        password: 'Password123!',
      });
    adminToken = adminRes.body.accessToken || adminRes.body.token || adminRes.body.data?.token;

    adminUser = await User.findOne({ where: { email: `ranking_admin_${ts}@workrank.test` } });
    if (adminUser) {
      await adminUser.update({ role: 'admin', teamId: teamDragon.id });
    }

    // 3. Create Season & Grand Championship
    activeSeason = await Season.create({
      name: `Consolidation Season ${ts}`,
      slug: `consolidation-season-${ts}`,
      seasonType: 'STANDARD',
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 3600000),
      endAt: new Date(Date.now() + 86400000),
    });

    currentGrand = await GrandChampionship.create({
      name: `Grand Championship 2026 ${ts}`,
      slug: `grand-championship-2026-${ts}`,
      year: 2026,
      status: 'ACTIVE',
      startAt: new Date(Date.now() - 86400000),
      endAt: new Date(Date.now() + 86400000 * 30),
    });

    // Link Season to Grand
    await activeSeason.update({
      grandChampionshipId: currentGrand.id,
    });

    // 4. Populate Projections & Read Models
    await SeasonLeaderboardProjection.create({
      seasonId: activeSeason.id,
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      teamColor: '#0284c7',
      score: 1250,
      rank: 1,
      activeMembersCount: 5,
    });
    await SeasonLeaderboardProjection.create({
      seasonId: activeSeason.id,
      teamId: teamDragon.id,
      teamName: teamDragon.name,
      teamColor: '#ea580c',
      score: 980,
      rank: 2,
      activeMembersCount: 4,
    });

    await SeasonIndividualLeaderboardProjection.create({
      seasonId: activeSeason.id,
      userId: memberUser.id,
      userName: memberUser.name,
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      points: 650,
      rank: 1,
    });
    await SeasonIndividualLeaderboardProjection.create({
      seasonId: activeSeason.id,
      userId: adminUser.id,
      userName: adminUser.name,
      teamId: teamDragon.id,
      teamName: teamDragon.name,
      points: 420,
      rank: 2,
    });

    await GrandLeaderboardProjection.create({
      grandId: currentGrand.id,
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      grandPoints: 100,
      rank: 1,
      seasonsWon: 1,
      podiumCount: 1,
    });

    await GrandIndividualLeaderboardProjection.create({
      grandId: currentGrand.id,
      userId: memberUser.id,
      userName: memberUser.name,
      userEmail: memberUser.email,
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      grandPoints: 85,
      rank: 1,
    });

    await CompetitionUserSummary.create({
      userId: memberUser.id,
      currentSeasonId: activeSeason.id,
      currentSeasonScore: 1500,
      grandChampionshipId: currentGrand.id,
      seasonWins: 2,
      grandPoints: 85,
      metadata: {
        userName: memberUser.name,
        teamName: teamPhoenix.name,
        mvpCount: 2,
      },
    });

    await CompetitionTeamSummary.create({
      teamId: teamPhoenix.id,
      teamName: teamPhoenix.name,
      currentSeasonScore: 3500,
      seasonWins: 2,
      grandPoints: 200,
      membersCount: 6,
    });

    await TeamYouTubeSummary.create({
      teamId: teamDragon.id,
      channelsCount: 2,
      totalViews: 450000,
      totalSubscribers: 12500,
      viewsGrowth30dPct: 18.5,
      rankByViews: 1,
      rankBySubs: 1,
      rankByGrowth: 1,
    });
  });

  after(async () => {
    // Cleanup created test records
    await SeasonLeaderboardProjection.destroy({ where: { seasonId: activeSeason.id } });
    await SeasonIndividualLeaderboardProjection.destroy({ where: { seasonId: activeSeason.id } });
    await GrandLeaderboardProjection.destroy({ where: { grandId: currentGrand.id } });
    await GrandIndividualLeaderboardProjection.destroy({ where: { grandId: currentGrand.id } });
    await CompetitionUserSummary.destroy({ where: { userId: memberUser.id } });
    await CompetitionTeamSummary.destroy({ where: { teamId: teamPhoenix.id } });
    await TeamYouTubeSummary.destroy({ where: { teamId: teamDragon.id } });
    await Season.destroy({ where: { id: activeSeason.id } });
    await GrandChampionship.destroy({ where: { id: currentGrand.id } });
    await User.destroy({ where: { id: [memberUser.id, adminUser.id] } });
    await Team.destroy({ where: { id: [teamPhoenix.id, teamDragon.id] } });
  });

  describe('1. Security & RBAC Gates', () => {
    it('Rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/rankings/overview');
      assert.equal(res.status, 401);
    });

    it('Allows authenticated member access with 200', async () => {
      const res = await request(app)
        .get('/api/rankings/overview')
        .set('Authorization', `Bearer ${memberToken}`);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
    });
  });

  describe('2. Canonical Overview Snapshot API', () => {
    it('GET /api/rankings/overview returns active season, grand, youtube and platform stats', async () => {
      const res = await request(app)
        .get('/api/rankings/overview')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(res.body.activeSeason);
      assert.ok(res.body.currentGrand);
      assert.ok(res.body.stats);

      // Verify active season leaders
      assert.ok(Array.isArray(res.body.activeSeason.topTeams));
      assert.ok(res.body.activeSeason.topTeams.length > 0);
      const topTeam = res.body.activeSeason.topTeams.find((t) => t.teamId === teamPhoenix.id);
      assert.ok(topTeam);
      assert.equal(topTeam.totalScore, 1250);

      // Verify individual leaders
      assert.ok(Array.isArray(res.body.activeSeason.topIndividuals));
      const topInd = res.body.activeSeason.topIndividuals.find((i) => i.userId === memberUser.id);
      assert.ok(topInd);
      assert.equal(topInd.score, 650);
    });
  });

  describe('3. Team Rankings API', () => {
    it('GET /api/rankings/teams?scope=season returns season team rankings', async () => {
      const res = await request(app)
        .get(`/api/rankings/teams?scope=season&seasonId=${activeSeason.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.scope, 'season');
      assert.equal(res.body.items.length, 2);
      assert.equal(res.body.items[0].teamName, teamPhoenix.name);
      assert.equal(res.body.items[0].rank, 1);
    });

    it('GET /api/rankings/teams?scope=grand returns grand championship team standings', async () => {
      const res = await request(app)
        .get(`/api/rankings/teams?scope=grand&grandId=${currentGrand.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.scope, 'grand');
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].grandPoints, 100);
    });

    it('GET /api/rankings/teams?scope=all-time returns cumulative lifetime team ranking', async () => {
      const res = await request(app)
        .get('/api/rankings/teams?scope=all-time')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.scope, 'all-time');
      assert.ok(res.body.items.length >= 1);
      const phoenix = res.body.items.find((t) => t.teamId === teamPhoenix.id);
      assert.ok(phoenix);
      assert.equal(phoenix.totalScore, 3500);
    });
  });

  describe('4. Individual Rankings API', () => {
    it('GET /api/rankings/individuals?scope=season returns season individual rankings', async () => {
      const res = await request(app)
        .get(`/api/rankings/individuals?scope=season&seasonId=${activeSeason.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.scope, 'season');
      assert.equal(res.body.items.length, 2);
      assert.equal(res.body.items[0].userName, memberUser.name);
      assert.equal(res.body.items[0].score, 650);
    });

    it('GET /api/rankings/individuals with search query filters users accurately', async () => {
      const res = await request(app)
        .get(`/api/rankings/individuals?scope=season&seasonId=${activeSeason.id}&search=Ranking%20Member`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].userId, memberUser.id);
    });

    it('GET /api/rankings/individuals with teamId filter isolates team members', async () => {
      const res = await request(app)
        .get(`/api/rankings/individuals?scope=season&seasonId=${activeSeason.id}&teamId=${teamPhoenix.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].teamId, teamPhoenix.id);
    });

    it('GET /api/rankings/individuals?scope=grand returns grand championship individual standings', async () => {
      const res = await request(app)
        .get(`/api/rankings/individuals?scope=grand&grandId=${currentGrand.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.scope, 'grand');
      assert.equal(res.body.items.length, 1);
      assert.equal(res.body.items[0].grandPoints, 85);
    });
  });

  describe('5. Selectors & YouTube Rankings', () => {
    it('GET /api/rankings/seasons lists available seasons', async () => {
      const res = await request(app)
        .get('/api/rankings/seasons')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.seasons));
      assert.ok(res.body.seasons.some((s) => s.id === activeSeason.id));
    });

    it('GET /api/rankings/grands lists available grand championships', async () => {
      const res = await request(app)
        .get('/api/rankings/grands')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.grands));
      assert.ok(res.body.grands.some((g) => g.id === currentGrand.id));
    });

    it('GET /api/rankings/youtube returns media performance rankings', async () => {
      const res = await request(app)
        .get('/api/rankings/youtube?sortBy=views')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      const dragon = res.body.items.find((t) => t.teamId === teamDragon.id);
      assert.ok(dragon);
      assert.equal(dragon.totalViews, 450000);
      assert.equal(dragon.totalSubscribers, 12500);
    });

    it('GET /api/rankings/top-performers returns Hall of Fame MVPs and Champions', async () => {
      const res = await request(app)
        .get('/api/rankings/top-performers')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.seasonMvps));
      assert.ok(Array.isArray(res.body.highScorers));
      assert.ok(Array.isArray(res.body.championTeams));

      const memberMvp = res.body.seasonMvps.find((m) => m.userId === memberUser.id);
      assert.ok(memberMvp);
      assert.equal(memberMvp.mvpCount, 2);
    });
  });

  describe('6. Zero Score Mutation Guarantee', () => {
    it('Querying rankings does not alter score ledgers or emit point mutations', async () => {
      const initialLedgerCount = await ScoreLedger.count();

      await request(app)
        .get('/api/rankings/overview')
        .set('Authorization', `Bearer ${memberToken}`);

      await request(app)
        .get(`/api/rankings/teams?scope=season&seasonId=${activeSeason.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      await request(app)
        .get(`/api/rankings/individuals?scope=season&seasonId=${activeSeason.id}`)
        .set('Authorization', `Bearer ${memberToken}`);

      const postLedgerCount = await ScoreLedger.count();
      assert.equal(initialLedgerCount, postLedgerCount, 'ScoreLedger count MUST remain strictly immutable during read queries');
    });
  });
});
