const express = require('express');
const controller = require('../controllers/leaderboard.controller');
const { auth } = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();
router.get('/public/weekly', asyncHandler(async (req, res) => {
  const service = require('../services/dashboard.service');
  const users = await service.leaderboard({ range: 'week', limit: 3 });
  const { Op } = require('sequelize');
  const { UserProfileImage, User, Team } = require('../models');
  const profiles = users.length ? await User.findAll({
    where: { id: { [Op.in]: users.map((u) => u.userId) } },
    attributes: ['id', 'jobTitle', 'department'],
    include: [{ model: Team, attributes: ['name'], required: false }],
  }) : [];
  const gallery = users.length ? await UserProfileImage.findAll({
    where: { userId: { [Op.in]: users.map((u) => u.userId) } },
    attributes: ['userId', 'imageData'], order: [['slot', 'ASC']], raw: true,
  }) : [];
  res.json({ items: users.map((u) => {
    const profile = profiles.find((p) => String(p.id) === String(u.userId));
    return {
    userId: u.userId, name: u.name, score: u.score, rank: u.rankPosition,
    avatarData: u.avatarData, isVerified: u.isVerified, mvpCount: u.mvpCount,
    galleryImages: gallery.filter((image) => String(image.userId) === String(u.userId)).map((image) => image.imageData).filter(Boolean),
    jobTitle: profile?.jobTitle || null,
    department: profile?.department || null,
    teamName: profile?.Team?.name || null,
  }; }) });
}));
router.get('/daily', auth, asyncHandler(controller.daily));
router.get('/weekly', auth, asyncHandler(controller.weekly));
router.get('/monthly', auth, asyncHandler(controller.monthly));
router.get('/yearly', auth, asyncHandler(controller.yearly));
router.get('/friends', auth, asyncHandler(controller.friends));
router.get('/team/:teamId', auth, asyncHandler(controller.team));

module.exports = router;
