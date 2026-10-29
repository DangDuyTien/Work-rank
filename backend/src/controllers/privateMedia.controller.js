'use strict';

/**
 * PRIVATE MEDIA — HTTP CONTROLLER
 *
 * Every handler here runs *after* `requirePrivateMedia(...)`, which is the only
 * place that decides access. Handlers never inspect `req.user.role`.
 */

const accessService = require('../services/privateMedia/access.service');
const sessionService = require('../services/privateMedia/session.service');
const realtime = require('../services/privateMedia/realtime.service');

/** Which playback session the caller is looking at: private (default) or the shared room. */
function roomOf(req) {
  return sessionService.normalizeRoom(req.get('x-pm-room'));
}
const deviceService = require('../services/privateMedia/device.service');
const telegramService = require('../services/privateMedia/telegram.service');
const youtubeService = require('../services/privateMedia/youtube.service');
const audit = require('../services/privateMedia/audit.service');

function fail(res, error, fallbackMessage = 'Không thực hiện được yêu cầu') {
  const status = Number(error?.status) || 500;
  const code = error?.code || 'ERROR';
  if (status >= 500) {
    console.error('[private-media] handler error:', error?.message);
  }
  return res.status(status).json({ message: error?.message || fallbackMessage, code });
}

/** GET /api/private-media/access — capability probe for UI rendering. */
async function getAccess(req, res) {
  return res.status(200).json(accessService.toPublicEntitlement(req.privateMedia));
}

