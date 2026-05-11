const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const email = z.string().email().max(191).transform((value) => value.toLowerCase());
const password = z.string().min(8).max(128);

router.post('/register', validate(z.object({ body: z.object({ name: z.string().min(1).max(120), email, password, teamId: z.coerce.number().int().positive().optional() }) })), asyncHandler(controller.register));
router.post('/login', validate(z.object({ body: z.object({ email, password }) })), asyncHandler(controller.login));
router.post('/refresh-token', validate(z.object({ body: z.object({ refreshToken: z.string().min(1) }) })), asyncHandler(controller.refreshToken));
router.post('/logout', auth, asyncHandler(controller.logout));
router.get('/me', auth, asyncHandler(controller.me));

module.exports = router;
