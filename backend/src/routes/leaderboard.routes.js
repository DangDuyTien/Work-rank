const express = require('express');
const controller = require('../controllers/leaderboard.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/daily', auth, asyncHandler(controller.daily));
router.get('/weekly', auth, asyncHandler(controller.weekly));
router.get('/monthly', auth, asyncHandler(controller.monthly));
router.get('/team/:teamId', auth, asyncHandler(controller.team));

module.exports = router;
