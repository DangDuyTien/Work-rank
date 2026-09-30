'use strict';

/**
 * competitionEngine.worker.js
 *
 * Polls competition_events for PENDING events, evaluates rules, persists effects.
 *
 * Flow:
 *   PENDING Event
 *     → Resolve rules for event_type (from in-memory registry in Phase 2)
 *     → evaluateRule() [pure]
 *     → BEGIN TX → persistEffects() → COMMIT TX
 *     → markProcessed(eventId)
 *
 * Failure semantics:
 *   - Rule invalid              → mark IGNORED (event noted, no score)
 *   - No rule matched           → mark PROCESSED (0 effects, valid outcome)
 *   - Duplicate effect          → treated as idempotent success
 *   - DB failure (persist)      → event stays PENDING (retried on next poll)
 *   - Unexpected evaluator err  → mark FAILED, do NOT mark PROCESSED
 *   - Event never silently lost → always transitions to PROCESSED|FAILED|IGNORED
 *
 * In Phase 2:
 *   Rules are registered in-memory via registerRules().
 *   In Phase 4, this will query rule_set_versions from the DB.
 */

const sequelize = require('../../config/database');
const eventStoreService = require('./eventStore.service');
const scoreEngine = require('./scoreEngine.service');
const effectEngine = require('./effectEngine.service');
const competitionStateService = require('./competitionState.service');
const competitionRealtime = require('./competitionRealtime.service');
const seasonRuleResolver = require('./seasonRuleResolver.service');
const { CompetitionEvent } = require('../../models');

const POLL_INTERVAL_MS = Number(process.env.ENGINE_POLL_INTERVAL_MS ?? 3000);
const BATCH_SIZE = Number(process.env.ENGINE_BATCH_SIZE ?? 50);

// ─── Operational Controls: Kill Switch & Shadow Mode ─────────────────────────

let dynamicProcessingEnabled = null;
let dynamicShadowMode = null;

function isProcessingEnabled() {
  if (dynamicProcessingEnabled !== null) return dynamicProcessingEnabled;
  return process.env.COMPETITION_PROCESSING_ENABLED !== 'false';
}

function setProcessingEnabled(enabled) {
  dynamicProcessingEnabled = Boolean(enabled);
}

function isShadowModeEnabled() {
  if (dynamicShadowMode !== null) return dynamicShadowMode;
  return process.env.COMPETITION_SHADOW_MODE === 'true';
}

function setShadowModeEnabled(enabled) {
  dynamicShadowMode = Boolean(enabled);
}

// ─── In-memory Rule Registry (Phase 2 only) ──────────────────────────────────

/** @type {Map<string, object[]>} eventType → rule definitions */
const ruleRegistry = new Map();

/**
 * Register rules for one or more event types.
 * This replaces the rule set for the given event_type.
 *
 * @param {string} eventType
 * @param {object[]} rules
 */
function registerRules(eventType, rules) {
  ruleRegistry.set(eventType, rules);
}

/**
 * Clear all registered rules (useful for test isolation).
 */
function clearRules() {
  ruleRegistry.clear();
}

// ─── Event processing ─────────────────────────────────────────────────────────

/**
 * Process a single PENDING competition event.
 *
 * @param {import('../models/CompetitionEvent')} event
 * @returns {Promise<void>}
 */
