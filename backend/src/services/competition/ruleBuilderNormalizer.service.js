'use strict';

/**
 * ruleBuilderNormalizer.service.js
 *
 * Normalizes UI Rule Builder Form input into a Canonical Safe AST for Phase 2 Rule Engine.
 * Features:
 *   - Strict whitelisting of fields and operators
 *   - Auto-normalization of shorthand paths (e.g., 'payload.duration' -> 'event.payload.duration')
 *   - Prototype pollution prevention (__proto__, constructor, prototype)
 *   - Deep recursive AST depth & node count enforcement
 *   - Canonical AST formatting (deterministic key ordering)
 *   - Human-readable rule summary generator (English / Vietnamese)
 */

const ruleValidator = require('./ruleValidator.service');

const ALLOWED_PREFIXES = [
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

const VALID_CONDITION_OPS = new Set([
  'EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE',
  'AND', 'OR', 'NOT',
  'IN', 'NOT_IN', 'CONTAINS',
  'IS_WEEKEND', 'IS_BETWEEN', 'IS_TIME_BETWEEN',
  'IS_NULL', 'IS_NOT_NULL',
]);

const VALID_ACTION_TYPES = new Set(['ADD', 'SUBTRACT', 'MULTIPLY', 'DISTRIBUTE']);
const VALID_EFFECT_TYPES = new Set(['INDIVIDUAL_XP', 'TEAM_SCORE', 'ADJUSTMENT']);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Sanitize object keys against prototype pollution.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeObject);

  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (FORBIDDEN_KEYS.has(key)) {
      throw new Error(`Security Violation: Forbidden key "${key}" detected`);
    }
    clean[key] = sanitizeObject(val);
  }
  return clean;
}

/**
 * Normalize field paths to canonical format.
 */
function normalizeFieldPath(field) {
  if (typeof field !== 'string') return '';
  let cleanField = field.trim();

  // Guard against prototype pollution in field string
  if (cleanField.includes('__proto__') || cleanField.includes('constructor') || cleanField.includes('prototype')) {
    throw new Error(`Security Violation: Forbidden token in field path "${cleanField}"`);
  }

  // Shorthand mapping
  if (cleanField.startsWith('payload.')) {
    cleanField = `event.${cleanField}`;
  } else if (cleanField.startsWith('actor.')) {
    cleanField = `context.${cleanField}`;
  } else if (cleanField.startsWith('team.')) {
    cleanField = `context.${cleanField}`;
  } else if (cleanField.startsWith('season.')) {
    cleanField = `context.${cleanField}`;
  } else if (!cleanField.startsWith('event.') && !cleanField.startsWith('context.')) {
    // If user provided a raw payload property like 'duration', wrap with 'event.payload.'
    if (!ALLOWED_PREFIXES.some((p) => cleanField === p.replace(/\.$/, '') || cleanField.startsWith(p))) {
      cleanField = `event.payload.${cleanField}`;
    }
  }

  return cleanField;
}

/**
 * Recursively normalize a Condition AST node.
 */
function normalizeConditionNode(node, depth = 0) {
  if (depth > 5) {
    throw new Error('Condition AST depth exceeds maximum allowed depth of 5');
  }
  if (!node || typeof node !== 'object') {
    throw new Error('Condition node must be a non-null object');
  }

  const clean = sanitizeObject(node);
  const op = String(clean.op || '').toUpperCase().trim();

  if (!VALID_CONDITION_OPS.has(op)) {
    throw new Error(`Invalid or unsupported condition operator: "${op}"`);
  }

  if (op === 'AND' || op === 'OR') {
    const rawConditions = Array.isArray(clean.conditions) ? clean.conditions : [];
    if (rawConditions.length === 0) {
      throw new Error(`${op} group requires at least one condition`);
    }
    const conditions = rawConditions.map((child) => normalizeConditionNode(child, depth + 1));
    return { op, conditions };
  }

  if (op === 'NOT') {
    if (!clean.condition || typeof clean.condition !== 'object') {
      throw new Error('NOT condition requires a child "condition" object');
    }
    return {
      op: 'NOT',
      condition: normalizeConditionNode(clean.condition, depth + 1),
    };
  }

  const field = normalizeFieldPath(clean.field);

  if (op === 'IS_NULL' || op === 'IS_NOT_NULL' || op === 'IS_WEEKEND') {
    return { op, field };
  }

  if (op === 'IN' || op === 'NOT_IN') {
    let values = clean.values;
    if (typeof values === 'string') {
      values = values.split(',').map((v) => v.trim()).filter(Boolean);
    }
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error(`${op} requires a non-empty array of values`);
    }
    return { op, field, values };
  }

  if (op === 'IS_BETWEEN') {
    const from = Number(clean.from);
    const to = Number(clean.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      throw new Error('IS_BETWEEN requires finite numeric "from" and "to" values');
    }
    return { op, field, from, to };
  }

  if (op === 'IS_TIME_BETWEEN') {
    const from = String(clean.from || '').trim();
    const to = String(clean.to || '').trim();
    if (!/^\d{2}:\d{2}$/.test(from) || !/^\d{2}:\d{2}$/.test(to)) {
      throw new Error('IS_TIME_BETWEEN requires "from" and "to" in HH:MM format');
    }
    return { op, field, from, to };
  }

  // Comparison operators: EQ, NEQ, GT, GTE, LT, LTE, CONTAINS
  let value = clean.value;
  if (['GT', 'GTE', 'LT', 'LTE'].includes(op)) {
    const num = Number(value);
    if (!Number.isFinite(num)) {
      throw new Error(`${op} requires a finite numeric "value"`);
    }
    value = num;
  }

  return { op, field, value };
}

