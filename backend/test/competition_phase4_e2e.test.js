'use strict';

/**
 * competition_phase4_e2e.test.js
 *
 * Phase 4 End-to-End Vertical Slice:
 * Admin Creates Season → Attaches Rules & Teams → Activates Season → User Arena Inspection →
 * Event Ingestion & Score Evaluation → Live Leaderboard → Pause/Resume → Finish & Frozen Results
 *
 * Run: node --test test/competition_phase4_e2e.test.js
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const request = require('supertest');
const jwt = require('jsonwebtoken');

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
  RuleSet,
  RuleSetVersion,
  Challenge,
  SeasonFrozenResult,
  ScoreLedger,
  CompetitionEvent,
  EventOutbox,
  GrandPointsLedger,
  GrandFrozenResult,
} = require('../src/models');

const outboxService = require('../src/services/competition/outbox.service');
const outboxDispatcher = require('../src/workers/outboxDispatcher.worker');
const engineWorker = require('../src/services/competition/competitionEngine.worker');

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwtSecret, { expiresIn: '1h' });
}

async function cleanAll() {
  await GrandFrozenResult.destroy({ where: {} });
  await GrandPointsLedger.destroy({ where: {} });
  await SeasonFrozenResult.destroy({ where: {} });
  await Challenge.destroy({ where: {} });
  await SeasonTeamMember.destroy({ where: {} });
  await SeasonTeam.destroy({ where: {} });
  await Season.destroy({ where: {} });
  await RuleSetVersion.destroy({ where: {} });
  await RuleSet.destroy({ where: {} });
  await ScoreLedger.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
  await EventOutbox.destroy({ where: {} });
}

describe('Phase 4 E2E — Season Domain & Arena Integration', () => {
  let regularUser;
  let adminUser;
  let teamPhoenix;
  let teamDragon;
  let regularToken;
  let adminToken;

  before(async () => {
    await sequelize.authenticate();

    [teamPhoenix] = await Team.findOrCreate({ where: { name: 'E2E Phoenix' } });
    [teamDragon] = await Team.findOrCreate({ where: { name: 'E2E Dragon' } });

    [regularUser] = await User.findOrCreate({
      where: { email: 'p4_e2e_user@workrank.test' },
      defaults: {
        name: 'P4 E2E Regular',
        email: 'p4_e2e_user@workrank.test',
        passwordHash: 'dummy',
        role: 'user',
        status: 'active',
        teamId: teamPhoenix.id,
      },
    });

    [adminUser] = await User.findOrCreate({
      where: { email: 'p4_e2e_admin@workrank.test' },
      defaults: {
        name: 'P4 E2E Admin',
        email: 'p4_e2e_admin@workrank.test',
        passwordHash: 'dummy',
        role: 'admin',
        status: 'active',
        teamId: teamDragon.id,
      },
    });

    regularToken = createToken(regularUser);
    adminToken = createToken(adminUser);
  });

  after(async () => {
    await cleanAll();
    await sequelize.close();
  });

  beforeEach(async () => {
    await cleanAll();
    engineWorker.clearRules();
  });

  it('Complete E2E: Admin creates season & rules → Activate → User queries Arena → Event scoring → Leaderboard → Finish Freeze', async () => {
    // 1. Admin creates Rule Set & Publishes Version
    const createRsRes = await request(app)
      .post('/api/competition/admin/rule-sets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E Quality Battle RuleSet',
        code: 'E2E_QB_V1',
        description: 'Quality battle rules for E2E testing',
      })
      .expect(201);

    const ruleSetId = createRsRes.body.ruleSet.id;

    const createVerRes = await request(app)
      .post(`/api/competition/admin/rule-sets/${ruleSetId}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        versionNumber: 1,
        effectiveFrom: '2026-10-01T00:00:00Z',
        effectiveTo: '2026-10-31T23:59:59Z',
        astPayload: [
          {
            condition_ast: null,
            action_ast: { type: 'ADD', value: 120 },
            effect_type: 'TEAM_SCORE',
          },
        ],
      })
      .expect(201);

    const versionId = createVerRes.body.version.id;

    await request(app)
      .post(`/api/competition/admin/rule-sets/versions/${versionId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // 2. Admin creates Season & Attaches Teams
    const createSeasonRes = await request(app)
      .post('/api/competition/admin/seasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'October E2E Championship',
        slug: 'october-e2e-championship',
        description: 'E2E testing season',
        startAt: '2026-10-01T00:00:00Z',
        endAt: '2026-10-31T23:59:59Z',
        gracePeriodHours: 2,
        activeRuleSetId: ruleSetId,
        grandPointsDistribution: {
          distribution: [
            { rank: 1, points: 20 },
            { rank: 2, points: 10 },
          ],
        },
      })
      .expect(201);

    const seasonId = createSeasonRes.body.season.id;

    // Add Teams (Phoenix & Dragon)
    await request(app)
      .post(`/api/competition/admin/seasons/${seasonId}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: teamPhoenix.id, color: '#f97316' })
      .expect(201);

    await request(app)
      .post(`/api/competition/admin/seasons/${seasonId}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: teamDragon.id, color: '#0284c7' })
      .expect(201);

    // 3. Admin Activates Season
    await request(app)
      .patch(`/api/competition/admin/seasons/${seasonId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE', reason: 'Launch E2E Season' })
      .expect(200);

    // 4. User queries Arena Active Season
    const userArenaRes = await request(app)
      .get('/api/competition/seasons/active')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(userArenaRes.body.season.id, seasonId);
    assert.equal(userArenaRes.body.season.status, 'ACTIVE');

    // 5. User checks Season Detail (sees myTeam = Phoenix)
    const userDetailRes = await request(app)
      .get(`/api/competition/seasons/${seasonId}`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.ok(userDetailRes.body.myTeam);
    assert.equal(userDetailRes.body.myTeam.teamNameSnapshot, 'E2E Phoenix');

    // 6. Enqueue & Process Event for regularUser (Team Phoenix)
    await outboxService.enqueue(
      { domainWrite: async () => ({ videoId: 101 }) },
      {
        eventType: 'VIDEO_APPROVED',
        payload: {
          actorId: regularUser.id,
          teamId: regularUser.teamId,
          seasonId,
          occurredAt: '2026-10-10T12:00:00Z',
        },
        idempotencyKey: `p4-e2e-video-${regularUser.id}`,
      },
    );

    await outboxDispatcher.processBatch();
    await engineWorker.processBatch();

    // 7. Verify Live Leaderboard (Phoenix has 120 points, Rank 1)
    const liveLbRes = await request(app)
      .get(`/api/competition/seasons/${seasonId}/leaderboard`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(liveLbRes.body.isFrozen, false);
    assert.equal(liveLbRes.body.rankings[0].teamName, 'E2E Phoenix');
    assert.equal(liveLbRes.body.rankings[0].score, 120);
    assert.equal(liveLbRes.body.rankings[0].rank, 1);

    // 8. Admin finishes and freezes season
    await request(app)
      .patch(`/api/competition/admin/seasons/${seasonId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'FINISHED', reason: 'Season Ended' })
      .expect(200);

    // 9. User queries Leaderboard -> shows frozen result + Grand Points
    const frozenLbRes = await request(app)
      .get(`/api/competition/seasons/${seasonId}/leaderboard`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(frozenLbRes.body.isFrozen, true);
    assert.ok(frozenLbRes.body.grandPoints);
    assert.equal(frozenLbRes.body.grandPoints[0].teamName, 'E2E Phoenix');
    assert.equal(frozenLbRes.body.grandPoints[0].grandPoints, 20); // 1st place = 20 Grand Points
  });
});
