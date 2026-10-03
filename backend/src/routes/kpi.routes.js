'use strict';

const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middlewares/auth.middleware');
const kpiController = require('../controllers/kpi.controller');
const asyncHandler = require('../utils/asyncHandler');

// ── 1. User Dashboard KPI Summary ──
router.get('/my-kpis', auth, asyncHandler(kpiController.getMyKpis));

// ── 2. Departments ──
router.get('/departments', auth, asyncHandler(kpiController.getDepartments));
router.post('/departments', auth, requireRole('admin'), asyncHandler(kpiController.createDepartment));
router.put('/departments/:id', auth, requireRole('admin'), asyncHandler(kpiController.updateDepartment));

// ── 3. KPI Definitions ──
router.get('/definitions', auth, asyncHandler(kpiController.getDefinitions));
router.post('/definitions', auth, requireRole('admin'), asyncHandler(kpiController.createDefinition));
router.put('/definitions/:id', auth, requireRole('admin'), asyncHandler(kpiController.updateDefinition));
router.patch('/definitions/:id/toggle', auth, requireRole('admin'), asyncHandler(kpiController.toggleDefinition));
router.delete('/definitions/:id', auth, requireRole('admin'), asyncHandler(kpiController.deleteDefinition));

// ── 4. KPI Periods ──
router.get('/periods', auth, asyncHandler(kpiController.getPeriods));
router.post('/periods', auth, requireRole('admin'), asyncHandler(kpiController.createPeriod));

// ── 5. KPI Results & History ──
router.get('/results', auth, asyncHandler(kpiController.getResults));
router.post('/results', auth, requireRole('admin'), asyncHandler(kpiController.recordResult));
router.get('/results/history', auth, asyncHandler(kpiController.getResultHistory));

module.exports = router;
