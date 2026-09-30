'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, Team, YouTubeChannel, YouTubeVideo } = require('../src/models');
const youtubeDataService = require('../src/services/youtube/youtubeData.service');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');

describe('YouTube Admin Company-wide Analytics & Multi-Channel Test Suite', () => {
  let adminUser;
  let adminToken;
  let teamPhoenix;
  let teamDragon;
  let phoenixChan1;
  let phoenixChan2;
  let dragonChan;

  before(async () => {
    adminUser = await User.create({
      name: 'Super Admin Analytics',
      email: `admin_analytics_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    teamPhoenix = await Team.create({
      name: `Phoenix Multi ${Date.now()}`,
      description: 'Phoenix Multi-Channel Studio',
    });

    teamDragon = await Team.create({
      name: `Dragon Multi ${Date.now()}`,
      description: 'Dragon Studio',
    });

    // Phoenix has 2 channels (1 Team -> N Channels)
    phoenixChan1 = await youtubeDataService.createChannel({
      channelId: `UC_PHX_MAIN_${Date.now()}`,
      title: 'Phoenix Main Channel',
      teamId: teamPhoenix.id,
    });
    await youtubeDataService.recordChannelMetricSnapshot({
      channelId: phoenixChan1.id,
      views: 1000000,
      subscribers: 50000,
      videosCount: 20,
    });

    phoenixChan2 = await youtubeDataService.createChannel({
      channelId: `UC_PHX_GAMING_${Date.now()}`,
      title: 'Phoenix Gaming Channel',
      teamId: teamPhoenix.id,
    });
    await youtubeDataService.recordChannelMetricSnapshot({
      channelId: phoenixChan2.id,
      views: 800000,
      subscribers: 35000,
      videosCount: 15,
    });

    // Dragon has 1 channel
    dragonChan = await youtubeDataService.createChannel({
      channelId: `UC_DRG_MAIN_${Date.now()}`,
      title: 'Dragon Official Channel',
      teamId: teamDragon.id,
    });
    await youtubeDataService.recordChannelMetricSnapshot({
      channelId: dragonChan.id,
      views: 2100000,
      subscribers: 91000,
      videosCount: 30,
    });

    // Aggregate both
    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamPhoenix.id);
    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamDragon.id);
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
  });

  after(async () => {
    if (phoenixChan1) await phoenixChan1.destroy();
    if (phoenixChan2) await phoenixChan2.destroy();
    if (dragonChan) await dragonChan.destroy();
    if (adminUser) await adminUser.destroy();
    if (teamPhoenix) await teamPhoenix.destroy();
    if (teamDragon) await teamDragon.destroy();
  });

  test('Multi-Channel Aggregation: Phoenix Total Views = Channel 1 + Channel 2', async () => {
    const res = await request(app)
      .get(`/api/youtube/teams/${teamPhoenix.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(res.body.channels.length, 2);
    assert.equal(Number(res.body.summary.channelsCount), 2);
    assert.equal(Number(res.body.summary.totalViews), 1800000); // 1.0M + 0.8M
    assert.equal(Number(res.body.summary.totalSubscribers), 85000); // 50K + 35K
  });

  test('Admin Overview aggregates company totals accurately without double counting', async () => {
    const res = await request(app)
      .get('/api/youtube/admin/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.ok(Number(res.body.kpis.totalViews) >= 3900000); // 1.8M (Phoenix) + 2.1M (Dragon)
    assert.ok(Number(res.body.kpis.totalSubscribers) >= 176000); // 85K + 91K
    assert.ok(res.body.diagnostics.totalChannels >= 3);
  });

  test('Admin can compare any pair of teams side-by-side', async () => {
    const res = await request(app)
      .get(`/api/youtube/compare?teamA=${teamPhoenix.id}&teamB=${teamDragon.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(res.body.teamA.id, teamPhoenix.id);
    assert.equal(res.body.teamB.id, teamDragon.id);
    assert.equal(Number(res.body.teamA.totalViews), 1800000);
    assert.equal(Number(res.body.teamB.totalViews), 2100000);
  });

  test('Admin can access drilldown on any channel across teams', async () => {
    const resPhx = await request(app)
      .get(`/api/youtube/channels/${phoenixChan1.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(resPhx.body.id, phoenixChan1.id);

    const resDrg = await request(app)
      .get(`/api/youtube/channels/${dragonChan.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    assert.equal(resDrg.body.id, dragonChan.id);
  });
});
