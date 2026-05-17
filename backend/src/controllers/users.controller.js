const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { Op } = require('sequelize');
const { User, UserProfileImage, UserProfilePreference } = require('../models');
const sanitizeUser = require('../utils/sanitizeUser');
const { decorateUserPresence } = require('../services/userPresence.service');
const profileLikeService = require('../services/profileLike.service');

const GALLERY_SLOT_COUNT = 6;
const FEATURED_BADGE_LIMIT = 12;
const MAX_PROFILE_IMAGE_CHARS = 2_500_000;
const MAX_AVATAR_IMAGE_CHARS = 1_500_000;
const DEFAULT_USER_LIST_LIMIT = 50;
const MAX_USER_LIST_LIMIT = 100;
const ADMIN_PRIVILEGE_BADGE_LABELS = new Set([
  'Tích xanh đặc quyền',
  'Dev đặc quyền',
  'Người đóng góp',
  'Nhà sáng lập',
  'Thành viên VIP',
  'Đối tác WorkRank',
  'Người nổi bật',
]);

function canCustomizeUserProfile(req, userId) {
  return req.user?.role === 'admin' || String(req.user?.id || '') === String(userId);
}

function parseGallerySlot(value) {
  const raw = String(value ?? '');
  if (!/^\d+$/.test(raw)) return null;
  const slot = Number(raw);
  if (!Number.isInteger(slot) || slot < 0 || slot >= GALLERY_SLOT_COUNT) return null;
  return slot;
}

function validateImageData(value, maxLength) {
  const imageData = String(value || '').trim();
  if (!imageData) return { error: 'Missing image data' };
  if (!imageData.startsWith('data:image/')) return { error: 'Image data must be a data URL' };
  if (imageData.length > maxLength) return { error: 'Image data is too large' };
  return { value: imageData };
}

function uniqueBadgeLabels(value) {
  return (Array.isArray(value) ? value : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index);
}

function normalizeFeaturedBadges(value, { existingLabels = [], isAdmin = false } = {}) {
  if (value === undefined) return { value: undefined };
  if (!Array.isArray(value)) return { error: 'Featured badges must be an array' };
  let labels = uniqueBadgeLabels(value);
  if (!isAdmin) {
    const existingPrivilegeLabels = uniqueBadgeLabels(existingLabels)
      .filter((label) => ADMIN_PRIVILEGE_BADGE_LABELS.has(label));
    const requestedPrivilegeLabels = labels
      .filter((label) => ADMIN_PRIVILEGE_BADGE_LABELS.has(label));
    const unauthorized = requestedPrivilegeLabels
      .filter((label) => !existingPrivilegeLabels.includes(label));
    if (unauthorized.length > 0) return { error: 'Privilege badges can only be managed by admins' };
    labels = [
      ...existingPrivilegeLabels,
      ...labels.filter((label) => !ADMIN_PRIVILEGE_BADGE_LABELS.has(label)),
    ];
  }
  labels = labels.slice(0, FEATURED_BADGE_LIMIT);
  if (labels.some((label) => label.length > 80)) return { error: 'Featured badge label is too long' };
  return { value: labels };
}

function serializeProfilePreference(preference) {
  return {
    avatarData: preference?.avatarData || null,
    featuredBadges: Array.isArray(preference?.featuredBadges) ? preference.featuredBadges : [],
    hasFeaturedBadgesPreference: Array.isArray(preference?.featuredBadges),
  };
}

function serializeUserWithProfile(user) {
  const plain = sanitizeUser(user);
  const preference = plain.UserProfilePreference || plain.userProfilePreference || null;
  delete plain.UserProfilePreference;
  delete plain.userProfilePreference;
  return decorateUserPresence({
    ...plain,
    avatarData: preference?.avatarData || null,
  });
}

function serializeUserListItem(user) {
  const plain = sanitizeUser(user);
  const preference = plain.UserProfilePreference || plain.userProfilePreference || null;
  delete plain.UserProfilePreference;
  delete plain.userProfilePreference;
  return decorateUserPresence({
    ...plain,
    featuredBadges: Array.isArray(preference?.featuredBadges) ? preference.featuredBadges : [],
  });
}

function clampPositiveInt(value, fallback, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(n)));
}

function serializeProfileImage(image) {
  return {
    slot: image.slot,
    imageData: image.imageData,
  };
}

