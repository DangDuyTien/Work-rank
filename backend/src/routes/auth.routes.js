const express = require('express');
const { z } = require('zod');
const controller = require('../controllers/auth.controller');
const validate = require('../middlewares/validate.middleware');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
const email = z.string().trim().min(1).max(191).transform((value) => value.toLowerCase());
const loginIdentifier = z.string().trim().min(1).max(191);
const loginPassword = z.string().min(1).max(128);
const registerPassword = z.string().min(1).max(128);

router.post('/register', validate(z.object({ body: z.object({ name: z.string().trim().min(1).max(120), email, password: registerPassword, teamId: z.coerce.number().int().positive().optional() }) })), asyncHandler(controller.register));
router.post('/login', validate(z.object({ body: z.object({ email: loginIdentifier, password: loginPassword }) })), asyncHandler(controller.login));
router.post('/refresh-token', validate(z.object({ body: z.object({ refreshToken: z.string().min(1) }) })), asyncHandler(controller.refreshToken));
router.post('/logout', auth, asyncHandler(controller.logout));
router.get('/me', auth, asyncHandler(controller.me));
router.patch('/me', auth, validate(z.object({
  body: z.object({
    name: z.string().trim().min(1).max(120),
  }),
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