async function processEvent(event) {
  const businessPayload = event.toBusinessPayload();
  const rawPayload = typeof businessPayload.payload === 'string'
    ? JSON.parse(businessPayload.payload)
    : (businessPayload.payload || {});
  const seasonId = rawPayload?.seasonId ?? null;

  let rules = ruleRegistry.get(event.eventType) ?? [];
  let resolvedVersionId = null;

  if (seasonId) {
    const resolution = await seasonRuleResolver.resolveSeasonRules({
      seasonId,
      occurredAt: businessPayload.occurredAt,
      receivedAt: businessPayload.receivedAt || new Date(),
    });

    if (resolution.isPaused || resolution.hold) {
      // Hold event until season resumes
      return;
    }

    if (!resolution.eligible) {
      // Ineligible event (late rejected, outside season, etc.) — mark processed with 0 score
      await eventStoreService.markProcessed(event.eventId);
      return;
    }

    if (resolution.rules && resolution.rules.length > 0) {
      rules = resolution.rules;
      resolvedVersionId = resolution.ruleSetVersion?.id || null;
    }
  }

  // Build evaluation context
  const ctx = {
    event: {
      ...businessPayload,
      // Map camelCase Sequelize fields to snake_case for condition evaluator
      event_type: businessPayload.eventType,
      source_module: businessPayload.sourceModule,
      aggregate_type: businessPayload.aggregateType,
      aggregate_id: businessPayload.aggregateId,
      actor_id: businessPayload.actorId,
      team_id: businessPayload.teamId,
      // occurred_at must be a Date so IS_WEEKEND and date operators work correctly
      occurred_at: businessPayload.occurredAt instanceof Date
        ? businessPayload.occurredAt
        : new Date(businessPayload.occurredAt),
      payload: rawPayload,
    },
    context: {
      actor: { id: businessPayload.actorId },
      team: { id: businessPayload.teamId },
      season: { id: seasonId },
    },
  };

  // Collect all effects across all matching rules
  const allEffects = [];
  let hadInvalidRule = false;

  for (const rule of rules) {
    let result;
    try {
      result = scoreEngine.evaluateRule(rule, ctx);
    } catch (evalErr) {
      // Rule DSL error — quarantine event, do not score
      console.warn('[CompetitionEngine] Rule evaluation error for event', event.eventId, evalErr.message);
      hadInvalidRule = true;
      break;
    }

    if (result.matched) {
      allEffects.push(...result.effects);
    }
  }

  if (hadInvalidRule) {
    await eventStoreService.markFailed(event.eventId, 'Rule evaluation error — quarantined');
    return;
  }

  // ─── SHADOW MODE BRANCH ──────────────────────────────────────────────────────
  if (isShadowModeEnabled()) {
    await CompetitionEvent.update(
      {
        status: 'PROCESSED',
        processedAt: new Date(),
      },
      { where: { eventId: event.eventId } },
    );
    console.log(`[CompetitionEngine][SHADOW_MODE] Event #${event.eventId} evaluated: ${allEffects.length} expected effects (Score mutations bypassed)`);
    return;
  }

  // Track state updates to emit realtime after commit
  const stateUpdatesToEmit = [];

  // Persist all effects and state mutations in ONE transaction
  // If persist fails → DO NOT mark PROCESSED → event stays PENDING → retried
  await sequelize.transaction(async (t) => {
    // 1. Process any state mutations configured in rules
    for (const rule of rules) {
      if (rule.state_mutation) {
        const { key, field = 'count', threshold, reset_on_threshold = true, on_threshold_action, on_threshold_effect = 'STREAK_BONUS' } = rule.state_mutation;
        const entityType = rule.state_mutation.entity_type || 'user';
        const entityId = entityType === 'team' ? businessPayload.teamId : businessPayload.actorId;

        if (entityId) {
          const stateRes = await competitionStateService.mutateState({
            seasonId: businessPayload.payload?.seasonId ?? null,
            entityId,
            entityType,
            stateKey: key,
            defaultData: { [field]: 0 },
            mutatorFn: competitionStateService.incrementMutator(field, threshold, reset_on_threshold),
            transaction: t,
          });

          stateUpdatesToEmit.push({
            entityType,
            entityId,
            stateKey: key,
            data: stateRes.newData,
            version: stateRes.version,
            thresholdMet: stateRes.thresholdMet,
          });

          // If threshold reached, award on_threshold action
          if (stateRes.thresholdMet && on_threshold_action) {
            allEffects.push({
              targetType: entityType === 'team' ? 'TEAM' : 'USER',
              targetId: entityId,
              effectType: on_threshold_effect,
              delta: on_threshold_action.value || 0,
              actionType: on_threshold_action.type || 'ADD',
              reason: `State threshold reached for ${key}`,
            });
          }
        }
      }
    }

    if (allEffects.length > 0) {
      await effectEngine.persistEffects({
        eventId: event.eventId,
        ruleVersionId: resolvedVersionId,
        seasonId: businessPayload.payload?.seasonId ?? null,
        effects: allEffects,
        reason: `Auto: ${event.eventType}`,
        metadata: { ruleset: resolvedVersionId ? 'phase4-season-version' : 'in-memory', eventType: event.eventType },
        transaction: t,
      });
    }
    // Mark PROCESSED inside the same transaction — atomicity guarantee
    await CompetitionEvent.update(
      { status: 'PROCESSED', processedAt: new Date() },
      { where: { eventId: event.eventId }, transaction: t },
    );
  });

  // After transaction commits successfully: Emit Realtime events & Update Read Model Projections
  for (const eff of allEffects) {
    competitionRealtime.emitScoreAwarded({
      userId: eff.targetType === 'USER' ? eff.targetId : null,
      teamId: eff.targetType === 'TEAM' ? eff.targetId : null,
      pointsDelta: eff.delta,
      effectType: eff.effectType,
      reason: eff.reason || `Auto: ${event.eventType}`,
      metadata: { eventId: event.eventId },
    });
  }
  for (const st of stateUpdatesToEmit) {
    competitionRealtime.emitStateUpdated(st);
  }

  // Phase 6 — Read Model Projection & Dashboard Realtime
  try {
    const projector = require('./competitionReadModel.projector');
    await projector.projectFromEvent({
      event,
      effects: allEffects,
      stateUpdates: stateUpdatesToEmit,
    });
    competitionRealtime.emitDashboardUpdated({
      userId: businessPayload.actorId,
      teamId: businessPayload.teamId,
    });
    if (businessPayload.payload?.seasonId) {
      competitionRealtime.emitLeaderboardUpdated({
        seasonId: businessPayload.payload.seasonId,
      });
    }
  } catch (projErr) {
    console.warn('[CompetitionEngine] Incremental projection warning:', projErr.message);
  }
}

