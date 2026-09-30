'use strict';

const express = require('express');
const controller = require('../controllers/game2048.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All 2048 game endpoints require authentication
router.use(auth);

// Game session & score submission
router.post('/start', asyncHandler(controller.startSession));
router.post('/submit', asyncHandler(controller.submitScore));

// Company Leaderboard & Personal Stats
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
router.get('/my-stats', asyncHandler(controller.getMyStats));

module.exports = router;
