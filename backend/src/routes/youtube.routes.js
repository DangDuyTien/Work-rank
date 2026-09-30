'use strict';

const express = require('express');
const router = express.Router();
const youtubeController = require('../controllers/youtube.controller');
const { auth, requireRole } = require('../middlewares/auth.middleware');

// Public / Shared Ranking Endpoint (Authenticated)
router.get('/leaderboard', auth, youtubeController.getLeaderboard);

// Member / Scoped Endpoints (Authenticated & Team Scoped)
router.get('/overview', auth, youtubeController.getOverview);
router.get('/my-team', auth, youtubeController.getMyTeam);
router.get('/teams/:teamId', auth, youtubeController.getTeamDetails);
router.get('/channels', auth, youtubeController.listChannels);
router.get('/channels/:id', auth, youtubeController.getChannelDetails);
router.get('/top-videos', auth, youtubeController.getTopVideos);
router.get('/compare', auth, youtubeController.compareTeams);

// Admin Endpoints (Auth + Admin Role)
router.get('/admin/overview', auth, requireRole('admin'), youtubeController.getAdminOverview);
router.get('/admin/channels', auth, requireRole('admin'), youtubeController.listAdminChannels);
router.post('/admin/channels', auth, requireRole('admin'), youtubeController.createAdminChannel);
router.patch('/admin/channels/:id/link', auth, requireRole('admin'), youtubeController.linkAdminChannel);
router.post('/admin/channels/:id/unlink', auth, requireRole('admin'), youtubeController.unlinkAdminChannel);
router.post('/admin/channels/:id/sync', auth, requireRole('admin'), youtubeController.syncAdminChannel);
router.post('/admin/sync-all', auth, requireRole('admin'), youtubeController.syncAllAdminChannels);
router.delete('/admin/channels/:id', auth, requireRole('admin'), youtubeController.deleteAdminChannel);
router.get('/admin/health', auth, requireRole('admin'), youtubeController.getAdminHealth);

module.exports = router;
