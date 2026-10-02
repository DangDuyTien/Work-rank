'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  sequelize,
  User,
  Team,
  YouTubeChannel,
  YouTubeChannelMetric,
  TeamYouTubeSummary,
  CompetitionUserSummary,
} = require('../src/models');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');

describe('Dashboard & YouTube Overview Upgrade E2E Test Suite', () => {
  let adminToken;
  let memberToken;
  let unassignedMemberToken;
  let adminUser;
  let memberUser;
  let unassignedMemberUser;
  let testTeam;
  let assignedChannel;
  let unassignedChannel;
  let userDirectChannel;

  before(async () => {
    // 1. Create Team
    testTeam = await Team.create({
      name: `Team Alpha ${Date.now()}`,
      description: 'Test Team for Dashboard Upgrade',
    });

    // 2. Create Admin
    adminUser = await User.create({
      name: 'Admin Dashboard',
      email: `admin_dash_${Date.now()}@workrank.test`,
      passwordHash: 'dummyhash',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign(
      { sub: adminUser.id, email: adminUser.email, role: 'admin', teamId: null },
      env.jwtSecret
    );

    // 3. Create Member belonging to testTeam
    memberUser = await User.create({
      name: 'Member Alpha',
      email: `member_dash_${Date.now()}@workrank.test`,
      passwordHash: 'dummyhash',
      role: 'user',
      teamId: testTeam.id,
      status: 'active',
    });
    memberToken = jwt.sign(
      { sub: memberUser.id, email: memberUser.email, role: 'user', teamId: testTeam.id },
      env.jwtSecret
    );

    // Set competition summary for member ranking
    await CompetitionUserSummary.upsert({
      userId: memberUser.id,
      currentSeasonScore: 500,
      seasonWins: 2,
    });

    // 4. Create Unassigned Member (no team)
    unassignedMemberUser = await User.create({
      name: 'Unassigned Member',
      email: `unassigned_dash_${Date.now()}@workrank.test`,
      passwordHash: 'dummyhash',
      role: 'user',
      teamId: null,
      status: 'active',
    });
    unassignedMemberToken = jwt.sign(
      { sub: unassignedMemberUser.id, email: unassignedMemberUser.email, role: 'user', teamId: null },
      env.jwtSecret
    );

    // 5. Create Channels
    // Channel A: Belongs to Team Alpha
    assignedChannel = await YouTubeChannel.create({
      channelId: `UC_alpha_${Date.now()}`,
      title: 'Alpha Team Channel',
      customUrl: `@alpha_${Date.now()}`,
      teamId: testTeam.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
      lastSyncedAt: new Date(),
    });

    // Channel B: Unassigned Channel (teamId = null)
    unassignedChannel = await YouTubeChannel.create({
      channelId: `UC_unassigned_${Date.now()}`,
      title: 'Unassigned Standalone Channel',
      customUrl: `@unassigned_${Date.now()}`,
      teamId: null,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
      lastSyncedAt: new Date(),
    });

    // Channel C: Directly assigned to unassignedMemberUser
    userDirectChannel = await YouTubeChannel.create({
      channelId: `UC_user_direct_${Date.now()}`,
      title: 'User Direct Channel',
      customUrl: `@user_direct_${Date.now()}`,
      teamId: null,
      assignedUserId: unassignedMemberUser.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
      lastSyncedAt: new Date(),
    });

    // 6. Create Historical Metrics (Snapshots)
    const now = Date.now();
    const t35d = new Date(now - 35 * 86400000);
    const t15d = new Date(now - 15 * 86400000);
    const tToday = new Date(now);

    // Assigned Channel has baseline 35 days ago (10,000 views) and today (15,000 views)
    await YouTubeChannelMetric.create({
      channelId: assignedChannel.id,
      capturedAt: t35d,
      views: 10000,
      subscribers: 1000,
    });
    await YouTubeChannelMetric.create({
      channelId: assignedChannel.id,
      capturedAt: t15d,
      views: 12000,
      subscribers: 1100,
    });
    await YouTubeChannelMetric.create({
      channelId: assignedChannel.id,
      capturedAt: tToday,
      views: 15000,
      subscribers: 1200,
    });

    // Unassigned Channel has ONLY 1 snapshot today (no baseline in the past)
    await YouTubeChannelMetric.create({
      channelId: unassignedChannel.id,
      capturedAt: tToday,
      views: 5000,
      subscribers: 500,
    });

    // User Direct Channel has snapshots
    await YouTubeChannelMetric.create({
      channelId: userDirectChannel.id,
      capturedAt: t15d,
      views: 2000,
      subscribers: 200,
    });
    await YouTubeChannelMetric.create({
      channelId: userDirectChannel.id,
      capturedAt: tToday,
      views: 2500,
      subscribers: 250,
    });

    // Recalculate summary
    await youtubeAggregationService.aggregateTeamYouTubeSummary(testTeam.id);
  });

  after(async () => {
    // Cleanup created records
    if (assignedChannel) {
      await YouTubeChannelMetric.destroy({ where: { channelId: assignedChannel.id } });
      await assignedChannel.destroy();
    }
    if (unassignedChannel) {
      await YouTubeChannelMetric.destroy({ where: { channelId: unassignedChannel.id } });
      await unassignedChannel.destroy();
    }
    if (userDirectChannel) {
      await YouTubeChannelMetric.destroy({ where: { channelId: userDirectChannel.id } });
      await userDirectChannel.destroy();
    }
    if (testTeam) {
      await TeamYouTubeSummary.destroy({ where: { teamId: testTeam.id } });
      await testTeam.destroy();
    }
  });

  describe('1. Growth Formula & Data Integrity', () => {
    test('Channel with only 1 snapshot returns growth = null, NOT fake +100%', async () => {
      const leaderboardRes = await request(app)
        .get(`/api/youtube/leaderboard?view=channels&search=${unassignedChannel.title}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(leaderboardRes.status, 200);
      const ch = leaderboardRes.body.items.find((i) => i.id === unassignedChannel.id);
      assert.ok(ch);
      assert.equal(ch.views, 5000);
      // Data integrity: Without baseline in past, growth must be null (not 100.0)
      assert.equal(ch.viewsGrowth30dPct, null);
    });

    test('Channel with valid baseline computes real percentage growth', async () => {
      const leaderboardRes = await request(app)
        .get(`/api/youtube/leaderboard?view=channels&search=${assignedChannel.title}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(leaderboardRes.status, 200);
      const ch = leaderboardRes.body.items.find((i) => i.id === assignedChannel.id);
      assert.ok(ch);
      assert.equal(ch.views, 15000);
      // Gained 5,000 views from baseline 10,000 => 50.0%
      assert.equal(Number(ch.viewsGrowth30dPct), 50.0);
    });
  });

  describe('2. Company Historical Time-Series Endpoint (/api/youtube/history)', () => {
    test('GET /api/youtube/history returns daily snapshots and supports period parameter', async () => {
      const res = await request(app)
        .get('/api/youtube/history?period=30d')
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.history));
      assert.ok(res.body.history.length > 0);
      assert.ok(res.body.history[0].date);
      assert.ok(typeof res.body.history[0].views === 'number');
      assert.ok(typeof res.body.history[0].subscribers === 'number');
      assert.equal(res.body.period, '30d');
      assert.ok(res.body.kpis);
    });

    test('Periods 7d, 90d, 12m respond with status 200 and formatted period', async () => {
      for (const p of ['7d', '90d', '12m']) {
        const res = await request(app)
          .get(`/api/youtube/history?period=${p}`)
          .set('Authorization', `Bearer ${adminToken}`);
        assert.equal(res.status, 200);
        assert.equal(res.body.period, p);
      }
    });
  });

  describe('3. Member Personal Dashboard ("CỦA TÔI" - /api/youtube/my-overview)', () => {
    test('Member with team receives personal profile, canonical ranking, team summary and channels', async () => {
      const res = await request(app)
        .get('/api/youtube/my-overview?period=30d')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.user);
      assert.equal(res.body.user.name, 'Member Alpha');
      assert.ok(res.body.ranking);
      assert.equal(res.body.ranking.score, 500);
      assert.ok(res.body.team);
      assert.equal(res.body.team.name, testTeam.name);
      assert.ok(res.body.teamSummary);
      assert.ok(Array.isArray(res.body.channels));
      assert.ok(res.body.channels.some((c) => c.id === assignedChannel.id));
      assert.ok(Array.isArray(res.body.history));
    });

    test('Unassigned member receives graceful unassigned team state with directly assigned channel', async () => {
      const res = await request(app)
        .get('/api/youtube/my-overview?period=30d')
        .set('Authorization', `Bearer ${unassignedMemberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.team, null);
      assert.equal(res.body.teamSummary, null);
      // Directly assigned channel must appear!
      assert.ok(Array.isArray(res.body.channels));
      assert.ok(res.body.channels.some((c) => c.id === userDirectChannel.id));
      const directCh = res.body.channels.find((c) => c.id === userDirectChannel.id);
      assert.equal(directCh.isDirectlyAssigned, true);
    });
  });

  describe('4. Direct Assigned Channel Permission & Anti-IDOR', () => {
    test('Unassigned member can access their directly assigned channel details without 403', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${userDirectChannel.id}`)
        .set('Authorization', `Bearer ${unassignedMemberToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, userDirectChannel.id);
      assert.equal(res.body.assignedUserId, unassignedMemberUser.id);
      assert.ok(Array.isArray(res.body.history));
    });

    test('Member is BLOCKED with 403 when trying to access a channel of another team they are not assigned to', async () => {
      // Unassigned member tries to access assignedChannel (which belongs to testTeam and is not assigned to them)
      const res = await request(app)
        .get(`/api/youtube/channels/${assignedChannel.id}`)
        .set('Authorization', `Bearer ${unassignedMemberToken}`);

      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'CROSS_CHANNEL_FORBIDDEN');
    });

    test('Admin has full access to any channel including unassigned and foreign teams', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${assignedChannel.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      assert.equal(res.status, 200);
      assert.equal(res.body.id, assignedChannel.id);
    });
  });
});
