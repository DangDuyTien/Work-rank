'use strict';

const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth.middleware');
const samGameController = require('../controllers/samGame.controller');

// All Sam game endpoints require authenticated user
router.use(auth);

// Lobby & Rooms
router.get('/rooms', samGameController.listRooms);
router.post('/rooms', samGameController.createRoom);
router.get('/rooms/active', samGameController.getActiveRoom);
router.get('/rooms/:id', samGameController.getRoom);
router.post('/rooms/:id/join', samGameController.joinRoom);
router.post('/rooms/:id/leave', samGameController.leaveRoom);

// Gameplay Actions
router.post('/rooms/:id/start', samGameController.startMatch);
router.post('/rooms/:id/declare-sam', samGameController.declareSam);
router.post('/rooms/:id/play-cards', samGameController.playCards);
router.post('/rooms/:id/pass', samGameController.passTurn);

// Leaderboard & Personal Stats
router.get('/leaderboard', samGameController.getLeaderboard);
router.get('/my-stats', samGameController.getMyStats);

module.exports = router;
