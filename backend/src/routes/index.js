const express = require('express');

const router = express.Router();
router.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./users.routes'));
router.use('/activity', require('./activity.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/leaderboard', require('./leaderboard.routes'));
router.use('/friends', require('./friends.routes'));
router.use('/groups', require('./groups.routes'));
router.use('/reports', require('./reports.routes'));
router.use('/security', require('./security.routes'));
router.use('/simulation', require('./simulation.routes'));

module.exports = router;
