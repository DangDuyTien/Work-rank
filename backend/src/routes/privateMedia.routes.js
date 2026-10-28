'use strict';

/**
 * PRIVATE MEDIA ROUTES
 *
 * Mounted at /api/private-media. The module is intentionally small and fully
 * self-contained: adding it (or deleting it) never touches another feature.
 *
 * Authorization order:
 *   /device/commands  -> device token (Mac helper hotkey path)
 *   everything else   -> Work Rank JWT + requirePrivateMedia(permission)
 *
 * Unauthorized callers receive 404, not 403: the capability is concealed.
 */

const express = require('express');
const controller = require('../controllers/privateMedia.controller');
const { auth } = require('../middlewares/auth.middleware');
const {
  requirePrivateMedia,
  privateMediaPairingLimiter,
  privateMediaCommandLimiter,
} = require('../middlewares/privateMedia.middleware');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

// ── Device hotkey path (no user session; scoped device token) ───────────────
router.post('/device/commands', privateMediaCommandLimiter, asyncHandler(controller.deviceCommand));

// Mac helper exchanges a one-time pairing code for a device token.
router.post('/devices/pair', privateMediaPairingLimiter, asyncHandler(controller.pairDevice));

// ── Everything below requires an authenticated Work Rank session ────────────
router.use(auth);

router.get('/access', requirePrivateMedia('view'), asyncHandler(controller.getAccess));
router.get('/status', requirePrivateMedia('view'), asyncHandler(controller.getStatus));
router.get('/session', requirePrivateMedia('view'), asyncHandler(controller.getSessionState));

// Player control
router.post('/commands', requirePrivateMedia('control'), privateMediaCommandLimiter, asyncHandler(controller.issueCommand));
router.get('/commands/recent', requirePrivateMedia('view'), asyncHandler(controller.recentCommands));
router.get('/recent', requirePrivateMedia('view'), asyncHandler(controller.recentVideos));

// YouTube lookup (official Data API; link resolution works without a key)
router.get('/youtube/search', requirePrivateMedia('view'), asyncHandler(controller.searchYouTube));
router.post('/youtube/resolve', requirePrivateMedia('view'), asyncHandler(controller.resolveYouTube));

// Access management — owner only, no delegation of this permission
router.get('/grants', requirePrivateMedia('manage_access'), asyncHandler(controller.listGrants));
router.post('/grants', requirePrivateMedia('manage_access'), asyncHandler(controller.createGrant));
router.delete('/grants/:userId', requirePrivateMedia('manage_access'), asyncHandler(controller.revokeGrant));
router.get('/users/search', requirePrivateMedia('manage_access'), asyncHandler(controller.searchUsers));

// Telegram binding
router.get('/telegram', requirePrivateMedia('view'), asyncHandler(controller.getTelegram));
router.post('/telegram/code', requirePrivateMedia('telegram'), privateMediaPairingLimiter, asyncHandler(controller.createTelegramCode));
router.delete('/telegram', requirePrivateMedia('telegram'), asyncHandler(controller.unbindTelegram));

// Mac helper devices
router.get('/devices', requirePrivateMedia('hotkey'), asyncHandler(controller.listDevices));
router.post('/devices/code', requirePrivateMedia('hotkey'), privateMediaPairingLimiter, asyncHandler(controller.createDeviceCode));
router.delete('/devices/:id', requirePrivateMedia('hotkey'), asyncHandler(controller.revokeDevice));

// Audit — owner only
router.get('/audit', requirePrivateMedia('manage_access'), asyncHandler(controller.listAudit));

module.exports = router;
