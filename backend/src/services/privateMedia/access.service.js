'use strict';

/**
 * PRIVATE MEDIA — ACCESS CONTROL SERVICE
 *
 * The single source of truth for "may this Work Rank account touch Private
 * Media?". Design constraints that are enforced here, not in callers:
 *
 *  1. `users.role` is NEVER read. admin / super admin / manager / team owner
 *     have zero implicit authority over this capability.
 *  2. The only two ways in are:
 *        private_media_owners row (bootstrap root owner)
 *        OR a non-revoked private_media_grants row (explicit delegation).
 *  3. Fail closed. Any error resolving the owner or the grant is a DENY.
 *  4. Only the owner may write grants. There is no API that can transfer
 *     ownership; changing the owner requires a database/ops decision.
 */

const crypto = require('crypto');
const env = require('../../config/env');
const {
  User,
  PrivateMediaOwner,
  PrivateMediaGrant,
  PrivateMediaDevice,
  PrivateMediaTelegramBinding,
} = require('../../models');

const OWNER_CACHE_TTL_MS = 30_000;
const PERMISSION_KEYS = ['canView', 'canControl', 'canTelegram', 'canHotkey'];

let ownerCache = { userId: null, at: 0 };

function denyAll() {
  return null;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function ownerEmailFromConfig() {
  return normalizeEmail(env.privateMedia?.bootstrapOwnerEmail || '');
}

function invalidateOwnerCache() {
  ownerCache = { userId: null, at: 0 };
}

/**
 * Resolve the canonical owner user id.
 *
 * Bootstrap happens at most once: the configured email is looked up, and the
 * resulting user id is persisted. After that the email is irrelevant — deleting
 * or renaming the account does not hand ownership to anybody else.
 *
 * @returns {Promise<number|null>} owner user id, or null when unresolvable
 */
async function resolveOwnerUserId({ force = false } = {}) {
  const now = Date.now();
  if (!force && ownerCache.userId && now - ownerCache.at < OWNER_CACHE_TTL_MS) {
    return ownerCache.userId;
  }

  const existing = await PrivateMediaOwner.findOne({ order: [['id', 'ASC']] });
  if (existing) {
    const owner = await User.findByPk(existing.userId, { attributes: ['id', 'status'] });
    if (!owner || owner.status !== 'active') {
      // Fail closed: a disabled/deleted owner does not promote anybody.
      ownerCache = { userId: null, at: now };
      return null;
    }
    ownerCache = { userId: Number(existing.userId), at: now };
    return ownerCache.userId;
  }

  const email = ownerEmailFromConfig();
  if (!email) {
    ownerCache = { userId: null, at: now };
    return null;
  }

  const bootstrapUser = await User.findOne({ where: { email }, attributes: ['id', 'status'] });
  if (!bootstrapUser || bootstrapUser.status !== 'active') {
    ownerCache = { userId: null, at: now };
    return null;
  }

  // Idempotent bootstrap: concurrent calls race on the unique user_id index.
  try {
    await PrivateMediaOwner.create({
      userId: bootstrapUser.id,
      bootstrapEmail: email,
    });
  } catch (error) {
    if (error?.name !== 'SequelizeUniqueConstraintError') throw error;
  }

  ownerCache = { userId: Number(bootstrapUser.id), at: now };
  return ownerCache.userId;
}

function emptyEntitlement(isOwner = false) {
  return {
    isOwner,
    canView: isOwner,
    canControl: isOwner,
    canTelegram: isOwner,
    canHotkey: isOwner,
    canManageAccess: isOwner,
    grantId: null,
    revokedAt: null,
  };
}

/**
 * Resolve what a user is allowed to do. Returns `null` for "no access at all".
 * Never throws: an internal failure is a deny, not an allow.
 *
 * @param {number|string} userId
 * @returns {Promise<null|object>}
 */
async function getEntitlement(userId) {
  try {
    const numericUserId = Number(userId);
    if (!numericUserId) return denyAll();

    const ownerUserId = await resolveOwnerUserId();
    if (ownerUserId && ownerUserId === numericUserId) {
      return emptyEntitlement(true);
    }

    const grant = await PrivateMediaGrant.findOne({
      where: { userId: numericUserId, revokedAt: null },
    });
    if (!grant) return denyAll();

    // A grant without view is a contradiction; treat it as no access.
    if (!grant.canView) return denyAll();

    return {
      isOwner: false,
      canView: Boolean(grant.canView),
      canControl: Boolean(grant.canControl),
      canTelegram: Boolean(grant.canTelegram),
      canHotkey: Boolean(grant.canHotkey),
      canManageAccess: false,
      grantId: grant.id,
      revokedAt: grant.revokedAt,
    };
  } catch (error) {
    console.error('[private-media] entitlement resolution failed (fail-closed):', error.message);
    return denyAll();
  }
}

async function isOwner(userId) {
  try {
    const ownerUserId = await resolveOwnerUserId();
    return Boolean(ownerUserId) && Number(ownerUserId) === Number(userId);
  } catch {
    return false;
  }
}

/**
 * Public entitlement payload for the frontend. Deliberately minimal: no ids of
 * other users, no tokens, no internal flags.
 */
function toPublicEntitlement(entitlement) {
  if (!entitlement) return { entitled: false };
  return {
    entitled: true,
    isOwner: Boolean(entitlement.isOwner),
    permissions: {
      view: Boolean(entitlement.canView),
      control: Boolean(entitlement.canControl),
      telegram: Boolean(entitlement.canTelegram),
      hotkey: Boolean(entitlement.canHotkey),
      manageAccess: Boolean(entitlement.canManageAccess),
    },
  };
}

function normalizePermissions(input = {}) {
  const permissions = {
    canView: input.view !== false,
    canControl: Boolean(input.control),
    canTelegram: Boolean(input.telegram),
    canHotkey: Boolean(input.hotkey),
  };
  // Control surfaces imply the ability to see the session they act on.
  if (permissions.canControl || permissions.canTelegram || permissions.canHotkey) {
    permissions.canView = true;
  }
  if (!permissions.canView) {
    permissions.canControl = false;
    permissions.canTelegram = false;
    permissions.canHotkey = false;
  }
  return permissions;
}

class PrivateMediaAccessError extends Error {
  constructor(code, message, status = 403) {
    super(message || code);
    this.name = 'PrivateMediaAccessError';
    this.code = code;
    this.status = status;
  }
}

async function requireOwnerActor(actorUserId) {
  const owner = await isOwner(actorUserId);
  if (!owner) {
    // Concealment: the caller must not learn that this capability exists.
    throw new PrivateMediaAccessError('NOT_FOUND', 'Not found', 404);
  }
  return true;
}

async function grantAccess({ actorUserId, targetUserId, permissions, note }) {
  await requireOwnerActor(actorUserId);

  const target = Number(targetUserId);
  if (!target) throw new PrivateMediaAccessError('INVALID_TARGET', 'Người dùng không hợp lệ', 400);

  const ownerUserId = await resolveOwnerUserId();
  if (ownerUserId && ownerUserId === target) {
    throw new PrivateMediaAccessError('OWNER_IS_IMPLICIT', 'Chủ sở hữu đã có toàn quyền', 400);
  }

  const user = await User.findByPk(target, { attributes: ['id', 'status', 'name', 'email'] });
  if (!user || user.status !== 'active') {
    throw new PrivateMediaAccessError('INVALID_TARGET', 'Không tìm thấy người dùng đang hoạt động', 404);
  }

  const normalized = normalizePermissions(permissions);
  const existing = await PrivateMediaGrant.findOne({ where: { userId: target } });

  let grant;
  if (existing) {
    await existing.update({
      ...normalized,
      grantedByUserId: actorUserId,
      note: note ? String(note).slice(0, 191) : null,
      revokedAt: null,
    });
    grant = existing;
  } else {
    grant = await PrivateMediaGrant.create({
      userId: target,
      grantedByUserId: actorUserId,
      note: note ? String(note).slice(0, 191) : null,
      ...normalized,
    });
  }

  return { grant, user };
}

async function revokeAccess({ actorUserId, targetUserId, reason }) {
  await requireOwnerActor(actorUserId);

  const target = Number(targetUserId);
  const ownerUserId = await resolveOwnerUserId();
  if (ownerUserId && ownerUserId === target) {
    throw new PrivateMediaAccessError('CANNOT_REVOKE_OWNER', 'Không thể thu hồi quyền của chủ sở hữu', 400);
  }

  const grant = await PrivateMediaGrant.findOne({ where: { userId: target } });
  if (!grant) {
    throw new PrivateMediaAccessError('GRANT_NOT_FOUND', 'Người dùng này chưa được cấp quyền', 404);
  }

  await grant.update({ revokedAt: new Date() });

  // Revocation is not just a flag on the grant: every derived credential dies
  // with it, so a previously paired helper or Telegram chat stops working on
  // the very next command.
  const now = new Date();
  await PrivateMediaDevice.update(
    { revokedAt: now },
    { where: { userId: target, revokedAt: null } },
  );
  await PrivateMediaTelegramBinding.update(
    { revokedAt: now },
    { where: { userId: target, revokedAt: null } },
  );

  return { grant, reason: reason ? String(reason).slice(0, 191) : null };
}

async function listGrants() {
  const rows = await PrivateMediaGrant.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'avatarUrl', 'jobTitle'], required: false }],
    order: [['createdAt', 'DESC']],
    limit: 500,
  });
  const ownerUserId = await resolveOwnerUserId();

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    isOwner: Number(row.userId) === Number(ownerUserId),
    active: !row.revokedAt,
    permissions: {
      view: row.canView,
      control: row.canControl,
      telegram: row.canTelegram,
      hotkey: row.canHotkey,
    },
    note: row.note,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
    user: row.user
      ? { id: row.user.id, name: row.user.name, email: row.user.email, avatarUrl: row.user.avatarUrl, jobTitle: row.user.jobTitle }
      : null,
  }));
}

