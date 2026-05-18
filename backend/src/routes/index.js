const express = require('express');
const healthController = require('../controllers/health.controller');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/health', asyncHandler(healthController.health));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/activity', require('./activity.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/leaderboard', require('./leaderboard.routes'));
router.use('/friends', require('./friends.routes'));
router.use('/chats', require('./chats.routes'));
router.use('/groups', require('./groups.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/security', require('./security.routes'));
router.use('/simulation', require('./simulation.routes'));

module.exports = router;
