'use strict';

/**
 * PRIVATE MEDIA — ONE-TIME PAIRING CODES
 *
 * Used by both flows:
 *   TELEGRAM : web UI generates a code -> user sends it to the bot -> binding
 *   DEVICE   : web UI generates a code -> Mac helper exchanges it for a token
 *
 * Codes are short, single-use, expiring, and stored as SHA-256 hashes only.
 */

const env = require('../../config/env');
const { PrivateMediaPairingCode } = require('../../models');
const { hashSecret } = require('../../utils/crypto');
const { randomCode } = require('./access.service');

const PURPOSES = Object.freeze({ TELEGRAM: 'TELEGRAM', DEVICE: 'DEVICE' });

function ttlMs() {
  const configured = Number(env.privateMedia?.pairingCodeTtlMs);
  return Number.isFinite(configured) && configured > 0 ? configured : 10 * 60 * 1000;
}

/**
 * Invalidate any live code of the same purpose for this user, then mint a new one.
 * Only the plaintext is returned — it is never persisted or logged.
 */
async function createCode({ userId, purpose, label = null }) {
  const normalizedPurpose = String(purpose || '').toUpperCase();
  if (!PURPOSES[normalizedPurpose]) throw new Error('INVALID_PAIRING_PURPOSE');

  const now = new Date();
  await PrivateMediaPairingCode.update(
    { usedAt: now },
    { where: { userId, purpose: normalizedPurpose, usedAt: null } },
  );

  const code = randomCode(8);
  const expiresAt = new Date(Date.now() + ttlMs());
  await PrivateMediaPairingCode.create({
    codeHash: hashSecret(code),
    purpose: normalizedPurpose,
    userId,
    label: label ? String(label).slice(0, 120) : null,
    expiresAt,
  });

  return { code, expiresAt, expiresInSeconds: Math.round(ttlMs() / 1000) };
}

/**
 * Consume a code atomically-ish: the conditional UPDATE on `usedAt: null`
 * guarantees only one caller can win, even with concurrent submissions.
 *
 * @returns {Promise<{userId:number, label:string|null}|null>}
 */
async function consumeCode({ code, purpose }) {
  const normalized = String(code || '').trim().toUpperCase();
  if (!normalized) return null;

  const normalizedPurpose = String(purpose || '').toUpperCase();
  const row = await PrivateMediaPairingCode.findOne({
    where: { codeHash: hashSecret(normalized), purpose: normalizedPurpose },
  });
  if (!row) return null;
  if (row.usedAt) return null;
  if (new Date(row.expiresAt).getTime() < Date.now()) return null;

  const [updated] = await PrivateMediaPairingCode.update(
    { usedAt: new Date() },
    { where: { id: row.id, usedAt: null } },
  );
  if (updated !== 1) return null;

  return { userId: Number(row.userId), label: row.label || null };
}

async function purgeExpired() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await PrivateMediaPairingCode.destroy({ where: { expiresAt: { [require('sequelize').Op.lt]: cutoff } } });
}

module.exports = { PURPOSES, createCode, consumeCode, purgeExpired, ttlMs };
