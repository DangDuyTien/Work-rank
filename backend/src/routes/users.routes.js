const express = require('express');
const controller = require('../controllers/users.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.use(auth);
router.get('/', asyncHandler(controller.list));
router.get('/:id/profile-preferences', asyncHandler(controller.getProfilePreferences));
router.patch('/:id/profile-preferences', asyncHandler(controller.updateProfilePreferences));
router.get('/:id/profile-likes', asyncHandler(controller.getProfileLikes));
router.post('/:id/profile-likes', asyncHandler(controller.likeProfile));
router.get('/:id/gallery', asyncHandler(controller.gallery));
router.put('/:id/gallery/:slot', asyncHandler(controller.updateGalleryImage));
router.delete('/:id/gallery/:slot', asyncHandler(controller.removeGalleryImage));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', requireRole('admin'), asyncHandler(controller.create));
router.patch('/:id', requireRole('admin'), asyncHandler(controller.update));
router.delete('/:id', requireRole('admin'), asyncHandler(controller.remove));

module.exports = router;
