'use strict';

/**
 * ranking.routes.js
 *
 * Canonical Unified Ranking Hub Routes for WorkRank V3.3.
 */

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { auth } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/ranking.controller');

const router = express.Router();

router.get('/overview', auth, asyncHandler(ctrl.getOverview));
router.get('/teams', auth, asyncHandler(ctrl.getTeams));
router.get('/individuals', auth, asyncHandler(ctrl.getIndividuals));
router.get('/seasons', auth, asyncHandler(ctrl.getSeasons));
router.get('/grands', auth, asyncHandler(ctrl.getGrands));
router.get('/youtube', auth, asyncHandler(ctrl.getYouTube));
router.get('/top-performers', auth, asyncHandler(ctrl.getTopPerformers));

module.exports = router;
