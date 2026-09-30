'use strict';

/**
 * ruleSet.service.js
 *
 * RuleSet & RuleSetVersion Domain Service.
 * Phase 7 Enhancements:
 *   - CRUD for Rule Sets and Versions
 *   - Normalization and AST validation before storage
 *   - Safe Version Duplication & Draft Updates
 *   - Effective Window Overlap Protection
 *   - Immutable Published Versions
 *   - Version Diffing & Simulator integration
 *   - Comprehensive Audit Trail
 */

const { Op } = require('sequelize');
const sequelize = require('../../config/database');
const { RuleSet, RuleSetVersion, Season, CompetitionAuditLog } = require('../../models');
const ruleValidator = require('./ruleValidator.service');
const normalizer = require('./ruleBuilderNormalizer.service');
const simulator = require('./ruleSimulator.service');
const differ = require('./ruleDiff.service');

/**
 * Helper to record CompetitionAuditLog entry.
 */
async function logAudit({ actorId, action, targetType, targetId, details, reason, transaction }) {
  try {
    await CompetitionAuditLog.create(
      {
        actorId: actorId ?? null,
        action,
        entityType: targetType,
        entityId: String(targetId),
        afterState: details || {},
        reason: reason || null,
      },
      { transaction },
    );
  } catch (err) {
    console.error(`[RuleSetService] Failed to create audit log: ${err.message}`);
  }
}

/**
 * List all Rule Sets with version counts and usage info.
 */
