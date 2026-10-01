'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { User, Team, YouTubeChannel } = require('../src/models');
const youtubeDataService = require('../src/services/youtube/youtubeData.service');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');

describe('YouTube Public Ranking vs Private Analytics Separation Test Suite', () => {
  let teamPhoenix;
  let teamDragon;
  let memberPhoenix;
  let phoenixToken;
  let chanPhoenix;
  let chanDragon;

  before(async () => {
    teamPhoenix = await Team.create({
      name: `Phoenix Rank ${Date.now()}`,
      description: 'Phoenix Ranking Team',
    });

    teamDragon = await Team.create({
      name: `Dragon Rank ${Date.now()}`,
      description: 'Dragon Ranking Team',
    });

    memberPhoenix = await User.create({
      name: 'Phoenix Rank Member',
      email: `phx_rank_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'user',
      status: 'active',
      teamId: teamPhoenix.id,
    });
    phoenixToken = jwt.sign({ sub: memberPhoenix.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });

    chanPhoenix = await youtubeDataService.createChannel({
      channelId: `UC_PHX_R_${Date.now()}`,
      title: 'Phoenix Rank Channel',
      teamId: teamPhoenix.id,
    });
    await youtubeDataService.recordChannelMetricSnapshot({
      channelId: chanPhoenix.id,
      views: 1800000,
      subscribers: 85000,
    });

    chanDragon = await youtubeDataService.createChannel({
      channelId: `UC_DRG_R_${Date.now()}`,
      title: 'Dragon Rank Channel',
      teamId: teamDragon.id,
    });
    await youtubeDataService.recordChannelMetricSnapshot({
      channelId: chanDragon.id,
      views: 2100000,
      subscribers: 91000,
    });

    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamPhoenix.id);
    await youtubeAggregationService.aggregateTeamYouTubeSummary(teamDragon.id);
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();
  });

  after(async () => {
    if (chanPhoenix) await chanPhoenix.destroy();
    if (chanDragon) await chanDragon.destroy();
    if (memberPhoenix) await memberPhoenix.destroy();
    if (teamPhoenix) await teamPhoenix.destroy();
    if (teamDragon) await teamDragon.destroy();
  });

  test('Public Leaderboard returns ranking with public summary metrics', async () => {
    const res = await request(app)
      .get('/api/youtube/leaderboard?sortBy=views')
      .set('Authorization', `Bearer ${phoenixToken}`)
      .expect(200);

    assert.ok(Array.isArray(res.body.items));
    assert.ok(res.body.items.length >= 2);

    const dragonItem = res.body.items.find((i) => Number(i.teamId) === Number(teamDragon.id));
    const phoenixItem = res.body.items.find((i) => Number(i.teamId) === Number(teamPhoenix.id));

    assert.ok(dragonItem);
    assert.ok(phoenixItem);
    assert.ok(dragonItem.rank < phoenixItem.rank, 'Dragon (2.1M views) should be ranked higher than Phoenix (1.8M views)');
    assert.equal(Number(dragonItem.totalViews), 2100000);
    assert.equal(Number(phoenixItem.totalViews), 1800000);
  });

  test('Public Leaderboard does NOT leak sensitive credentials or internal stack errors', async () => {
    const res = await request(app)
      .get('/api/youtube/leaderboard')
      .set('Authorization', `Bearer ${phoenixToken}`)
      .expect(200);

    for (const item of res.body.items) {
      assert.equal(item.apiKey, undefined);
      assert.equal(item.accessToken, undefined);
      assert.equal(item.refreshToken, undefined);
      assert.equal(item.lastSyncError, undefined);
      assert.equal(item.channels, undefined, 'Public leaderboard should NOT contain private channels list');
    }
  });

  test('Public Ranking visibility DOES NOT grant private analytics access to other teams', async () => {
    // 1. Phoenix member sees Dragon in leaderboard
    const lbRes = await request(app)
      .get('/api/youtube/leaderboard')
      .set('Authorization', `Bearer ${phoenixToken}`)
      .expect(200);

    const dragonRow = lbRes.body.items.find((i) => Number(i.teamId) === Number(teamDragon.id));
    assert.ok(dragonRow);

    // 2. But Phoenix member attempting to access Dragon private dashboard is rejected with 403
    await request(app)
      .get(`/api/youtube/teams/${teamDragon.id}`)
      .set('Authorization', `Bearer ${phoenixToken}`)
      .expect(403);
  });
});