/** GET /api/private-media/status — connection chips + capabilities. */
async function getStatus(req, res) {
  try {
    const isOwner = Boolean(req.privateMedia?.isOwner);
    const session = await sessionService.getSessionState(req.user.id, roomOf(req));

    let devices = [];
    if (accessService.hasPermission(req.privateMedia, 'hotkey')) {
      devices = await deviceService.listDevices(req.user.id);
    }

    let telegramBinding = null;
    if (accessService.hasPermission(req.privateMedia, 'telegram')) {
      telegramBinding = await telegramService.getBinding(req.user.id);
    }

    const telegramStatus = telegramService.getStatus();

    return res.status(200).json({
      session,
      player: {
        online: Boolean(session?.playerOnline),
        socketCount: realtime.playerCount(session?.sessionKey),
      },
      telegram: {
        // Bot configuration is not a secret; the token itself never appears here.
        enabled: telegramStatus.enabled,
        running: telegramStatus.running,
        botUsername: telegramStatus.botUsername,
        binding: telegramBinding,
      },
      devices,
      youtube: youtubeService.capabilities(),
      permissions: accessService.toPublicEntitlement(req.privateMedia).permissions,
      isOwner,
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/session */
async function getSessionState(req, res) {
  try {
    return res.status(200).json({ session: await sessionService.getSessionState(req.user.id, roomOf(req)) });
  } catch (error) {
    return fail(res, error);
  }
}

/** POST /api/private-media/commands */
async function issueCommand(req, res) {
  try {
    const { commandId, action, payload } = req.body || {};
    const result = await sessionService.issueCommand({
      commandId,
      action,
      source: 'WEB',
      actorUserId: req.user.id,
      payload: payload || {},
      room: roomOf(req),
    });

    if (!result.duplicate) {
      // Scoped to the caller's own playback session.
      realtime.broadcastCommand(result.command, result.state?.sessionKey);
      realtime.broadcastState(result.state);
    }

    return res.status(200).json(result);
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/youtube/search?q= */
async function searchYouTube(req, res) {
  try {
    const result = await youtubeService.search({ query: req.query.q, limit: req.query.limit });
    return res.status(200).json(result);
  } catch (error) {
    return fail(res, error);
  }
}

/** POST /api/private-media/youtube/resolve — { input } */
async function resolveYouTube(req, res) {
  try {
    const video = await youtubeService.resolveVideo(req.body?.input);
    return res.status(200).json({ video });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/grants — owner only. */
async function listGrants(req, res) {
  try {
    return res.status(200).json({ grants: await accessService.listGrants() });
  } catch (error) {
    return fail(res, error);
  }
}

/** POST /api/private-media/grants — owner only. */
async function createGrant(req, res) {
  try {
    const { userId, permissions, note } = req.body || {};
    const { grant, user } = await accessService.grantAccess({
      actorUserId: req.user.id,
      targetUserId: userId,
      permissions,
      note,
    });

    await audit.record({
      action: 'GRANT_ACCESS',
      actorUserId: req.user.id,
      targetUserId: grant.userId,
      source: 'WEB',
      metadata: {
        canView: grant.canView,
        canControl: grant.canControl,
        canTelegram: grant.canTelegram,
        canHotkey: grant.canHotkey,
      },
    });

    return res.status(200).json({
      grant: {
        id: grant.id,
        userId: grant.userId,
        permissions: {
          view: grant.canView,
          control: grant.canControl,
          telegram: grant.canTelegram,
          hotkey: grant.canHotkey,
        },
        user: { id: user.id, name: user.name, email: user.email },
      },
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** DELETE /api/private-media/grants/:userId — owner only. */
async function revokeGrant(req, res) {
  try {
    const targetUserId = Number(req.params.userId);
    const { grant } = await accessService.revokeAccess({
      actorUserId: req.user.id,
      targetUserId,
      reason: req.body?.reason,
    });

    // Cut every live credential immediately: sockets, devices, telegram chat.
    realtime.revokeUser(targetUserId, 'access-revoked');
    await telegramService.unbindUser(targetUserId);

    await audit.record({
      action: 'REVOKE_ACCESS',
      actorUserId: req.user.id,
      targetUserId,
      source: 'WEB',
      metadata: { reason: req.body?.reason || null },
    });

    return res.status(200).json({ revoked: true, userId: grant.userId });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/users/search?q= — owner only. */
async function searchUsers(req, res) {
  try {
    return res.status(200).json({ users: await accessService.searchUsers(req.query.q) });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/telegram */
async function getTelegram(req, res) {
  try {
    const status = telegramService.getStatus();
    const binding = await telegramService.getBinding(req.user.id);
    return res.status(200).json({
      enabled: status.enabled,
      running: status.running,
      botUsername: status.botUsername,
      binding,
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** POST /api/private-media/telegram/code */
async function createTelegramCode(req, res) {
  try {
    if (!telegramService.isEnabled()) {
      return res.status(503).json({
        message: 'Bot Telegram chưa được cấu hình trên máy chủ (TELEGRAM_BOT_TOKEN).',
        code: 'TELEGRAM_DISABLED',
      });
    }
    const result = await telegramService.createBindingCode(req.user.id);
    const status = telegramService.getStatus();
    return res.status(200).json({
      code: result.code,
      expiresInSeconds: result.expiresInSeconds,
      botUsername: status.botUsername,
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** DELETE /api/private-media/telegram */
async function unbindTelegram(req, res) {
  try {
    const binding = await telegramService.unbindUser(req.user.id);
    if (binding) {
      await audit.record({
        action: 'TELEGRAM_UNBOUND',
        actorUserId: req.user.id,
        targetUserId: req.user.id,
        source: 'WEB',
        metadata: { telegramUserId: binding.telegramUserId },
      });
    }
    return res.status(200).json({ unbound: Boolean(binding) });
  } catch (error) {
    return fail(res, error);
  }
}

/** POST /api/private-media/devices/code */
async function createDeviceCode(req, res) {
  try {
    const result = await deviceService.createPairingCode({
      userId: req.user.id,
      label: req.body?.label,
    });
    return res.status(200).json({
      code: result.code,
      expiresInSeconds: result.expiresInSeconds,
      helperCommand: `swift run WorkRankPrivateMediaHelper --pair ${result.code}`,
    });
  } catch (error) {
    return fail(res, error);
  }
}

/**
 * POST /api/private-media/devices/pair
 *
 * Called by the Mac helper, so there is no user JWT here. The one-time pairing
 * code IS the credential: single-use, 10-minute TTL, hashed at rest, and rate
 * limited. On success the plaintext device token is returned exactly once.
 */
async function pairDevice(req, res) {
  try {
    const { code, name, platform } = req.body || {};
    const paired = await deviceService.pairDevice({ code, name, platform });
    if (!paired) {
      return res.status(404).json({ message: 'Mã ghép nối không đúng hoặc đã hết hạn', code: 'PAIRING_CODE_INVALID' });
    }

    // The pairing code was minted for a specific user, but the grant may have
    // been revoked between minting and pairing. Re-check before issuing a token.
    const entitlement = await accessService.getEntitlement(paired.userId);
    if (!accessService.hasPermission(entitlement, 'hotkey')) {
      await deviceService.revokeDevice({ userId: paired.userId, deviceId: paired.device.id });
      return res.status(404).json({ message: 'Mã ghép nối không đúng hoặc đã hết hạn', code: 'PAIRING_CODE_INVALID' });
    }

    await audit.record({
      action: 'DEVICE_PAIRED',
      actorUserId: paired.userId,
      targetUserId: paired.userId,
      source: 'HOTKEY',
      metadata: { deviceId: paired.device.id, name: paired.device.name, platform: paired.device.platform },
    });

    return res.status(200).json({
      device: {
        id: paired.device.id,
        name: paired.device.name,
        platform: paired.device.platform,
      },
      deviceToken: paired.token,
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/devices */
async function listDevices(req, res) {
  try {
    return res.status(200).json({ devices: await deviceService.listDevices(req.user.id) });
  } catch (error) {
    return fail(res, error);
  }
}

/** DELETE /api/private-media/devices/:id */
async function revokeDevice(req, res) {
  try {
    const device = await deviceService.revokeDevice({
      userId: req.user.id,
      deviceId: Number(req.params.id),
    });
    if (!device) return res.status(404).json({ message: 'Không tìm thấy thiết bị', code: 'DEVICE_NOT_FOUND' });

    realtime.revokeDevice(device.id, 'device-revoked');
    await audit.record({
      action: 'DEVICE_REVOKED',
      actorUserId: req.user.id,
      targetUserId: req.user.id,
      source: 'WEB',
      metadata: { deviceId: device.id, name: device.name },
    });

    return res.status(200).json({ revoked: true, id: device.id });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/audit — owner only. */
async function listAudit(req, res) {
  try {
    const entries = await audit.list({ limit: req.query.limit, action: req.query.action });
    return res.status(200).json({ entries });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/commands/recent */
async function recentCommands(req, res) {
  try {
    return res.status(200).json({
      commands: await sessionService.recentCommands({ limit: req.query.limit, userId: req.user.id, room: roomOf(req) }),
    });
  } catch (error) {
    return fail(res, error);
  }
}

/** GET /api/private-media/recent — keyless quick replay list. */
async function recentVideos(req, res) {
  try {
    return res.status(200).json({
      videos: await sessionService.recentVideos({ limit: req.query.limit, userId: req.user.id, room: roomOf(req) }),
    });
  } catch (error) {
    return fail(res, error);
  }
}

/**
 * POST /api/private-media/device/commands
 *
 * Hotkey path. Authenticated by device token (never by a user JWT), scoped to
 * the device owner, and re-checked against the live entitlement on every call.
 */
async function deviceCommand(req, res) {
  try {
    // Header only: a token in the body would be far easier to leak into logs.
    const raw = req.headers['x-device-token'];
    const token = Array.isArray(raw) ? raw[0] : raw;
    const device = await deviceService.authenticateToken(token);
    if (!device) return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });

    const entitlement = await accessService.getEntitlement(device.userId);
    if (!accessService.hasPermission(entitlement, 'hotkey')) {
      return res.status(404).json({ message: 'Not found', code: 'NOT_FOUND' });
    }

    const { commandId, action, payload } = req.body || {};
    const result = await sessionService.issueCommand({
      commandId,
      action,
      source: 'HOTKEY',
      actorUserId: device.userId,
      payload: payload || {},
    });

    if (!result.duplicate) {
      // Scoped to the caller's own playback session.
      realtime.broadcastCommand(result.command, result.state?.sessionKey);
      realtime.broadcastState(result.state);
    }

    return res.status(200).json({
      ok: true,
      duplicate: result.duplicate,
      command: result.command,
      state: result.state,
    });
  } catch (error) {
    if (error?.code === 'NO_ACTIVE_MEDIA_SESSION') {
      // A hotkey press with no player must never look like a crash.
      return res.status(409).json({ ok: false, code: 'NO_ACTIVE_MEDIA_SESSION', message: error.message });
    }
    return fail(res, error);
  }
}

module.exports = {
  getAccess,
  getStatus,
  getSessionState,
  issueCommand,
  searchYouTube,
  resolveYouTube,
  listGrants,
  createGrant,
  revokeGrant,
  searchUsers,
  getTelegram,
  createTelegramCode,
  unbindTelegram,
  createDeviceCode,
  pairDevice,
  listDevices,
  revokeDevice,
  listAudit,
  recentCommands,
  recentVideos,
  deviceCommand,
};
