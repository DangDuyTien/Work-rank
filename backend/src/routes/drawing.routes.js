'use strict';

const express = require('express');
const drawingController = require('../controllers/drawing.controller');
const { auth, optionalAuth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// Settings
router.get('/settings', optionalAuth, asyncHandler(drawingController.getSettings));
router.patch('/settings', auth, requireRole('admin'), asyncHandler(drawingController.updateSettings));

// Gallery & Detail
router.get('/', optionalAuth, asyncHandler(drawingController.getGallery));
router.get('/user/:userId', optionalAuth, asyncHandler(drawingController.getUserDrawings));
router.get('/:id', optionalAuth, asyncHandler(drawingController.getById));

// Create, Like & Delete
router.post('/', auth, drawingController.uploadMiddleware, asyncHandler(drawingController.create));
router.post('/:id/like', auth, asyncHandler(drawingController.toggleLike));
router.delete('/:id', auth, asyncHandler(drawingController.remove));

module.exports = router;
