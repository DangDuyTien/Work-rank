'use strict';

const express = require('express');
const controller = require('../controllers/capitalBoardGame.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All game routes require authentication
router.use(auth);

// Rooms Management
router.get('/rooms', asyncHandler(controller.listRooms));
router.get('/active-room', asyncHandler(controller.getActiveRoom));
router.get('/rooms/:id', asyncHandler(controller.getRoom));
router.post('/rooms', asyncHandler(controller.createRoom));
router.post('/rooms/:id/join', asyncHandler(controller.joinRoom));
router.post('/rooms/:id/leave', asyncHandler(controller.leaveRoom));
router.post('/rooms/:id/start', asyncHandler(controller.startGame));

// Active Match Actions
router.post('/rooms/:id/roll', asyncHandler(controller.rollDice));
router.post('/rooms/:id/buy', asyncHandler(controller.buyProperty));
router.post('/rooms/:id/end-turn', asyncHandler(controller.endTurn));

// Game Leaderboard & History
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
router.get('/history', asyncHandler(controller.getMyHistory));

module.exports = router;
