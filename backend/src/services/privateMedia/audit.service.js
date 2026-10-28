'use strict';

/**
 * PRIVATE MEDIA — AUDIT
 *
 * Append-only record of who did what to this capability. Secrets are stripped
 * defensively even if a caller accidentally passes them: a bot token or device
 * token must never reach the audit table (or the log stream).
 */

const { PrivateMediaAuditLog, User } = require('../../models');

const SECRET_KEY_PATTERN = /(token|secret|password|code|hash|authorization|cookie)/i;

function sanitizeMetadata(value, depth = 0) {
  if (value == null) return value;
  if (depth > 3) return '[depth-limit]';
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, item] of Object.entries(value)) {
      if (SECRET_KEY_PATTERN.test(key)) {
        out[key] = '[redacted]';
        continue;
      }
      out[key] = sanitizeMetadata(item, depth + 1);
    }
    return out;
  }
  if (typeof value === 'string' && value.length > 500) return `${value.slice(0, 500)}…`;
  return value;
}

/**
 * Best-effort write. An audit failure must never break a control command, but
 * it is logged loudly so the gap is visible in operations.
 */
async function record({ action, actorUserId = null, targetUserId = null, source = 'WEB', metadata = null }) {
  try {
    await PrivateMediaAuditLog.create({
      action: String(action).slice(0, 48),
      actorUserId: actorUserId ? Number(actorUserId) : null,
      targetUserId: targetUserId ? Number(targetUserId) : null,
      source: ['WEB', 'TELEGRAM', 'HOTKEY', 'SYSTEM'].includes(source) ? source : 'SYSTEM',
      metadata: metadata ? sanitizeMetadata(metadata) : null,
    });
  } catch (error) {
    console.error('[private-media] audit write failed:', action, error.message);
  }
}

async function list({ limit = 50, action = null } = {}) {
  const where = {};
  if (action) where.action = action;

  const rows = await PrivateMediaAuditLog.findAll({
    where,
    order: [['createdAt', 'DESC']],
    limit: Math.min(Number(limit) || 50, 200),
  });

  const userIds = new Set();
  rows.forEach((row) => {
    if (row.actorUserId) userIds.add(Number(row.actorUserId));
    if (row.targetUserId) userIds.add(Number(row.targetUserId));
  });

  let nameById = new Map();
  if (userIds.size) {
    const users = await User.findAll({
      where: { id: [...userIds] },
      attributes: ['id', 'name', 'email'],
    });
    nameById = new Map(users.map((user) => [Number(user.id), user]));
  }

  const decorate = (id) => {
    if (!id) return null;
    const user = nameById.get(Number(id));
    return user ? { id: Number(id), name: user.name, email: user.email } : { id: Number(id), name: null, email: null };
  };

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    source: row.source,
    metadata: row.metadata || null,
    createdAt: row.createdAt,
    actor: decorate(row.actorUserId),
    target: decorate(row.targetUserId),
  }));
}

module.exports = { record, list, sanitizeMetadata };