/**
 * Normalize an Action AST node.
 */
function normalizeActionNode(action) {
  if (!action || typeof action !== 'object') {
    throw new Error('Action must be a non-null object');
  }

  const clean = sanitizeObject(action);
  const type = String(clean.type || '').toUpperCase().trim();

  if (!VALID_ACTION_TYPES.has(type)) {
    throw new Error(`Invalid or unsupported action type: "${type}"`);
  }

  const value = Number(clean.value);
  if (!Number.isFinite(value)) {
    throw new Error(`${type} action requires a finite numeric "value"`);
  }

  if (type === 'MULTIPLY' && value === 0) {
    throw new Error('MULTIPLY value cannot be 0');
  }

  const normalized = { type, value };

  if (type === 'DISTRIBUTE') {
    let targets = clean.targets;
    if (typeof targets === 'string') {
      targets = targets.split(',').map((t) => t.trim()).filter(Boolean);
    }
    if (!Array.isArray(targets) || targets.length === 0) {
      throw new Error('DISTRIBUTE action requires non-empty "targets" array');
    }
    normalized.targets = targets;
  }

  return normalized;
}

/**
 * Normalize a complete Rule definition from UI form.
 */
function normalizeRule(rawRule) {
  if (!rawRule || typeof rawRule !== 'object') {
    throw new Error('Rule definition must be an object');
  }

  const clean = sanitizeObject(rawRule);

  // 1. Condition AST
  let condition_ast = null;
  if (clean.condition_ast && Object.keys(clean.condition_ast).length > 0) {
    condition_ast = normalizeConditionNode(clean.condition_ast);
  } else if (clean.conditions && Array.isArray(clean.conditions) && clean.conditions.length > 0) {
    // UI block array shorthand
    if (clean.conditions.length === 1) {
      condition_ast = normalizeConditionNode(clean.conditions[0]);
    } else {
      condition_ast = normalizeConditionNode({
        op: clean.logical_op || 'AND',
        conditions: clean.conditions,
      });
    }
  }

  // 2. Action AST
  let action_ast;
  if (clean.action_ast) {
    action_ast = normalizeActionNode(clean.action_ast);
  } else if (clean.action) {
    action_ast = normalizeActionNode(clean.action);
  } else if (clean.action_type && clean.action_value !== undefined) {
    action_ast = normalizeActionNode({
      type: clean.action_type,
      value: clean.action_value,
      targets: clean.action_targets,
    });
  } else {
    throw new Error('Rule definition missing action definition');
  }

  // 3. Effect Type
  let effect_type = String(clean.effect_type || 'INDIVIDUAL_XP').toUpperCase().trim();
  if (!VALID_EFFECT_TYPES.has(effect_type)) {
    effect_type = 'INDIVIDUAL_XP';
  }

  // 4. Modifiers
  const rule = {
    name: clean.name ? String(clean.name).trim() : 'Rule',
    condition_ast,
    action_ast,
    effect_type,
  };

  if (clean.multiplier !== undefined && clean.multiplier !== null && clean.multiplier !== '') {
    const m = Number(clean.multiplier);
    if (!Number.isFinite(m) || m === 0) {
      throw new Error('Rule multiplier must be a non-zero finite number');
    }
    rule.multiplier = m;
  }

  if (clean.bonus !== undefined && clean.bonus !== null && clean.bonus !== '') {
    const b = Number(clean.bonus);
    if (!Number.isFinite(b)) throw new Error('Rule bonus must be a finite number');
    rule.bonus = b;
  }

  if (clean.penalty !== undefined && clean.penalty !== null && clean.penalty !== '') {
    const p = Number(clean.penalty);
    if (!Number.isFinite(p)) throw new Error('Rule penalty must be a finite number');
    rule.penalty = p;
  }

  if (clean.cap !== undefined && clean.cap !== null && clean.cap !== '') {
    const c = Number(clean.cap);
    if (!Number.isFinite(c)) throw new Error('Rule cap must be a finite number or null');
    rule.cap = c;
  }

  if (clean.floor !== undefined && clean.floor !== null && clean.floor !== '') {
    const f = Number(clean.floor);
    if (!Number.isFinite(f)) throw new Error('Rule floor must be a finite number or null');
    rule.floor = f;
  }

  // Run validation against Phase 2 validator
  const validation = ruleValidator.validateRule(rule);
  if (!validation.valid) {
    throw new Error(`Rule validation failed: ${validation.errors.join('; ')}`);
  }

  return rule;
}

