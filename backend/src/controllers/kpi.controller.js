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
    const summary = await kpiService.getMyKpis(userId);
    return res.json({ success: true, data: summary });
  } catch (error) {
    return next(error);
  }
};
