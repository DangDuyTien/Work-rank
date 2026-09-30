'use strict';

/**
 * conditionEvaluator.service.js
 *
 * Pure function — no DB access, no side effects.
 * Evaluates a Condition AST against an evaluation context.
 *
 * Supported operators:
 *   Comparison: EQ, NEQ, GT, GTE, LT, LTE
 *   Logic:      AND, OR, NOT
 *   Collection: IN, NOT_IN, CONTAINS
 *   Date/Time:  IS_WEEKEND, IS_BETWEEN, IS_TIME_BETWEEN
 *   Null:       IS_NULL, IS_NOT_NULL
 *
 * Security:
 *   - No eval(), no new Function(), no dynamic code
 *   - Field access is whitelist-based (allowed prefixes only)
 *   - AST depth and node limits enforced before evaluation
 */

const ALLOWED_FIELD_PREFIXES = [
  'event.payload.',
  'event.occurred_at',
  'event.actor_id',
  'event.team_id',
  'event.event_type',
  'event.source_module',
  'event.aggregate_type',
  'event.aggregate_id',
  'context.actor.',
  'context.team.',
  'context.season.',
];

const MAX_AST_DEPTH = 5;
const MAX_AST_NODES = 100;

// ─── Field access ────────────────────────────────────────────────────────────

/**
 * Safely resolve a dot-path field from the evaluation context.
 * Only allows paths with approved prefixes.
 *
 * @param {string} fieldPath  e.g. "event.payload.stage"
 * @param {object} ctx        Evaluation context
 * @returns {*}
 * @throws {Error} if field path is not allowed
 */
function resolveField(fieldPath, ctx) {
  const allowed = ALLOWED_FIELD_PREFIXES.some(
    (prefix) => fieldPath === prefix.replace(/\.$/, '') || fieldPath.startsWith(prefix),
  );
  if (!allowed) {
    throw new Error(`ConditionEvaluator: field path not allowed: "${fieldPath}"`);
  }

  // Walk the dot-path on the merged context object
  const parts = fieldPath.split('.');
  let value = ctx;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = value[part];
  }
  return value;
}

// ─── AST validators ──────────────────────────────────────────────────────────

function countNodes(node, depth = 0) {
  if (depth > MAX_AST_DEPTH) {
    throw new Error(`ConditionEvaluator: AST depth exceeds MAX_AST_DEPTH (${MAX_AST_DEPTH})`);
  }
  let count = 1;
  if (Array.isArray(node.conditions)) {
    for (const child of node.conditions) count += countNodes(child, depth + 1);
  }
  if (node.condition) count += countNodes(node.condition, depth + 1);
  return count;
}

/**
 * Pre-validate an AST before evaluation.
 * @param {object} ast
 */
function validateAst(ast) {
  if (!ast || typeof ast !== 'object') {
    throw new Error('ConditionEvaluator: AST must be a non-null object');
  }
  if (!ast.op || typeof ast.op !== 'string') {
    throw new Error('ConditionEvaluator: AST node missing "op" field');
  }
  const nodeCount = countNodes(ast);
  if (nodeCount > MAX_AST_NODES) {
    throw new Error(`ConditionEvaluator: AST node count (${nodeCount}) exceeds MAX_AST_NODES (${MAX_AST_NODES})`);
  }
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function isWeekend(date) {
  const d = date instanceof Date ? date : new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6;
}

// ─── Core evaluator ──────────────────────────────────────────────────────────

/**
 * Evaluate one AST node against the context.
 * @param {object} node
 * @param {object} ctx
 * @returns {boolean}
 */
function evaluateNode(node, ctx) {
  const { op } = node;

  switch (op) {
    // ── Logic ──────────────────────────────────────────────────────────────
    case 'AND': {
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        throw new Error('ConditionEvaluator: AND requires non-empty "conditions" array');
      }
      return node.conditions.every((child) => evaluateNode(child, ctx));
    }
    case 'OR': {
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        throw new Error('ConditionEvaluator: OR requires non-empty "conditions" array');
      }
      return node.conditions.some((child) => evaluateNode(child, ctx));
    }
    case 'NOT': {
      if (!node.condition || typeof node.condition !== 'object') {
        throw new Error('ConditionEvaluator: NOT requires a "condition" object');
      }
      return !evaluateNode(node.condition, ctx);
    }

    // ── Null / existence ───────────────────────────────────────────────────
    case 'IS_NULL': {
      const v = resolveField(node.field, ctx);
      return v === null || v === undefined;
    }
    case 'IS_NOT_NULL': {
      const v = resolveField(node.field, ctx);
      return v !== null && v !== undefined;
    }

    // ── Comparison ─────────────────────────────────────────────────────────
    case 'EQ': {
      // eslint-disable-next-line eqeqeq
      return resolveField(node.field, ctx) == node.value;
    }
    case 'NEQ': {
      // eslint-disable-next-line eqeqeq
      return resolveField(node.field, ctx) != node.value;
    }
    case 'GT': {
      return Number(resolveField(node.field, ctx)) > Number(node.value);
    }
    case 'GTE': {
      return Number(resolveField(node.field, ctx)) >= Number(node.value);
    }
    case 'LT': {
      return Number(resolveField(node.field, ctx)) < Number(node.value);
    }
    case 'LTE': {
      return Number(resolveField(node.field, ctx)) <= Number(node.value);
    }

    // ── Collection ─────────────────────────────────────────────────────────
    case 'IN': {
      if (!Array.isArray(node.values)) {
        throw new Error('ConditionEvaluator: IN requires "values" array');
      }
      const fv = resolveField(node.field, ctx);
      return node.values.includes(fv);
    }
    case 'NOT_IN': {
      if (!Array.isArray(node.values)) {
        throw new Error('ConditionEvaluator: NOT_IN requires "values" array');
      }
      const fv = resolveField(node.field, ctx);
      return !node.values.includes(fv);
    }
    case 'CONTAINS': {
      const fv = resolveField(node.field, ctx);
      if (typeof fv === 'string') return fv.includes(String(node.value));
      if (Array.isArray(fv)) return fv.includes(node.value);
      return false;
    }

    // ── Date/Time ──────────────────────────────────────────────────────────
    case 'IS_WEEKEND': {
      const fv = resolveField(node.field, ctx);
      return isWeekend(fv);
    }
    case 'IS_BETWEEN': {
      // Inclusive range comparison on dates or numbers
      const fv = new Date(resolveField(node.field, ctx)).getTime();
      const from = new Date(node.from).getTime();
      const to = new Date(node.to).getTime();
      return fv >= from && fv <= to;
    }
    case 'IS_TIME_BETWEEN': {
      // HH:MM format, UTC
      const d = new Date(resolveField(node.field, ctx));
      const hhmm = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
      return hhmm >= node.from && hhmm <= node.to;
    }

    default:
      throw new Error(`ConditionEvaluator: unknown operator "${op}"`);
  }
}

/**
 * Public API — evaluate an AST against a context object.
 *
 * @param {object|null} ast  null/undefined = always true (unconditional rule)
 * @param {object} ctx       Evaluation context
 * @returns {boolean}
 */
function evaluate(ast, ctx) {
  // Null/empty condition = unconditional match
  if (!ast || Object.keys(ast).length === 0) return true;

  validateAst(ast);
  return evaluateNode(ast, ctx);
}

module.exports = { evaluate, validateAst, resolveField, isWeekend };
