'use strict';

/**
 * actionEvaluator.service.js
 *
 * Pure function — no DB access, no side effects.
 * Evaluates an Action AST and returns a list of pending Effects.
 *
 * Supported action types:
 *   ADD       — add a fixed value to a target
 *   SUBTRACT  — subtract a fixed value from a target
 *   MULTIPLY  — multiply the running total by a factor (used as pipeline step)
 *   DISTRIBUTE — split a total value equally among multiple targets
 *
 * DISTRIBUTE semantics (spec V3.3):
 *   value = total points to distribute, divided equally across valid targets.
 *   e.g. { type: "DISTRIBUTE", targets: ["event.actor_id", "event.payload.collaborator_id"], value: 100 }
 *   → each target receives Math.floor(100 / 2) = 50 points.
 *   If a target resolves to null/undefined it is skipped.
 *
 * Score Evaluation Pipeline order (enforced by scoreEngine):
 *   BASE → BONUS → PENALTY → MULTIPLIER → CAP → FLOOR → FINAL DELTA
 *
 * Security:
 *   - No eval(), no new Function()
 *   - No arbitrary field writes
 *   - NaN / Infinity / division-by-zero all rejected
 */

const SAFE_EFFECT_TYPES = new Set(['INDIVIDUAL_XP', 'TEAM_SCORE', 'ADJUSTMENT']);

/**
 * @typedef {object} Effect
 * @property {'USER'|'TEAM'} targetType
 * @property {number|string} targetId
 * @property {string} effectType    e.g. 'INDIVIDUAL_XP'
 * @property {number} delta         Final point delta (before pipeline modifiers)
 * @property {string} actionType    Source action type for audit
 */

/**
 * Safely resolve a field path from context — same whitelist as conditionEvaluator.
 * Inline copy to keep actionEvaluator self-contained (no cross-service import).
 */
const ALLOWED_FIELD_PREFIXES = [
  'event.payload.',
  'event.occurred_at',
  'event.actor_id',
  'event.team_id',
  'event.event_type',
  'event.source_module',
  'context.actor.',
  'context.team.',
];

function resolveField(path, ctx) {
  const allowed = ALLOWED_FIELD_PREFIXES.some(
    (prefix) => path === prefix.replace(/\.$/, '') || path.startsWith(prefix),
  );
  if (!allowed) throw new Error(`ActionEvaluator: field path not allowed: "${path}"`);

  const parts = path.split('.');
  let v = ctx;
  for (const p of parts) {
    if (v === null || v === undefined) return undefined;
    v = v[p];
  }
  return v;
}

function safeNumber(v, label) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`ActionEvaluator: ${label} must be a finite number, got ${v}`);
  return n;
}

/**
 * Evaluate an action AST and produce one or more Effect objects.
 *
 * @param {object} action    The action AST node
 * @param {object} ctx       Evaluation context { event, context }
 * @param {string} effectType Target effect category ('INDIVIDUAL_XP' | 'TEAM_SCORE')
 * @returns {Effect[]}
 */
function evaluate(action, ctx, effectType = 'INDIVIDUAL_XP') {
  if (!action || typeof action !== 'object') {
    throw new Error('ActionEvaluator: action must be a non-null object');
  }
  if (!action.type || typeof action.type !== 'string') {
    throw new Error('ActionEvaluator: action.type is required');
  }

  switch (action.type) {
    case 'ADD': {
      const delta = safeNumber(action.value, 'action.value');
      const isTeam = effectType === 'TEAM_SCORE' || action.target === 'TEAM';
      const targetType = isTeam ? 'TEAM' : 'USER';
      const targetId = isTeam
        ? (ctx.event.team_id ?? ctx.event.teamId)
        : (ctx.event.actor_id ?? ctx.event.actorId);
      if (!targetId) throw new Error(`ActionEvaluator: ADD requires ${isTeam ? 'team_id' : 'actor_id'} in event`);
      return [{ targetType, targetId, effectType, delta, actionType: 'ADD' }];
    }

    case 'SUBTRACT': {
      const delta = -Math.abs(safeNumber(action.value, 'action.value'));
      const isTeam = effectType === 'TEAM_SCORE' || action.target === 'TEAM';
      const targetType = isTeam ? 'TEAM' : 'USER';
      const targetId = isTeam
        ? (ctx.event.team_id ?? ctx.event.teamId)
        : (ctx.event.actor_id ?? ctx.event.actorId);
      if (!targetId) throw new Error(`ActionEvaluator: SUBTRACT requires ${isTeam ? 'team_id' : 'actor_id'} in event`);
      return [{ targetType, targetId, effectType, delta, actionType: 'SUBTRACT' }];
    }

    case 'MULTIPLY': {
      // MULTIPLY returns a special modifier effect; scoreEngine applies it in pipeline
      const factor = safeNumber(action.value, 'action.value');
      if (factor === 0) throw new Error('ActionEvaluator: MULTIPLY factor cannot be 0');
      // Not a score effect by itself — return as a modifier marker
      return [{ targetType: 'MODIFIER', targetId: null, effectType: 'MULTIPLIER', delta: factor, actionType: 'MULTIPLY' }];
    }

    case 'DISTRIBUTE': {
      if (!Array.isArray(action.targets) || action.targets.length === 0) {
        throw new Error('ActionEvaluator: DISTRIBUTE requires non-empty "targets" array');
      }
      const total = safeNumber(action.value, 'action.value');
      // Resolve each target path to a concrete ID
      const resolvedTargets = action.targets
        .map((path) => {
          try {
            const id = resolveField(path, ctx);
            return id ?? null;
          } catch (_) {
            return null;
          }
        })
        .filter((id) => id !== null && id !== undefined);

      if (resolvedTargets.length === 0) {
        throw new Error('ActionEvaluator: DISTRIBUTE — no valid targets resolved');
      }

      const perTarget = Math.floor(total / resolvedTargets.length);
      return resolvedTargets.map((targetId) => ({
        targetType: 'USER',
        targetId,
        effectType,
        delta: perTarget,
        actionType: 'DISTRIBUTE',
      }));
    }

    default:
      throw new Error(`ActionEvaluator: unknown action type "${action.type}"`);
  }
}

module.exports = { evaluate };
