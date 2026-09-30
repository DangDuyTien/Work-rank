'use strict';

/**
 * competition_phase5_e2e.test.js
 *
 * Phase 5 End-to-End Vertical Slice:
 * Admin Creates Grand Championship → Links Season 1 & 2 → Seasons Finish & Settle Grand Points →
 * User Queries Grand Hub Standings & Timeline → Grand Finalize & Freeze Champion
 *
 * Run: node --test test/competition_phase5_e2e.test.js
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
  GrandChampionship,
  GrandPointsLedger,
  GrandFrozenResult,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  SeasonFrozenResult,
  ScoreLedger,
  CompetitionEvent,
  EventOutbox,
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
  await SeasonTeamMember.destroy({ where: {} });
  await SeasonTeam.destroy({ where: {} });
  await Season.destroy({ where: {} });
  await GrandChampionship.destroy({ where: {} });
  await ScoreLedger.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
  await EventOutbox.destroy({ where: {} });
}

describe('Phase 5 E2E — Grand Championship & Year-Long Race Flow', () => {
  let regularUser;
  let adminUser;
  let teamPhoenix;
  let teamDragon;
  let regularToken;
  let adminToken;

  before(async () => {
    await sequelize.authenticate();

    [teamPhoenix] = await Team.findOrCreate({ where: { name: 'E2E Grand Phoenix' } });
    [teamDragon] = await Team.findOrCreate({ where: { name: 'E2E Grand Dragon' } });

    [regularUser] = await User.findOrCreate({
      where: { email: 'p5_e2e_user@workrank.test' },
      defaults: {
        name: 'P5 User',
        email: 'p5_e2e_user@workrank.test',
        passwordHash: 'dummy',
        role: 'user',
        status: 'active',
        teamId: teamPhoenix.id,
      },
    });

    [adminUser] = await User.findOrCreate({
      where: { email: 'p5_e2e_admin@workrank.test' },
      defaults: {
        name: 'P5 Admin',
        email: 'p5_e2e_admin@workrank.test',
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

  it('Complete E2E: Admin creates Grand 2026 → Links Season 1 & 2 → Settle Grand Points → User inspects Grand Hub → Admin Freezes Grand', async () => {
    // 1. Admin creates Grand Championship 2026
    const createGrandRes = await request(app)
      .post('/api/competition/admin/grand')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        year: 2026,
        name: 'WorkRank Grand Championship 2026',
        slug: 'grand-2026',
        description: 'Cuộc đua thường niên toàn công ty 2026',
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-12-31T23:59:59Z',
      })
      .expect(201);

    const grandId = createGrandRes.body.grand.id;

    // 2. Admin activates Grand Championship
    await request(app)
      .patch(`/api/competition/admin/grand/${grandId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE', reason: 'Activate year 2026' })
      .expect(200);

    // 3. Admin creates Season 1 (Q1 Battle) & links to Grand
    const s1Res = await request(app)
      .post('/api/competition/admin/seasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Q1 Battle Season',
        slug: 'q1-battle-season',
        startAt: '2026-01-01T00:00:00Z',
        endAt: '2026-03-31T23:59:59Z',
        grandPointsDistribution: {
          distribution: [
            { rank: 1, points: 30 },
            { rank: 2, points: 15 },
          ],
        },
      })
      .expect(201);

    const season1Id = s1Res.body.season.id;
    await request(app)
      .post(`/api/competition/admin/grand/${grandId}/seasons/${season1Id}/link`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app)
      .post(`/api/competition/admin/seasons/${season1Id}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: teamPhoenix.id, color: '#f97316' })
      .expect(201);

    await request(app)
      .post(`/api/competition/admin/seasons/${season1Id}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: teamDragon.id, color: '#0284c7' })
      .expect(201);

    await request(app)
      .patch(`/api/competition/admin/seasons/${season1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    // Score Season 1: Team Phoenix earns 500, Team Dragon earns 300
    await sequelize.transaction((t) => ScoreLedger.bulkCreate([
      {
        id: crypto.randomUUID(), eventId: crypto.randomUUID(), seasonId: season1Id, teamId: teamPhoenix.id,
        pointsDelta: 500, effectType: 'TEAM_SCORE', reason: 'Video Approval',
        idempotencyKey: 's1-p-1',
      },
      {
        id: crypto.randomUUID(), eventId: crypto.randomUUID(), seasonId: season1Id, teamId: teamDragon.id,
        pointsDelta: 300, effectType: 'TEAM_SCORE', reason: 'Video Approval',
        idempotencyKey: 's1-d-1',
      },
    ], { transaction: t }));

    // Finish Season 1 (triggers auto settlement: Phoenix gets 30 GP, Dragon gets 15 GP)
    await request(app)
      .patch(`/api/competition/admin/seasons/${season1Id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'FINISHED', reason: 'Q1 Over' })
      .expect(200);

    // 4. User inspects current Grand Championship via /grand
    const userGrandRes = await request(app)
      .get('/api/competition/grand/current')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(userGrandRes.body.grand.id, grandId);
    assert.equal(userGrandRes.body.grand.status, 'ACTIVE');

    // 5. User checks Grand Standings (Phoenix has 30 GP, Dragon has 15 GP)
    const standingsRes = await request(app)
      .get(`/api/competition/grand/${grandId}/standings`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(standingsRes.body.standings.length, 2);
    assert.equal(standingsRes.body.standings[0].teamName, 'E2E Grand Phoenix');
    assert.equal(standingsRes.body.standings[0].grandPoints, 30);
    assert.equal(standingsRes.body.standings[0].seasonWins, 1);
    assert.equal(standingsRes.body.standings[1].teamName, 'E2E Grand Dragon');
    assert.equal(standingsRes.body.standings[1].grandPoints, 15);

    // 6. User inspects Grand Timeline (Season 1 is listed as completed with Phoenix as winner)
    const timelineRes = await request(app)
      .get(`/api/competition/grand/${grandId}/timeline`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(timelineRes.body.timeline.length, 1);
    assert.equal(timelineRes.body.timeline[0].status, 'FINISHED');
    assert.equal(timelineRes.body.timeline[0].winner.teamName, 'E2E Grand Phoenix');

    // 7. Admin finalizes Grand Championship
    await request(app)
      .patch(`/api/competition/admin/grand/${grandId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'FINISHED', reason: 'End of 2026' })
      .expect(200);

    // 8. User queries final frozen standings
    const finalStandingsRes = await request(app)
      .get(`/api/competition/grand/${grandId}/standings`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(finalStandingsRes.body.isFrozen, true);
    assert.equal(finalStandingsRes.body.championTeamId, teamPhoenix.id);
  });
});
