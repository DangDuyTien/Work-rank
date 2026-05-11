const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/activity.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const platform = z.enum(['macos', 'windows', 'linux']).optional();
const event = z.object({
  sessionId: z.coerce.number().int().positive().optional(),
  timestamp: z.string().datetime().optional(),
  activeSeconds: z.coerce.number().int().min(0).max(3600).default(0),
  idleSeconds: z.coerce.number().int().min(0).max(3600).default(0),
  keystrokeCount: z.coerce.number().int().min(0).default(0),
  mouseClickCount: z.coerce.number().int().min(0).default(0),
  mouseMoveCount: z.coerce.number().int().min(0).default(0),
  metadata: z.record(z.any()).optional(),
  sequence: z.coerce.number().int().positive(),
});
const deviceFields = {
  deviceUuid: z.string().min(1).max(191),
  deviceName: z.string().min(1).max(191).optional(),
  platform,
  appVersion: z.string().max(50).optional(),
  deviceSecret: z.string().min(32).max(128).optional(),
};

router.post('/session/start', auth, validate(z.object({ body: z.object({ ...deviceFields, startedAt: z.string().datetime().optional() }) })), asyncHandler(controller.startSession));
router.post('/session/end', auth, validate(z.object({ body: z.object({ sessionId: z.coerce.number().int().positive() }) })), asyncHandler(controller.endSession));
router.post('/batch', auth, validate(z.object({ body: z.object({ ...deviceFields, sessionId: z.coerce.number().int().positive().optional(), events: z.array(event).min(1).max(500), signature: z.string().length(64).optional() }) })), asyncHandler(controller.ingestBatch));
router.post('/events', auth, validate(z.object({ body: z.object({ ...deviceFields, ...event.shape }) })), asyncHandler(controller.ingestEvent));
router.get('/me/today', auth, asyncHandler(controller.meToday));

module.exports = router;
