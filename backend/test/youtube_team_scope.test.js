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

describe('YouTube Team Scope & Anti-IDOR Protection Test Suite', () => {
  let phoenixTeam;
  let dragonTeam;
  let phoenixMember;
  let dragonMember;
  let unassignedMember;
  let phoenixToken;
  let dragonToken;
  let unassignedToken;
  let phoenixChannel;
  let dragonChannel;

  before(async () => {
    // 1. Create Teams
    phoenixTeam = await Team.create({
      name: `Phoenix Scope ${Date.now()}`,
      description: 'Phoenix Scope Team',
    });

    dragonTeam = await Team.create({
      name: `Dragon Scope ${Date.now()}`,
      description: 'Dragon Scope Team',
    });

    // 2. Create Members
    phoenixMember = await User.create({
      name: 'Phoenix Member',
      email: `phx_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'user',
      status: 'active',
      teamId: phoenixTeam.id,
    });
    phoenixToken = jwt.sign({ sub: phoenixMember.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });

    dragonMember = await User.create({
      name: 'Dragon Member',
      email: `drg_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'user',
      status: 'active',
      teamId: dragonTeam.id,
    });
    dragonToken = jwt.sign({ sub: dragonMember.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });

    unassignedMember = await User.create({
      name: 'Unassigned Member',
      email: `unassigned_${Date.now()}@workrank.test`,
      passwordHash: 'hash_123',
      role: 'user',
      status: 'active',
      teamId: null,
    });
    unassignedToken = jwt.sign({ sub: unassignedMember.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });

    // 3. Create Channels
    phoenixChannel = await youtubeDataService.createChannel({
      channelId: `UC_PHX_CHAN_${Date.now()}`,
      title: 'Phoenix Channel 1',
      teamId: phoenixTeam.id,
    });

    dragonChannel = await youtubeDataService.createChannel({
      channelId: `UC_DRG_CHAN_${Date.now()}`,
      title: 'Dragon Channel 1',
      teamId: dragonTeam.id,
    });

    // Initial aggregations
    await youtubeAggregationService.aggregateTeamYouTubeSummary(phoenixTeam.id);
    await youtubeAggregationService.aggregateTeamYouTubeSummary(dragonTeam.id);
  });

  after(async () => {
    if (phoenixChannel) await phoenixChannel.destroy();
    if (dragonChannel) await dragonChannel.destroy();
    if (phoenixMember) await phoenixMember.destroy();
    if (dragonMember) await dragonMember.destroy();
    if (unassignedMember) await unassignedMember.destroy();
    if (phoenixTeam) await phoenixTeam.destroy();
    if (dragonTeam) await dragonTeam.destroy();
  });

  describe('1. Team Self-Scope vs Cross-Team IDOR Protection', () => {
    test('Phoenix Member successfully retrieves Phoenix Team details', async () => {
      const res = await request(app)
        .get(`/api/youtube/teams/${phoenixTeam.id}`)
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(200);

      assert.equal(res.body.team.id, phoenixTeam.id);
      assert.ok(Array.isArray(res.body.channels));
    });

    test('Phoenix Member is BLOCKED (403) from accessing Dragon Team details (IDOR Prevention)', async () => {
      const res = await request(app)
        .get(`/api/youtube/teams/${dragonTeam.id}`)
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(403);

      assert.equal(res.body.code, 'CROSS_TEAM_FORBIDDEN');
    });

    test('Dragon Member is BLOCKED (403) from accessing Phoenix Team details (IDOR Prevention)', async () => {
      const res = await request(app)
        .get(`/api/youtube/teams/${phoenixTeam.id}`)
        .set('Authorization', `Bearer ${dragonToken}`)
        .expect(403);

      assert.equal(res.body.code, 'CROSS_TEAM_FORBIDDEN');
    });
  });

  describe('2. Convenience /my-team Endpoint', () => {
    test('Phoenix Member calls /api/youtube/my-team and receives Phoenix analytics', async () => {
      const res = await request(app)
        .get('/api/youtube/my-team')
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(200);

      assert.equal(res.body.team.id, phoenixTeam.id);
      assert.ok(res.body.summary);
    });

    test('Unassigned Member calls /api/youtube/my-team and receives graceful empty model', async () => {
      const res = await request(app)
        .get('/api/youtube/my-team')
        .set('Authorization', `Bearer ${unassignedToken}`)
        .expect(200);

      assert.equal(res.body.team, null);
      assert.deepEqual(res.body.channels, []);
    });
  });

  describe('3. Channel Ownership Scope & IDOR Protection', () => {
    test('Phoenix Member successfully retrieves Phoenix Channel details', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${phoenixChannel.id}`)
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(200);

      assert.equal(res.body.id, phoenixChannel.id);
    });

    test('Phoenix Member is BLOCKED (403) from accessing Dragon Channel details', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels/${dragonChannel.id}`)
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(403);

      assert.equal(res.body.code, 'CROSS_CHANNEL_FORBIDDEN');
    });

    test('Member channel list is automatically scoped to own team', async () => {
      const res = await request(app)
        .get('/api/youtube/channels')
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(200);

      assert.ok(Array.isArray(res.body.items));
      for (const item of res.body.items) {
        assert.equal(Number(item.teamId), Number(phoenixTeam.id));
      }
    });

    test('Member attempting to list another team channels via ?teamId is rejected with 403', async () => {
      const res = await request(app)
        .get(`/api/youtube/channels?teamId=${dragonTeam.id}`)
        .set('Authorization', `Bearer ${phoenixToken}`)
        .expect(403);

      assert.equal(res.body.code, 'CROSS_TEAM_FORBIDDEN');
    });
  });

  describe('4. Compare Team Scoping', () => {
    test('Member comparing two foreign teams is rejected with 403', async () => {
      // Create a 3rd team to test comparing 2 foreign teams
      const tigerTeam = await Team.create({ name: `Tiger Scope ${Date.now()}` });
      try {
        await request(app)
          .get(`/api/youtube/compare?teamA=${dragonTeam.id}&teamB=${tigerTeam.id}`)
          .set('Authorization', `Bearer ${phoenixToken}`)
          .expect(403);
      } finally {
        await tigerTeam.destroy();
      }
    });
  });
});
