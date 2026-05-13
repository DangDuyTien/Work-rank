const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/groups.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(auth);

router.get('/', asyncHandler(controller.list));
router.post(
  '/',
  validate(z.object({ body: z.object({ name: z.string().min(1).max(120), description: z.string().max(1000).optional() }) })),
  asyncHandler(controller.create),
);
router.post(
  '/join',
  validate(z.object({ body: z.object({ inviteCode: z.string().min(1).max(32).optional(), invite_code: z.string().min(1).max(32).optional() }).refine((body) => body.inviteCode || body.invite_code, { message: 'Missing invite code' }) })),
  asyncHandler(controller.join),
);
router.post('/:id/leave', asyncHandler(controller.leave));

module.exports = router;
