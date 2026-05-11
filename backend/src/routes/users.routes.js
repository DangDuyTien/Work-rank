const express = require('express');
const controller = require('../controllers/users.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(auth);
router.get('/', asyncHandler(controller.list));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', requireRole('admin'), asyncHandler(controller.create));
router.patch('/:id', requireRole('admin'), asyncHandler(controller.update));
router.delete('/:id', requireRole('admin'), asyncHandler(controller.remove));

module.exports = router;
