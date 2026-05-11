const { Router } = require('express');
const activityController = require('../controllers/activityController');
const auth = require('../middlewares/auth');

const router = Router();

router.post('/ping', activityController.ping);
router.post('/ping-auth', auth, activityController.ping);
router.get('/today', auth, activityController.today);
router.get('/user/:id', auth, activityController.userStats);
router.get('/timeline/:id', auth, activityController.timeline);
router.get('/heatmap/:id', auth, activityController.heatmap);

module.exports = router;


