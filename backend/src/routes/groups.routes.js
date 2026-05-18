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
router.patch(
  '/:id',
  validate(z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
      name: z.string().trim().min(1).max(120).optional(),
      description: z.string().max(1000).optional(),
    }).refine((body) => body.name !== undefined || body.description !== undefined, { message: 'No group fields to update' }),
  })),
  asyncHandler(controller.update),
);
router.delete(
  '/:id',
  validate(z.object({ params: z.object({ id: z.coerce.number().int().positive() }) })),
  asyncHandler(controller.remove),
);
router.post(
  '/join',
  validate(z.object({ body: z.object({ inviteCode: z.string().min(1).max(32).optional(), invite_code: z.string().min(1).max(32).optional() }).refine((body) => body.inviteCode || body.invite_code, { message: 'Missing invite code' }) })),
  asyncHandler(controller.join),
);
router.post(
  '/:id/leave',
  validate(z.object({ params: z.object({ id: z.coerce.number().int().positive() }) })),
  asyncHandler(controller.leave),
);
router.post(
  '/:id/kick',
  validate(z.object({
    params: z.object({ id: z.coerce.number().int().positive() }),
    body: z.object({
      userId: z.coerce.number().int().positive().optional(),
      user_id: z.coerce.number().int().positive().optional(),
    }).refine((body) => body.userId || body.user_id, { message: 'Missing user id' }),
  })),
  asyncHandler(controller.kick),
);

module.exports = router;
