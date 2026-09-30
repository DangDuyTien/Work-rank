const express = require('express');
const healthController = require('../controllers/health.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/health', asyncHandler(healthController.health));
router.get('/health/live', asyncHandler(healthController.live));
router.get('/health/ready', asyncHandler(healthController.ready));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/leaderboard', require('./leaderboard.routes'));
router.use('/friends', require('./friends.routes'));
router.use('/chats', require('./chats.routes'));
router.use('/groups', require('./groups.routes'));
router.use('/tradingview', require('./tradingview.routes'));
router.use('/competition', require('./competition.routes'));
router.use('/youtube', require('./youtube.routes'));
router.use('/rankings', require('./ranking.routes'));
router.use('/games/quiz', require('./quizGame.routes'));
router.use('/games', require('./capitalBoardGame.routes'));

module.exports = router;

