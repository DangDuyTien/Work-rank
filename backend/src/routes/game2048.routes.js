'use strict';

const express = require('express');
const controller = require('../controllers/game2048.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All 2048 game endpoints require authentication
router.use(auth);

// Game session, checkpoints & score submission
router.post('/start', asyncHandler(controller.startSession));
router.post('/checkpoint', asyncHandler(controller.checkpointSession));
router.post('/submit', asyncHandler(controller.submitScore));
router.get('/active-session', asyncHandler(controller.getActiveSession));

// Company Leaderboard & Personal Stats
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
router.get('/my-stats', asyncHandler(controller.getMyStats));

module.exports = router;
