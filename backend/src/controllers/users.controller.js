const bcrypt = require('bcryptjs');
const env = require('../config/env');
const { User, UserProfileImage, UserProfilePreference } = require('../models');
const sanitizeUser = require('../utils/sanitizeUser');
const { decorateUserPresence } = require('../services/userPresence.service');

const GALLERY_SLOT_COUNT = 6;
const FEATURED_BADGE_LIMIT = 4;
const MAX_PROFILE_IMAGE_CHARS = 2_500_000;
const MAX_AVATAR_IMAGE_CHARS = 1_500_000;

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

function normalizeFeaturedBadges(value) {
  if (value === undefined) return { value: undefined };
  if (!Array.isArray(value)) return { error: 'Featured badges must be an array' };
  const labels = value
    .map((label) => String(label || '').trim())
    .filter(Boolean)
    .filter((label, index, list) => list.indexOf(label) === index)
    .slice(0, FEATURED_BADGE_LIMIT);
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

function serializeProfileImage(image) {
  return {
    slot: image.slot,
    imageData: image.imageData,
  };
}

async function list(req, res) {
  const users = await User.findAll({ order: [['createdAt', 'DESC']] });
  res.json({ data: users.map((user) => decorateUserPresence(sanitizeUser(user))) });
}

async function getById(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  return res.json({ user: decorateUserPresence(sanitizeUser(user)) });
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
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'avatarData')) {
    if (req.body.avatarData === null || req.body.avatarData === '') {
      values.avatarData = null;
    } else {
      const image = validateImageData(req.body.avatarData, MAX_AVATAR_IMAGE_CHARS);
      if (image.error) return res.status(400).json({ message: image.error });
      values.avatarData = image.value;
    }
  }

  const featuredBadges = normalizeFeaturedBadges(req.body?.featuredBadges);
  if (featuredBadges.error) return res.status(400).json({ message: featuredBadges.error });
  if (featuredBadges.value !== undefined) values.featuredBadges = featuredBadges.value;

  let preference = await UserProfilePreference.findByPk(user.id);
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
};
