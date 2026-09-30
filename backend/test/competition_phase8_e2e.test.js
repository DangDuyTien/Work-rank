'use strict';

/**
 * competition_phase8_e2e.test.js
 *
 * End-to-End Test for WORKRANK V3.3 Phase 8 — Product Integration.
 *
 * Verifies the full pipeline:
 *   Product Module Action (Production & YouTube)
 *     ↓
 *   Contract Validation & Domain Ingestion
 *     ↓
 *   Competition Event Store & Transactional Outbox
 *     ↓
 *   Competition Engine Worker Evaluation
 *     ↓
 *   Immutable Score Ledger
 *     ↓
 *   Read Model Projections (User Summary, Team Summary, Activity Feed)
 *     ↓
 *   User Dashboard API & Audit Trace Verification
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const app = require('../src/app');
const sequelize = require('../src/config/database');
const {
  User,
  Team,
  Season,
  SeasonTeam,
  SeasonTeamMember,
  RuleSet,
  RuleSetVersion,
  ScoreLedger,
  CompetitionActivityProjection,
  CompetitionEvent,
} = require('../src/models');

const productionIntegration = require('../src/services/competition/productionIntegration.service');
const youtubeIntegration = require('../src/services/competition/youtubeIntegration.service');
const competitionEngineWorker = require('../src/services/competition/competitionEngine.worker');

const env = require('../src/config/env');

describe('Phase 8 E2E — Complete Product Integration & Event Flow', () => {
  let adminUser, creatorUser;
  let adminToken, creatorToken;
  let productionTeam;
  let e2eSeason, e2eRuleSet, e2eRuleVersion;

  before(async () => {
    await sequelize.authenticate();
    const rnd = Date.now();

    // 1. Create Team
    [productionTeam] = await Team.findOrCreate({
      where: { name: `Studio Dragons ${rnd}` },
      defaults: { inviteCode: `DRAGONS_${rnd}` },
    });

    // 2. Create Users
    [adminUser] = await User.findOrCreate({
      where: { email: `admin_e2e8_${rnd}@workrank.io` },
      defaults: { name: 'E2E8 Admin', role: 'admin', passwordHash: 'testpass', teamId: productionTeam.id },
    });
    [creatorUser] = await User.findOrCreate({
      where: { email: `creator_e2e8_${rnd}@workrank.io` },
      defaults: { name: 'E2E8 Lead Creator', role: 'user', passwordHash: 'testpass', teamId: productionTeam.id },
    });

    adminToken = jwt.sign(
      { sub: adminUser.id, id: adminUser.id, role: 'admin', email: adminUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );
    creatorToken = jwt.sign(
      { sub: creatorUser.id, id: creatorUser.id, role: 'user', email: creatorUser.email },
      env.jwtSecret,
      { expiresIn: '1h' },
    );

    // 3. Create Rule Set & Version via API
    const createRsRes = await request(app)
      .post('/api/competition/admin/rules')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Studio Production Rules ${rnd}`,
        code: `rs_studio_${rnd}`,
        description: 'Multi-module production and YouTube rules',
      });
    assert.strictEqual(createRsRes.status, 201);
    e2eRuleSet = createRsRes.body.ruleSet;

    const createVerRes = await request(app)
      .post(`/api/competition/admin/rules/${e2eRuleSet.id}/versions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        effectiveFrom: new Date('2026-01-01'),
        effectiveTo: new Date('2026-12-31'),
        astPayload: [
          {
            name: 'High Quality Video Production XP',
            condition_ast: {
              op: 'AND',
              conditions: [
                { op: 'EQ', field: 'event.event_type', value: 'VIDEO_APPROVED' },
                { op: 'GTE', field: 'event.payload.qualityScore', value: 85 },
              ],
            },
            action_ast: { type: 'ADD', value: 150 },
            effect_type: 'INDIVIDUAL_XP',
          },
          {
            name: 'Viral Video Milestone Reward',
            condition_ast: {
              op: 'AND',
              conditions: [
                { op: 'EQ', field: 'event.event_type', value: 'VIDEO_VIEW_MILESTONE_REACHED' },
                { op: 'GTE', field: 'event.payload.views', value: 100000 },
              ],
            },
            action_ast: { type: 'ADD', value: 300 },
            effect_type: 'INDIVIDUAL_XP',
          },
        ],
      });
    assert.strictEqual(createVerRes.status, 201);
    e2eRuleVersion = createVerRes.body.version;

    // Publish Version
    const pubVerRes = await request(app)
      .post(`/api/competition/admin/rules/${e2eRuleSet.id}/versions/${e2eRuleVersion.id}/publish`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'E2E Phase 8 testing publish' });
    assert.strictEqual(pubVerRes.status, 200);

    // 4. Create Season and Link Team
    const seasonRes = await request(app)
      .post('/api/competition/admin/seasons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Season Studio Championship ${rnd}`,
        slug: `season-studio-${rnd}`,
        startAt: new Date('2026-01-01'),
        endAt: new Date('2026-12-31'),
        activeRuleSetId: e2eRuleSet.id,
        activeRuleVersionId: e2eRuleVersion.id,
        grandPointsDistribution: [100, 70, 50],
      });
    assert.strictEqual(seasonRes.status, 201);
    e2eSeason = seasonRes.body.season;

    await request(app)
      .post(`/api/competition/admin/seasons/${e2eSeason.id}/teams`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ teamId: productionTeam.id });

    await request(app)
      .patch(`/api/competition/admin/seasons/${e2eSeason.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'ACTIVE' });
  });

  it('Complete E2E: Production Action → YouTube Milestone → Outbox/EventStore → Scoring → Read Models → Trace API', async () => {
    const e2eVideoId = Math.floor(Math.random() * 1000000) + 20000;
    const e2eYtVideoId = `yt_doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    // ─── Step 1: User completes Video Production in studio ─────────────────────────
    const prodRes = await productionIntegration.recordVideoApproved({
      videoId: e2eVideoId,
      title: 'Deep Dive Architecture Documentary',
      qualityScore: 95,
      duration: 360,
      actorId: creatorUser.id,
      teamId: productionTeam.id,
      seasonId: e2eSeason.id,
    });
    assert.strictEqual(prodRes.success, true);
    assert.strictEqual(prodRes.isDuplicate, false);
    const prodEventId = prodRes.eventId;

    // ─── Step 2: YouTube Milestone is reached ──────────────────────────────────────
    const ytRes = await youtubeIntegration.recordViewMilestone({
      youtubeVideoId: e2eYtVideoId,
      title: 'Deep Dive Architecture Documentary',
      views: 150000,
      actorId: creatorUser.id,
      teamId: productionTeam.id,
      seasonId: e2eSeason.id,
    });
    assert.strictEqual(ytRes.success, true);
    assert.strictEqual(ytRes.isDuplicate, false);
    const ytEventId = ytRes.eventId;

    // ─── Step 3: Worker processes both events asynchronously ──────────────────────
    let totalProcessed = 0;
    for (let i = 0; i < 5; i++) {
      const p = await competitionEngineWorker.processBatch();
      totalProcessed += p;
      if (p === 0) break;
    }
    assert.ok(totalProcessed >= 2);

    // ─── Step 4: Verify Score Ledger entries created ──────────────────────────────
    const prodLedger = await ScoreLedger.findOne({ where: { eventId: prodEventId } });
    assert.ok(prodLedger);
    assert.strictEqual(prodLedger.pointsDelta, 150); // High Quality Video Rule: +150 XP

    const ytLedger = await ScoreLedger.findOne({ where: { eventId: ytEventId } });
    assert.ok(ytLedger);
    assert.strictEqual(ytLedger.pointsDelta, 300); // Viral Video Rule (>=100k views): +300 XP

    // ─── Step 5: Verify User Competition Dashboard contains multi-module score ────
    const dashRes = await request(app)
      .get('/api/competition/dashboard')
      .set('Authorization', `Bearer ${creatorToken}`);
    assert.strictEqual(dashRes.status, 200);
    assert.ok(dashRes.body.userSummary);
    assert.ok(dashRes.body.userSummary.currentSeasonScore >= 450); // 150 + 300 = 450 XP

    // ─── Step 6: Verify Event Trace Endpoint for Admin ────────────────────────────
    const traceRes = await request(app)
      .get(`/api/competition/events/${prodEventId}/trace`)
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(traceRes.status, 200);
    assert.strictEqual(traceRes.body.eventId, prodEventId);
    assert.strictEqual(traceRes.body.eventType, 'VIDEO_APPROVED');
    assert.strictEqual(traceRes.body.ruleEvaluation.matched, true);
    assert.strictEqual(traceRes.body.ruleEvaluation.totalPointsAwarded, 150);
    assert.strictEqual(traceRes.body.ledgerEntries.length, 1);

    // ─── Step 7: Verify Admin Integration Health Monitor ──────────────────────────
    const healthRes = await request(app)
      .get('/api/competition/admin/integration/health')
      .set('Authorization', `Bearer ${adminToken}`);
    assert.strictEqual(healthRes.status, 200);
    assert.ok(['HEALTHY', 'DEGRADED'].includes(healthRes.body.status));
    assert.ok(healthRes.body.summary.processedCount >= 2);
    assert.ok(healthRes.body.bySourceModule.production >= 1);
    assert.ok(healthRes.body.bySourceModule.youtube >= 1);
  });
});
