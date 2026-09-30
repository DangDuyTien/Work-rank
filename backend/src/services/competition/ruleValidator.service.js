'use strict';

/**
 * ruleValidator.service.js
 *
 * Validates a Rule definition (condition_ast + action_ast) BEFORE it is
 * stored or evaluated. Rejects structurally invalid, unsafe, or semantically
 * inconsistent rules.
 *
 * Does NOT eval() anything. Pure structural validation only.
 */

const MAX_AST_DEPTH = 5;
const MAX_AST_NODES = 100;

const VALID_CONDITION_OPS = new Set([
  'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE',
  'AND', 'OR', 'NOT',
  'IN', 'NOT_IN', 'CONTAINS',
  'IS_WEEKEND', 'IS_BETWEEN', 'IS_TIME_BETWEEN',
  'IS_NULL', 'IS_NOT_NULL',
]);

const VALID_ACTION_TYPES = new Set(['ADD', 'SUBTRACT', 'MULTIPLY', 'DISTRIBUTE']);

const VALID_EFFECT_TYPES = new Set(['INDIVIDUAL_XP', 'TEAM_SCORE', 'ADJUSTMENT']);

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAllowedField(field) {
  return ALLOWED_FIELD_PREFIXES.some(
    (p) => field === p.replace(/\.$/, '') || field.startsWith(p),
  );
}

function isSafeNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// ─── Condition AST validation ─────────────────────────────────────────────────

function validateConditionNode(node, depth = 0) {
  if (depth > MAX_AST_DEPTH) {
    return [`AST depth exceeds MAX_AST_DEPTH (${MAX_AST_DEPTH})`];
  }
  if (!node || typeof node !== 'object') return ['Condition node must be an object'];

  const errors = [];

  if (!node.op || !VALID_CONDITION_OPS.has(node.op)) {
    errors.push(`Unknown condition op: "${node.op}"`);
    return errors; // can't continue without valid op
  }

  switch (node.op) {
    case 'AND':
    case 'OR':
      if (!Array.isArray(node.conditions) || node.conditions.length === 0) {
        errors.push(`${node.op} requires non-empty "conditions" array`);
      } else {
        node.conditions.forEach((child) => errors.push(...validateConditionNode(child, depth + 1)));
      }
      break;

    case 'NOT':
      if (!node.condition || typeof node.condition !== 'object') {
        errors.push('NOT requires a "condition" object');
      } else {
        errors.push(...validateConditionNode(node.condition, depth + 1));
      }
      break;

    case 'IS_NULL':
    case 'IS_NOT_NULL':
    case 'IS_WEEKEND':
      if (!node.field || !isAllowedField(node.field)) {
        errors.push(`${node.op}: field "${node.field}" is not in the allowed whitelist`);
      }
      break;

    case 'IN':
    case 'NOT_IN':
      if (!node.field || !isAllowedField(node.field)) {
        errors.push(`${node.op}: field is not allowed`);
      }
      if (!Array.isArray(node.values)) {
        errors.push(`${node.op}: "values" must be an array`);
      }
      break;

    case 'IS_BETWEEN':
      if (!node.field || !isAllowedField(node.field)) errors.push('IS_BETWEEN: field not allowed');
      if (!node.from || !node.to) errors.push('IS_BETWEEN: requires "from" and "to"');
      break;

    case 'IS_TIME_BETWEEN':
      if (!node.field || !isAllowedField(node.field)) errors.push('IS_TIME_BETWEEN: field not allowed');
      if (!/^\d{2}:\d{2}$/.test(node.from ?? '')) errors.push('IS_TIME_BETWEEN: "from" must be HH:MM');
      if (!/^\d{2}:\d{2}$/.test(node.to ?? '')) errors.push('IS_TIME_BETWEEN: "to" must be HH:MM');
      break;

    default: {
      // Comparison operators: EQ, NEQ, GT, GTE, LT, LTE, CONTAINS
      if (!node.field || !isAllowedField(node.field)) {
        errors.push(`${node.op}: field "${node.field}" is not in the allowed whitelist`);
      }
      if (node.value === undefined) {
        errors.push(`${node.op}: "value" is required`);
      }
      // Guard against NaN/Infinity in numeric comparisons
      if (['GT', 'GTE', 'LT', 'LTE'].includes(node.op)) {
        if (typeof node.value === 'number' && !Number.isFinite(node.value)) {
          errors.push(`${node.op}: "value" must be a finite number`);
        }
      }
    }
  }

  return errors;
}

// ─── Action AST validation ────────────────────────────────────────────────────

function validateAction(action) {
  const errors = [];
  if (!action || typeof action !== 'object') return ['Action must be an object'];
  if (!action.type || !VALID_ACTION_TYPES.has(action.type)) {
    return [`Unknown action type: "${action.type}"`];
  }

  switch (action.type) {
    case 'ADD':
    case 'SUBTRACT':
      if (!isSafeNumber(action.value)) {
        errors.push(`${action.type}: "value" must be a finite number`);
      }
      break;

    case 'MULTIPLY':
      if (!isSafeNumber(action.value)) {
        errors.push('MULTIPLY: "value" must be a finite number');
      }
      if (action.value === 0) {
        errors.push('MULTIPLY: "value" cannot be 0 (division by zero equivalent)');
      }
      break;

    case 'DISTRIBUTE':
      if (!isSafeNumber(action.value)) {
        errors.push('DISTRIBUTE: "value" must be a finite number');
      }
      if (!Array.isArray(action.targets) || action.targets.length === 0) {
        errors.push('DISTRIBUTE: "targets" must be a non-empty array');
      }
      break;
  }

  return errors;
}

// ─── Rule-level validation ────────────────────────────────────────────────────

/**
 * Validate a complete rule definition.
 *
 * @param {object} rule
 * @param {object|null} [rule.condition_ast]
 * @param {object} rule.action_ast
 * @param {string} rule.effect_type
 * @param {number} [rule.multiplier]
 * @param {number|null} [rule.cap]
 * @param {number|null} [rule.floor]
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateRule(rule) {
  const errors = [];

  if (!rule || typeof rule !== 'object') {
    return { valid: false, errors: ['Rule must be a non-null object'] };
  }

  // Condition AST (optional — null = unconditional)
  if (rule.condition_ast && Object.keys(rule.condition_ast).length > 0) {
    errors.push(...validateConditionNode(rule.condition_ast));
  }

  // Action AST (required)
  if (!rule.action_ast) {
    errors.push('Rule missing "action_ast"');
  } else {
    errors.push(...validateAction(rule.action_ast));
  }

  // Effect type
  if (!rule.effect_type || !VALID_EFFECT_TYPES.has(rule.effect_type)) {
    errors.push(`Unknown or missing effect_type: "${rule.effect_type}"`);
  }

  // Semantic: INDIVIDUAL_XP requires no explicit team target (Action Engine handles it)
  // TEAM_SCORE is allowed with DISTRIBUTE or when action targets team fields

  // Pipeline modifiers
  if (rule.multiplier !== undefined) {
    if (!isSafeNumber(rule.multiplier) || rule.multiplier === 0) {
      errors.push('Rule multiplier must be a non-zero finite number');
    }
  }
  if (rule.cap !== undefined && rule.cap !== null && !isSafeNumber(rule.cap)) {
    errors.push('Rule cap must be a finite number or null');
  }
  if (rule.floor !== undefined && rule.floor !== null && !isSafeNumber(rule.floor)) {
    errors.push('Rule floor must be a finite number or null');
  }

  return { valid: errors.length === 0, errors };
}

module.exports = { validateRule, validateConditionNode, validateAction };
