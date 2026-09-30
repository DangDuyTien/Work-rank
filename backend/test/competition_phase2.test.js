'use strict';

/**
 * competition_phase2.test.js
 *
 * Phase 2 Gate Tests — Core Competition Engine
 * Run: node --test test/competition_phase2.test.js
 *
 * Covers:
 *   - Condition Engine (all operators)
 *   - Score Pipeline (deterministic math)
 *   - Action Engine (ADD/SUBTRACT/MULTIPLY/DISTRIBUTE)
 *   - Rule Validator (structure, safety, semantics)
 *   - Effect Engine (deterministic key, duplicate, target invariant)
 *   - Event Processor (matched/unmatched/invalid/duplicate/retry)
 *   - Season 1 fixture (Production Race)
 *   - Season 2 fixture (Quality Battle)
 *   - Season 4 fixture (Weekend Multiplier)
 */

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

require('dotenv').config();

const sequelize = require('../src/config/database');
const { CompetitionEvent, ScoreLedger } = require('../src/models');

const conditionEval = require('../src/services/competition/conditionEvaluator.service');
const actionEval = require('../src/services/competition/actionEvaluator.service');
const scoreEngine = require('../src/services/competition/scoreEngine.service');
const ruleValidator = require('../src/services/competition/ruleValidator.service');
const effectEngine = require('../src/services/competition/effectEngine.service');
const engine = require('../src/services/competition/competitionEngine.worker');

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function cleanCompetitionTables() {
  await ScoreLedger.destroy({ where: {} });
  await CompetitionEvent.destroy({ where: {} });
}

