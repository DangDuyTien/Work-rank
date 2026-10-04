'use strict';

const kpiService = require('../services/kpi.service');

// ── Department Handlers ──
exports.getDepartments = async (req, res, next) => {
  try {
    const departments = await kpiService.getDepartments();
    return res.json({ success: true, data: departments });
  } catch (error) {
    return next(error);
  }
};
exports.createDepartment = async (req, res, next) => {
  try {
    const department = await kpiService.createDepartment(req.body);
    return res.status(201).json({ success: true, data: department });
  } catch (error) {
    return next(error);
  }
};

exports.updateDepartment = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const department = await kpiService.updateDepartment(id, req.body);
    return res.json({ success: true, data: department });
  } catch (error) {
    return next(error);
  }
};

// ── KPI Definition Handlers ──
exports.getDefinitions = async (req, res, next) => {
  try {
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const activeOnly = req.query.activeOnly === 'true';
    const definitions = await kpiService.getDefinitions({ departmentId, activeOnly });
    return res.json({ success: true, data: definitions });
  } catch (error) {
    return next(error);
  }
};

exports.createDefinition = async (req, res, next) => {
  try {
    const definition = await kpiService.createDefinition(req.body);
    return res.status(201).json({ success: true, data: definition });
  } catch (error) {
    return next(error);
  }
};

exports.updateDefinition = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const definition = await kpiService.updateDefinition(id, req.body);
    return res.json({ success: true, data: definition });
  } catch (error) {
    return next(error);
  }
};

exports.toggleDefinition = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const definition = await kpiService.toggleDefinition(id);
    return res.json({ success: true, data: definition });
  } catch (error) {
    return next(error);
  }
};

exports.deleteDefinition = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const result = await kpiService.deleteDefinition(id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

// ── KPI Period Handlers ──
exports.getPeriods = async (req, res, next) => {
  try {
    const periods = await kpiService.getPeriods(req.query);
    return res.json({ success: true, data: periods });
  } catch (error) {
    return next(error);
  }
};

exports.createPeriod = async (req, res, next) => {
  try {
    const period = await kpiService.createPeriod(req.body);
    return res.status(201).json({ success: true, data: period });
  } catch (error) {
    return next(error);
  }
};

// ── KPI Result & History Handlers ──
exports.getResults = async (req, res, next) => {
  try {
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const periodId = req.query.periodId ? Number(req.query.periodId) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;

    const results = await kpiService.getResults({ departmentId, periodId, userId });
    return res.json({ success: true, data: results });
  } catch (error) {
    return next(error);
  }
};

exports.recordResult = async (req, res, next) => {
  try {
    const actorId = req.user?.id || null;
    const result = await kpiService.recordResult({
      ...req.body,
      actorId,
    });
    return res.json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

exports.getResultHistory = async (req, res, next) => {
  try {
    const kpiResultId = req.query.kpiResultId ? Number(req.query.kpiResultId) : undefined;
    const kpiId = req.query.kpiId ? Number(req.query.kpiId) : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const history = await kpiService.getResultHistory({ kpiResultId, kpiId, userId, limit });
    return res.json({ success: true, data: history });
  } catch (error) {
    return next(error);
  }
};

// ── User Dashboard KPI Summary ──
exports.getMyKpis = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập' });
    }
    const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
    const departmentCode = req.query.departmentCode ? String(req.query.departmentCode) : undefined;
    const periodId = req.query.periodId ? Number(req.query.periodId) : undefined;
    const summary = await kpiService.getMyKpis(userId, { departmentId, departmentCode, periodId });
    return res.json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
};

// ── 6. PRODUCTION KPI ENGINE (EXCEL BASELINE & RUNTIME EVALUATION) ──
const excelKpiImporter = require('../services/competition/excelKpiImporter.service');
const productionKpiCalculator = require('../services/competition/productionKpiCalculator.service');

exports.getProductionKpiRules = async (req, res, next) => {
  try {
    const { version, role } = req.query;
    if (version) {
      const rules = await excelKpiImporter.getRulesByVersion(version);
      return res.json({ success: true, version, data: rules });
    }
    const versions = await excelKpiImporter.listVersions();
    const activeRules = await excelKpiImporter.getRulesByVersion(versions.find((v) => v.active)?.version || 'v1.0');
    return res.json({ success: true, versions, activeRules });
  } catch (error) {
    return next(error);
  }
};

exports.getProductionKpiVersions = async (req, res, next) => {
  try {
    const versions = await excelKpiImporter.listVersions();
    return res.json({ success: true, data: versions });
  } catch (error) {
    return next(error);
  }
};

exports.previewProductionKpiExcel = async (req, res, next) => {
  try {
    let fileBuffer;
    let originalFilename = 'kpi_benchmark.xlsx';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalFilename = req.file.originalname;
    } else if (req.body?.base64Data) {
      fileBuffer = Buffer.from(req.body.base64Data, 'base64');
      originalFilename = req.body.filename || 'kpi_benchmark.xlsx';
    } else {
      return res.status(400).json({ success: false, error: 'Vui lòng tải lên file Excel (.xlsx / .xls) hoặc gửi base64Data.' });
    }

    const preview = await excelKpiImporter.previewExcel(fileBuffer, originalFilename);
    return res.json(preview);
  } catch (error) {
    return next(error);
  }
};

