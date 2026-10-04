'use strict';

const xlsx = require('xlsx');
const crypto = require('node:crypto');
const {
  sequelize,
  ProductionKpiRule,
  ProductionKpiActivation,
  CompetitionAuditLog,
} = require('../../models');

/**
 * Normalize string keys for header matching.
 */
function normalizeKey(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

/**
 * Parse an Excel buffer and extract production KPI rules.
 * Supports multiple sheets (e.g. EDITOR, CONTENT).
 *
 * @param {Buffer} buffer
 * @param {string} originalFilename
 * @returns {object} { success, sheets, parsedRules, errors, warnings }
 */
function parseExcelBuffer(buffer, originalFilename = 'kpi_benchmark.xlsx') {
  let workbook;
  try {
    workbook = xlsx.read(buffer, { type: 'buffer' });
  } catch (err) {
    return {
      success: false,
      error: `Không thể đọc file Excel: ${err.message}`,
      sheets: [],
      parsedRules: [],
      errors: [err.message],
      warnings: [],
    };
  }

  const sheetNames = workbook.SheetNames || [];
  if (!sheetNames.length) {
    return {
      success: false,
      error: 'File Excel không có sheet nào.',
      sheets: [],
      parsedRules: [],
      errors: ['File rỗng'],
      warnings: [],
    };
  }

  const parsedRules = [];
  const errors = [];
  const warnings = [];
  const sheetsSummary = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    // Deduce default role from sheet name if possible
    const normalizedSheet = normalizeKey(sheetName);
    let defaultRole = null;
    if (normalizedSheet.includes('edit') || normalizedSheet.includes('bien_tap')) {
      defaultRole = 'EDITOR';
    } else if (normalizedSheet.includes('content') || normalizedSheet.includes('noi_dung') || normalizedSheet.includes('kich_ban')) {
      defaultRole = 'CONTENT';
    }

    sheetsSummary.push({
      sheetName,
      rowCount: rawRows.length,
      detectedRole: defaultRole,
    });

    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const row = rawRows[rowIndex];
      const actualRowNumber = rowIndex + 2; // Excel 1-based + 1 for header

      // Map row keys using normalized keys
      const normalizedRow = {};
      for (const [key, value] of Object.entries(row)) {
        normalizedRow[normalizeKey(key)] = value;
      }

      // 1. Resolve Role
      let role = (
        normalizedRow.role ||
        normalizedRow.vai_tro ||
        normalizedRow.bo_phan ||
        normalizedRow.phong_ban ||
        normalizedRow.department ||
        defaultRole
      );
      if (role) {
        const normRole = normalizeKey(role);
        if (normRole.includes('edit') || normRole.includes('bien_tap')) {
          role = 'EDITOR';
        } else if (normRole.includes('content') || normRole.includes('noi_dung') || normRole.includes('kich_ban')) {
          role = 'CONTENT';
        } else {
          role = String(role).toUpperCase();
        }
      }

      if (!role || (role !== 'EDITOR' && role !== 'CONTENT')) {
        warnings.push(`Sheet "${sheetName}" dòng #${actualRowNumber}: Bỏ qua vì không xác định được vai trò EDITOR hoặc CONTENT.`);
        continue;
      }

      // 2. Resolve Task Type
      let taskType = (
        normalizedRow.task_type ||
        normalizedRow.loai_cong_viec ||
        normalizedRow.loai_tap ||
        normalizedRow.hang_muc ||
        normalizedRow.task ||
        normalizedRow.type ||
        normalizedRow.loai_kpi ||
        normalizedRow.kpi_name ||
        normalizedRow.ten_kpi
      );
      if (!taskType) {
        errors.push(`Sheet "${sheetName}" dòng #${actualRowNumber}: Thiếu Loại công việc / Task Type.`);
        continue;
      }
      taskType = String(taskType).trim().toUpperCase().replace(/\s+/g, '_');

      // 3. Resolve Metric & Unit
      const metric = (
        normalizedRow.metric ||
        normalizedRow.chi_so ||
        (role === 'EDITOR' ? 'COMPLETION_DURATION' : 'WEEKLY_OUTPUT_AND_AVG_TIME')
      );
      const unit = String(
        normalizedRow.unit ||
        normalizedRow.don_vi ||
        normalizedRow.dvt ||
        (role === 'EDITOR' ? 'minutes' : 'episodes_per_week')
      ).trim();

      // 4. Resolve Standard Time (Benchmark in minutes)
      let rawStandardTime = (
        normalizedRow.standard_time ||
        normalizedRow.thoi_gian_chuan ||
        normalizedRow.dinh_muc_thoi_gian ||
        normalizedRow.benchmark ||
        normalizedRow.target_time ||
        normalizedRow.thoi_gian ||
        normalizedRow.chuan_gio ||
        normalizedRow.chuan_phut
      );
      let standardTime = Number(rawStandardTime);

      // Handle hour to minute conversion if unit is hour
      if (unit.toLowerCase().includes('gio') || unit.toLowerCase().includes('hour') || unit.toLowerCase().includes('h')) {
        if (!isNaN(standardTime) && standardTime > 0 && standardTime < 50) {
          standardTime = standardTime * 60; // convert hours to minutes
        }
      }

      if (isNaN(standardTime) || standardTime <= 0) {
        // If content role, standardTime might be per episode
        if (role === 'CONTENT' && (normalizedRow.thoi_gian_tb || normalizedRow.avg_time)) {
          standardTime = Number(normalizedRow.thoi_gian_tb || normalizedRow.avg_time) || 120;
        } else {
          errors.push(`Sheet "${sheetName}" dòng #${actualRowNumber} [${taskType}]: Thời gian chuẩn (Standard Time) phải là số dương hợp lệ.`);
          continue;
        }
      }

      // 5. Resolve Target Value (Quota / Quantity)
      let targetValue = Number(
        normalizedRow.target_value ||
        normalizedRow.dinh_muc_so_luong ||
        normalizedRow.so_luong ||
        normalizedRow.dinh_muc ||
        normalizedRow.target ||
        normalizedRow.quota ||
        1
      );
      if (isNaN(targetValue) || targetValue <= 0) {
        targetValue = 1;
      }

      // 6. Resolve Point Base & XP Base
      let pointBase = Number(
        normalizedRow.point_base ||
        normalizedRow.diem_chuan ||
        normalizedRow.point ||
        normalizedRow.diem ||
        normalizedRow.score ||
        100
      );
      if (isNaN(pointBase) || pointBase < 0) pointBase = 100;

      let xpBase = Number(
        normalizedRow.xp_base ||
        normalizedRow.xp_chuan ||
        normalizedRow.xp ||
        pointBase ||
        100
      );
      if (isNaN(xpBase) || xpBase < 0) xpBase = 100;

      // 7. Resolve Scoring Mode
      const scoringMode = (
        normalizedRow.scoring_mode ||
        normalizedRow.che_do_tinh_diem ||
        (role === 'EDITOR' ? 'SPEED_EFFICIENCY_CURVE' : 'WEEKLY_OUTPUT_AVERAGE_CURVE')
      );

      // 8. Resolve Difficulty Tier & Weight
      const difficultyTier = String(
        normalizedRow.difficulty_tier ||
        normalizedRow.do_kho ||
        normalizedRow.muc_do ||
        normalizedRow.difficulty ||
        'STANDARD'
      ).toUpperCase();

      let weight = Number(
        normalizedRow.weight ||
        normalizedRow.he_so ||
        normalizedRow.trong_so ||
        1.0
      );
      if (isNaN(weight) || weight <= 0) weight = 1.0;

      parsedRules.push({
        role,
        taskType,
        metric,
        unit,
        standardTime,
        targetValue,
        pointBase,
        xpBase,
        scoringMode,
        difficultyTier,
        weight,
        sourceFileName: originalFilename,
        sourceSheetName: sheetName,
        sourceRowIndex: actualRowNumber,
        metadata: {
          rawRow: row,
        },
      });
    }
  }

  return {
    success: errors.length === 0 && parsedRules.length > 0,
    fileName: originalFilename,
    sheets: sheetsSummary,
    parsedRules,
    totalParsed: parsedRules.length,
    errors,
    warnings,
  };
}

