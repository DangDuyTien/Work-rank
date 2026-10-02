'use strict';

const express = require('express');
const router = express.Router();
const { auth, requireRole, optionalAuth } = require('../middlewares/auth.middleware');
const gameCatalogController = require('../controllers/gameCatalog.controller');
const asyncHandler = require('../utils/asyncHandler');

// 1. Game Catalog List & Detail
router.get('/', optionalAuth, asyncHandler(gameCatalogController.getCatalog));
router.get('/list', optionalAuth, asyncHandler(gameCatalogController.getCatalog));
router.get('/:gameKey', optionalAuth, asyncHandler(gameCatalogController.getGame));

// 2. Admin: Update Game Status (AVAILABLE vs COMING_SOON)
router.patch('/status/:gameKey', auth, requireRole('admin'), asyncHandler(gameCatalogController.updateGame));
router.patch('/:gameKey', auth, requireRole('admin'), asyncHandler(gameCatalogController.updateGame));

module.exports = router;