async function list(req, res) {
  const limit = clampPositiveInt(req.query.limit, DEFAULT_USER_LIST_LIMIT, MAX_USER_LIST_LIMIT);
  const page = clampPositiveInt(req.query.page, 1, 1000000);
  const offset = (page - 1) * limit;
  const search = String(req.query.search || '').trim();
  const where = {};
  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
    ];
  }

  const { count, rows } = await User.findAndCountAll({
    where,
    order: [['createdAt', 'DESC'], ['id', 'DESC']],
    limit,
    offset,
    include: [{ model: UserProfilePreference, attributes: ['featuredBadges'], required: false }],
  });
  res.json({
    data: rows.map(serializeUserListItem),
    pagination: {
      page,
      limit,
      total: count,
      totalPages: Math.max(1, Math.ceil(count / limit)),
      hasNextPage: offset + rows.length < count,
    },
  });
}

async function getById(req, res) {
  const user = await User.findByPk(req.params.id, {
    include: [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }],
  });
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: serializeUserWithProfile(user) });
}

async function create(req, res) {
  const passwordHash = await bcrypt.hash(req.body.password, env.bcryptRounds);
  const user = await User.create({ ...req.body, passwordHash });
  res.status(201).json({ user: sanitizeUser(user) });
}

async function update(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.update(req.body);
  return res.json({ user: sanitizeUser(user) });
}

async function remove(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  await user.update({ status: 'inactive' });
  return res.status(204).send();
}

async function getProfilePreferences(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const preference = await UserProfilePreference.findByPk(user.id);
  return res.json({ data: serializeProfilePreference(preference) });
}

async function updateProfilePreferences(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const values = {};
  let preference = await UserProfilePreference.findByPk(user.id);
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarData')) {
    if (req.body.avatarData === null || req.body.avatarData === '') {
      values.avatarData = null;
    } else {
      const image = validateImageData(req.body.avatarData, MAX_AVATAR_IMAGE_CHARS);
      if (image.error) return res.status(400).json({ message: image.error });
      values.avatarData = image.value;
    }
  }

  const featuredBadges = normalizeFeaturedBadges(req.body?.featuredBadges, {
    existingLabels: preference?.featuredBadges,
    isAdmin: req.user?.role === 'admin',
  });
  if (featuredBadges.error) return res.status(400).json({ message: featuredBadges.error });
  if (featuredBadges.value !== undefined) values.featuredBadges = featuredBadges.value;

  if (preference) {
    await preference.update(values);
  } else {
    preference = await UserProfilePreference.create({ userId: user.id, ...values });
  }

  return res.json({ data: serializeProfilePreference(preference) });
}

async function gallery(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });

  const images = await UserProfileImage.findAll({
    where: { userId: user.id },
    order: [['slot', 'ASC']],
  });
  return res.json({ data: images.map(serializeProfileImage) });
}

async function updateGalleryImage(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const slot = parseGallerySlot(req.params.slot);
  if (slot === null) return res.status(400).json({ message: 'Invalid gallery slot' });

  const image = validateImageData(req.body?.imageData, MAX_PROFILE_IMAGE_CHARS);
  if (image.error) return res.status(400).json({ message: image.error });

  const existing = await UserProfileImage.findOne({ where: { userId: user.id, slot } });
  const row = existing
    ? await existing.update({ imageData: image.value })
    : await UserProfileImage.create({ userId: user.id, slot, imageData: image.value });

  return res.json({ image: serializeProfileImage(row) });
}

async function removeGalleryImage(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  if (!canCustomizeUserProfile(req, user.id)) return res.status(403).json({ message: 'Forbidden' });

  const slot = parseGallerySlot(req.params.slot);
  if (slot === null) return res.status(400).json({ message: 'Invalid gallery slot' });

  await UserProfileImage.destroy({ where: { userId: user.id, slot } });
  return res.status(204).send();
}

async function getProfileLikes(req, res) {
  try {
    const data = await profileLikeService.getProfileLikes({
      viewerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.json({ data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
}

async function likeProfile(req, res) {
  try {
    const data = await profileLikeService.likeProfile({
      likerId: req.user.id,
      targetUserId: req.params.id,
    });
    return res.status(data.created ? 201 : 200).json({ data });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    throw error;
  }
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getProfilePreferences,
  updateProfilePreferences,
  gallery,
  updateGalleryImage,
  removeGalleryImage,
  getProfileLikes,
  likeProfile,
};
