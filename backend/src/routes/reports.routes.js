const express = require('express');
const controller = require('../controllers/reports.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(auth);
router.get('/users/:id/daily', asyncHandler(controller.userDaily));
router.get('/users/:id/weekly', asyncHandler(controller.userWeekly));
router.get('/users/:id/monthly', asyncHandler(controller.userMonthly));
router.get('/export.csv', asyncHandler(controller.exportCsv));

module.exports = router;
