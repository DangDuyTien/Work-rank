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
} = require('../src/models');
const youtubeDataService = require('../src/services/youtube/youtubeData.service');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');

describe('YouTube Growth Baseline & Precision Audit Test Suite', () => {
  let adminUser;
  let adminToken;
  let teamBrandNew;
  let teamMixed;
  let chanBrandNew;
  let chanSecondSnapshot;
  let chanExistedOld;
  let chanMidMonth;
  let chanZeroBaseline;

  before(async () => {
    // 1. Create Admin
    adminUser = await User.create({
      name: 'Growth Audit Admin',
      email: `admin_growth_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    // 2. Create Teams
    teamBrandNew = await Team.create({
      name: `Brand New Team ${Date.now()}`,
      description: 'Team with only newly added channels',
    });

    teamMixed = await Team.create({
      name: `Mixed Team ${Date.now()}`,
      description: 'Team with both established and newly added channels',
    });

    // 3. Channels Setup

    // Channel 1 (CASE 1 / CASE 4): Just added, only 1 snapshot
    chanBrandNew = await YouTubeChannel.create({
      channelId: `UC_NEW_1_${Date.now()}`,
      title: 'Newly Added Channel 1 Snapshot',
      teamId: teamBrandNew.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: chanBrandNew.id,
      views: 500000,
      subscribers: 20000,
      capturedAt: new Date(),
    });

    // Channel 2 (CASE 1 later): Added in current period, but now has 2nd snapshot (500K -> 600K)
    chanSecondSnapshot = await YouTubeChannel.create({
      channelId: `UC_TWO_SNAP_${Date.now()}`,
      title: 'Channel with 2 Snapshots',
      teamId: teamBrandNew.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    const t5DaysAgo = new Date(Date.now() - 5 * 86400000);
    await YouTubeChannelMetric.create({
      channelId: chanSecondSnapshot.id,
      views: 500000,
      subscribers: 20000,
      capturedAt: t5DaysAgo, // onboarding snapshot
    });
    await YouTubeChannelMetric.create({
      channelId: chanSecondSnapshot.id,
      views: 600000,
      subscribers: 24000,
      capturedAt: new Date(), // latest snapshot (+20% views, +20% subs)
    });

    // Channel 3 (CASE 2): Existed before 30d lookback (35 days ago = 8M, today = 10M)
    chanExistedOld = await YouTubeChannel.create({
      channelId: `UC_OLD_CHAN_${Date.now()}`,
      title: 'Established Channel > 30D',
      teamId: teamMixed.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    const t35DaysAgo = new Date(Date.now() - 35 * 86400000);
    await YouTubeChannelMetric.create({
      channelId: chanExistedOld.id,
      views: 8000000,
      subscribers: 100000,
      capturedAt: t35DaysAgo,
    });
    await YouTubeChannelMetric.create({
      channelId: chanExistedOld.id,
      views: 10000000,
      subscribers: 125000,
      capturedAt: new Date(), // +25% views, +25% subs
    });

    // Channel 4 (CASE 3): Added mid-month (12 days ago = 1M, today = 1.4M)
    chanMidMonth = await YouTubeChannel.create({
      channelId: `UC_MID_MONTH_${Date.now()}`,
      title: 'Mid Month Channel',
      teamId: teamMixed.id,
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    const t12DaysAgo = new Date(Date.now() - 12 * 86400000);
    await YouTubeChannelMetric.create({
      channelId: chanMidMonth.id,
      views: 1000000,
      subscribers: 50000,
      capturedAt: t12DaysAgo,
    });
    await YouTubeChannelMetric.create({
      channelId: chanMidMonth.id,
      views: 1400000,
      subscribers: 60000,
      capturedAt: new Date(), // +40% views, +20% subs
    });

    // Channel 5 (CASE 4 edge): Baseline was 0
    chanZeroBaseline = await YouTubeChannel.create({
      channelId: `UC_ZERO_BASE_${Date.now()}`,
      title: 'Zero Baseline Channel',
      teamId: null, // Unassigned
      status: 'ACTIVE',
      syncStatus: 'SUCCESS',
    });
    await YouTubeChannelMetric.create({
      channelId: chanZeroBaseline.id,
      views: 0,
      subscribers: 0,
      capturedAt: t35DaysAgo,
    });
    await YouTubeChannelMetric.create({
      channelId: chanZeroBaseline.id,
      views: 50000,
      subscribers: 500,
      capturedAt: new Date(),
    });

    // Run aggregations
    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamBrandNew.id);
    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamMixed.id);
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
  });

  after(async () => {
    // Cleanup
    const chanIds = [
      chanBrandNew?.id,
      chanSecondSnapshot?.id,
      chanExistedOld?.id,
      chanMidMonth?.id,
      chanZeroBaseline?.id,
    ].filter(Boolean);

    await YouTubeChannelMetric.destroy({ where: { channelId: chanIds } });
    await YouTubeChannel.destroy({ where: { id: chanIds } });
    if (teamBrandNew) await TeamYouTubeSummary.destroy({ where: { teamId: teamBrandNew.id } });
    if (teamMixed) await TeamYouTubeSummary.destroy({ where: { teamId: teamMixed.id } });
    if (teamBrandNew) await teamBrandNew.destroy();
    if (teamMixed) await teamMixed.destroy();
    if (adminUser) await adminUser.destroy();
  });

  describe('1. Individual Channel Baseline Resolution', () => {
    test('Case 1: Newly added channel with only 1 snapshot has NULL growth and INSUFFICIENT_DATA status', async () => {
      const t30d = new Date(Date.now() - 30 * 86400000);
      const res = await youtubeDataService.resolveChannelBaseline(chanBrandNew.id, t30d);

      assert.equal(res.currentViews, 500000);
      assert.equal(res.viewsGrowthPct, null, 'Growth percent must be null for 1 snapshot');
      assert.equal(res.growthStatus, 'INSUFFICIENT_DATA');
      assert.equal(res.growthContext, 'SINCE_ONBOARDING');
      assert.equal(res.hasElapsedMeasurement, false);
      assert.notEqual(res.viewsGrowthPct, 100, 'Must NOT be 100%');
      assert.notEqual(res.viewsGrowthPct, 0, 'Must NOT be 0.0000%');
    });

    test('Case 1 (later): Channel with 2nd snapshot calculates growth from onboarding baseline (+20%)', async () => {
      const t30d = new Date(Date.now() - 30 * 86400000);
      const res = await youtubeDataService.resolveChannelBaseline(chanSecondSnapshot.id, t30d);

      assert.equal(res.currentViews, 600000);
      assert.equal(res.baselineViews, 500000);
      assert.equal(res.viewsDelta, 100000);
      assert.equal(res.viewsGrowthPct, 20.0, 'Expected (600K - 500K)/500K = +20%');
      assert.equal(res.growthStatus, 'AVAILABLE');
      assert.equal(res.growthContext, 'SINCE_ONBOARDING');
      assert.equal(res.subGrowthPct, 20.0, 'Expected (24K - 20K)/20K = +20%');
    });

    test('Case 2: Channel existed before 30d window calculates growth from 30d snapshot (+25%)', async () => {
      const t30d = new Date(Date.now() - 30 * 86400000);
      const res = await youtubeDataService.resolveChannelBaseline(chanExistedOld.id, t30d);

      assert.equal(res.currentViews, 10000000);
      assert.equal(res.baselineViews, 8000000);
      assert.equal(res.viewsDelta, 2000000);
      assert.equal(res.viewsGrowthPct, 25.0, 'Expected (10M - 8M)/8M = +25%');
      assert.equal(res.growthStatus, 'AVAILABLE');
      assert.equal(res.growthContext, '30D');
      assert.equal(res.subGrowthPct, 25.0, 'Expected (125K - 100K)/100K = +25%');
    });

    test('Case 3: Channel added mid-month calculates growth from onboarding baseline (+40%)', async () => {
      const t30d = new Date(Date.now() - 30 * 86400000);
      const res = await youtubeDataService.resolveChannelBaseline(chanMidMonth.id, t30d);

      assert.equal(res.currentViews, 1400000);
      assert.equal(res.baselineViews, 1000000);
      assert.equal(res.viewsDelta, 400000);
      assert.equal(res.viewsGrowthPct, 40.0, 'Expected (1.4M - 1M)/1M = +40%');
      assert.equal(res.growthStatus, 'AVAILABLE');
      assert.equal(res.growthContext, 'SINCE_ONBOARDING');
      assert.equal(res.subGrowthPct, 20.0, 'Expected (60K - 50K)/50K = +20%');
    });

    test('Case 4: Baseline <= 0 yields NULL growth, never +Infinity or 100%', async () => {
      const t30d = new Date(Date.now() - 30 * 86400000);
      const res = await youtubeDataService.resolveChannelBaseline(chanZeroBaseline.id, t30d);

      assert.equal(res.viewsGrowthPct, null);
      assert.equal(res.growthStatus, 'INSUFFICIENT_DATA');
      assert.equal(res.growthContext, 'NO_VALID_BASELINE');
    });
  });

  describe('2. Team YouTube Summary Aggregation', () => {
    test('Team with mixed channels calculates weighted growth without treating mid-month channel as 0 baseline', async () => {
      const details = await youtubeAggregationService.getTeamYouTubeDetails(teamMixed.id);
      assert.ok(details.summary);

      // Old: base 8M, cur 10M, delta 2M
      // Mid: base 1M, cur 1.4M, delta 0.4M
      // Total current: 11.4M
      // Total baseline: 9.0M
      // Total delta: 2.4M
      // Expected growth: 2.4M / 9.0M * 100 = 26.67% ~ 26.7%
      assert.equal(Number(details.summary.totalViews), 11400000);
      assert.equal(Number(details.summary.views30d), 2400000);
      assert.ok(Math.abs(Number(details.summary.viewsGrowth30dPct) - 26.7) <= 0.5, `Expected ~26.7%, got ${details.summary.viewsGrowth30dPct}`);
      assert.notEqual(Number(details.summary.viewsGrowth30dPct), 100.0, 'Must NOT be 100%');
    });

    test('Team where channels have elapsed measurement computes growth accurately', async () => {
      const details = await youtubeAggregationService.getTeamYouTubeDetails(teamBrandNew.id);
      assert.ok(details.summary);

      // BrandNew: 1 snapshot (500K base, 0 delta)
      // SecondSnapshot: 2 snapshots (500K base, 600K current, 100K delta)
      // Total baseline: 1.0M
      // Total current: 1.1M
      // Total delta: 100K
      // Growth: 100K / 1M * 100 = 10.0%
      assert.equal(Number(details.summary.totalViews), 1100000);
      assert.equal(Number(details.summary.views30d), 100000);
      assert.equal(Number(details.summary.viewsGrowth30dPct), 10.0);
    });
  });

  describe('3. Company Overview Aggregation', () => {
    test('Company Overview KPI growth aggregates properly without 100% distortion', async () => {
      const overview = await youtubeAggregationService.getCompanyYouTubeOverview();
      assert.ok(overview.kpis);
      assert.ok(overview.kpis.totalViews >= 12500000);
      assert.ok(overview.kpis.viewsGrowthPct !== null);
      assert.notEqual(overview.kpis.viewsGrowthPct, 100.0, 'Company growth must not be distorted to 100%');
    });
  });

  describe('4. Leaderboard & Channels API Endpoints', () => {
    test('GET /api/youtube/channels/:id returns canonical growth fields', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${chanBrandNew.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.id, chanBrandNew.id);
      assert.equal(res.body.viewsGrowthPct, null, 'Single snapshot channel must return null viewsGrowthPct');
      assert.equal(res.body.growthStatus, 'INSUFFICIENT_DATA');
      assert.equal(res.body.subGrowthPct, null);
    });

    test('GET /api/youtube/channels/:id with 2 snapshots returns valid percentage', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${chanSecondSnapshot.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.equal(res.body.id, chanSecondSnapshot.id);
      assert.equal(res.body.viewsGrowthPct, 20.0);
      assert.equal(res.body.growthStatus, 'AVAILABLE');
      assert.equal(res.body.growthContext, 'SINCE_ONBOARDING');
    });

    test('GET /api/youtube/leaderboard?view=channels includes null-safe growth and sorts correctly', async () => {
      const res = await request(app)
        .get(`/api/youtube/leaderboard?view=channels&teamId=${teamBrandNew.id}&sortBy=growth`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(Array.isArray(res.body.items));
      const items = res.body.items;

      const secondSnapItem = items.find((c) => c.id === chanSecondSnapshot.id);
      const brandNewItem = items.find((c) => c.id === chanBrandNew.id);

      assert.ok(secondSnapItem, 'chanSecondSnapshot must be present');
      assert.ok(brandNewItem, 'chanBrandNew must be present');
      assert.equal(secondSnapItem.viewsGrowth30dPct, 20.0);
      assert.equal(brandNewItem.viewsGrowth30dPct, null, 'Single snapshot channel must have null viewsGrowth30dPct');
      assert.equal(brandNewItem.growthStatus, 'INSUFFICIENT_DATA');
      assert.ok(secondSnapItem.rank < brandNewItem.rank, 'Channel with valid +20% growth must rank ahead of channel with null growth');
    });

    test('GET /api/youtube/leaderboard?view=teams sorts teams correctly', async () => {
      const res = await request(app)
        .get('/api/youtube/leaderboard?view=teams&sortBy=growth&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(Array.isArray(res.body.items));
      const mixedTeamItem = res.body.items.find((t) => t.id === teamMixed.id || t.teamId === teamMixed.id);
      assert.ok(mixedTeamItem, 'teamMixed must be present');
      assert.equal(mixedTeamItem.viewsGrowth30dPct, 26.7);
    });

    test('GET /api/youtube/admin/overview returns structured diagnostics and clean kpis', async () => {
      const res = await request(app)
        .get('/api/youtube/admin/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      assert.ok(res.body.kpis);
      assert.notEqual(res.body.kpis.viewsGrowth30dPct, 100.0000);
      assert.ok(res.body.diagnostics);
      assert.ok(res.body.diagnostics.totalChannels >= 5);
    });
  });
});
