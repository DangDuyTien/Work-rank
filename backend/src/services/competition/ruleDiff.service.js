'use strict';

/**
 * ruleDiff.service.js
 *
 * Compares two RuleSetVersion definitions and computes a structured,
 * deterministic diff:
 *   - Added rules
 *   - Removed rules
 *   - Modified rules (changes in conditions, actions, modifiers)
 *   - Effective window changes (from/to)
 *   - Status changes
 */

const normalizer = require('./ruleBuilderNormalizer.service');

/**
 * Deep structural equality helper.
 */
function isDeepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Compute differences between two RuleSetVersion objects / AST payloads.
 *
 * @param {object} versionA Previous version (e.g. v1)
 * @param {object} versionB New version (e.g. v2)
 * @returns {object} Structured diff report
 */
function diffRuleVersions(versionA, versionB) {
  const astA = Array.isArray(versionA.astPayload) ? versionA.astPayload : [];
  const astB = Array.isArray(versionB.astPayload) ? versionB.astPayload : [];

  const changes = [];
  const addedRules = [];
  const removedRules = [];
  const modifiedRules = [];
  const unchangedRules = [];

  // Effective window diff
  const windowChanged =
    String(versionA.effectiveFrom) !== String(versionB.effectiveFrom) ||
    String(versionA.effectiveTo) !== String(versionB.effectiveTo);

  if (windowChanged) {
    changes.push({
      type: 'EFFECTIVE_WINDOW_CHANGED',
      description: `Thời gian áp dụng thay đổi từ [${versionA.effectiveFrom || 'N/A'} - ${versionA.effectiveTo || 'Vô thời hạn'}] sang [${versionB.effectiveFrom || 'N/A'} - ${versionB.effectiveTo || 'Vô thời hạn'}]`,
      from: { effectiveFrom: versionA.effectiveFrom, effectiveTo: versionA.effectiveTo },
      to: { effectiveFrom: versionB.effectiveFrom, effectiveTo: versionB.effectiveTo },
    });
  }

  // Compare rule definitions
  const mapA = new Map();
  astA.forEach((r, idx) => mapA.set(r.name || `Rule_${idx}`, { rule: r, idx }));

  const mapB = new Map();
  astB.forEach((r, idx) => mapB.set(r.name || `Rule_${idx}`, { rule: r, idx }));

  // Check rules in B
  for (const [name, { rule: ruleB, idx: idxB }] of mapB.entries()) {
    if (!mapA.has(name)) {
      const summary = normalizer.generateHumanReadableSummary(ruleB);
      addedRules.push({
        name,
        index: idxB,
        summary,
        rule: ruleB,
      });
      changes.push({
        type: 'RULE_ADDED',
        ruleName: name,
        description: `Thêm quy tắc mới: "${name}" (${summary})`,
        rule: ruleB,
      });
    } else {
      const { rule: ruleA, idx: idxA } = mapA.get(name);
      const isConditionEqual = isDeepEqual(ruleA.condition_ast, ruleB.condition_ast);
      const isActionEqual = isDeepEqual(ruleA.action_ast, ruleB.action_ast);
      const isModifiersEqual =
        ruleA.multiplier === ruleB.multiplier &&
        ruleA.cap === ruleB.cap &&
        ruleA.floor === ruleB.floor &&
        ruleA.effect_type === ruleB.effect_type;

      if (isConditionEqual && isActionEqual && isModifiersEqual) {
        unchangedRules.push({ name, rule: ruleB });
      } else {
        const details = [];
        if (!isConditionEqual) details.push('Điều kiện (Condition AST) thay đổi');
        if (!isActionEqual) details.push('Hành động (Action AST) thay đổi');
        if (ruleA.multiplier !== ruleB.multiplier) {
          details.push(`Hệ số thay đổi: ${ruleA.multiplier || 1} ➔ ${ruleB.multiplier || 1}`);
        }
        if (ruleA.cap !== ruleB.cap) {
          details.push(`Giới hạn tối đa (Cap) thay đổi: ${ruleA.cap ?? 'None'} ➔ ${ruleB.cap ?? 'None'}`);
        }
        if (ruleA.floor !== ruleB.floor) {
          details.push(`Giới hạn tối thiểu (Floor) thay đổi: ${ruleA.floor ?? 'None'} ➔ ${ruleB.floor ?? 'None'}`);
        }
        if (ruleA.effect_type !== ruleB.effect_type) {
          details.push(`Loại điểm thay đổi: ${ruleA.effect_type} ➔ ${ruleB.effect_type}`);
        }

        const summaryA = normalizer.generateHumanReadableSummary(ruleA);
        const summaryB = normalizer.generateHumanReadableSummary(ruleB);

        modifiedRules.push({
          name,
          details,
          summaryA,
          summaryB,
          before: ruleA,
          after: ruleB,
        });

        changes.push({
          type: 'RULE_MODIFIED',
          ruleName: name,
          description: `Quy tắc "${name}" thay đổi: ${details.join(', ')}`,
          details,
          before: ruleA,
          after: ruleB,
        });
      }
    }
  }

  // Check rules in A that are missing in B
  for (const [name, { rule: ruleA, idx: idxA }] of mapA.entries()) {
    if (!mapB.has(name)) {
      const summary = normalizer.generateHumanReadableSummary(ruleA);
      removedRules.push({
        name,
        index: idxA,
        summary,
        rule: ruleA,
      });
      changes.push({
        type: 'RULE_REMOVED',
        ruleName: name,
        description: `Xóa quy tắc: "${name}" (${summary})`,
        rule: ruleA,
      });
    }
  }

  return {
    versionA: {
      versionId: versionA.id,
      versionNumber: versionA.versionNumber,
      status: versionA.status,
      effectiveFrom: versionA.effectiveFrom,
      effectiveTo: versionA.effectiveTo,
      rulesCount: astA.length,
    },
    versionB: {
      versionId: versionB.id,
      versionNumber: versionB.versionNumber,
      status: versionB.status,
      effectiveFrom: versionB.effectiveFrom,
      effectiveTo: versionB.effectiveTo,
      rulesCount: astB.length,
    },
    hasChanges: changes.length > 0,
    totalChangesCount: changes.length,
    addedCount: addedRules.length,
    removedCount: removedRules.length,
    modifiedCount: modifiedRules.length,
    unchangedCount: unchangedRules.length,
    changes,
    addedRules,
    removedRules,
    modifiedRules,
    unchangedRules,
  };
}

module.exports = {
  diffRuleVersions,
};
