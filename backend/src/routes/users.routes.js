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
router.get('/:id/recognitions', asyncHandler(controller.getRecognitions));
router.post('/admin/recognitions/mvp', requireRole('admin'), asyncHandler(controller.adminAwardMVP));
router.delete('/admin/recognitions/:id', requireRole('admin'), asyncHandler(controller.adminRevokeMVP));
router.post('/admin/recognitions/champion', requireRole('admin'), asyncHandler(controller.adminAwardChampion));
router.patch('/admin/users/:id/job-profile', requireRole('admin'), asyncHandler(controller.adminUpdateJobProfile));
router.get('/admin/recognitions/audit-logs', requireRole('admin'), asyncHandler(controller.adminGetAuditLogs));
router.get('/:id', asyncHandler(controller.getById));
router.post('/', requireRole('admin'), asyncHandler(controller.create));
router.patch('/:id/profile', asyncHandler(controller.update));
router.patch('/:id', asyncHandler(controller.update));
router.delete('/:id', requireRole('admin'), asyncHandler(controller.remove));

module.exports = router;
