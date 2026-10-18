const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const { googleLinkLimiter } = require('../middlewares/rateLimit.middleware');
const { normalizeJobTitle, normalizeDepartment } = require('../config/employeeProfile');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const email = z.string().trim().min(1).max(191).transform((value) => value.toLowerCase());
const loginIdentifier = z.string().trim().min(1).max(191);
const loginPassword = z.string().min(1).max(128);
const registerPassword = z.string().min(1).max(128);
const employeeProfile = z.object({
  name: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().transform(normalizeJobTitle).refine(Boolean, 'Chức danh không hợp lệ'),
  department: z.string().trim().transform(normalizeDepartment).refine(Boolean, 'Phòng ban không hợp lệ'),
});

router.post('/register', validate(z.object({ body: z.object({ name: z.string().trim().min(1).max(120), email, password: registerPassword, teamId: z.coerce.number().int().positive().optional() }) })), asyncHandler(controller.register));
router.post('/login', validate(z.object({ body: z.object({ email: loginIdentifier, password: loginPassword }) })), asyncHandler(controller.login));
router.get('/google', asyncHandler(controller.startGoogle));
router.get('/google/callback', asyncHandler(controller.googleCallback));
router.post('/google/exchange', validate(z.object({ body: z.object({ ticket: z.string().min(1).max(64) }) })), asyncHandler(controller.exchangeGoogleTicket));
router.post('/google/link', googleLinkLimiter, validate(z.object({ body: z.object({ ticket: z.string().min(1).max(64), password: loginPassword }) })), asyncHandler(controller.linkGoogleAccount));
router.post('/refresh-token', validate(z.object({ body: z.object({ refreshToken: z.string().min(1) }) })), asyncHandler(controller.refreshToken));
router.post('/logout', auth, asyncHandler(controller.logout));
router.get('/me', auth, asyncHandler(controller.me));
router.patch('/me', auth, validate(z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    jobTitle: z.string().trim().transform(normalizeJobTitle).refine(Boolean, 'Chức danh không hợp lệ').optional(),
    department: z.string().trim().transform(normalizeDepartment).refine(Boolean, 'Phòng ban không hợp lệ').optional(),
  }).refine((body) => Object.keys(body).length > 0),
})), asyncHandler(controller.updateMe));
router.patch('/password', auth, validate(z.object({
  body: z.object({
    currentPassword: z.string().min(1).max(128),
    newPassword: z.string().min(1).max(128),
  }),
})), asyncHandler(controller.changePassword));

router.patch('/email', auth, validate(z.object({
  body: z.object({
    newEmail: z.string().trim().email('Định dạng email không hợp lệ').min(5).max(191).transform((val) => val.toLowerCase()),
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
  }),
})), asyncHandler(controller.changeEmail));
router.post('/email', auth, validate(z.object({
  body: z.object({
    newEmail: z.string().trim().email('Định dạng email không hợp lệ').min(5).max(191).transform((val) => val.toLowerCase()),
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
  }),
})), asyncHandler(controller.changeEmail));
router.post('/change-email', auth, validate(z.object({
  body: z.object({
    newEmail: z.string().trim().email('Định dạng email không hợp lệ').min(5).max(191).transform((val) => val.toLowerCase()),
    currentPassword: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại').max(128),
  }),
})), asyncHandler(controller.changeEmail));

router.delete('/me/account', auth, asyncHandler(controller.deleteMe));
router.post('/me/delete', auth, asyncHandler(controller.deleteMe));

module.exports = router;
