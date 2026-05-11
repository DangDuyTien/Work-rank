const express = require('express');
const controller = require('../controllers/dashboard.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/overview', auth, asyncHandler(controller.overview));
router.get('/realtime-users', auth, asyncHandler(controller.realtimeUsers));
router.get('/team-summary', auth, asyncHandler(controller.teamSummary));
router.get('/heatmap', auth, asyncHandler(controller.heatmap));

module.exports = router;