/**
 * Owner-only people search for the access-management panel.
 * Returns only fields needed to disambiguate a person.
 */
async function searchUsers(query, { limit = 12 } = {}) {
  const { Op } = require('sequelize');
  const term = String(query || '').trim();
  if (term.length < 2) return [];

  const like = `%${term}%`;
  const rows = await User.findAll({
    where: {
      status: 'active',
      [Op.or]: [{ name: { [Op.like]: like } }, { email: { [Op.like]: like } }],
    },
    attributes: ['id', 'name', 'email', 'avatarUrl', 'jobTitle', 'role'],
    order: [['name', 'ASC']],
    limit: Math.min(Number(limit) || 12, 25),
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    jobTitle: row.jobTitle,
    // Presentational only. The UI never branches on this for authorization.
    role: row.role,
  }));
}

/**
 * Permission gate used by HTTP middleware and socket handlers.
 * Returns a denial code instead of throwing so callers can map it to 404.
 */
function hasPermission(entitlement, permission) {
  if (!entitlement) return false;
  switch (permission) {
    case 'view': return Boolean(entitlement.canView);
    case 'control': return Boolean(entitlement.canControl);
    case 'telegram': return Boolean(entitlement.canTelegram && entitlement.canControl);
    case 'hotkey': return Boolean(entitlement.canHotkey && entitlement.canControl);
    case 'manage_access': return Boolean(entitlement.canManageAccess && entitlement.isOwner);
    default: return false;
  }
}

function randomCode(length = 8) {
  // Human-transcribable alphabet: no 0/O, 1/I/L.
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

module.exports = {
  PERMISSION_KEYS,
  PrivateMediaAccessError,
  normalizeEmail,
  resolveOwnerUserId,
  invalidateOwnerCache,
  getEntitlement,
  isOwner,
  toPublicEntitlement,
  normalizePermissions,
  grantAccess,
  revokeAccess,
  listGrants,
  searchUsers,
  hasPermission,
  randomCode,
  ownerEmailFromConfig,
};
