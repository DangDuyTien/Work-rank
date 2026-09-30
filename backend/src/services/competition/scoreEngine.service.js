'use strict';

/**
 * scoreEngine.service.js
 *
 * Pure function — no DB access.
 *
 * Implements the deterministic Score Evaluation Pipeline:
 *
 *   BASE → BONUS → PENALTY → MULTIPLIER → CAP → FLOOR → FINAL DELTA
 *
 * Usage:
 *   const { applyPipeline } = require('./scoreEngine.service');
 *   const finalDelta = applyPipeline({ base: 100, bonus: 20, penalty: 10, multiplier: 2 });
 *   // → 220
 *
 * Also provides evaluateRule() which combines:
 *   conditionEvaluator → check condition
 *   actionEvaluator    → compute raw effects
 *   applyPipeline      → apply pipeline to each effect
 *
 * Returns:
 *   { matched: boolean, effects: PipelinedEffect[] }
 */

const conditionEvaluator = require('./conditionEvaluator.service');
const actionEvaluator = require('./actionEvaluator.service');

/**
 * @typedef {object} PipelineOptions
 * @property {number} base         Raw base points from action
 * @property {number} [bonus]      Additional points added before multiplier
 * @property {number} [penalty]    Points deducted before multiplier (positive number)
 * @property {number} [multiplier] Factor applied after bonus/penalty
 * @property {number|null} [cap]   Maximum value for final delta (null = no cap)
 * @property {number|null} [floor] Minimum value for final delta (null = no floor)
 */

/**
 * Apply the deterministic scoring pipeline.
 * Order: BASE → BONUS → PENALTY → MULTIPLIER → CAP → FLOOR
 *
 * @param {PipelineOptions} opts
 * @returns {number} final integer delta
 */
function applyPipeline({ base, bonus = 0, penalty = 0, multiplier = 1, cap = null, floor = null }) {
  // Validate inputs
  for (const [label, val] of [['base', base], ['bonus', bonus], ['penalty', penalty], ['multiplier', multiplier]]) {
    if (!Number.isFinite(val)) {
      throw new Error(`ScoreEngine: pipeline ${label} must be a finite number, got ${val}`);
    }
  }
  if (multiplier === 0) throw new Error('ScoreEngine: multiplier cannot be 0');

  let result = base;
  result += bonus;       // Step 1: add bonus
  result -= penalty;     // Step 2: subtract penalty
  result *= multiplier;  // Step 3: apply multiplier
  result = Math.round(result); // Avoid floating point drift

  if (cap !== null && Number.isFinite(cap)) result = Math.min(result, cap);
  if (floor !== null && Number.isFinite(floor)) result = Math.max(result, floor);

  return result;
}

/**
 * @typedef {object} RuleDefinition
 * @property {object|null} condition_ast    Condition AST (null = unconditional)
 * @property {object} action_ast            Action AST
 * @property {string} effect_type           'INDIVIDUAL_XP' | 'TEAM_SCORE'
 * @property {number} [bonus]
 * @property {number} [penalty]
 * @property {number} [multiplier]
 * @property {number|null} [cap]
 * @property {number|null} [floor]
 */

/**
 * @typedef {object} PipelinedEffect
 * @property {'USER'|'TEAM'|'MODIFIER'} targetType
 * @property {number|string} targetId
 * @property {string} effectType
 * @property {number} delta           Final delta after pipeline
 * @property {string} actionType
 */

/**
 * Evaluate one rule against an event context.
 *
 * @param {RuleDefinition} rule
 * @param {object} ctx  { event, context: { actor, team, season } }
 * @returns {{ matched: boolean, effects: PipelinedEffect[] }}
 */
function evaluateRule(rule, ctx) {
  // 1. Condition check (pure)
  const matched = conditionEvaluator.evaluate(rule.condition_ast ?? null, ctx);
  if (!matched) return { matched: false, effects: [] };

  // 2. Action → raw effects (pure)
  const rawEffects = actionEvaluator.evaluate(
    rule.action_ast,
    ctx,
    rule.effect_type ?? 'INDIVIDUAL_XP',
  );

  // 3. Pipeline modifiers from rule definition
  const pipelineOpts = {
    bonus: Number(rule.bonus ?? 0),
    penalty: Number(rule.penalty ?? 0),
    multiplier: Number(rule.multiplier ?? 1),
    cap: rule.cap ?? null,
    floor: rule.floor ?? null,
  };

  // 4. Apply pipeline to each non-modifier effect
  const finalEffects = rawEffects.map((effect) => {
    if (effect.effectType === 'MULTIPLIER') return effect; // pass modifier through
    return {
      ...effect,
      delta: applyPipeline({ base: effect.delta, ...pipelineOpts }),
    };
  });

  return { matched: true, effects: finalEffects };
}

module.exports = { applyPipeline, evaluateRule };
