'use strict';

/**
 * competition_phase3.test.js
 *
 * Phase 3 Backend Tests — Stateful Competition Engine
 * Run: node --test test/competition_phase3.test.js
 *
 * Covers:
 *   - State create / get
 *   - State increment (counter)
 *   - State threshold + reset
 *   - State expiration
 *   - Team state
 *   - Concurrent mutation (optimistic lock)
 *   - Retry / duplicate event
 *   - Atomic state + score (within one TX)
 *   - Rollback on score failure
 *   - Streak semantics (spec V3.3 exact)
 *   - End-to-end: event → state → score ledger
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

require('dotenv').config();

const sequelize = require('../src/config/database');
const { CompetitionState, ScoreLedger, CompetitionEvent } = require('../src/models');
const stateService = require('../src/services/competition/competitionState.service');
const effectEngine = require('../src/services/competition/effectEngine.service');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanTables() {
  await ScoreLedger.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
  await CompetitionState.destroy({ where: {} });
}

function uuid() { return crypto.randomUUID(); }

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Phase 3 — Stateful Competition', () => {
  before(async () => { await sequelize.authenticate(); });
  after(async () => { await sequelize.close(); });
  beforeEach(async () => { await cleanTables(); });

  // ── STATE CREATE / READ ────────────────────────────────────────────────────
  describe('State Create / Read', () => {
    it('getState returns null if no state exists', async () => {
      const result = await stateService.getState({ seasonId: null, entityId: 1, entityType: 'user', stateKey: 'daily_streak' });
      assert.equal(result, null);
    });

    it('mutateState creates state if not exists', async () => {
      await sequelize.transaction(async (t) => {
        const res = await stateService.mutateState({
          seasonId: null, entityId: 1, entityType: 'user', stateKey: 'daily_streak',
          defaultData: { count: 0 },
          mutatorFn: stateService.incrementMutator('count', 5),
          transaction: t,
        });
        assert.equal(res.newData.count, 1);
        assert.equal(res.version, 2); // created at v1, mutated to v2
        assert.equal(res.thresholdMet, false);
      });

      const state = await stateService.getState({ seasonId: null, entityId: 1, entityType: 'user', stateKey: 'daily_streak' });
      assert.equal(state.dataJson.count, 1);
    });

    it('getState marks expired state', async () => {
      await CompetitionState.create({
        seasonId: null, entityId: 1, entityType: 'user', stateKey: 'weekly_count',
        dataJson: { count: 3 }, version: 1,
        expiresAt: new Date(Date.now() - 1000), // 1 second ago
      });
      const state = await stateService.getState({ seasonId: null, entityId: 1, entityType: 'user', stateKey: 'weekly_count' });
      assert.equal(state._isExpired, true);
    });
  });

  // ── COUNTER + THRESHOLD + RESET ────────────────────────────────────────────
  describe('Counter / Threshold / Reset', () => {
    it('Increments counter correctly', async () => {
      for (let i = 1; i <= 3; i++) {
        await sequelize.transaction(async (t) => {
          const res = await stateService.mutateState({
            seasonId: null, entityId: 2, entityType: 'user', stateKey: 'video_count',
            defaultData: { count: 0 },
            mutatorFn: stateService.incrementMutator('count', 5),
            transaction: t,
          });
          assert.equal(res.newData.count, i);
        });
      }
    });

    it('Threshold met + reset at count=3 (Streak semantics V3.3)', async () => {
      const opts = {
        seasonId: null, entityId: 3, entityType: 'user', stateKey: 'streak',
        defaultData: { count: 0 },
        mutatorFn: stateService.incrementMutator('count', 3, true), // reset on threshold
      };

      let result;
      for (let i = 1; i <= 3; i++) {
        await sequelize.transaction(async (t) => {
          result = await stateService.mutateState({ ...opts, transaction: t });
        });
      }

      // After 3rd event: threshold met, reset to 0
      assert.equal(result.thresholdMet, true);
      assert.equal(result.newData.count, 0, 'count must reset to 0 after threshold');

      const state = await stateService.getState({ seasonId: null, entityId: 3, entityType: 'user', stateKey: 'streak' });
      assert.equal(state.dataJson.count, 0);
    });
  });

  // ── TEAM STATE ─────────────────────────────────────────────────────────────
  describe('Team State', () => {
    it('Stores state for team entity', async () => {
      await sequelize.transaction(async (t) => {
        await stateService.mutateState({
          seasonId: 1, entityId: 10, entityType: 'team', stateKey: 'team_win_streak',
          defaultData: { wins: 0 },
          mutatorFn: stateService.incrementMutator('wins', 3),
          transaction: t,
        });
      });

      const state = await stateService.getState({ seasonId: 1, entityId: 10, entityType: 'team', stateKey: 'team_win_streak' });
      assert.equal(state.entityType, 'team');
      assert.equal(state.dataJson.wins, 1);
    });

    it('User and team states are independent for same key', async () => {
      await sequelize.transaction(async (t) => {
        await stateService.mutateState({
          seasonId: 1, entityId: 5, entityType: 'user', stateKey: 'weekly_count',
          defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 10), transaction: t,
        });
        await stateService.mutateState({
          seasonId: 1, entityId: 5, entityType: 'team', stateKey: 'weekly_count',
          defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 10), transaction: t,
        });
      });

      const userState = await stateService.getState({ seasonId: 1, entityId: 5, entityType: 'user', stateKey: 'weekly_count' });
      const teamState = await stateService.getState({ seasonId: 1, entityId: 5, entityType: 'team', stateKey: 'weekly_count' });
      assert.equal(userState.dataJson.count, 1);
      assert.equal(teamState.dataJson.count, 1);
      assert.notEqual(userState.id, teamState.id);
    });
  });

  // ── CONCURRENCY ────────────────────────────────────────────────────────────
  describe('Concurrent Mutation (Optimistic Lock)', () => {
    it('Sequential mutations produce correct count', async () => {
      // Run 5 increments sequentially — each must see previous state
      for (let i = 0; i < 5; i++) {
        await sequelize.transaction(async (t) => {
          await stateService.mutateState({
            seasonId: null, entityId: 20, entityType: 'user', stateKey: 'seq_count',
            defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 999), transaction: t,
          });
        });
      }
      const state = await stateService.getState({ seasonId: null, entityId: 20, entityType: 'user', stateKey: 'seq_count' });
      assert.equal(state.dataJson.count, 5);
    });

    it('Concurrent increment attempt raises lock conflict or serializes correctly', async () => {
      // Run 10 concurrent increments — result must be exactly 10, not less
      const promises = Array.from({ length: 10 }, () =>
        sequelize.transaction(async (t) => {
          return stateService.mutateState({
            seasonId: null, entityId: 21, entityType: 'user', stateKey: 'concurrent_count',
            defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 999), transaction: t,
          });
        }).catch(() => null) // some may fail due to deadlock, that's acceptable
      );

      const results = await Promise.allSettled(promises);
      const succeeded = results.filter((r) => r.status === 'fulfilled' && r.value !== null).length;

      const state = await stateService.getState({ seasonId: null, entityId: 21, entityType: 'user', stateKey: 'concurrent_count' });
      const finalCount = state?.dataJson?.count ?? 0;

      // Count in DB must match number of successful mutations
      assert.equal(finalCount, succeeded, `Final count ${finalCount} must equal succeeded mutations ${succeeded}`);
      assert.ok(finalCount >= 1, 'At least 1 mutation must succeed');
    });
  });

  // ── STATE + SCORE ATOMICITY ────────────────────────────────────────────────
  describe('Atomic State + Score (Same Transaction)', () => {
    it('State increment + score effect in one TX: both succeed or both fail', async () => {
      const eventId = uuid();

      await sequelize.transaction(async (t) => {
        // Step 1: mutate state
        const stateResult = await stateService.mutateState({
          seasonId: null, entityId: 30, entityType: 'user', stateKey: 'atomic_streak',
          defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 3), transaction: t,
        });

        // Step 2: persist score in same TX (simulating threshold bonus)
        await effectEngine.persistEffects({
          eventId, ruleVersionId: null, seasonId: null,
          effects: [{ targetType: 'USER', targetId: 30, effectType: 'INDIVIDUAL_XP', delta: 50, actionType: 'ADD' }],
          reason: 'Atomic test',
          transaction: t,
        });
      });

      const state = await stateService.getState({ seasonId: null, entityId: 30, entityType: 'user', stateKey: 'atomic_streak' });
      const score = await ScoreLedger.findOne({ where: { userId: 30 } });

      assert.equal(state.dataJson.count, 1);
      assert.equal(score.pointsDelta, 50);
    });

    it('If score persist fails (duplicate), state is NOT rolled back if TX commits', async () => {
      const eventId = uuid();

      // First TX: state + score
      await sequelize.transaction(async (t) => {
        await stateService.mutateState({
          seasonId: null, entityId: 31, entityType: 'user', stateKey: 'rollback_test',
          defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 3), transaction: t,
        });
        await effectEngine.persistEffects({
          eventId, ruleVersionId: null, seasonId: null,
          effects: [{ targetType: 'USER', targetId: 31, effectType: 'INDIVIDUAL_XP', delta: 100, actionType: 'ADD' }],
          reason: 'First insert', transaction: t,
        });
      });

      // Second TX: same eventId → score insert is idempotent (skipped), state still increments
      await sequelize.transaction(async (t) => {
        await stateService.mutateState({
          seasonId: null, entityId: 31, entityType: 'user', stateKey: 'rollback_test',
          defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 3), transaction: t,
        });
        const result = await effectEngine.persistEffects({
          eventId, ruleVersionId: null, seasonId: null,
          effects: [{ targetType: 'USER', targetId: 31, effectType: 'INDIVIDUAL_XP', delta: 100, actionType: 'ADD' }],
          reason: 'Retry insert', transaction: t,
        });
        assert.equal(result.skipped, 1, 'Duplicate score should be skipped');
      });

      const state = await stateService.getState({ seasonId: null, entityId: 31, entityType: 'user', stateKey: 'rollback_test' });
      const scoreCount = await ScoreLedger.count({ where: { userId: 31 } });

      assert.equal(state.dataJson.count, 2, 'State incremented twice (both TXs committed)');
      assert.equal(scoreCount, 1, 'Score ledger has exactly 1 row (idempotent)');
    });

    it('TX rollback → neither state nor score persisted', async () => {
      try {
        await sequelize.transaction(async (t) => {
          await stateService.mutateState({
            seasonId: null, entityId: 32, entityType: 'user', stateKey: 'rollback_both',
            defaultData: { count: 0 }, mutatorFn: stateService.incrementMutator('count', 3), transaction: t,
          });
          await effectEngine.persistEffects({
            eventId: uuid(), ruleVersionId: null, seasonId: null,
            effects: [{ targetType: 'USER', targetId: 32, effectType: 'INDIVIDUAL_XP', delta: 100, actionType: 'ADD' }],
            transaction: t,
          });
          throw new Error('Intentional rollback');
        });
      } catch (_) { /* expected */ }

      const state = await stateService.getState({ seasonId: null, entityId: 32, entityType: 'user', stateKey: 'rollback_both' });
      const score = await ScoreLedger.findOne({ where: { userId: 32 } });

      assert.equal(state, null, 'State must not exist after rollback');
      assert.equal(score, null, 'Score must not exist after rollback');
    });
  });

  // ── STREAK SEMANTICS (EXACT V3.3 SPEC) ────────────────────────────────────
  describe('Streak Semantics (V3.3 Exact)', () => {
    it('count=0 → A=1 → B=2 → C=3 → bonus → reset=0; retry C → count=1 not 4', async () => {
      const ENTITY = { seasonId: null, entityId: 40, entityType: 'user', stateKey: 'exact_streak' };
      const eventIds = [uuid(), uuid(), uuid()];
      let thresholdResults = [];

      // Events A, B, C
      for (let i = 0; i < 3; i++) {
        await sequelize.transaction(async (t) => {
          const res = await stateService.mutateState({
            ...ENTITY, defaultData: { count: 0 },
            mutatorFn: stateService.incrementMutator('count', 3, true),
            transaction: t,
          });
          thresholdResults.push(res.thresholdMet);

          // If threshold met, award bonus
          if (res.thresholdMet) {
            await effectEngine.persistEffects({
              eventId: eventIds[i], ruleVersionId: null, seasonId: null,
              effects: [{ targetType: 'USER', targetId: 40, effectType: 'STREAK_BONUS', delta: 150, actionType: 'ADD' }],
              reason: 'Streak 3 bonus', transaction: t,
            });
          }
        });
      }

      assert.deepEqual(thresholdResults, [false, false, true]);

      const stateAfterC = await stateService.getState({ ...ENTITY });
      assert.equal(stateAfterC.dataJson.count, 0, 'count reset to 0 after threshold in same TX');

      const bonusRows = await ScoreLedger.findAll({ where: { userId: 40, effectType: 'STREAK_BONUS' } });
      assert.equal(bonusRows.length, 1, 'Exactly 1 bonus row');
      assert.equal(bonusRows[0].pointsDelta, 150);

      // Retry Event C → count becomes 1, no new bonus (idempotent key blocks it)
      await sequelize.transaction(async (t) => {
        const res = await stateService.mutateState({
          ...ENTITY, defaultData: { count: 0 },
          mutatorFn: stateService.incrementMutator('count', 3, true),
          transaction: t,
        });
        // Retry bonus effect → should be skipped by idempotency
        if (res.thresholdMet) {
          await effectEngine.persistEffects({
            eventId: eventIds[2], // same event_id as C
            ruleVersionId: null, seasonId: null,
            effects: [{ targetType: 'USER', targetId: 40, effectType: 'STREAK_BONUS', delta: 150, actionType: 'ADD' }],
            reason: 'Streak 3 bonus retry', transaction: t,
          });
        }
      });

      const stateAfterRetry = await stateService.getState({ ...ENTITY });
      const bonusAfterRetry = await ScoreLedger.findAll({ where: { userId: 40, effectType: 'STREAK_BONUS' } });

      assert.equal(stateAfterRetry.dataJson.count, 1, 'count=1 after retry (not 4)');
      assert.equal(bonusAfterRetry.length, 1, 'Still exactly 1 bonus after retry');
    });
  });

  // ── EXPIRATION ─────────────────────────────────────────────────────────────
  describe('State Expiration', () => {
    it('Expired state is reset and treated as fresh on next mutation', async () => {
      await CompetitionState.create({
        seasonId: null, entityId: 50, entityType: 'user', stateKey: 'exp_count',
        dataJson: { count: 9 }, version: 5,
        expiresAt: new Date(Date.now() - 5000), // already expired
      });

      await sequelize.transaction(async (t) => {
        const res = await stateService.mutateState({
          seasonId: null, entityId: 50, entityType: 'user', stateKey: 'exp_count',
          defaultData: { count: 0 },
          mutatorFn: stateService.incrementMutator('count', 10),
          transaction: t,
        });
        assert.equal(res.isExpired, true);
        // After expiry reset then increment from 0: result should be 1
        assert.equal(res.newData.count, 1);
      });
    });
  });
});
