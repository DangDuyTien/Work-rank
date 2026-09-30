'use strict';

/**
 * competition_phase3_e2e.test.js
 *
 * Phase 3 End-to-End Test:
 * Event Ingestion → State Engine Mutation → Threshold Bonus → Score Ledger → User & Admin API Verification
 *
 * Run: node --test test/competition_phase3_e2e.test.js
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
const { User, Team, CompetitionState, ScoreLedger, CompetitionEvent, EventOutbox } = require('../src/models');
const outboxService = require('../src/services/competition/outbox.service');
const outboxDispatcher = require('../src/workers/outboxDispatcher.worker');
const engineWorker = require('../src/services/competition/competitionEngine.worker');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email, role: user.role }, env.jwtSecret, { expiresIn: '1h' });
}

async function cleanAll() {
  await ScoreLedger.destroy({ where: {} });
  await CompetitionState.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
  await EventOutbox.destroy({ where: {} });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Phase 3 E2E — Stateful Competition & API Authorization', () => {
  let regularUser;
  let adminUser;
  let regularToken;
  let adminToken;

  before(async () => {
    await sequelize.authenticate();

    // Create test team and users
    let [team] = await Team.findOrCreate({
      where: { name: 'E2E Test Team' },
      defaults: { name: 'E2E Test Team', key: 'E2E' },
    });

    [regularUser] = await User.findOrCreate({
      where: { email: 'phase3_regular@workrank.test' },
      defaults: {
        name: 'Regular Test User',
        email: 'phase3_regular@workrank.test',
        passwordHash: 'dummy-hash',
        role: 'user',
        status: 'active',
        teamId: team.id,
      },
    });

    [adminUser] = await User.findOrCreate({
      where: { email: 'phase3_admin@workrank.test' },
      defaults: {
        name: 'Admin Test User',
        email: 'phase3_admin@workrank.test',
        passwordHash: 'dummy-hash',
        role: 'admin',
        status: 'active',
        teamId: team.id,
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

  it('E2E Flow: 3 Video events → streak count reaches 3 → +150 bonus in ledger → User API & Admin API audit verified', async () => {
    // 1. Register a stateful rule in the competition engine
    engineWorker.registerRules('VIDEO_APPROVED', [
      {
        condition_ast: null,
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
        state_mutation: {
          key: 'daily_streak',
          entity_type: 'user',
          mutator: 'INCREMENT',
          field: 'count',
          threshold: 3,
          reset_on_threshold: true,
          on_threshold_action: { type: 'ADD', value: 150 },
          on_threshold_effect: 'STREAK_BONUS',
        },
      },
    ]);

    // 2. Enqueue 3 domain events for regularUser
    for (let i = 1; i <= 3; i++) {
      await outboxService.enqueue(
        { domainWrite: async () => ({ videoId: i }) },
        {
          eventType: 'VIDEO_APPROVED',
          payload: {
            actorId: regularUser.id,
            teamId: regularUser.teamId,
            videoId: i,
            stage: 'approved',
          },
          idempotencyKey: `e2e-video-${regularUser.id}-${i}`,
        },
      );
    }

    // 3. Dispatch outbox → event store
    await outboxDispatcher.processBatch();

    // Verify 3 events in event store
    const eventCount = await CompetitionEvent.count({ where: { actorId: regularUser.id } });
    assert.equal(eventCount, 3, 'Event Store should have 3 events');

    // 4. Process events via Competition Engine Worker
    await engineWorker.processBatch();

    // Verify all 3 events are marked PROCESSED
    const processedCount = await CompetitionEvent.count({ where: { actorId: regularUser.id, status: 'PROCESSED' } });
    assert.equal(processedCount, 3, 'All 3 events should be PROCESSED');

    // 5. Verify Score Ledger entries:
    // 3 x +100 INDIVIDUAL_XP + 1 x +150 STREAK_BONUS = 4 total rows, 450 total XP
    const scoreRows = await ScoreLedger.findAll({ where: { userId: regularUser.id } });
    assert.equal(scoreRows.length, 4, 'Should have 4 score ledger rows');

    const totalXP = scoreRows.reduce((sum, r) => sum + r.pointsDelta, 0);
    assert.equal(totalXP, 450, 'Total score should be 450 XP (3x100 + 150 bonus)');

    const streakBonusRow = scoreRows.find((r) => r.effectType === 'STREAK_BONUS');
    assert.ok(streakBonusRow, 'STREAK_BONUS row must exist');
    assert.equal(streakBonusRow.pointsDelta, 150);

    // 6. User API verification: GET /api/competition/my-state
    const userStateRes = await request(app)
      .get('/api/competition/my-state')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.ok(Array.isArray(userStateRes.body.states));
    const userStreakState = userStateRes.body.states.find((s) => s.stateKey === 'daily_streak');
    assert.ok(userStreakState, 'User state for daily_streak should be returned');
    assert.equal(userStreakState.data.count, 0, 'Streak count was reset to 0 after reaching threshold 3');

    // 7. User API verification: GET /api/competition/my-score-history
    const userHistoryRes = await request(app)
      .get('/api/competition/my-score-history')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(200);

    assert.equal(userHistoryRes.body.history.length, 4);

    // 8. Authorization Check: Regular User CANNOT access Admin endpoints
    await request(app)
      .get('/api/competition/admin/states')
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);

    await request(app)
      .get(`/api/competition/admin/score-inspect/${regularUser.id}`)
      .set('Authorization', `Bearer ${regularToken}`)
      .expect(403);

    // 9. Admin API verification: GET /api/competition/admin/states
    const adminStatesRes = await request(app)
      .get('/api/competition/admin/states')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.ok(adminStatesRes.body.total >= 1);
    assert.ok(adminStatesRes.body.states.some((s) => s.stateKey === 'daily_streak' && Number(s.entityId) === Number(regularUser.id)));

    // 10. Admin API verification: GET /api/competition/admin/score-inspect/:userId
    const adminInspectRes = await request(app)
      .get(`/api/competition/admin/score-inspect/${regularUser.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    assert.equal(adminInspectRes.body.userId, regularUser.id);
    assert.equal(adminInspectRes.body.total, 4);
    assert.equal(adminInspectRes.body.totalScore, 450);
    assert.equal(adminInspectRes.body.entries.length, 4);
  });
});
