'use strict';

const express = require('express');
const router = express.Router();
const typingGameController = require('../controllers/typingGame.controller');
const musicRaceController = require('../controllers/musicRace.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

// Game availability check
router.get('/status', auth, asyncHandler(typingGameController.getCatalogStatus));

// Personal stats & challenges
router.get('/my-stats', auth, asyncHandler(typingGameController.getMyStats));
router.get('/leaderboard', auth, asyncHandler(typingGameController.getLeaderboard));
router.get('/challenges', auth, asyncHandler(typingGameController.getChallenges));

router.get('/history', auth, asyncHandler(async(req,res)=>res.json(await require('../services/typingGame.service').getHistory(req.user.id,req.query))));

// Đua Gõ Theo Nhạc — music-synchronised typing race.
// The internal game type stays `typing_battle`; only the challenge shape changes.
router.get('/music/songs', auth, asyncHandler(musicRaceController.listSongs));
router.get('/music/songs/:songId', auth, asyncHandler(musicRaceController.getSong));
router.post('/music/songs', auth, requireRole('admin'), asyncHandler(musicRaceController.publishSong));
router.get('/music/my-stats', auth, asyncHandler(musicRaceController.myStats));
router.get('/music/leaderboard', auth, asyncHandler(musicRaceController.leaderboard));
router.post('/music/attempts', auth, asyncHandler(musicRaceController.createAttempt));
router.post('/music/attempts/:attemptId/progress', auth, asyncHandler(musicRaceController.progress));
router.post('/music/finish', auth, asyncHandler(musicRaceController.finish));

// Room management
router.get('/rooms', auth, asyncHandler(typingGameController.listRooms));
router.get('/active-room', auth, asyncHandler(typingGameController.getActiveRoom));
router.post('/rooms', auth, asyncHandler(typingGameController.createRoom));
router.post('/matchmaking/quick', auth, asyncHandler(typingGameController.quickMatch));
router.get('/rooms/:roomId', auth, asyncHandler(typingGameController.getRoomDetail));
router.get('/rooms/:roomId/spectators', auth, asyncHandler(typingGameController.getRoomSpectators));
router.post('/rooms/:roomId/join', auth, asyncHandler(typingGameController.joinRoom));
router.post('/rooms/:roomId/switch-team', auth, asyncHandler(typingGameController.switchTeam));
router.post('/rooms/:roomId/leave', auth, asyncHandler(typingGameController.leaveRoom));
router.post('/rooms/:roomId/ready', auth, asyncHandler(typingGameController.toggleReady));
router.post('/rooms/:roomId/start', auth, asyncHandler(typingGameController.startMatch));
router.post('/rooms/:roomId/reset', auth, asyncHandler(typingGameController.resetRoom));

// In-game actions
router.post('/rooms/:roomId/progress', auth, asyncHandler(typingGameController.updateProgress));
router.post('/rooms/:roomId/finish', auth, asyncHandler(typingGameController.submitFinish));
router.post('/practice/attempts', auth, asyncHandler(typingGameController.createPractice));
router.get('/practice/active', auth, asyncHandler(typingGameController.activePractice));
router.post('/practice/attempts/:attemptId/progress', auth, asyncHandler(typingGameController.practiceProgress));
router.post('/practice/finish', auth, asyncHandler(typingGameController.submitPractice));

module.exports = router;
