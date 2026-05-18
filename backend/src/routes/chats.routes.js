const express = require('express');
const controller = require('../controllers/chats.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(auth);
router.get('/unread-counts', asyncHandler(controller.unreadCounts));
router.get('/:friendId/messages', asyncHandler(controller.listMessages));
router.post('/:friendId/messages', asyncHandler(controller.sendMessage));
router.post('/:friendId/read', asyncHandler(controller.markRead));

module.exports = router;
