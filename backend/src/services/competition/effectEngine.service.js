'use strict';

/**
 * effectEngine.service.js
 *
 * Responsible for:
 *   1. Validating target invariants (INDIVIDUAL_XP → user_id required, etc.)
 *   2. Generating deterministic idempotency keys per effect
 *   3. Persisting effects to score_ledger (INSERT-ONLY) within a transaction
 *   4. Handling UniqueConstraintError as idempotent success (not an error)
 *
 * This is the ONLY service allowed to write to score_ledger.
 * No other module may INSERT/UPDATE/DELETE score_ledger rows.
 */

const crypto = require('node:crypto');
const { UniqueConstraintError } = require('sequelize');
const { ScoreLedger } = require('../../models');

// ─── Target Invariants ────────────────────────────────────────────────────────

const TARGET_INVARIANTS = {
  INDIVIDUAL_XP: { required: 'userId', targetType: 'USER' },
  TEAM_SCORE: { required: 'teamId', targetType: 'TEAM' },
  STREAK_BONUS: { required: 'userId', targetType: 'USER' },
  CHALLENGE_BONUS: { required: 'userId', targetType: 'USER' },
  PENALTY: { required: 'userId', targetType: 'USER' },
  ADJUSTMENT: { required: null }, // either target is acceptable
};

/**
 * Validate that a ledger row satisfies its effect_type target invariant.
 * Throws if invariant is violated.
 *
 * @param {string} effectType
 * @param {object} ledgerData  { userId, teamId, ... }
 */
function validateTargetInvariant(effectType, ledgerData) {
  const rule = TARGET_INVARIANTS[effectType];
  if (!rule) return; // unknown effect_type — allow; validator should catch earlier

  if (rule.required === 'userId' && !ledgerData.userId) {
    throw new Error(`EffectEngine: effect_type "${effectType}" requires userId to be set`);
  }
  if (rule.required === 'teamId' && !ledgerData.teamId) {
    throw new Error(`EffectEngine: effect_type "${effectType}" requires teamId to be set`);
  }
}

// ─── Deterministic Effect Key ─────────────────────────────────────────────────

/**
 * Generate a deterministic, collision-resistant idempotency key for one effect.
 * SAME event + SAME rule + SAME effect_type + SAME target → SAME key.
 * This enables safe retry without duplicate ledger entries.
 *
 * @param {object} params
 * @param {string} params.eventId
 * @param {string|null} params.ruleVersionId
 * @param {string} params.effectType
 * @param {'USER'|'TEAM'} params.targetType
 * @param {string|number} params.targetId
 * @returns {string} sha256 hex
 */
function buildEffectKey({ eventId, ruleVersionId, effectType, targetType, targetId }) {
  const content = [
    eventId,
    ruleVersionId ?? 'no-rule',
    effectType,
    targetType,
    String(targetId),
  ].join('|');
  return crypto.createHash('sha256').update(content).digest('hex');
}

// ─── Persist effects ─────────────────────────────────────────────────────────

/**
 * Persist one or more score effects to score_ledger.
 * Must be called inside a DB transaction for atomicity.
 *
 * Effects with duplicate idempotency keys are silently skipped (idempotent).
 *
 * @param {object} opts
 * @param {string} opts.eventId           UUID of the CompetitionEvent
 * @param {string|null} opts.ruleVersionId UUID of the RuleSetVersion (null for test/admin)
 * @param {number|null} opts.seasonId
 * @param {Array} opts.effects            Array from actionEvaluator/scoreEngine
 * @param {string} [opts.reason]
 * @param {object} [opts.metadata]
 * @param {import('sequelize').Transaction} opts.transaction
 * @returns {Promise<{ inserted: number, skipped: number }>}
 */
async function persistEffects({ eventId, ruleVersionId, seasonId, effects, reason, metadata, transaction }) {
  let inserted = 0;
  let skipped = 0;

  for (const effect of effects) {
    // Skip modifier markers (MULTIPLIER type from MULTIPLY action)
    if (effect.effectType === 'MULTIPLIER' || effect.targetType === 'MODIFIER') continue;

    const ledgerData = {
      eventId,
      ruleVersionId: ruleVersionId ?? null,
      seasonId: seasonId ?? null,
      effectType: effect.effectType,
      pointsDelta: effect.delta,
      reason: reason ?? null,
      metadata: metadata ?? null,
    };

    // Assign target based on targetType
    if (effect.targetType === 'USER') {
      ledgerData.userId = effect.targetId;
    } else if (effect.targetType === 'TEAM') {
      ledgerData.teamId = effect.targetId;
    }

    // Validate invariant BEFORE generating key or inserting
    validateTargetInvariant(effect.effectType, ledgerData);

    // Deterministic key
    const idempotencyKey = buildEffectKey({
      eventId,
      ruleVersionId,
      effectType: effect.effectType,
      targetType: effect.targetType,
      targetId: effect.targetId,
    });
    ledgerData.idempotencyKey = idempotencyKey;

    try {
      await ScoreLedger.create(ledgerData, { transaction });
      inserted++;
    } catch (err) {
      if (err instanceof UniqueConstraintError) {
        // Already persisted — idempotent success
        skipped++;
      } else {
        throw err;
      }
    }
  }

  return { inserted, skipped };
}

module.exports = { persistEffects, buildEffectKey, validateTargetInvariant };
