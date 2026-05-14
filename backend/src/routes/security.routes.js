const express = require('express');
const controller = require('../controllers/security.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(auth);
router.use(requireRole('admin'));

router.get('/devices', asyncHandler(controller.listDevices));
router.post('/devices/:id/revoke', asyncHandler(controller.revokeDevice));
router.post('/devices/:id/restore', asyncHandler(controller.restoreDevice));
router.get('/anomalies', asyncHandler(controller.anomalies));
router.get('/events', asyncHandler(controller.events));
router.get('/users/:userId/baseline', asyncHandler(controller.baseline));

module.exports = router;
