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

// ── 6. Production KPI Engine ──────────────────────────────────────────────────
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file Excel (.xlsx / .xls)'), false);
    }
  },
});

// Rule browsing (authenticated — all members can view active rules)
router.get('/production/rules',    auth, asyncHandler(kpiController.getProductionKpiRules));
router.get('/production/versions', auth, asyncHandler(kpiController.getProductionKpiVersions));

// Excel import — admin only
router.post(
  '/production/preview',
  auth, requireRole('admin'),
  upload.single('file'),
  asyncHandler(kpiController.previewProductionKpiExcel),
);
router.post(
  '/production/import',
  auth, requireRole('admin'),
  upload.single('file'),
  asyncHandler(kpiController.importProductionKpiExcel),
);
router.post(
  '/production/activate',
  auth, requireRole('admin'),
  asyncHandler(kpiController.activateProductionKpiVersion),
);

// KPI evaluation awards Point/XP from caller-supplied timestamps, so it must NOT be
// reachable by regular users (self-award / farming). Admin/manager or internal workflow only.
router.post('/production/calculate/editor',  auth, requireRole('admin', 'manager'), asyncHandler(kpiController.calculateEditorKpi));
router.post('/production/calculate/content', auth, requireRole('admin', 'manager'), asyncHandler(kpiController.calculateContentKpi));

// History / audit trail
router.get('/production/history', auth, asyncHandler(kpiController.getProductionKpiHistory));

module.exports = router;
