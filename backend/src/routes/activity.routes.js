'use strict';

const express = require('express');
const router = express.Router();
const { auth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const activityController = require('../controllers/activityTracking.controller');
const asyncHandler = require('../utils/asyncHandler');

// 1. Pure Activity Batch Ingestion (Optimized network batching, no anti-cheat, no rate-limiting)
router.post('/batch', optionalAuth, asyncHandler(activityController.recordBatch));

// 2. Settings (Read current toggle status)
router.get('/settings', optionalAuth, asyncHandler(activityController.getSettings));

// 3. Admin: Update Tracking Toggles (ON / OFF for clicks and keyboard)
router.patch('/settings', auth, requireRole('admin'), asyncHandler(activityController.updateSettings));

// 4. Admin: View Pure Activity Telemetry Analytics (Today / 7d / 30d)
router.get('/analytics', auth, requireRole('admin'), asyncHandler(activityController.getAnalytics));

// 5. COMPUTER ACTIVITY TRACKING (Desktop Agent Ingestion & BXH Độ Năng Động)
const computerActivityController = require('../controllers/computerActivity.controller');
router.post('/computer/batch', auth, asyncHandler(computerActivityController.recordBatch));
router.get('/rankings', optionalAuth, asyncHandler(computerActivityController.getRankings));
router.get('/wave/live', optionalAuth, asyncHandler(computerActivityController.getLiveWave));
router.get('/my-summary', auth, asyncHandler(computerActivityController.getMySummary));
router.get('/admin/overview', auth, requireRole('admin'), asyncHandler(computerActivityController.getAdminOverview));

module.exports = router;