/**
 * Preview Excel KPI import without saving to database.
 */
async function previewExcel(buffer, originalFilename = 'kpi_benchmark.xlsx') {
  return parseExcelBuffer(buffer, originalFilename);
}

/**
 * Import Excel and persist as a new immutable version in production_kpi_rules.
 *
 * @param {Buffer} buffer
 * @param {string} originalFilename
 * @param {object} options { version, autoActivate, activatedBy, reason, seasonId, teamId }
 */
async function importAndCreateVersion(buffer, originalFilename, options = {}) {
  const parseResult = parseExcelBuffer(buffer, originalFilename);
  if (!parseResult.success) {
    const error = new Error(`Lỗi validate dữ liệu Excel: ${parseResult.errors.join('; ')}`);
    error.statusCode = 400;
    error.details = parseResult;
    throw error;
  }

  const versionTag = String(
    options.version ||
    `v_${Date.now()}_${crypto.randomUUID().slice(0, 6)}`
  ).trim();

  // Check if version already exists
  const existingCount = await ProductionKpiRule.count({ where: { version: versionTag } });
  if (existingCount > 0) {
    const error = new Error(`Phiên bản KPI "${versionTag}" đã tồn tại. Vui lòng chọn tên phiên bản khác.`);
    error.statusCode = 409;
    throw error;
  }

  const rulesToInsert = parseResult.parsedRules.map((r) => ({
    id: crypto.randomUUID(),
    version: versionTag,
    role: r.role,
    taskType: r.taskType,
    metric: r.metric,
    unit: r.unit,
    standardTime: r.standardTime,
    targetValue: r.targetValue,
    pointBase: r.pointBase,
    xpBase: r.xpBase,
    scoringMode: r.scoringMode,
    difficultyTier: r.difficultyTier,
    weight: r.weight,
    sourceFileName: originalFilename,
    sourceSheetName: r.sourceSheetName,
    sourceRowIndex: r.sourceRowIndex,
    active: false,
    status: 'DRAFT',
    effectiveFrom: new Date(),
    metadata: r.metadata,
  }));

  await sequelize.transaction(async (transaction) => {
    await ProductionKpiRule.bulkCreate(rulesToInsert, { transaction });

    if (options.autoActivate) {
      await activateVersionInternal({
        version: versionTag,
        role: 'ALL',
        seasonId: options.seasonId || null,
        teamId: options.teamId || null,
        activatedBy: options.activatedBy || null,
        reason: options.reason || `Imported from Excel ${originalFilename} with auto-activation`,
        transaction,
      });
    }
  });

  return {
    success: true,
    version: versionTag,
    rulesCount: rulesToInsert.length,
    activated: Boolean(options.autoActivate),
    rules: rulesToInsert,
    warnings: parseResult.warnings,
  };
}

