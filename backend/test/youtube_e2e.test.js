'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const {
  User,
  Team,
  YouTubeChannel,
  TeamYouTubeSummary,
  ScoreLedger,
} = require('../src/models');
const youtubeSyncService = require('../src/services/youtube/youtubeSync.service');
const youtubeAggregationService = require('../src/services/youtube/youtubeAggregation.service');
const youtubeIntegrationService = require('../src/services/competition/youtubeIntegration.service');

describe('YouTube ↔ Team Analytics End-to-End (E2E) Flow', () => {
  let adminUser;
  let memberUser;
  let adminToken;
  let memberToken;
  let teamPhoenix;
  let teamDragon;
  let channelPhoenix;

  before(async () => {
    adminUser = await User.create({
      name: 'Admin E2E YouTube',
      email: `admin_e2e_yt_${Date.now()}@workrank.test`,
      passwordHash: 'hashed_password_123',
      role: 'admin',
      status: 'active',
    });
    adminToken = jwt.sign({ sub: adminUser.id, role: 'admin' }, env.jwtSecret, { expiresIn: '1h' });

    teamPhoenix = await Team.create({
      name: `Phoenix E2E ${Date.now()}`,
      description: 'Phoenix Content Creators',
    });

    teamDragon = await Team.create({
      name: `Dragon E2E ${Date.now()}`,
      description: 'Dragon Video Masters',
    });

    memberUser = await User.create({
      name: 'Member Phoenix E2E',
      email: `member_phx_${Date.now()}@workrank.test`,
      passwordHash: 'hashed_password_123',
      role: 'user',
      status: 'active',
      teamId: teamPhoenix.id,
    });

    memberToken = jwt.sign({ sub: memberUser.id, role: 'user' }, env.jwtSecret, { expiresIn: '1h' });
  });


  after(async () => {
    if (adminUser) await adminUser.destroy();
    if (memberUser) await memberUser.destroy();
    if (teamPhoenix) await teamPhoenix.destroy();
    if (teamDragon) await teamDragon.destroy();
  });

  test('Complete E2E: Register Channel → Link Team → Sync Metrics → Leaderboard → User View → Competition Separation', async () => {
    // 1. Admin registers YouTube channel
    const createRes = await request(app)
      .post('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        channelId: `UC_PHOENIX_PROD_${Date.now()}`,
        title: 'Phoenix Production Hub',
        customUrl: '@phoenix_prod',
        teamId: teamPhoenix.id,
      })
      .expect(201);

    channelPhoenix = createRes.body;
    assert.ok(channelPhoenix.id);
    assert.equal(channelPhoenix.teamId, teamPhoenix.id);

    // 2. Also create a channel for Dragon team
    const dragonChanRes = await request(app)
      .post('/api/youtube/admin/channels')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        channelId: `UC_DRAGON_PROD_${Date.now()}`,
        title: 'Dragon Media Network',
        customUrl: '@dragon_media',
        teamId: teamDragon.id,
      })
      .expect(201);
    const channelDragon = dragonChanRes.body;

    // 3. Admin triggers sync on Phoenix channel
    const syncRes = await request(app)
      .post(`/api/youtube/admin/channels/${channelPhoenix.id}/sync`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(syncRes.body.status, 'SUCCESS');
    assert.ok(syncRes.body.views > 0);
    assert.ok(syncRes.body.subscribers > 0);

    // 4. Sync Dragon channel as well
    await request(app)
      .post(`/api/youtube/admin/channels/${channelDragon.id}/sync`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 5. Recalculate company leaderboard
    await youtubeAggregationService.recalculateAllTeamYouTubeSummaries();

    // 6. User accesses /api/youtube/overview
    const overviewRes = await request(app)
      .get('/api/youtube/overview')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    assert.ok(overviewRes.body.kpis.totalViews > 0);
    assert.ok(overviewRes.body.kpis.totalSubscribers > 0);
    assert.equal(overviewRes.body.kpis.freshnessStatus, 'FRESH');

    // 7. User queries YouTube Team Leaderboard
    const lbRes = await request(app)
      .get('/api/youtube/leaderboard?sortBy=views')
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    assert.ok(lbRes.body.items.length >= 2);
    const phoenixRow = lbRes.body.items.find((i) => Number(i.teamId) === Number(teamPhoenix.id));
    assert.ok(phoenixRow);
    assert.ok(phoenixRow.totalViews > 0);
    assert.ok(phoenixRow.totalSubscribers > 0);

    // 8. User queries specific Team Details for Phoenix
    const teamDetailsRes = await request(app)
      .get(`/api/youtube/teams/${teamPhoenix.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    assert.equal(teamDetailsRes.body.team.id, teamPhoenix.id);
    assert.ok(teamDetailsRes.body.channels.length >= 1);

    // 9. User compares Team Phoenix vs Team Dragon
    const compareRes = await request(app)
      .get(`/api/youtube/compare?teamA=${teamPhoenix.id}&teamB=${teamDragon.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    assert.equal(compareRes.body.teamA.id, teamPhoenix.id);
    assert.equal(compareRes.body.teamB.id, teamDragon.id);
    assert.ok(compareRes.body.teamA.totalViews >= 0);
    assert.ok(compareRes.body.teamB.totalViews >= 0);

    // 10. Verify Competition ScoreLedger remains completely independent of raw YouTube metrics
    const scoreLedgerCount = await ScoreLedger.count({ where: { teamId: teamPhoenix.id } });
    assert.equal(scoreLedgerCount, 0, 'No XP should be awarded purely from YouTube metric ingestion');
  });
});
