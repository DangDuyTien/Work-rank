'use strict';

const express = require('express');
const router = express.Router();
const typingGameController = require('../controllers/typingGame.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

// Game availability check
router.get('/status', auth, asyncHandler(typingGameController.getCatalogStatus));

// Personal stats & challenges
router.get('/my-stats', auth, asyncHandler(typingGameController.getMyStats));
router.get('/leaderboard', auth, asyncHandler(typingGameController.getLeaderboard));
router.get('/challenges', auth, asyncHandler(typingGameController.getChallenges));

// Room management
router.get('/rooms', auth, asyncHandler(typingGameController.listRooms));
router.get('/active-room', auth, asyncHandler(typingGameController.getActiveRoom));
router.post('/rooms', auth, asyncHandler(typingGameController.createRoom));
router.post('/matchmaking/quick', auth, asyncHandler(typingGameController.quickMatch));
router.get('/rooms/:roomId', auth, asyncHandler(typingGameController.getRoomDetail));
router.post('/rooms/:roomId/join', auth, asyncHandler(typingGameController.joinRoom));
router.post('/rooms/:roomId/switch-team', auth, asyncHandler(typingGameController.switchTeam));
router.post('/rooms/:roomId/leave', auth, asyncHandler(typingGameController.leaveRoom));
router.post('/rooms/:roomId/ready', auth, asyncHandler(typingGameController.toggleReady));
router.post('/rooms/:roomId/start', auth, asyncHandler(typingGameController.startMatch));
router.post('/rooms/:roomId/reset', auth, asyncHandler(typingGameController.resetRoom));

// In-game actions
router.post('/rooms/:roomId/progress', auth, asyncHandler(typingGameController.updateProgress));
router.post('/rooms/:roomId/finish', auth, asyncHandler(typingGameController.submitFinish));
router.post('/practice/finish', auth, asyncHandler(typingGameController.submitPractice));

module.exports = router;
