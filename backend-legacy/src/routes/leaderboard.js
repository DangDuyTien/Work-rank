const { Router } = require('express');
const leaderboardController = require('../controllers/leaderboardController');
const auth = require('../middlewares/auth');

const router = Router();

router.get('/', auth, leaderboardController.getLeaderboard);
router.get('/group/:groupId', auth, leaderboardController.getGroupLeaderboard);

module.exports = router;
