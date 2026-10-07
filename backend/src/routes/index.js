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
router.use('/kpi', require('./kpi.routes'));
router.use('/games/quiz', require('./quizGame.routes'));
router.use('/admin/quiz', require('./quizAdmin.routes'));
router.use('/games/2048', require('./game2048.routes'));
router.use('/games/sam', require('./samGame.routes'));
router.use('/admin/games/sam', require('./samGame.routes'));
router.use('/games/typing', require('./typingGame.routes'));
router.use('/admin/games/typing', require('./typingGame.routes'));
router.use('/admin/games', require('./gameCatalog.routes'));
router.use('/games/catalog', require('./gameCatalog.routes'));
router.use('/games', require('./capitalBoardGame.routes'));
router.delete('/admin/users/:id', require('../middlewares/auth.middleware').auth, require('../middlewares/auth.middleware').requireRole('admin'), asyncHandler(require('../controllers/users.controller').remove));

module.exports = router;