/**
 * Internal activation logic inside a transaction.
 */
async function activateVersionInternal({
  version,
  role = 'ALL',
  seasonId = null,
  teamId = null,
  activatedBy = null,
  reason = '',
  transaction,
}) {
  const whereRole = role === 'ALL' ? {} : { role };

  // 1. Deactivate previously active rules for this role scope
  await ProductionKpiRule.update(
    { active: false, status: 'DEPRECATED' },
    {
      where: {
        ...whereRole,
        active: true,
      },
      transaction,
    }
  );

  // 2. Activate target version rules
  const [updatedCount] = await ProductionKpiRule.update(
    { active: true, status: 'ACTIVE', effectiveFrom: new Date() },
    {
      where: {
        version,
        ...whereRole,
      },
      transaction,
    }
  );

  if (updatedCount === 0) {
    const error = new Error(`Không tìm thấy rule nào thuộc phiên bản "${version}" để kích hoạt.`);
    error.statusCode = 404;
    throw error;
  }

  // 3. Record activation record
  const activationRecord = await ProductionKpiActivation.create(
    {
      id: crypto.randomUUID(),
      version,
      role,
      seasonId,
      teamId,
      status: 'ACTIVE',
      effectiveFrom: new Date(),
      activatedBy,
      reason: reason || `Kích hoạt phiên bản KPI ${version}`,
    },
    { transaction }
  );

  // 4. Record CompetitionAuditLog
  try {
    await CompetitionAuditLog.create(
      {
        actorId: activatedBy || null,
        action: 'KPI_VERSION_ACTIVATED',
        entityType: 'KPI_RULE_VERSION',
        entityId: version,
        beforeState: { previousActive: 'DEPRECATED' },
        afterState: { activeVersion: version, role, seasonId, activatedRulesCount: updatedCount },
        reason: reason || `Kích hoạt phiên bản KPI ${version}`,
      },
      { transaction }
    );
  } catch (auditErr) {
    console.warn('[excelKpiImporter] Audit log error:', auditErr.message);
  }

  return {
    version,
    role,
    activatedRulesCount: updatedCount,
    activationId: activationRecord.id,
  };
}

