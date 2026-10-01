'use strict';

/**
 * competition_phase6_e2e.test.js
 *
 * Phase 6 End-to-End Test:
 *   Full Flow:
 *     1. Admin creates Season & Grand Championship via API.
 *     2. Competition event is processed & scored.
 *     3. Projector updates User Summary, Team Summary, Season Leaderboard & Activity.
 *     4. User retrieves Dashboard via GET /api/competition/dashboard.
 *     5. Season finishes, Grand points are settled, Grand Leaderboard is projected.
 *     6. Admin queries Admin Dashboard & Projection Status.
 *     7. Admin triggers Read Model Rebuild via POST /api/competition/admin/projections/rebuild.
 *     8. Read Model Consistency check confirms 0 drift.
 *
 * Run: node --test test/competition_phase6_e2e.test.js
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const crypto = require('node:crypto');

require('dotenv').config();

const app = require('../src/app');
const env = require('../src/config/env');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  SeasonFrozenResult,
  ScoreLedger,
  CompetitionState,
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  CompetitionAuditLog,
  CompetitionEvent,
  CompetitionUserSummary,
  CompetitionTeamSummary,
  SeasonLeaderboardProjection,
  GrandLeaderboardProjection,
  CompetitionActivityProjection,
  ProjectionCheckpoint,
} = require('../src/models');

const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');
const eventStoreService = require('../src/services/competition/eventStore.service');

function makeAuthHeader(user) {
  const token = jwt.sign(
    { sub: user.id, id: user.id, email: user.email, role: user.role },
    env.jwtSecret,
    { expiresIn: '1h' }
  );
  return { Authorization: `Bearer ${token}` };
}

function request(server, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, `http://127.0.0.1:${server.address().port}`);
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let data;
          try { data = JSON.parse(raw); } catch { data = raw; }
          resolve({ status: res.statusCode, body: data });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Phase 6 E2E — Read Models & Company Competition Dashboard Flow', () => {
  let server;
  let adminUser;
  let memberUser;
  let teamPhoenix;
  let teamDragon;

  before(async () => {
    await sequelize.authenticate();

    // Clean tables in reverse dependency order
    await CompetitionActivityProjection.destroy({ where: {} });
    await GrandLeaderboardProjection.destroy({ where: {} });
    await SeasonLeaderboardProjection.destroy({ where: {} });
    await CompetitionTeamSummary.destroy({ where: {} });
    await CompetitionUserSummary.destroy({ where: {} });
    await ProjectionCheckpoint.destroy({ where: {} });
    await GrandFrozenResult.destroy({ where: {} });
    await GrandPointsLedger.destroy({ where: {} });
    await SeasonFrozenResult.destroy({ where: {} });
    await SeasonTeamMember.destroy({ where: {} });
    await SeasonTeam.destroy({ where: {} });
    await ScoreLedger.destroy({ where: {} });
    await CompetitionEvent.destroy({ where: {} });
    await CompetitionAuditLog.destroy({ where: {} });
    await CompetitionState.destroy({ where: {} });
    await Season.destroy({ where: {} });
    await GrandChampionship.destroy({ where: {} });

    // Seed Teams
    [teamPhoenix] = await Team.findOrCreate({
      where: { name: 'E2E P6 Phoenix' },
      defaults: { name: 'E2E P6 Phoenix', color: '#f97316' },
    });
    [teamDragon] = await Team.findOrCreate({
      where: { name: 'E2E P6 Dragon' },
      defaults: { name: 'E2E P6 Dragon', color: '#3b82f6' },
    });

    // Seed Users
    [adminUser] = await User.findOrCreate({
      where: { email: 'admin_p6_e2e@workrank.test' },
      defaults: { name: 'Admin P6', username: 'admin_p6', email: 'admin_p6_e2e@workrank.test', passwordHash: 'dummy_hash', role: 'admin' },
    });
    adminUser.role = 'admin';
    await adminUser.save();

    [memberUser] = await User.findOrCreate({
      where: { email: 'member_p6_e2e@workrank.test' },
      defaults: { name: 'Member P6', username: 'member_p6', email: 'member_p6_e2e@workrank.test', passwordHash: 'dummy_hash', role: 'user', teamId: teamPhoenix.id },
    });
    memberUser.role = 'user';
    memberUser.teamId = teamPhoenix.id;
    await memberUser.save();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await sequelize.close();
  });

  it('Complete E2E: Admin creates Grand & Season → Events Scored → Projection Dashboard → Season Finish → Rebuild & Consistency', async () => {
    const adminHeaders = makeAuthHeader(adminUser);
    const memberHeaders = makeAuthHeader(memberUser);

    // 1. Admin creates Grand Championship 2026
    const createGrandRes = await request(server, 'POST', '/api/competition/admin/grand', adminHeaders, {
      year: 2026,
      name: 'WorkRank Grand Championship 2026 E2E',
      slug: `grand-2026-e2e-${Date.now()}`,
      startAt: '2026-01-01T00:00:00Z',
      endAt: '2026-12-31T23:59:59Z',
    });
    assert.equal(createGrandRes.status, 201);
    const grandId = createGrandRes.body.grand.id;

    await request(server, 'PATCH', `/api/competition/admin/grand/${grandId}/status`, adminHeaders, {
      status: 'ACTIVE',
      reason: 'Activate 2026 Championship',
    });

    // 2. Admin creates Season 1
    const createSeasonRes = await request(server, 'POST', '/api/competition/admin/seasons', adminHeaders, {
      name: 'Season 1 - Q1 Grand Rush',
      slug: `season-1-q1-rush-${Date.now()}`,
      startAt: new Date(Date.now() - 3600000).toISOString(),
      endAt: new Date(Date.now() + 86400000 * 30).toISOString(),
      grandPointsDistribution: {
        distribution: [
          { rank: 1, points: 25 },
          { rank: 2, points: 15 },
        ],
      },
    });
    assert.equal(createSeasonRes.status, 201);
    const seasonId = createSeasonRes.body.season.id;

    // Link Season to Grand & Add Teams
    await request(server, 'POST', `/api/competition/admin/grand/${grandId}/seasons/${seasonId}/link`, adminHeaders);
    await request(server, 'POST', `/api/competition/admin/seasons/${seasonId}/teams`, adminHeaders, { teamId: teamPhoenix.id });
    await request(server, 'POST', `/api/competition/admin/seasons/${seasonId}/teams`, adminHeaders, { teamId: teamDragon.id });
    await request(server, 'PATCH', `/api/competition/admin/seasons/${seasonId}/status`, adminHeaders, { status: 'ACTIVE' });

    // 3. Ingest and Process Competition Events
    competitionEngineWorker.registerRules('VIDEO_APPROVED', [
      {
        id: 'rule-video-approved-user',
        name: 'Video Approved User Score',
        event_type: 'VIDEO_APPROVED',
        condition_ast: { field: 'event.payload.quality', op: 'GTE', value: 80 },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      },
      {
        id: 'rule-video-approved-team',
        name: 'Video Approved Team Score',
        event_type: 'VIDEO_APPROVED',
        condition_ast: { field: 'event.payload.quality', op: 'GTE', value: 80 },
        action_ast: { type: 'ADD', value: 100, target: 'TEAM' },
        effect_type: 'TEAM_SCORE',
      },
    ]);

    // Send 3 events for memberUser (Phoenix)
    for (let i = 1; i <= 3; i++) {
      const eventId = crypto.randomUUID();
      await CompetitionEvent.create({
        eventId,
        idempotencyKey: `evt-key-${eventId}`,
        eventType: 'VIDEO_APPROVED',
        actorId: memberUser.id,
        teamId: teamPhoenix.id,
        payload: { seasonId, quality: 90, title: `Video #${i}` },
        occurredAt: new Date(),
        receivedAt: new Date(),
        status: 'PENDING',
      });
    }

    // Worker batch execution
    const processedCount = await competitionEngineWorker.processBatch();
    assert.equal(processedCount, 3);

    // 4. User queries Dashboard API
    const dashRes = await request(server, 'GET', '/api/competition/dashboard', memberHeaders);
    assert.equal(dashRes.status, 200);
    assert.equal(dashRes.body.user.id, memberUser.id);
    assert.equal(dashRes.body.userSummary.currentSeasonScore, 300);
    assert.equal(dashRes.body.teamSummary.currentSeasonScore, 300);
    assert.equal(dashRes.body.teamSummary.currentSeasonRank, 1);
    assert.ok(dashRes.body.recentActivities.length > 0);

    // 5. Query Season Leaderboard Projection API
    const seasonLeadRes = await request(server, 'GET', `/api/competition/projections/seasons/${seasonId}/leaderboard`, memberHeaders);
    assert.equal(seasonLeadRes.status, 200);
    assert.equal(seasonLeadRes.body.totalTeams, 2);
    assert.equal(seasonLeadRes.body.rankings[0].teamId, teamPhoenix.id);
    assert.equal(seasonLeadRes.body.rankings[0].score, 300);

    // 6. Finish Season $\rightarrow$ Auto-settle Grand Points $\rightarrow$ Project Grand Leaderboard
    await request(server, 'PATCH', `/api/competition/admin/seasons/${seasonId}/status`, adminHeaders, {
      status: 'FINISHED',
      reason: 'Season completed on schedule',
    });

    // Check Grand Leaderboard Projection
    const grandLeadRes = await request(server, 'GET', `/api/competition/projections/grand/${grandId}/leaderboard`, memberHeaders);
    assert.equal(grandLeadRes.status, 200);
    assert.equal(grandLeadRes.body.standings.length, 2);
    assert.equal(grandLeadRes.body.standings[0].teamId, teamPhoenix.id);
    assert.equal(grandLeadRes.body.standings[0].grandPoints, 25);

    // 7. Admin queries Analytics & Projections Monitor
    const adminDashRes = await request(server, 'GET', '/api/competition/admin/dashboard', adminHeaders);
    assert.equal(adminDashRes.status, 200);
    assert.ok(adminDashRes.body.seasonStats);
    assert.ok(adminDashRes.body.grandStats);
    assert.equal(adminDashRes.body.consistency.status, 'PASS');

    // 8. Admin triggers Read Model Rebuild
    const rebuildRes = await request(server, 'POST', '/api/competition/admin/projections/rebuild', adminHeaders, {
      reason: 'E2E test audit-approved rebuild',
    });
    assert.equal(rebuildRes.status, 200);
    assert.equal(rebuildRes.body.status, 'SUCCESS');

    // 9. Consistency Check after Rebuild
    const consistencyRes = await request(server, 'GET', '/api/competition/admin/projections/consistency', adminHeaders);
    assert.equal(consistencyRes.status, 200);
    assert.equal(consistencyRes.body.status, 'PASS');
    assert.equal(consistencyRes.body.driftCount, 0);

    competitionEngineWorker.clearRules();
  });
});
