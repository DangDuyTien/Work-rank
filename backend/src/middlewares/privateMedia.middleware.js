'use strict';

/**
 * PRIVATE MEDIA — AUTHORIZATION MIDDLEWARE
 *
 * Every `/api/private-media/*` route passes through `requirePrivateMedia`.
 * There is no role check in this file and no admin shortcut: an `admin` or
 * "super admin" account with no grant is treated exactly like a stranger.
 *
 * Denials use 404 (concealment policy): an unauthorized caller must not be able
 * to tell this capability apart from a route that does not exist.
 */

const rateLimit = require('express-rate-limit');
const accessService = require('../services/privateMedia/access.service');

const NOT_FOUND_BODY = { message: 'Not found', code: 'NOT_FOUND' };

function deny(res) {
  return res.status(404).json(NOT_FOUND_BODY);
}

/**
 * @param {'view'|'control'|'telegram'|'hotkey'|'manage_access'} permission
 */
function requirePrivateMedia(permission = 'view') {
  return async function privateMediaGate(req, res, next) {
    try {
      if (!req.user) return deny(res);

      const entitlement = await accessService.getEntitlement(req.user.id);
      if (!accessService.hasPermission(entitlement, permission)) {
        // A denied actor still produces an audit trail — but only for actors who
        // actually authenticated, never for anonymous probing.
        if (entitlement) {
          const audit = require('../services/privateMedia/audit.service');
          audit.record({
            action: 'ACCESS_DENIED',
            actorUserId: req.user.id,
            source: 'WEB',
            metadata: { permission, path: req.originalUrl?.split('?')[0] },
          });
        }
        return deny(res);
      }

      req.privateMedia = entitlement;
      return next();
    } catch (error) {
      // Fail closed, always.
      console.error('[private-media] gate error (fail-closed):', error.message);
      return deny(res);
    }
  };
}

/** Brute-force guard for one-time pairing codes. */
const privateMediaPairingLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({ message: 'Bạn đã thử ghép nối quá nhiều lần. Vui lòng thử lại sau ít phút.', code: 'PAIRING_RATE_LIMITED' });
  },
});

/** Guard for control commands (Telegram callbacks / device hotkeys are separate). */
const privateMediaCommandLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: true,
  legacyHeaders: false,
  handler(req, res) {
    res.status(429).json({ message: 'Quá nhiều lệnh điều khiển. Vui lòng thử lại.', code: 'COMMAND_RATE_LIMITED' });
  },
});

module.exports = { requirePrivateMedia, privateMediaPairingLimiter, privateMediaCommandLimiter, NOT_FOUND_BODY };
