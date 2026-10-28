'use strict';

/**
 * PRIVATE MEDIA — DEVICE REGISTRY (macOS helper)
 *
 * A device token is a bearer credential, so it is treated like a password:
 * random 32 bytes, only the SHA-256 hash is stored, it expires with the grant,
 * and it can be revoked individually. There is no unauthenticated local
 * endpoint anywhere in this design — the helper always talks to the backend.
 */

const crypto = require('crypto');
const { PrivateMediaDevice } = require('../../models');
const { hashSecret } = require('../../utils/crypto');
const pairing = require('./pairing.service');

const TOKEN_PREFIX = 'pmd_';
const LAST_SEEN_THROTTLE_MS = 30_000;

function mintToken() {
  return `${TOKEN_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

async function createPairingCode({ userId, label }) {
  return pairing.createCode({ userId, purpose: pairing.PURPOSES.DEVICE, label });
}

/**
 * Exchange a one-time code for a device token. Returns the plaintext token ONCE.
 */
async function pairDevice({ code, name, platform = 'macos' }) {
  const consumed = await pairing.consumeCode({ code, purpose: pairing.PURPOSES.DEVICE });
  if (!consumed) return null;

  const token = mintToken();
  const device = await PrivateMediaDevice.create({
    userId: consumed.userId,
    name: String(name || consumed.label || 'Mac Helper').slice(0, 120),
    platform: String(platform || 'macos').slice(0, 32),
    tokenHash: hashSecret(token),
    tokenPrefix: token.slice(0, 12),
  });

  return { device, token, userId: consumed.userId };
}

/**
 * Resolve a device token to its owning user. Returns null for unknown/revoked.
 * Never throws: an infrastructure failure must not authenticate anybody.
 */
async function authenticateToken(token) {
  try {
    const raw = String(token || '').trim();
    if (!raw.startsWith(TOKEN_PREFIX)) return null;

    const device = await PrivateMediaDevice.findOne({ where: { tokenHash: hashSecret(raw) } });
    if (!device) return null;
    if (device.revokedAt) return null;

    const now = Date.now();
    const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    if (now - lastSeen > LAST_SEEN_THROTTLE_MS) {
      PrivateMediaDevice.update({ lastSeenAt: new Date() }, { where: { id: device.id } }).catch(() => {});
    }

    return device;
  } catch (error) {
    console.error('[private-media] device auth failed (fail-closed):', error.message);
    return null;
  }
}

async function listDevices(userId) {
  const rows = await PrivateMediaDevice.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    platform: row.platform,
    tokenPrefix: row.tokenPrefix,
    active: !row.revokedAt,
    createdAt: row.createdAt,
    lastSeenAt: row.lastSeenAt,
    revokedAt: row.revokedAt,
  }));
}

async function revokeDevice({ userId, deviceId }) {
  const device = await PrivateMediaDevice.findOne({ where: { id: deviceId, userId } });
  if (!device) return null;
  if (!device.revokedAt) await device.update({ revokedAt: new Date() });
  return device;
}

async function revokeAllForUser(userId) {
  return PrivateMediaDevice.update({ revokedAt: new Date() }, { where: { userId, revokedAt: null } });
}

module.exports = {
  TOKEN_PREFIX,
  createPairingCode,
  pairDevice,
  authenticateToken,
  listDevices,
  revokeDevice,
  revokeAllForUser,
};
