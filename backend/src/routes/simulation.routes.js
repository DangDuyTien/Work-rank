const express = require('express');
const controller = require('../controllers/simulation.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(auth, requireRole('admin'));
router.get('/status', asyncHandler(controller.status));
router.post('/start', asyncHandler(controller.start));
router.post('/stop', asyncHandler(controller.stop));
router.post('/tick', asyncHandler(controller.tick));

module.exports = router;
