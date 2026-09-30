'use strict';

const express = require('express');
const controller = require('../controllers/quizGame.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All quiz game routes require authentication
router.use(auth);

// Rooms Management
router.get('/rooms', asyncHandler(controller.listRooms));
router.get('/active-room', asyncHandler(controller.getActiveRoom));
router.get('/rooms/:id', asyncHandler(controller.getRoom));
router.post('/rooms', asyncHandler(controller.createRoom));
router.post('/rooms/:id/join', asyncHandler(controller.joinRoom));
router.post('/rooms/:id/leave', asyncHandler(controller.leaveRoom));
router.post('/rooms/:id/start', asyncHandler(controller.startGame));

// Gameplay Actions
router.post('/rooms/:id/answer', asyncHandler(controller.submitAnswer));

// Leaderboard & Stats
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
router.get('/my-stats', asyncHandler(controller.getMyStats));

module.exports = router;