/**
 * Normalize an entire AST payload array from UI.
 */
function normalizeAstPayload(rawPayload) {
  let list = rawPayload;
  if (!Array.isArray(list)) {
    if (rawPayload && typeof rawPayload === 'object') {
      list = [rawPayload];
    } else {
      throw new Error('AST Payload must be an array of rule definitions');
    }
  }

  if (list.length === 0) {
    throw new Error('AST Payload cannot be empty');
  }

  return list.map(normalizeRule);
}

/**
 * Generate human-readable summary for a Condition AST.
 */
function summarizeConditionNode(node) {
  if (!node) return 'Luôn áp dụng';

  switch (node.op) {
    case 'AND':
      return node.conditions.map(summarizeConditionNode).join(' VÀ ');
    case 'OR':
      return `(${node.conditions.map(summarizeConditionNode).join(' HOẶC ')})`;
    case 'NOT':
      return `KHÔNG (${summarizeConditionNode(node.condition)})`;
    case 'EQ':
      return `${node.field} bằng "${node.value}"`;
    case 'NEQ':
      return `${node.field} khác "${node.value}"`;
    case 'GT':
      return `${node.field} > ${node.value}`;
    case 'GTE':
      return `${node.field} >= ${node.value}`;
    case 'LT':
      return `${node.field} < ${node.value}`;
    case 'LTE':
      return `${node.field} <= ${node.value}`;
    case 'IN':
      return `${node.field} thuộc [${node.values.join(', ')}]`;
    case 'NOT_IN':
      return `${node.field} không thuộc [${node.values.join(', ')}]`;
    case 'CONTAINS':
      return `${node.field} chứa "${node.value}"`;
    case 'IS_WEEKEND':
      return `${node.field} là ngày cuối tuần`;
    case 'IS_BETWEEN':
      return `${node.field} trong khoảng [${node.from} .. ${node.to}]`;
    case 'IS_TIME_BETWEEN':
      return `Thời gian ${node.field} trong khung giờ ${node.from} - ${node.to}`;
    case 'IS_NULL':
      return `${node.field} rỗng (null)`;
    case 'IS_NOT_NULL':
      return `${node.field} có giá trị`;
    default:
      return `${node.field} ${node.op} ${node.value ?? ''}`;
  }
}

/**
 * Generate human-readable summary for an Action AST.
 */
function summarizeActionNode(action, effectType, multiplier) {
  const targetLabel = effectType === 'TEAM_SCORE' ? 'Điểm Đội' : 'Điểm Cá Nhân';
  let actionText = '';

  switch (action.type) {
    case 'ADD':
      actionText = `+${action.value} ${targetLabel}`;
      break;
    case 'SUBTRACT':
      actionText = `-${action.value} ${targetLabel}`;
      break;
    case 'MULTIPLY':
      actionText = `Nhân hệ số x${action.value} ${targetLabel}`;
      break;
    case 'DISTRIBUTE':
      actionText = `Phân phối ${action.value} ${targetLabel} cho các thành viên`;
      break;
    default:
      actionText = `${action.type} ${action.value} ${targetLabel}`;
  }

  if (multiplier && multiplier !== 1) {
    actionText += ` (Hệ số quy tắc x${multiplier})`;
  }

  return actionText;
}

/**
 * Generate full human-readable description for a rule.
 */
function generateHumanReadableSummary(rule) {
  const condText = summarizeConditionNode(rule.condition_ast);
  const actionText = summarizeActionNode(rule.action_ast, rule.effect_type, rule.multiplier);

  if (!rule.condition_ast || condText === 'Luôn áp dụng') {
    return `${rule.name || 'Quy tắc'}: ${actionText}`;
  }

  return `${rule.name || 'Quy tắc'}: Khi ${condText} ➔ ${actionText}`;
}

module.exports = {
  normalizeConditionNode,
  normalizeActionNode,
  normalizeRule,
  normalizeAstPayload,
  summarizeConditionNode,
  summarizeActionNode,
  generateHumanReadableSummary,
  ALLOWED_PREFIXES,
  VALID_CONDITION_OPS,
  VALID_ACTION_TYPES,
  VALID_EFFECT_TYPES,
};