exports.importProductionKpiExcel = async (req, res, next) => {
  try {
    let fileBuffer;
    let originalFilename = 'kpi_benchmark.xlsx';

    if (req.file) {
      fileBuffer = req.file.buffer;
      originalFilename = req.file.originalname;
    } else if (req.body?.base64Data) {
      fileBuffer = Buffer.from(req.body.base64Data, 'base64');
      originalFilename = req.body.filename || 'kpi_benchmark.xlsx';
    } else {
      return res.status(400).json({ success: false, error: 'Vui lòng tải lên file Excel (.xlsx / .xls) hoặc gửi base64Data.' });
    }

    const { version, autoActivate, reason, seasonId, teamId } = req.body;
    const result = await excelKpiImporter.importAndCreateVersion(fileBuffer, originalFilename, {
      version,
      autoActivate: autoActivate === true || autoActivate === 'true',
      activatedBy: req.user?.id || null,
      reason,
      seasonId: seasonId ? Number(seasonId) : null,
      teamId: teamId ? Number(teamId) : null,
    });

    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
};

exports.activateProductionKpiVersion = async (req, res, next) => {
  try {
    const { version, role = 'ALL', seasonId, teamId, reason } = req.body;
    if (!version) {
      return res.status(400).json({ success: false, error: 'Tên phiên bản (version) là bắt buộc để kích hoạt.' });
    }

    const result = await excelKpiImporter.activateVersion({
      version,
      role,
      seasonId: seasonId ? Number(seasonId) : null,
      teamId: teamId ? Number(teamId) : null,
      activatedBy: req.user?.id || null,
      reason,
    });

    return res.json({ success: true, message: `Đã kích hoạt phiên bản KPI ${version} thành công.`, data: result });
  } catch (error) {
    return next(error);
  }
};

exports.calculateEditorKpi = async (req, res, next) => {
  try {
    const result = await productionKpiCalculator.evaluateEditorTask({
      ...req.body,
      actorId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

exports.calculateContentKpi = async (req, res, next) => {
  try {
    const result = await productionKpiCalculator.evaluateContentWeekly({
      ...req.body,
      actorId: req.user?.id || null,
    });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};

exports.getProductionKpiHistory = async (req, res, next) => {
  try {
    const { userId, role, seasonId, limit, offset } = req.query;
    const history = await productionKpiCalculator.getExecutionHistory({
      userId: userId ? Number(userId) : undefined,
      role: role ? String(role).toUpperCase() : undefined,
      seasonId: seasonId ? Number(seasonId) : undefined,
      limit: limit ? Number(limit) : 50,
      offset: offset ? Number(offset) : 0,
    });
    return res.json({ success: true, count: history.count, data: history.rows });
  } catch (error) {
    return next(error);
  }
};