/**
 * Public function to activate a KPI rule version.
 */
async function activateVersion({
  version,
  role = 'ALL',
  seasonId = null,
  teamId = null,
  activatedBy = null,
  reason = '',
}) {
  return sequelize.transaction(async (transaction) => {
    return activateVersionInternal({
      version,
      role,
      seasonId,
      teamId,
      activatedBy,
      reason,
      transaction,
    });
  });
}

/**
 * Get the currently active rule for a specific role and taskType.
 */
async function getActiveRule(role, taskType) {
  const normRole = String(role || '').toUpperCase();
  const normTaskType = String(taskType || '').trim().toUpperCase().replace(/\s+/g, '_');

  // Exact match
  let rule = await ProductionKpiRule.findOne({
    where: {
      role: normRole,
      taskType: normTaskType,
      active: true,
      status: 'ACTIVE',
    },
  });

  // Fallback: Default rule for role if specific taskType is not found
  if (!rule) {
    rule = await ProductionKpiRule.findOne({
      where: {
        role: normRole,
        active: true,
        status: 'ACTIVE',
      },
      order: [['created_at', 'DESC']],
    });
  }

  return rule;
}

/**
 * List all KPI versions and their status summary.
 */
async function listVersions() {
  const rules = await ProductionKpiRule.findAll({
    order: [['created_at', 'DESC']],
  });

  const versionsMap = new Map();
  for (const r of rules) {
    if (!versionsMap.has(r.version)) {
      versionsMap.set(r.version, {
        version: r.version,
        active: false,
        roles: new Set(),
        rulesCount: 0,
        createdAt: r.createdAt,
        sourceFileName: r.sourceFileName,
        status: r.status,
      });
    }
    const entry = versionsMap.get(r.version);
    entry.roles.add(r.role);
    entry.rulesCount += 1;
    if (r.active) entry.active = true;
  }

  return Array.from(versionsMap.values()).map((v) => ({
    ...v,
    roles: Array.from(v.roles),
  }));
}

/**
 * Get all rules for a specific version.
 */
async function getRulesByVersion(version) {
  return ProductionKpiRule.findAll({
    where: { version },
    order: [['role', 'ASC'], ['task_type', 'ASC']],
  });
}

module.exports = {
  parseExcelBuffer,
  previewExcel,
  importAndCreateVersion,
  activateVersion,
  getActiveRule,
  listVersions,
  getRulesByVersion,
};
