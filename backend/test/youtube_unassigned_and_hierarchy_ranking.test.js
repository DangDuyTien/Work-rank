'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/app');
const {
  sequelize,
  User,
  Team,
  YouTubeChannel,
  YouTubeChannelMetric,
  TeamYouTubeSummary,
} = require('../src/models');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');
const youtubeSyncService = require('../src/services/youtube/youtubeSync.service');

describe('YouTube Unassigned Channels & Hierarchical Ranking Test Suite', () => {
  let adminToken;
  let memberToken;
  let teamAlpha;
  let teamBeta;
  let channelAlpha1;
  let channelAlpha2;
  let channelBeta1;
  let channelUnassigned1;
  let channelUnassigned2;

  before(async () => {
    // 1. Create Admin & Member users
    const adminRes = await request(app).post('/api/auth/register').send({
      email: `yt_admin_${Date.now()}@workrank.io`,
      password: 'Password123!',
      name: 'YouTube Admin',
      role: 'admin',
    });
    adminToken = adminRes.body.accessToken || adminRes.body.token;

    // 2. Create Teams
    teamAlpha = await Team.create({ name: 'Alpha Studio', description: 'Alpha production team' });
    teamBeta = await Team.create({ name: 'Beta Media', description: 'Beta media team' });

    const memberRes = await request(app).post('/api/auth/register').send({
      email: `yt_member_${Date.now()}@workrank.io`,
      password: 'Password123!',
      name: 'Alpha Member',
      teamId: teamAlpha.id,
    });
    memberToken = memberRes.body.accessToken || memberRes.body.token;

    // 3. Create Channels:
    // Team Alpha: Channel A1 (1,000 views, 100 subs), Channel A2 (2,000 views, 200 subs) => Team Alpha = 3,000 views, 300 subs
    // Team Beta: Channel B1 (4,000 views, 400 subs) => Team Beta = 4,000 views, 400 subs
    // Unassigned: Channel U1 (5,000 views, 500 subs), Channel U2 (6,000 views, 600 subs) => Unassigned = 11,000 views, 1,100 subs
    // Company Total = 3,000 + 4,000 + 11,000 = 18,000 views, 1,800 subs!

    channelAlpha1 = await YouTubeChannel.create({
      channelId: `UC_alpha_1_${Date.now()}`,
      title: 'Alpha Channel 1',
      teamId: teamAlpha.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: channelAlpha1.id,
      views: 1000,
      subscribers: 100,
      capturedAt: new Date(),
    });

    channelAlpha2 = await YouTubeChannel.create({
      channelId: `UC_alpha_2_${Date.now()}`,
      title: 'Alpha Channel 2',
      teamId: teamAlpha.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: channelAlpha2.id,
      views: 2000,
      subscribers: 200,
      capturedAt: new Date(),
    });

    channelBeta1 = await YouTubeChannel.create({
      channelId: `UC_beta_1_${Date.now()}`,
      title: 'Beta Channel 1',
      teamId: teamBeta.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: channelBeta1.id,
      views: 4000,
      subscribers: 400,
      capturedAt: new Date(),
    });

    channelUnassigned1 = await YouTubeChannel.create({
      channelId: `UC_unassigned_1_${Date.now()}`,
      title: 'Unassigned Channel 1',
      teamId: null, // Unassigned!
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: channelUnassigned1.id,
      views: 5000,
      subscribers: 500,
      capturedAt: new Date(),
    });

    channelUnassigned2 = await YouTubeChannel.create({
      channelId: `UC_unassigned_2_${Date.now()}`,
      title: 'Unassigned Channel 2',
      teamId: null, // Unassigned!
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: channelUnassigned2.id,
      views: 6000,
      subscribers: 600,
      capturedAt: new Date(),
    });

    // Run aggregations
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
  });

  after(async () => {
    // Cleanup created test records
    await YouTubeChannelMetric.destroy({ where: { channelId: [channelAlpha1.id, channelAlpha2.id, channelBeta1.id, channelUnassigned1.id, channelUnassigned2.id] } });
    await YouTubeChannel.destroy({ where: { id: [channelAlpha1.id, channelAlpha2.id, channelBeta1.id, channelUnassigned1.id, channelUnassigned2.id] } });
    await TeamYouTubeSummary.destroy({ where: { teamId: [teamAlpha.id, teamBeta.id] } });
    await Team.destroy({ where: { id: [teamAlpha.id, teamBeta.id] } });
  });

  describe('1. Company Total vs Team Total Calculations', () => {
    it('Company Overview includes all channels (assigned + unassigned) in total views and subscribers', async () => {
      const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
      assert.ok(overview.kpis);
      assert.ok(overview.kpis.totalViews >= 18000, `Expected totalViews >= 18000, got ${overview.kpis.totalViews}`);
      assert.ok(overview.kpis.totalSubscribers >= 1800, `Expected totalSubscribers >= 1800, got ${overview.kpis.totalSubscribers}`);
      assert.ok(overview.kpis.unassignedChannelsCount >= 2);
      assert.ok(overview.kpis.unassignedViews >= 11000);
      assert.ok(overview.kpis.unassignedSubscribers >= 1100);
    });

    it('Team Alpha Summary strictly aggregates only Alpha channels (1,000 + 2,000 = 3,000 views)', async () => {
      const details = await youtubeAggregationService.getTeamYouTubeDetails(teamAlpha.id);
      assert.equal(Number(details.summary.totalViews), 3000);
      assert.equal(Number(details.summary.totalSubscribers), 300);
      assert.equal(details.channels.length, 2);
    });

    it('Team Beta Summary strictly aggregates only Beta channels (4,000 views)', async () => {
      const details = await youtubeAggregationService.getTeamYouTubeDetails(teamBeta.id);
      assert.equal(Number(details.summary.totalViews), 4000);
      assert.equal(Number(details.summary.totalSubscribers), 400);
      assert.equal(details.channels.length, 1);
    });
  });

  describe('2. Canonical Channel Leaderboard with Unassigned Channels', () => {
    it('getYouTubeChannelLeaderboard ranks all channels including unassigned channels', async () => {
      const leaderboard = await youtubeAggregationService.getYouTubeChannelLeaderboard({
        sortBy: 'views',
        limit: 500,
      });

      assert.ok(leaderboard.items.length >= 5);
      // Top channel should be Unassigned 2 (6,000 views) or higher
      const topChannel = leaderboard.items[0];
      assert.ok(topChannel.views >= 6000);

      const u2 = leaderboard.items.find((c) => c.id === channelUnassigned2.id);
      assert.ok(u2);
      assert.equal(u2.views, 6000);
      assert.equal(u2.subscribers, 600);
      assert.equal(u2.teamName, 'Chưa gán đội');
      assert.equal(u2.isUnassigned, true);
      assert.ok(u2.rank >= 1);

      const a1 = leaderboard.items.find((c) => c.id === channelAlpha1.id);
      assert.ok(a1);
      assert.equal(a1.views, 1000);
      assert.equal(a1.teamName, 'Alpha Studio');
      assert.equal(a1.isUnassigned, false);
    });

    it('getYouTubeChannelLeaderboard with teamId filters strictly to that team', async () => {
      const alphaLeaderboard = await youtubeAggregationService.getYouTubeChannelLeaderboard({
        teamId: teamAlpha.id,
        sortBy: 'views',
      });

      assert.equal(alphaLeaderboard.total, 2);
      assert.ok(alphaLeaderboard.items.every((c) => c.teamId === teamAlpha.id));
      assert.equal(alphaLeaderboard.items[0].id, channelAlpha2.id); // 2,000 views > 1,000 views
      assert.equal(alphaLeaderboard.items[0].rank, 1);
      assert.equal(alphaLeaderboard.items[1].id, channelAlpha1.id);
      assert.equal(alphaLeaderboard.items[1].rank, 2);
    });

    it('getYouTubeChannelLeaderboard with teamId = "unassigned" isolates unassigned channels', async () => {
      const unassignedLeaderboard = await youtubeAggregationService.getYouTubeChannelLeaderboard({
        teamId: 'unassigned',
        sortBy: 'views',
        limit: 500,
      });

      assert.ok(unassignedLeaderboard.total >= 2);
      assert.ok(unassignedLeaderboard.items.every((c) => c.teamId === null || c.isUnassigned));
    });
  });

  describe('3. Unified Ranking Hub API Integration', () => {
    it('GET /api/rankings/youtube?view=channels returns ranked channels', async () => {
      const res = await request(app)
        .get('/api/rankings/youtube?view=channels&sortBy=views&limit=500')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(Array.isArray(res.body.items));
      const foundU1 = res.body.items.find((c) => c.id === channelUnassigned1.id);
      assert.ok(foundU1);
      assert.equal(foundU1.teamName, 'Chưa gán đội');
    });

    it('GET /api/rankings/youtube?view=teams returns ranked teams', async () => {
      const res = await request(app)
        .get('/api/rankings/youtube?view=teams&sortBy=views&limit=500')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(res.body.success);
      assert.ok(Array.isArray(res.body.items));
      const foundBeta = res.body.items.find((t) => t.teamId === teamBeta.id);
      assert.ok(foundBeta);
      assert.equal(foundBeta.totalViews, 4000);
    });

    it('GET /api/youtube/leaderboard?view=channels returns channel rankings to authenticated users', async () => {
      const res = await request(app)
        .get('/api/youtube/leaderboard?view=channels&sortBy=views&limit=500')
        .set('Authorization', `Bearer ${memberToken}`);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.items));
      assert.ok(res.body.items.some((c) => c.id === channelUnassigned2.id));
    });
  });
});