function makeEvent(overrides = {}) {
  return {
    eventId: require('crypto').randomUUID(),
    idempotencyKey: require('crypto').randomUUID(),
    eventType: overrides.eventType ?? 'VIDEO_APPROVED',
    actorId: overrides.actorId ?? 1,
    teamId: overrides.teamId ?? 1,
    occurredAt: overrides.occurredAt ? new Date(overrides.occurredAt) : new Date(),
    receivedAt: new Date(),
    payload: overrides.payload ?? { seasonId: null },
    schemaVersion: 1,
    sourceModule: 'test',
    aggregateType: 'Video',
    aggregateId: 1,
    correlationId: null,
    causationId: null,
    // toBusinessPayload as used by engine
    toBusinessPayload() { return { ...this }; },
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('Phase 2 — Core Competition Engine', () => {
  before(async () => { await sequelize.authenticate(); });
  after(async () => { await sequelize.close(); });
  beforeEach(async () => {
    await cleanCompetitionTables();
    engine.clearRules();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // CONDITION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Condition Engine', () => {
    const ctx = {
      event: {
        actor_id: 1,
        team_id: 2,
        event_type: 'VIDEO_APPROVED',
        occurred_at: new Date('2026-10-04T10:00:00Z'), // Saturday
        payload: { stage: 'script', views: 15000, verified: true, tags: ['comedy', 'viral'] },
      },
      context: { actor: { id: 1 }, team: { id: 2 }, season: { id: null } },
    };

    it('EQ — matching', () => assert.equal(conditionEval.evaluate({ op: 'EQ', field: 'event.payload.stage', value: 'script' }, ctx), true));
    it('EQ — not matching', () => assert.equal(conditionEval.evaluate({ op: 'EQ', field: 'event.payload.stage', value: 'editing' }, ctx), false));
    it('NEQ', () => assert.equal(conditionEval.evaluate({ op: 'NEQ', field: 'event.payload.stage', value: 'editing' }, ctx), true));
    it('GT', () => assert.equal(conditionEval.evaluate({ op: 'GT', field: 'event.payload.views', value: 10000 }, ctx), true));
    it('GT — false', () => assert.equal(conditionEval.evaluate({ op: 'GT', field: 'event.payload.views', value: 20000 }, ctx), false));
    it('GTE', () => assert.equal(conditionEval.evaluate({ op: 'GTE', field: 'event.payload.views', value: 15000 }, ctx), true));
    it('LT', () => assert.equal(conditionEval.evaluate({ op: 'LT', field: 'event.payload.views', value: 20000 }, ctx), true));
    it('LTE', () => assert.equal(conditionEval.evaluate({ op: 'LTE', field: 'event.payload.views', value: 15000 }, ctx), true));
    it('AND — both true', () => assert.equal(conditionEval.evaluate({ op: 'AND', conditions: [
      { op: 'EQ', field: 'event.payload.stage', value: 'script' },
      { op: 'EQ', field: 'event.payload.verified', value: true },
    ] }, ctx), true));
    it('AND — one false', () => assert.equal(conditionEval.evaluate({ op: 'AND', conditions: [
      { op: 'EQ', field: 'event.payload.stage', value: 'script' },
      { op: 'EQ', field: 'event.payload.verified', value: false },
    ] }, ctx), false));
    it('OR — one true', () => assert.equal(conditionEval.evaluate({ op: 'OR', conditions: [
      { op: 'EQ', field: 'event.payload.stage', value: 'WRONG' },
      { op: 'EQ', field: 'event.payload.verified', value: true },
    ] }, ctx), true));
    it('NOT', () => assert.equal(conditionEval.evaluate({ op: 'NOT', condition: { op: 'EQ', field: 'event.payload.stage', value: 'editing' } }, ctx), true));
    it('IN', () => assert.equal(conditionEval.evaluate({ op: 'IN', field: 'event.payload.stage', values: ['script', 'editing'] }, ctx), true));
    it('NOT_IN', () => assert.equal(conditionEval.evaluate({ op: 'NOT_IN', field: 'event.payload.stage', values: ['editing', 'review'] }, ctx), true));
    it('IS_WEEKEND — Saturday', () => assert.equal(conditionEval.evaluate({ op: 'IS_WEEKEND', field: 'event.occurred_at' }, ctx), true));
    it('IS_WEEKEND — weekday', () => {
      const weekdayCtx = { ...ctx, event: { ...ctx.event, occurred_at: new Date('2026-10-05T10:00:00Z') } }; // Monday
      assert.equal(conditionEval.evaluate({ op: 'IS_WEEKEND', field: 'event.occurred_at' }, weekdayCtx), false);
    });
    it('IS_NULL', () => assert.equal(conditionEval.evaluate({ op: 'IS_NULL', field: 'event.aggregate_id' }, { event: { aggregate_id: null }, context: {} }), true));
    it('IS_NOT_NULL', () => assert.equal(conditionEval.evaluate({ op: 'IS_NOT_NULL', field: 'event.actor_id' }, ctx), true));
    it('null/empty AST = unconditional match', () => assert.equal(conditionEval.evaluate(null, ctx), true));
    it('unknown field path throws', () => assert.throws(() => conditionEval.evaluate({ op: 'EQ', field: 'process.env.SECRET', value: 'x' }, ctx), /not allowed/));
    it('unknown op throws', () => assert.throws(() => conditionEval.evaluate({ op: 'HACK', field: 'event.actor_id', value: 1 }, ctx), /unknown operator/));
    it('AST depth exceeded throws', () => {
      // Build a nested AND that is 6 levels deep
      let node = { op: 'EQ', field: 'event.actor_id', value: 1 };
      for (let i = 0; i < 7; i++) node = { op: 'AND', conditions: [node] };
      assert.throws(() => conditionEval.evaluate(node, ctx), /depth exceeds/);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SCORE PIPELINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Score Pipeline', () => {
    it('Base=100, Bonus=20, Penalty=10, Multiplier=2 → 220', () => {
      const result = scoreEngine.applyPipeline({ base: 100, bonus: 20, penalty: 10, multiplier: 2 });
      assert.equal(result, 220);
    });
    it('Base only → 100', () => assert.equal(scoreEngine.applyPipeline({ base: 100 }), 100));
    it('With floor: result clamped up to 0', () => {
      const result = scoreEngine.applyPipeline({ base: -200, floor: 0 });
      assert.equal(result, 0);
    });
    it('With cap: result clamped down to 500', () => {
      const result = scoreEngine.applyPipeline({ base: 1000, cap: 500 });
      assert.equal(result, 500);
    });
    it('NaN base throws', () => assert.throws(() => scoreEngine.applyPipeline({ base: NaN }), /finite/));
    it('Infinity multiplier throws', () => assert.throws(() => scoreEngine.applyPipeline({ base: 100, multiplier: Infinity }), /finite/));
    it('Zero multiplier throws', () => assert.throws(() => scoreEngine.applyPipeline({ base: 100, multiplier: 0 }), /cannot be 0/));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTION ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Action Engine', () => {
    const ctx = { event: { actor_id: 7, team_id: 3, payload: { collaborator_id: 8 } }, context: {} };

    it('ADD produces positive delta for actor', () => {
      const effects = actionEval.evaluate({ type: 'ADD', value: 100 }, ctx, 'INDIVIDUAL_XP');
      assert.equal(effects.length, 1);
      assert.equal(effects[0].delta, 100);
      assert.equal(effects[0].targetId, 7);
    });
    it('SUBTRACT produces negative delta', () => {
      const effects = actionEval.evaluate({ type: 'SUBTRACT', value: 50 }, ctx, 'INDIVIDUAL_XP');
      assert.equal(effects[0].delta, -50);
    });
    it('MULTIPLY returns MODIFIER marker', () => {
      const effects = actionEval.evaluate({ type: 'MULTIPLY', value: 2 }, ctx, 'INDIVIDUAL_XP');
      assert.equal(effects[0].effectType, 'MULTIPLIER');
      assert.equal(effects[0].delta, 2);
    });
    it('DISTRIBUTE splits value equally', () => {
      const effects = actionEval.evaluate(
        { type: 'DISTRIBUTE', targets: ['event.actor_id', 'event.payload.collaborator_id'], value: 100 },
        ctx, 'INDIVIDUAL_XP',
      );
      assert.equal(effects.length, 2);
      assert.equal(effects[0].delta, 50);
      assert.equal(effects[1].delta, 50);
      assert.equal(effects[0].targetId, 7);
      assert.equal(effects[1].targetId, 8);
    });
    it('Unknown action type throws', () => assert.throws(() => actionEval.evaluate({ type: 'HACK' }, ctx), /unknown action/));
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RULE VALIDATOR
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Rule Validator', () => {
    it('Valid simple rule passes', () => {
      const { valid, errors } = ruleValidator.validateRule({
        condition_ast: { op: 'EQ', field: 'event.payload.stage', value: 'script' },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      });
      assert.equal(valid, true, errors.join(', '));
    });
    it('Unknown op in condition fails', () => {
      const { valid } = ruleValidator.validateRule({
        condition_ast: { op: 'HACK', field: 'event.actor_id', value: 1 },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      });
      assert.equal(valid, false);
    });
    it('Disallowed field in condition fails', () => {
      const { valid } = ruleValidator.validateRule({
        condition_ast: { op: 'EQ', field: 'process.env.NODE_ENV', value: 'production' },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      });
      assert.equal(valid, false);
    });
    it('Infinity value in condition fails', () => {
      const { valid } = ruleValidator.validateRule({
        condition_ast: { op: 'GT', field: 'event.payload.views', value: Infinity },
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      });
      assert.equal(valid, false);
    });
    it('MULTIPLY by 0 fails', () => {
      const { valid } = ruleValidator.validateRule({
        condition_ast: null,
        action_ast: { type: 'MULTIPLY', value: 0 },
        effect_type: 'INDIVIDUAL_XP',
      });
      assert.equal(valid, false);
    });
    it('Unknown effect_type fails', () => {
      const { valid } = ruleValidator.validateRule({
        condition_ast: null,
        action_ast: { type: 'ADD', value: 50 },
        effect_type: 'HACK_POINTS',
      });
      assert.equal(valid, false);
    });
    it('Missing action_ast fails', () => {
      const { valid } = ruleValidator.validateRule({ condition_ast: null, effect_type: 'INDIVIDUAL_XP' });
      assert.equal(valid, false);
    });
    it('Deep AST (7 levels) fails', () => {
      let node = { op: 'EQ', field: 'event.actor_id', value: 1 };
      for (let i = 0; i < 7; i++) node = { op: 'AND', conditions: [node] };
      const { valid } = ruleValidator.validateRule({ condition_ast: node, action_ast: { type: 'ADD', value: 10 }, effect_type: 'INDIVIDUAL_XP' });
      assert.equal(valid, false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EFFECT ENGINE
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Effect Engine', () => {
    it('Deterministic key — same inputs produce same key', () => {
      const k1 = effectEngine.buildEffectKey({ eventId: 'E1', ruleVersionId: 'R1', effectType: 'INDIVIDUAL_XP', targetType: 'USER', targetId: 7 });
      const k2 = effectEngine.buildEffectKey({ eventId: 'E1', ruleVersionId: 'R1', effectType: 'INDIVIDUAL_XP', targetType: 'USER', targetId: 7 });
      assert.equal(k1, k2);
    });
    it('Different targetId → different key', () => {
      const k1 = effectEngine.buildEffectKey({ eventId: 'E1', ruleVersionId: 'R1', effectType: 'INDIVIDUAL_XP', targetType: 'USER', targetId: 7 });
      const k2 = effectEngine.buildEffectKey({ eventId: 'E1', ruleVersionId: 'R1', effectType: 'INDIVIDUAL_XP', targetType: 'USER', targetId: 8 });
      assert.notEqual(k1, k2);
    });
    it('Persist effect and duplicate is skipped', async () => {
      const eventId = require('crypto').randomUUID();
      const effect = { targetType: 'USER', targetId: 1, effectType: 'INDIVIDUAL_XP', delta: 100, actionType: 'ADD' };
      const result1 = await sequelize.transaction((t) => effectEngine.persistEffects({ eventId, ruleVersionId: null, seasonId: null, effects: [effect], transaction: t }));
      assert.equal(result1.inserted, 1);
      const result2 = await sequelize.transaction((t) => effectEngine.persistEffects({ eventId, ruleVersionId: null, seasonId: null, effects: [effect], transaction: t }));
      assert.equal(result2.skipped, 1);
      const count = await ScoreLedger.count({ where: { eventId } });
      assert.equal(count, 1);
    });
    it('INDIVIDUAL_XP without userId throws before insert', async () => {
      const effect = { targetType: 'TEAM', targetId: null, effectType: 'INDIVIDUAL_XP', delta: 100, actionType: 'ADD' };
      await assert.rejects(
        () => sequelize.transaction((t) => effectEngine.persistEffects({ eventId: require('crypto').randomUUID(), ruleVersionId: null, seasonId: null, effects: [effect], transaction: t })),
        /requires userId/,
      );
    });
    it('MULTIPLIER marker is skipped (no ledger row)', async () => {
      const effect = { targetType: 'MODIFIER', targetId: null, effectType: 'MULTIPLIER', delta: 2, actionType: 'MULTIPLY' };
      const result = await sequelize.transaction((t) => effectEngine.persistEffects({ eventId: require('crypto').randomUUID(), ruleVersionId: null, seasonId: null, effects: [effect], transaction: t }));
      assert.equal(result.inserted, 0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EVENT PROCESSOR
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Event Processor (competitionEngine.worker)', () => {
    it('Rule matched → score effect persisted → event PROCESSED', async () => {
      engine.registerRules('VIDEO_APPROVED', [{
        condition_ast: null,
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      }]);

      await CompetitionEvent.create({ ...makeEvent({ actorId: 1 }), status: 'PENDING' });
      await engine.processBatch();

      const event = await CompetitionEvent.findOne({ where: { status: 'PROCESSED' } });
      assert.ok(event, 'Event should be PROCESSED');
      const ledger = await ScoreLedger.findAll({ where: { effectType: 'INDIVIDUAL_XP', userId: 1 } });
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0].pointsDelta, 100);
    });

    it('No rule matched → event PROCESSED with 0 effects', async () => {
      // No rules registered for this event type
      await CompetitionEvent.create({ ...makeEvent({ eventType: 'UNKNOWN_TYPE', actorId: 2 }), status: 'PENDING' });
      await engine.processBatch();

      const event = await CompetitionEvent.findOne({ where: { status: 'PROCESSED' } });
      assert.ok(event);
      const count = await ScoreLedger.count();
      assert.equal(count, 0);
    });

    it('Same event processed twice → idempotent (1 ledger row only)', async () => {
      engine.registerRules('VIDEO_APPROVED', [{
        condition_ast: null,
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      }]);

      // Create a PENDING event, process it once
      const eventData = makeEvent({ actorId: 3 });
      await CompetitionEvent.create({ ...eventData, status: 'PENDING' });
      await engine.processBatch();

      // Manually reset status to PENDING to simulate duplicate delivery
      await CompetitionEvent.update({ status: 'PENDING', processedAt: null }, { where: { eventId: eventData.eventId } });
      await engine.processBatch();

      const rows = await ScoreLedger.findAll({ where: { userId: 3, effectType: 'INDIVIDUAL_XP' } });
      assert.equal(rows.length, 1, 'Ledger should have exactly 1 row despite 2 processing attempts');
    });

    it('Condition match — only matching events score', async () => {
      engine.registerRules('VIDEO_APPROVED', [{
        condition_ast: { op: 'GT', field: 'event.payload.views', value: 10000 },
        action_ast: { type: 'ADD', value: 200 },
        effect_type: 'INDIVIDUAL_XP',
      }]);

      // Event with views = 15000 (matches condition)
      await CompetitionEvent.create({ ...makeEvent({ actorId: 10, payload: { views: 15000 } }), status: 'PENDING' });
      // Event with views = 5000 (does NOT match)
      await CompetitionEvent.create({ ...makeEvent({ actorId: 11, payload: { views: 5000 } }), status: 'PENDING' });

      await engine.processBatch();

      const rows = await ScoreLedger.findAll({ where: { effectType: 'INDIVIDUAL_XP' } });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].userId, 10);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SEASON FIXTURE TESTS
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Season Fixtures (no-code proof)', () => {
    it('Season 1 — Production Race: VIDEO_APPROVED → +100 INDIVIDUAL_XP', async () => {
      engine.registerRules('VIDEO_APPROVED', [{
        condition_ast: null,
        action_ast: { type: 'ADD', value: 100 },
        effect_type: 'INDIVIDUAL_XP',
      }]);

      await CompetitionEvent.create({ ...makeEvent({ actorId: 5, eventType: 'VIDEO_APPROVED' }), status: 'PENDING' });
      await CompetitionEvent.create({ ...makeEvent({ actorId: 6, eventType: 'VIDEO_APPROVED' }), status: 'PENDING' });
      await CompetitionEvent.create({ ...makeEvent({ actorId: 5, eventType: 'VIDEO_APPROVED' }), status: 'PENDING' });

      await engine.processBatch();

      const u5Total = await ScoreLedger.sum('points_delta', { where: { userId: 5 } });
      const u6Total = await ScoreLedger.sum('points_delta', { where: { userId: 6 } });
      assert.equal(u5Total, 200);
      assert.equal(u6Total, 100);
    });

    it('Season 2 — Quality Battle: VIDEO_APPROVED +100, VIDEO_REJECTED -50', async () => {
      engine.registerRules('VIDEO_APPROVED', [{
        condition_ast: null, action_ast: { type: 'ADD', value: 100 }, effect_type: 'INDIVIDUAL_XP',
      }]);
      engine.registerRules('VIDEO_REJECTED', [{
        condition_ast: null, action_ast: { type: 'SUBTRACT', value: 50 }, effect_type: 'INDIVIDUAL_XP',
      }]);

      await CompetitionEvent.create({ ...makeEvent({ actorId: 20, eventType: 'VIDEO_APPROVED' }), status: 'PENDING' });
      await CompetitionEvent.create({ ...makeEvent({ actorId: 20, eventType: 'VIDEO_REJECTED' }), status: 'PENDING' });
      await CompetitionEvent.create({ ...makeEvent({ actorId: 21, eventType: 'VIDEO_APPROVED' }), status: 'PENDING' });

      await engine.processBatch();

      const u20Total = await ScoreLedger.sum('points_delta', { where: { userId: 20 } });
      const u21Total = await ScoreLedger.sum('points_delta', { where: { userId: 21 } });
      assert.equal(u20Total, 50);  // 100 - 50
      assert.equal(u21Total, 100);
    });

    it('Season 4 — Weekend Multiplier: Saturday ×2, Monday ×1', async () => {
      engine.registerRules('VIDEO_APPROVED', [
        {
          condition_ast: { op: 'IS_WEEKEND', field: 'event.occurred_at' },
          action_ast: { type: 'ADD', value: 100 },
          effect_type: 'INDIVIDUAL_XP',
          multiplier: 2,
        },
        {
          condition_ast: { op: 'NOT', condition: { op: 'IS_WEEKEND', field: 'event.occurred_at' } },
          action_ast: { type: 'ADD', value: 100 },
          effect_type: 'INDIVIDUAL_XP',
          multiplier: 1,
        },
      ]);

      // Saturday 2026-10-04
      await CompetitionEvent.create({
        ...makeEvent({ actorId: 30, occurredAt: '2026-10-04T10:00:00Z' }),
        status: 'PENDING',
      });
      // Monday 2026-10-06
      await CompetitionEvent.create({
        ...makeEvent({ actorId: 31, occurredAt: '2026-10-06T10:00:00Z' }),
        status: 'PENDING',
      });

      await engine.processBatch();

      const satTotal = await ScoreLedger.sum('points_delta', { where: { userId: 30 } });
      const monTotal = await ScoreLedger.sum('points_delta', { where: { userId: 31 } });
      assert.equal(satTotal, 200); // 100 × 2
      assert.equal(monTotal, 100); // 100 × 1
    });
  });
});