// ─── Batch processing ─────────────────────────────────────────────────────────

async function processBatch() {
  if (!isProcessingEnabled()) {
    console.log('[CompetitionEngine] Scoring processing is currently disabled (Kill Switch active). Backlog retained.');
    return { count: 0, paused: true };
  }

  const events = await eventStoreService.fetchPendingBatch(BATCH_SIZE);
  if (events.length === 0) return 0;

  let processed = 0;
  for (const event of events) {
    try {
      await processEvent(event);
      processed++;
    } catch (err) {
      console.error('[CompetitionEngine] Unexpected error processing event', event.eventId, err.message);
      // Mark FAILED — event will not retry automatically unless manually reset
      await eventStoreService.markFailed(event.eventId, err.message).catch(() => {});
    }
  }
  return processed;
}

// ─── Worker lifecycle ─────────────────────────────────────────────────────────

let running = false;
let timerId = null;

function start() {
  if (running) return;
  running = true;
  console.log(`[CompetitionEngine] Started (interval=${POLL_INTERVAL_MS}ms, batch=${BATCH_SIZE})`);
  scheduleNext();
}

async function stop() {
  running = false;
  if (timerId) { clearTimeout(timerId); timerId = null; }
  console.log('[CompetitionEngine] Stopped');
}

function scheduleNext() {
  if (!running) return;
  timerId = setTimeout(async () => {
    try { await processBatch(); } catch (e) { console.error('[CompetitionEngine] batch error', e.message); }
    finally { scheduleNext(); }
  }, POLL_INTERVAL_MS);
}

module.exports = {
  start,
  stop,
  processBatch,
  registerRules,
  clearRules,
  isProcessingEnabled,
  setProcessingEnabled,
  isShadowModeEnabled,
  setShadowModeEnabled,
};
