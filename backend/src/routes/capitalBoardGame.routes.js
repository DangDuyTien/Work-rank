'use strict';

const express = require('express');
const controller = require('../controllers/capitalBoardGame.controller');
const { auth } = require('../middlewares/auth.middleware');
const { requireGameAvailable } = require('../middlewares/gameAvailability.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// All game routes require authentication
router.use(auth);

// Rooms Management
router.get('/rooms', asyncHandler(controller.listRooms));
router.get('/active-room', asyncHandler(controller.getActiveRoom));
router.get('/rooms/:id', asyncHandler(controller.getRoom));
router.post('/rooms', requireGameAvailable('capital_board'), asyncHandler(controller.createRoom));
router.post('/practice', requireGameAvailable('capital_board'), asyncHandler(controller.createPracticeRoom));
router.post('/rooms/:id/join', requireGameAvailable('capital_board'), asyncHandler(controller.joinRoom));
router.post('/rooms/:id/leave', asyncHandler(controller.leaveRoom));
router.post('/rooms/:id/bots', requireGameAvailable('capital_board'), asyncHandler(controller.addBot));
router.delete('/rooms/:id/bots/:botUserId', asyncHandler(controller.removeBot));
router.post('/rooms/:id/start', requireGameAvailable('capital_board'), asyncHandler(controller.startGame));

// Active Match Actions
router.post('/rooms/:id/roll', asyncHandler(controller.rollDice));
router.post('/rooms/:id/buy', asyncHandler(controller.buyProperty));
router.post('/rooms/:id/end-turn', asyncHandler(controller.endTurn));

// Game Leaderboard & History
router.get('/leaderboard', asyncHandler(controller.getLeaderboard));
router.get('/history', asyncHandler(controller.getMyHistory));

module.exports = router;
