'use strict';

const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middlewares/auth.middleware');
const samGameController = require('../controllers/samGame.controller');

// All Sam game endpoints require authenticated user
router.use(auth);

// ── LOBBY & ROOMS ──
router.get('/rooms', samGameController.listRooms);
router.post('/rooms', samGameController.createRoom);
router.get('/rooms/active', samGameController.getActiveRoom);
router.get('/rooms/:id', samGameController.getRoom);
router.post('/rooms/:id/join', samGameController.joinRoom);
router.post('/rooms/:id/leave', samGameController.leaveRoom);

// ── GAMEPLAY ACTIONS ──
router.post('/rooms/:id/start', samGameController.startMatch);
router.post('/rooms/:id/declare-sam', samGameController.declareSam);
router.post('/rooms/:id/play-cards', samGameController.playCards);
router.post('/rooms/:id/pass', samGameController.passTurn);

// ── LEADERBOARD & STATS ──
router.get('/leaderboard', samGameController.getLeaderboard);
router.get('/my-stats', samGameController.getMyStats);

// ── ADMIN BOT TEST ROUTES (RBAC: ADMIN ONLY) ──
router.post('/admin/bot-room', requireRole('admin'), samGameController.createBotTestRoom);
router.post('/bot-room', requireRole('admin'), samGameController.createBotTestRoom);
router.get('/admin/bot-rooms', requireRole('admin'), samGameController.listBotTestRooms);
router.post('/admin/rooms/:id/start', requireRole('admin'), samGameController.startMatch);
router.post('/admin/rooms/:id/pause', requireRole('admin'), samGameController.pauseBotTest);
router.post('/admin/rooms/:id/resume', requireRole('admin'), samGameController.resumeBotTest);
router.post('/admin/rooms/:id/step', requireRole('admin'), samGameController.stepBotTest);
router.post('/admin/rooms/:id/restart', requireRole('admin'), samGameController.restartBotTest);
router.post('/admin/rooms/:id/fill-bots', requireRole('admin'), samGameController.fillBots);
router.post('/admin/rooms/:id/stop', requireRole('admin'), samGameController.stopBotTest);
router.delete('/admin/rooms/:id', requireRole('admin'), samGameController.stopBotTest);
router.get('/admin/rooms/:id/debug', requireRole('admin'), samGameController.getBotDebugState);

module.exports = router;