async function listRuleSets(options = {}) {
  const { search, limit = 50, offset = 0 } = options;
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { code: { [Op.like]: `%${search}%` } },
      { description: { [Op.like]: `%${search}%` } },
    ];
  }

  const ruleSets = await RuleSet.findAll({
    where,
    include: [
      {
        model: RuleSetVersion,
        as: 'versions',
        attributes: ['id', 'versionNumber', 'status', 'effectiveFrom', 'effectiveTo', 'publishedAt'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const formatted = [];
  for (const rs of ruleSets) {
    const versions = rs.versions || [];
    const publishedVersion = versions.find((v) => v.status === 'PUBLISHED');
    const seasonCount = await Season.count({
      where: { activeRuleSetId: rs.id },
    });

    formatted.push({
      id: rs.id,
      name: rs.name,
      code: rs.code,
      description: rs.description,
      createdBy: rs.createdBy,
      createdAt: rs.createdAt,
      updatedAt: rs.updatedAt,
      totalVersions: versions.length,
      publishedVersion: publishedVersion
        ? {
            id: publishedVersion.id,
            versionNumber: publishedVersion.versionNumber,
            effectiveFrom: publishedVersion.effectiveFrom,
            effectiveTo: publishedVersion.effectiveTo,
            publishedAt: publishedVersion.publishedAt,
          }
        : null,
      usedInSeasonsCount: seasonCount,
    });
  }

  return formatted;
}

/**
 * Get detailed Rule Set by ID with all versions and seasons using it.
 */
async function getRuleSet(id) {
  const ruleSet = await RuleSet.findByPk(id, {
    include: [
      {
        model: RuleSetVersion,
        as: 'versions',
      },
    ],
    order: [[{ model: RuleSetVersion, as: 'versions' }, 'versionNumber', 'DESC']],
  });

  if (!ruleSet) {
    throw new Error(`RuleSet #${id} not found`);
  }

  const seasonsUsing = await Season.findAll({
    where: { activeRuleSetId: id },
    attributes: ['id', 'name', 'code', 'status', 'startsAt', 'endsAt'],
  });

  // Enrich versions with human-readable summary previews
  const versionsWithSummary = (ruleSet.versions || []).map((v) => {
    const rules = Array.isArray(v.astPayload) ? v.astPayload : [];
    const summaries = rules.map(normalizer.generateHumanReadableSummary);
    return {
      id: v.id,
      ruleSetId: v.ruleSetId,
      versionNumber: v.versionNumber,
      effectiveFrom: v.effectiveFrom,
      effectiveTo: v.effectiveTo,
      status: v.status,
      rulesCount: rules.length,
      rulesSummary: summaries,
      astPayload: v.astPayload,
      createdBy: v.createdBy,
      publishedAt: v.publishedAt,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    };
  });

  return {
    id: ruleSet.id,
    name: ruleSet.name,
    code: ruleSet.code,
    description: ruleSet.description,
    createdBy: ruleSet.createdBy,
    createdAt: ruleSet.createdAt,
    updatedAt: ruleSet.updatedAt,
    versions: versionsWithSummary,
    seasonsUsing,
  };
}

/**
 * Create a new Rule Set.
 */
async function createRuleSet(data, actorId) {
  const { name, code, description } = data;
  if (!name || !code) throw new Error('RuleSet requires name and code');

  const existing = await RuleSet.findOne({ where: { code } });
  if (existing) {
    throw new Error(`RuleSet code "${code}" already exists`);
  }

  return sequelize.transaction(async (t) => {
    const ruleSet = await RuleSet.create(
      {
        name,
        code,
        description,
        createdBy: actorId ?? null,
      },
      { transaction: t },
    );

    await logAudit({
      actorId,
      action: 'RULE_SET_CREATED',
      targetType: 'RULE_SET',
      targetId: ruleSet.id,
      details: { name, code, description },
      transaction: t,
    });

    return ruleSet;
  });
}

/**
 * Update Rule Set metadata (name, description).
 */
async function updateRuleSet(id, data, actorId) {
  const { name, description } = data;
  const ruleSet = await RuleSet.findByPk(id);
  if (!ruleSet) throw new Error(`RuleSet #${id} not found`);

  return sequelize.transaction(async (t) => {
    const before = { name: ruleSet.name, description: ruleSet.description };
    if (name) ruleSet.name = name;
    if (description !== undefined) ruleSet.description = description;

    await ruleSet.save({ transaction: t });

    await logAudit({
      actorId,
      action: 'RULE_SET_UPDATED',
      targetType: 'RULE_SET',
      targetId: ruleSet.id,
      details: { before, after: { name: ruleSet.name, description: ruleSet.description } },
      transaction: t,
    });

    return ruleSet;
  });
}

/**
 * Archive a Rule Set if not actively used.
 */
async function archiveRuleSet(id, actorId, reason) {
  const ruleSet = await RuleSet.findByPk(id);
  if (!ruleSet) throw new Error(`RuleSet #${id} not found`);

  // Check if used by active seasons
  const activeSeasonCount = await Season.count({
    where: { activeRuleSetId: id, status: 'ACTIVE' },
  });

  if (activeSeasonCount > 0) {
    throw new Error(`Cannot archive RuleSet #${id}: currently used by ${activeSeasonCount} active season(s)`);
  }

  return sequelize.transaction(async (t) => {
    await logAudit({
      actorId,
      action: 'RULE_SET_ARCHIVED',
      targetType: 'RULE_SET',
      targetId: ruleSet.id,
      details: { name: ruleSet.name, code: ruleSet.code },
      reason,
      transaction: t,
    });

    return { success: true, ruleSetId: id };
  });
}

/**
 * Get a specific RuleSetVersion by UUID with summaries.
 */
async function getRuleSetVersion(versionId) {
  const version = await RuleSetVersion.findByPk(versionId, {
    include: [{ model: RuleSet, as: 'ruleSet' }],
  });

  if (!version) {
    throw new Error(`RuleSetVersion #${versionId} not found`);
  }

  const rules = Array.isArray(version.astPayload) ? version.astPayload : [];
  const summaries = rules.map(normalizer.generateHumanReadableSummary);

  return {
    id: version.id,
    ruleSetId: version.ruleSetId,
    ruleSetName: version.ruleSet?.name,
    ruleSetCode: version.ruleSet?.code,
    versionNumber: version.versionNumber,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    status: version.status,
    rulesCount: rules.length,
    rulesSummary: summaries,
    astPayload: version.astPayload,
    createdBy: version.createdBy,
    publishedAt: version.publishedAt,
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}

/**
 * Validate AST payload before saving.
 */
function validateVersionPayload(astPayload) {
  const normalizedRules = normalizer.normalizeAstPayload(astPayload);
  const errors = [];

  for (let i = 0; i < normalizedRules.length; i++) {
    const res = ruleValidator.validateRule(normalizedRules[i]);
    if (!res.valid) {
      errors.push(`Rule #${i + 1} (${normalizedRules[i].name || 'Unnamed'}): ${res.errors.join(', ')}`);
    }
  }

  const summaries = normalizedRules.map(normalizer.generateHumanReadableSummary);

  return {
    valid: errors.length === 0,
    errors,
    rulesCount: normalizedRules.length,
    normalizedRules,
    summaries,
  };
}

/**
 * Check overlapping published windows.
 */
async function checkOverlap(ruleSetId, fromDate, toDate, excludeVersionId = null) {
  const where = {
    ruleSetId,
    status: 'PUBLISHED',
  };
  if (excludeVersionId) {
    where.id = { [Op.ne]: excludeVersionId };
  }

  const publishedList = await RuleSetVersion.findAll({ where });
  for (const ver of publishedList) {
    const exFrom = new Date(ver.effectiveFrom);
    const exTo = ver.effectiveTo ? new Date(ver.effectiveTo) : null;

    const overlaps = (toDate === null || exFrom < toDate) && (exTo === null || fromDate < exTo);
    if (overlaps) {
      throw new Error(
        `Effective window overlaps with published version #${ver.versionNumber} (${ver.effectiveFrom.toISOString()} to ${ver.effectiveTo ? ver.effectiveTo.toISOString() : 'indefinite'})`,
      );
    }
  }
}

/**
 * Create a new version for a RuleSet.
 */
async function createRuleSetVersion(ruleSetId, data, actorId) {
  const { versionNumber, effectiveFrom, effectiveTo, astPayload } = data;

  if (!effectiveFrom || !astPayload) {
    throw new Error('RuleSetVersion requires effectiveFrom and astPayload');
  }

  // 1. Normalize & Validate AST
  let normalizedRules;
  try {
    normalizedRules = normalizer.normalizeAstPayload(astPayload);
  } catch (normErr) {
    const err = new Error(`Rule validation failed: ${normErr.message}`);
    err.status = 400;
    throw err;
  }

  for (const rule of normalizedRules) {
    const { valid, errors } = ruleValidator.validateRule(rule);
    if (!valid) {
      const err = new Error(`Rule validation failed: ${errors.join(', ')}`);
      err.status = 400;
      throw err;
    }
  }

  const fromDate = new Date(effectiveFrom);
  const toDate = effectiveTo ? new Date(effectiveTo) : null;

  if (toDate && fromDate >= toDate) {
    throw new Error('effectiveFrom must be before effectiveTo');
  }

  // Check for overlapping published windows
  await checkOverlap(ruleSetId, fromDate, toDate);

  // Determine version number if not provided
  let verNum = versionNumber;
  if (!verNum) {
    const maxVer = await RuleSetVersion.max('versionNumber', { where: { ruleSetId } });
    verNum = (maxVer || 0) + 1;
  }

  return sequelize.transaction(async (t) => {
    const version = await RuleSetVersion.create(
      {
        ruleSetId,
        versionNumber: verNum,
        effectiveFrom: fromDate,
        effectiveTo: toDate,
        astPayload: normalizedRules,
        status: 'DRAFT',
        createdBy: actorId ?? null,
      },
      { transaction: t },
    );

    await logAudit({
      actorId,
      action: 'RULE_VERSION_CREATED',
      targetType: 'RULE_SET_VERSION',
      targetId: version.id,
      details: { ruleSetId, versionNumber: verNum, rulesCount: normalizedRules.length },
      transaction: t,
    });

    return version;
  });
}

/**
 * Update a DRAFT version.
 */
async function updateDraftVersion(versionId, data, actorId) {
  const { effectiveFrom, effectiveTo, astPayload } = data;

  return sequelize.transaction(async (t) => {
    const version = await RuleSetVersion.findByPk(versionId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!version) {
      const err = new Error(`RuleSetVersion #${versionId} not found`);
      err.status = 404;
      throw err;
    }
    if (version.status !== 'DRAFT') {
      const err = new Error(`Cannot edit version in ${version.status} status. Only DRAFT versions are editable.`);
      err.status = 400;
      throw err;
    }

    if (astPayload) {
      const normalizedRules = normalizer.normalizeAstPayload(astPayload);
      for (const rule of normalizedRules) {
        const { valid, errors } = ruleValidator.validateRule(rule);
        if (!valid) {
          throw new Error(`Rule validation failed: ${errors.join(', ')}`);
        }
      }
      version.astPayload = normalizedRules;
    }

    if (effectiveFrom) {
      version.effectiveFrom = new Date(effectiveFrom);
    }
    if (effectiveTo !== undefined) {
      version.effectiveTo = effectiveTo ? new Date(effectiveTo) : null;
    }

    if (version.effectiveTo && version.effectiveFrom >= version.effectiveTo) {
      throw new Error('effectiveFrom must be before effectiveTo');
    }

    await version.save({ transaction: t });

    await logAudit({
      actorId,
      action: 'RULE_SET_UPDATED',
      targetType: 'RULE_SET_VERSION',
      targetId: version.id,
      details: { versionNumber: version.versionNumber, status: version.status },
      transaction: t,
    });

    return version;
  });
}

/**
 * Duplicate an existing version into a new DRAFT version.
 */
async function duplicateRuleSetVersion(versionId, actorId) {
  const source = await RuleSetVersion.findByPk(versionId);
  if (!source) throw new Error(`Source RuleSetVersion #${versionId} not found`);

  const maxVer = await RuleSetVersion.max('versionNumber', {
    where: { ruleSetId: source.ruleSetId },
  });

  const nextVerNum = (maxVer || 0) + 1;
  const now = new Date();

  return sequelize.transaction(async (t) => {
    const newVersion = await RuleSetVersion.create(
      {
        ruleSetId: source.ruleSetId,
        versionNumber: nextVerNum,
        effectiveFrom: now,
        effectiveTo: null,
        astPayload: source.astPayload,
        status: 'DRAFT',
        createdBy: actorId ?? null,
      },
      { transaction: t },
    );

    await logAudit({
      actorId,
      action: 'RULE_VERSION_CREATED',
      targetType: 'RULE_SET_VERSION',
      targetId: newVersion.id,
      details: { duplicatedFrom: source.id, sourceVersion: source.versionNumber, newVersionNumber: nextVerNum },
      transaction: t,
    });

    return newVersion;
  });
}

/**
 * Publish a RuleSetVersion.
 */
async function publishRuleSetVersion(versionId, actorId, reason) {
  return sequelize.transaction(async (t) => {
    const version = await RuleSetVersion.findByPk(versionId, {
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!version) throw new Error(`RuleSetVersion #${versionId} not found`);
    if (version.status === 'PUBLISHED') {
      return version; // Idempotent
    }
    if (version.status === 'SUPERSEDED') {
      throw new Error('Cannot publish a superseded version');
    }

    // 1. Re-validate AST Payload
    const rules = Array.isArray(version.astPayload) ? version.astPayload : [];
    if (rules.length === 0) {
      throw new Error('Cannot publish an empty RuleSetVersion');
    }
    for (const r of rules) {
      const { valid, errors } = ruleValidator.validateRule(r);
      if (!valid) {
        throw new Error(`Cannot publish: invalid rule AST: ${errors.join(', ')}`);
      }
    }

    // 2. Check overlap
    await checkOverlap(version.ruleSetId, version.effectiveFrom, version.effectiveTo, version.id);

    // 3. Mark published
    version.status = 'PUBLISHED';
    version.publishedAt = new Date();
    await version.save({ transaction: t });

    // 4. Record Audit Log
    await logAudit({
      actorId,
      action: 'RULE_VERSION_PUBLISHED',
      targetType: 'RULE_SET_VERSION',
      targetId: version.id,
      details: {
        ruleSetId: version.ruleSetId,
        versionNumber: version.versionNumber,
        effectiveFrom: version.effectiveFrom,
        effectiveTo: version.effectiveTo,
      },
      reason,
      transaction: t,
    });

    return version;
  });
}

/**
 * Compare two versions of a RuleSet.
 */
async function diffVersions(versionIdA, versionIdB) {
  const versionA = await RuleSetVersion.findByPk(versionIdA);
  const versionB = await RuleSetVersion.findByPk(versionIdB);

  if (!versionA || !versionB) {
    throw new Error('One or both RuleSetVersions not found for diff');
  }

  return differ.diffRuleVersions(versionA, versionB);
}

/**
 * Run in-memory simulation against Rule AST.
 */
async function simulateRule(data, actorId) {
  const { astPayload, versionId, eventPayload, context } = data;

  let rulesAst = astPayload;
  if (!rulesAst && versionId) {
    const version = await RuleSetVersion.findByPk(versionId);
    if (!version) throw new Error(`RuleSetVersion #${versionId} not found`);
    rulesAst = version.astPayload;
  }

  if (!rulesAst) {
    throw new Error('Simulation requires either astPayload or versionId');
  }

  const result = simulator.simulateRules({
    astPayload: rulesAst,
    eventPayload: eventPayload || {},
    context: context || {},
  });

  // Log non-mutating simulation audit
  await logAudit({
    actorId,
    action: 'RULE_SIMULATED',
    targetType: 'RULE_SIMULATOR',
    targetId: versionId || 'IN_MEMORY',
    details: {
      matchedRules: result.matchedRulesCount,
      totalUserPoints: result.totalUserPoints,
      totalTeamScore: result.totalTeamScore,
    },
  });

  return result;
}

/**
 * Get human-readable summary of rules applied to a season.
 */
async function getSeasonRulesSummary(seasonId) {
  const season = await Season.findByPk(seasonId, {
    include: [
      { model: RuleSet, as: 'ruleSet' },
      { model: RuleSetVersion, as: 'activeRuleVersion' },
    ],
  });

  if (!season) {
    throw new Error(`Season #${seasonId} not found`);
  }

  const ruleSet = season.ruleSet;
  const version = season.activeRuleVersion;

  if (!version || !Array.isArray(version.astPayload)) {
    return {
      seasonId: season.id,
      seasonName: season.name,
      hasRules: false,
      ruleSetName: ruleSet?.name || 'Mặc định',
      rules: [],
    };
  }

  const summaries = version.astPayload.map((rule) => {
    return {
      name: rule.name || 'Quy tắc thi đấu',
      effectType: rule.effect_type || 'INDIVIDUAL_XP',
      multiplier: rule.multiplier || 1,
      humanSummary: normalizer.generateHumanReadableSummary(rule),
      conditionSummary: normalizer.summarizeConditionNode(rule.condition_ast),
      actionSummary: normalizer.summarizeActionNode(rule.action_ast, rule.effect_type, rule.multiplier),
    };
  });

  return {
    seasonId: season.id,
    seasonName: season.name,
    hasRules: true,
    ruleSetId: ruleSet?.id,
    ruleSetName: ruleSet?.name,
    ruleSetCode: ruleSet?.code,
    versionId: version.id,
    versionNumber: version.versionNumber,
    effectiveFrom: version.effectiveFrom,
    effectiveTo: version.effectiveTo,
    publishedAt: version.publishedAt,
    rules: summaries,
  };
}

module.exports = {
  listRuleSets,
  getRuleSet,
  createRuleSet,
  updateRuleSet,
  archiveRuleSet,
  getRuleSetVersion,
  createRuleSetVersion,
  updateDraftVersion,
  duplicateRuleSetVersion,
  validateVersionPayload,
  publishRuleSetVersion,
  diffVersions,
  simulateRule,
  getSeasonRulesSummary,
};
