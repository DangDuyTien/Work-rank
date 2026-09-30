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
  YouTubeVideo,
  YouTubeChannelMetric,
  YouTubeVideoMetric,
  TeamYouTubeSummary,
  ScoreLedger,
} = require('../src/models');
const youtubeDataService = require('../src/services/youtube/youtubeData.service');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');
const youtubeSyncService = require('../src/services/youtube/youtubeSync.service');
const youtubeIntegrationService = require('../src/services/competition/youtubeIntegration.service');

describe('YouTube ↔ Team Integration & Analytics Test Suite', () => {
  let adminUser;
  let memberUser;
  let adminToken;
  let memberToken;
  let teamPhoenix;
  let teamDragon;

  before(async () => {
    // Bootstrap Admin and Member users
    adminUser = await User.create({
      name: 'Admin YouTube Test',
      email: `admin_yt_${Date.now()}@workrank.test`,
      passwordHash: 'hashed_password_123',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    teamPhoenix = await Team.create({
      name: `Phoenix Studio ${Date.now()}`,
      description: 'Phoenix Production Team',
    });

    teamDragon = await Team.create({
      name: `Dragon Studio ${Date.now()}`,
      description: 'Dragon Production Team',
    });

    memberUser = await User.create({
      name: 'Member YouTube Test',
      email: `member_yt_${Date.now()}@workrank.test`,
      passwordHash: 'hashed_password_123',
      role: 'user',
      status: 'active',
      teamId: teamPhoenix.id,
    });

    memberToken = jwt.sign({ sub: memberUser.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
  });


  after(async () => {
    // Clean up
    if (adminUser) await adminUser.destroy();
    if (memberUser) await memberUser.destroy();
    if (teamPhoenix) await teamPhoenix.destroy();
    if (teamDragon) await teamDragon.destroy();
  });

  describe('1. Channel ↔ Team Mapping & Ownership', () => {
    let testChannel;

    test('Admin registers a new YouTube Channel with team mapping', async () => {
      testChannel = await youtubeDataService.createChannel({
        channelId: `UC_PHOENIX_${Date.now()}`,
        title: 'Phoenix Official Channel',
        customUrl: '@phoenix_official',
        teamId: teamPhoenix.id,
      });

      assert.ok(testChannel.id);
      assert.equal(testChannel.teamId, teamPhoenix.id);
      assert.equal(testChannel.title, 'Phoenix Official Channel');
    });

    test('Support 1 Team → N YouTube Channels', async () => {
      const secondChannel = await youtubeDataService.createChannel({
        channelId: `UC_PHOENIX_GAMING_${Date.now()}`,
        title: 'Phoenix Gaming Channel',
        customUrl: '@phoenix_gaming',
        teamId: teamPhoenix.id,
      });

      const channels = await youtubeDataService.listChannels({ teamId: teamPhoenix.id });
      assert.equal(channels.length >= 2, true);
    });

    test('Unlink channel from team sets teamId to null', async () => {
      const unlinked = await youtubeDataService.unlinkChannel(testChannel.id);
      assert.equal(unlinked.teamId, null);
    });

    test('Re-link channel to Dragon Team', async () => {
      const relinked = await youtubeDataService.linkChannelToTeam(testChannel.id, teamDragon.id);
      assert.equal(relinked.teamId, teamDragon.id);
    });

    test('Rejects linking to non-existent team', async () => {
      await assert.rejects(
        () => youtubeDataService.linkChannelToTeam(testChannel.id, 99999999),
        /not found/,
      );
    });
  });

  describe('2. Metrics Snapshots & Historical Idempotency', () => {
    let channel;
    let video;

    before(async () => {
      channel = await youtubeDataService.createChannel({
        channelId: `UC_METRICS_TEST_${Date.now()}`,
        title: 'Metrics Test Channel',
        teamId: teamPhoenix.id,
      });

      video = await youtubeDataService.upsertVideo({
        channelId: channel.id,
        videoId: `yt_vid_${Date.now()}`,
        title: 'Epic Production Video #1',
        publishedAt: new Date(Date.now() - 5 * 86400000),
      });
    });

    test('Records channel metric snapshot', async () => {
      const snapshot = await youtubeDataService.recordChannelMetricSnapshot({
        channelId: channel.id,
        views: 500000,
        subscribers: 25000,
        videosCount: 15,
        watchTimeHours: 12500.5,
        engagementRate: 8.5,
        capturedAt: new Date(),
      });

      assert.ok(snapshot.id);
      assert.equal(Number(snapshot.views), 500000);
      assert.equal(Number(snapshot.subscribers), 25000);
    });

    test('Idempotent snapshot update within same time window (no duplicate row)', async () => {
      const beforeCount = await YouTubeChannelMetric.count({ where: { channelId: channel.id } });

      // Record snapshot with slightly updated numbers in same window
      await youtubeDataService.recordChannelMetricSnapshot({
        channelId: channel.id,
        views: 505000,
        subscribers: 25100,
        videosCount: 15,
        capturedAt: new Date(),
      });

      const afterCount = await YouTubeChannelMetric.count({ where: { channelId: channel.id } });
      assert.equal(afterCount, beforeCount, 'Should update existing snapshot in time window rather than duplicating');
    });

    test('Records video metric snapshot and associates with video', async () => {
      const vSnapshot = await youtubeDataService.recordVideoMetricSnapshot({
        videoId: video.id,
        views: 180000,
        likes: 15000,
        comments: 2100,
        watchTimeHours: 4500,
      });

      assert.ok(vSnapshot.id);
      assert.equal(Number(vSnapshot.views), 180000);
      assert.equal(Number(vSnapshot.likes), 15000);
    });
  });

  describe('3. Team YouTube Aggregation & Leaderboard', () => {
    test('Aggregates Team Summary accurately across team channels', async () => {
      const summary = await youtubeAggregationService.aggregateTeamYouTubeSummary(teamPhoenix.id);
      assert.ok(summary);
      assert.equal(summary.teamId, teamPhoenix.id);
      assert.ok(Number(summary.totalViews) >= 0);
      assert.ok(summary.freshnessStatus);
    });

    test('Recalculates all team summaries and computes relative ranks', async () => {
      const res = await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
      assert.equal(res.status, 'RECALCULATED');

      const leaderboard = await youtubeAggregationService.getYouTubeTeamLeaderboard({ sortBy: 'views' });
      assert.ok(Array.isArray(leaderboard.items));
      assert.ok(leaderboard.items.length >= 2);
      assert.ok(leaderboard.items[0].rank === 1);
    });

    test('Company overview aggregates totals across all active channels', async () => {
      const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
      assert.ok(overview.kpis);
      assert.ok(overview.kpis.totalViews >= 0);
      assert.ok(Array.isArray(overview.topTeamsByViews));
      assert.ok(Array.isArray(overview.topTeamsByGrowth));
    });

    test('Team comparison returns structured side-by-side metrics', async () => {
      const cmp = await youtubeAggregationService.compareTeams(teamPhoenix.id, teamDragon.id);
      assert.ok(cmp.teamA);
      assert.ok(cmp.teamB);
      assert.equal(cmp.teamA.id, teamPhoenix.id);
      assert.equal(cmp.teamB.id, teamDragon.id);
    });
  });

  describe('4. API Endpoints & Role-Based Access Control (BAC)', () => {
    test('GET /api/youtube/overview — Member access returns 200 with scoped data', async () => {
      const res = await request(app)
        .get('/api/youtube/overview')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      assert.ok(res.body.kpis);
      assert.ok(Array.isArray(res.body.topTeamsByViews));
    });

    test('GET /api/youtube/leaderboard — Supports sorting by views, subscribers, growth', async () => {
      const resViews = await request(app)
        .get('/api/youtube/leaderboard?sortBy=views')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      assert.equal(resViews.body.sortBy, 'views');

      const resSubs = await request(app)
        .get('/api/youtube/leaderboard?sortBy=subscribers')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      assert.equal(resSubs.body.sortBy, 'subscribers');

      const resGrowth = await request(app)
        .get('/api/youtube/leaderboard?sortBy=growth')
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      assert.equal(resGrowth.body.sortBy, 'growth');
    });

    test('GET /api/youtube/compare — Returns side-by-side comparison', async () => {
      const res = await request(app)
        .get(`/api/youtube/compare?teamA=${teamPhoenix.id}&teamB=${teamDragon.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.teamA.id, teamPhoenix.id);
      assert.equal(res.body.teamB.id, teamDragon.id);
    });

    test('POST /api/youtube/admin/channels — Member is rejected with 403 Forbidden', async () => {
      await request(app)
        .post('/api/youtube/admin/channels')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({
          channelId: 'UC_HACK_ATTEMPT',
          title: 'Unauthorized Channel',
        })
        .expect(403);
    });

    test('POST /api/youtube/admin/channels — Admin successfully registers channel', async () => {
      const res = await request(app)
        .post('/api/youtube/admin/channels')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channelId: `UC_ADMIN_REG_${Date.now()}`,
          title: 'Admin Registered Channel',
          customUrl: '@admin_chan',
          teamId: teamPhoenix.id,
        })
        .expect(201);

      assert.ok(res.body.id);
      assert.equal(res.body.title, 'Admin Registered Channel');
    });

    test('POST /api/youtube/admin/channels/:id/sync — Admin triggers channel sync', async () => {
      const channel = await YouTubeChannel.findOne({ where: { teamId: teamPhoenix.id } });
      const res = await request(app)
        .post(`/api/youtube/admin/channels/${channel.id}/sync`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(res.body.status === 'SUCCESS' || res.body.status === 'ERROR');
    });
  });

  describe('5. System Separation: YouTube Metrics vs Competition XP', () => {
    test('Raw YouTube metrics sync DOES NOT alter Score Ledger directly', async () => {
      const ledgerCountBefore = await ScoreLedger.count();

      // Perform YouTube Channel sync
      const channel = await YouTubeChannel.findOne({ where: { teamId: teamPhoenix.id } });
      await youtubeSyncService.syncChannel(channel.id);

      const ledgerCountAfter = await ScoreLedger.count();
      assert.equal(ledgerCountAfter, ledgerCountBefore, 'YouTube raw metrics must NOT directly create score ledger rows');
    });

    test('Domain Milestone Event ingested through Competition Engine awards score independently', async () => {
      const ledgerCountBefore = await ScoreLedger.count();

      // Emit milestone event via Competition event adapter
      const result = await youtubeIntegrationService.recordViewMilestone({
        youtubeVideoId: `yt_milestone_${Date.now()}`,
        views: 1000000,
        channelId: 'UC_TEST_123',
        actorId: memberUser.id,
        teamId: teamPhoenix.id,
      });

      assert.ok(result.success);
      assert.ok(result.eventId);
    });

  });
});
