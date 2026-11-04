'use strict';

/**
 * PRIVATE MEDIA — PLAYLISTS
 *
 * Access model (enforced here, never in the UI):
 *   curated  → read-only for every entitled account, writable only by the sync
 *              script (no HTTP path can modify it)
 *   user     → readable/editable by its owner
 *              `visibility = 'shared'` additionally lets other entitled accounts
 *              *see and play* it, but never edit or delete it
 *
 * A playlist id from another user's private playlist resolves to 404, exactly
 * like a missing row.
 */

const { Op } = require('sequelize');
const {
  PrivateMediaPlaylist: Playlist,
  PrivateMediaPlaylistItem: PlaylistItem,
  PrivateMediaPlaylistProgress: Progress,
  sequelize,
} = require('../../models');
const access = require('./access.service');
const youtube = require('./youtube.service');
const sessions = require('./session.service');
const transaction = require('../typingTransaction');

const MAX_ITEMS = 500;
const MAX_PLAYLISTS_PER_USER = 50;

class PlaylistError extends Error {
  constructor(code, message, status = 400) {
    super(message || code);
    this.name = 'PlaylistError';
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status) => { throw new PlaylistError(code, message, status); };

function serializeItem(row) {
  return {
    id: row.id,
    videoId: row.videoId,
    title: row.title,
    channelTitle: row.channelTitle,
    thumbnailUrl: row.thumbnailUrl,
    durationSeconds: row.durationSeconds,
    episodeNumber: row.episodeNumber,
    position: row.position,
    available: row.available !== false,
    unavailableReason: row.unavailableReason || null,
  };
}

function serializePlaylist(row, { items = null, viewerId = null } = {}) {
  const ownerUserId = row.ownerUserId == null ? null : Number(row.ownerUserId);
  return {
    id: Number(row.id),
    slug: row.slug || null,
    title: row.title,
    description: row.description || '',
    kind: row.kind,
    visibility: row.visibility,
    playbackMode: row.playbackMode,
    repeatMode: row.repeatMode,
    sourceType: row.sourceType,
    sourceChannel: row.sourceChannel || null,
    sourceUrl: row.sourceUrl || null,
    coverUrl: row.coverUrl || null,
    itemCount: Number(row.itemCount) || 0,
    expectedCount: row.expectedCount == null ? null : Number(row.expectedCount),
    verifiedAt: row.verifiedAt,
    isOwner: ownerUserId != null && Number(viewerId) === ownerUserId,
    editable: row.kind === 'user' && ownerUserId != null && Number(viewerId) === ownerUserId,
    items: items ? items.map(serializeItem) : undefined,
  };
}

async function requireEntitled(userId) {
  const entitlement = await access.getEntitlement(userId);
  if (!access.hasPermission(entitlement, 'view')) fail('NOT_FOUND', 'Not found', 404);
  return entitlement;
}

/** A playlist row the caller may read. Everything else is a 404. */
async function findVisible(playlistId, viewerId, { withItems = false } = {}) {
  const id = Number(playlistId);
  if (!id) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  const row = await Playlist.findByPk(id);
  if (!row) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  if (row.kind !== 'curated') {
    const isOwner = Number(row.ownerUserId) === Number(viewerId);
    if (!isOwner && row.visibility !== 'shared') fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  }
  let items = null;
  if (withItems) {
    items = await PlaylistItem.findAll({ where: { playlistId: id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  }
  return { row, items };
}

async function listPlaylists({ userId, includeCurated = true }) {
  await requireEntitled(userId);
  const where = {
    [Op.or]: [
      { ownerUserId: Number(userId) },
      { visibility: 'shared' },
      ...(includeCurated ? [{ kind: 'curated' }] : []),
    ],
  };
  const rows = await Playlist.findAll({ where, order: [['kind', 'ASC'], ['updatedAt', 'DESC']], limit: 200 });
  return rows.map((row) => serializePlaylist(row, { viewerId: userId }));
}

async function getPlaylist({ userId, playlistId, withItems = true }) {
  await requireEntitled(userId);
  const { row, items } = await findVisible(playlistId, userId, { withItems });
  const progress = await getProgress({ playlistId: row.id, userId });
  return { ...serializePlaylist(row, { items, viewerId: userId }), progress };
}

/**
 * Runtime view used by the playback engine. Only playable rows are returned so a
 * private/deleted video can never be scheduled.
 */
/**
 * Bookmark the item this account just started. Best-effort: a failed bookmark
 * must never fail playback.
 */
async function recordProgress({ playlistId, userId, itemId = null, videoId = null, episodeNumber = null }) {
  if (!playlistId || !userId || !videoId) return null;
  try {
    // Uses the shared transaction helper so the SQLite fixture (one connection)
    // never opens a second transaction while the session lock is held.
    return await transaction(async (t) => {
      const [row] = await Progress.findOrCreate({
        where: { playlistId: Number(playlistId), userId: Number(userId) },
        defaults: { itemId: itemId ? Number(itemId) : null, videoId, episodeNumber: episodeNumber ?? null },
        transaction: t,
      });
      await row.update({
        itemId: itemId ? Number(itemId) : null,
        videoId,
        episodeNumber: episodeNumber ?? null,
        updatedAt: new Date(),
      }, { transaction: t });
      return row;
    });
  } catch {
    return null;
  }
}

async function getProgress({ playlistId, userId }) {
  if (!playlistId || !userId) return null;
  const row = await Progress.findOne({ where: { playlistId: Number(playlistId), userId: Number(userId) } });
  if (!row) return null;
  return {
    itemId: row.itemId,
    videoId: row.videoId,
    episodeNumber: row.episodeNumber,
    updatedAt: row.updatedAt,
  };
}

async function getPlayablePlaylist(playlistId) {
  const row = await Playlist.findByPk(Number(playlistId));
  if (!row) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  const items = await PlaylistItem.findAll({
    where: { playlistId: row.id, available: true },
    order: [['position', 'ASC'], ['id', 'ASC']],
    limit: MAX_ITEMS,
  });
  return { ...serializePlaylist(row), items: items.map(serializeItem) };
}

function cleanTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  if (!title) fail('INVALID_TITLE', 'Đặt tên cho danh sách phát');
  if (title.length > 120) fail('INVALID_TITLE', 'Tên tối đa 120 ký tự');
  return title;
}

async function createPlaylist({ userId, title, description, visibility, playbackMode, repeatMode }) {
  await requireEntitled(userId);
  const count = await Playlist.count({ where: { ownerUserId: Number(userId) } });
  if (count >= MAX_PLAYLISTS_PER_USER) fail('PLAYLIST_LIMIT', `Mỗi tài khoản tối đa ${MAX_PLAYLISTS_PER_USER} danh sách phát`);
  const row = await Playlist.create({
    ownerUserId: Number(userId),
    title: cleanTitle(title),
    description: description ? String(description).slice(0, 500) : null,
    kind: 'user',
    visibility: visibility === 'shared' ? 'shared' : 'private',
    playbackMode: playbackMode === 'shuffle' ? 'shuffle' : 'sequential',
    repeatMode: repeatMode === 'all' ? 'all' : 'off',
    sourceType: 'manual',
    itemCount: 0,
  });
  return serializePlaylist(row, { viewerId: userId, items: [] });
}

async function requireEditable(playlistId, userId) {
  const row = await Playlist.findByPk(Number(playlistId));
  if (!row || row.kind !== 'user' || Number(row.ownerUserId) !== Number(userId)) {
    fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  }
  return row;
}

async function updatePlaylist({ userId, playlistId, patch = {} }) {
  const row = await requireEditable(playlistId, userId);
  const next = {};
  if (patch.title !== undefined) next.title = cleanTitle(patch.title);
  if (patch.description !== undefined) next.description = patch.description ? String(patch.description).slice(0, 500) : null;
  if (patch.visibility !== undefined) next.visibility = patch.visibility === 'shared' ? 'shared' : 'private';
  if (patch.playbackMode !== undefined) next.playbackMode = patch.playbackMode === 'shuffle' ? 'shuffle' : 'sequential';
  if (patch.repeatMode !== undefined) next.repeatMode = patch.repeatMode === 'all' ? 'all' : 'off';
  await row.update(next);
  const items = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  return serializePlaylist(row, { items, viewerId: userId });
}

async function deletePlaylist({ userId, playlistId }) {
  const row = await requireEditable(playlistId, userId);
  await PlaylistItem.destroy({ where: { playlistId: row.id } });
  await row.destroy();
  return { deleted: true, id: Number(playlistId) };
}

/** Normalises one client item; accepts a raw videoId or a full metadata object. */
function normalizeItem(input) {
  const videoId = String(input?.videoId || '').trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) fail('INVALID_VIDEO_ID', 'Video không hợp lệ');
  return {
    videoId,
    title: input.title ? String(input.title).slice(0, 255) : null,
    channelTitle: input.channelTitle ? String(input.channelTitle).slice(0, 191) : null,
    thumbnailUrl: input.thumbnailUrl ? String(input.thumbnailUrl).slice(0, 512) : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
    durationSeconds: Number(input.durationSeconds) > 0 ? Math.round(Number(input.durationSeconds)) : null,
    episodeNumber: Number.isFinite(Number(input.episodeNumber)) ? Number(input.episodeNumber) : null,
    available: input.available !== false,
    unavailableReason: input.unavailableReason || null,
  };
}

async function addItems({ userId, playlistId, items = [] }) {
  const row = await requireEditable(playlistId, userId);
  if (!Array.isArray(items) || !items.length) fail('INVALID_ITEMS', 'Chưa chọn video nào');
  if (items.length > 50) fail('INVALID_ITEMS', 'Mỗi lần thêm tối đa 50 video');

  const existing = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'DESC']], limit: 1 });
  let position = existing.length ? Number(existing[0].position) + 1 : 0;
  const currentCount = await PlaylistItem.count({ where: { playlistId: row.id } });
  if (currentCount + items.length > MAX_ITEMS) fail('PLAYLIST_LIMIT', `Mỗi danh sách tối đa ${MAX_ITEMS} video`);

  const prepared = items.map(normalizeItem);
  const created = [];
  for (const item of prepared) {
    // Duplicates are allowed by design (a user may want a track twice), but an
    // import never duplicates the same video id twice in a row.
    const last = created[created.length - 1];
    if (last && last.videoId === item.videoId) continue;
    created.push({ ...item, playlistId: row.id, position: position++, addedByUserId: Number(userId) });
  }
  const rows = await PlaylistItem.bulkCreate(created);
  await row.update({ itemCount: currentCount + rows.length, coverUrl: row.coverUrl || rows[0]?.thumbnailUrl || null });

  // A playlist that is currently playing should pick up the new videos in the
  // same cycle instead of waiting for the next one.
  await sessions.syncActiveCycle({ playlistId: row.id, addedItems: rows.map((r) => r.get({ plain: true })) });

  const all = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  return { playlist: serializePlaylist(row, { items: all, viewerId: userId }), added: rows.length };
}

async function removeItem({ userId, playlistId, itemId }) {
  const row = await requireEditable(playlistId, userId);
  const item = await PlaylistItem.findOne({ where: { id: Number(itemId), playlistId: row.id } });
  if (!item) fail('PLAYLIST_ITEM_NOT_FOUND', 'Không tìm thấy video trong danh sách phát', 404);
  await item.destroy();

  const rest = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  await sequelize.transaction(async (t) => {
    for (let index = 0; index < rest.length; index += 1) {
      if (rest[index].position !== index) await rest[index].update({ position: index }, { transaction: t });
    }
    await row.update({ itemCount: rest.length }, { transaction: t });
  });
  await sessions.syncActiveCycle({ playlistId: row.id, removedItemIds: [Number(itemId)] });
  const items = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  return serializePlaylist(row, { items, viewerId: userId });
}

async function reorderItems({ userId, playlistId, itemIds }) {
  const row = await requireEditable(playlistId, userId);
  const items = await PlaylistItem.findAll({ where: { playlistId: row.id } });
  if (!Array.isArray(itemIds) || itemIds.length !== items.length) fail('INVALID_ORDER', 'Danh sách đã thay đổi, vui lòng thử lại');
  const byId = new Map(items.map((item) => [String(item.id), item]));
  if (new Set(itemIds.map(String)).size !== itemIds.length || itemIds.some((id) => !byId.has(String(id)))) {
    fail('INVALID_ORDER', 'Danh sách đã thay đổi, vui lòng thử lại');
  }
  await sequelize.transaction(async (t) => {
    for (let index = 0; index < itemIds.length; index += 1) {
      await byId.get(String(itemIds[index])).update({ position: index }, { transaction: t });
    }
  });
  const ordered = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  return serializePlaylist(row, { items: ordered, viewerId: userId });
}

/** Import a YouTube playlist (full pagination, availability checked). */
async function importPlaylist({ userId, input, title, visibility = 'private' }) {
  await requireEntitled(userId);
  const count = await Playlist.count({ where: { ownerUserId: Number(userId) } });
  if (count >= MAX_PLAYLISTS_PER_USER) fail('PLAYLIST_LIMIT', `Mỗi tài khoản tối đa ${MAX_PLAYLISTS_PER_USER} danh sách phát`);

  const source = await youtube.fetchPlaylist({ playlistId: input, maxItems: MAX_ITEMS });
  const row = await Playlist.create({
    ownerUserId: Number(userId),
    title: cleanTitle(title || source.title),
    description: source.channelTitle ? `Nhập từ kênh ${source.channelTitle}` : null,
    kind: 'user',
    visibility: visibility === 'shared' ? 'shared' : 'private',
    playbackMode: 'sequential',
    repeatMode: 'off',
    sourceType: 'youtube',
    sourcePlaylistId: source.playlistId,
    sourceChannel: source.channelTitle,
    sourceUrl: `https://www.youtube.com/playlist?list=${source.playlistId}`,
    coverUrl: source.coverUrl,
    itemCount: 0,
    expectedCount: source.declaredCount,
    verifiedAt: new Date(),
  });

  const created = source.items.slice(0, MAX_ITEMS).map((item, index) => ({
    playlistId: row.id,
    videoId: item.videoId,
    title: item.title,
    channelTitle: item.channelTitle,
    thumbnailUrl: item.thumbnailUrl,
    durationSeconds: item.durationSeconds,
    episodeNumber: null,
    position: index,
    available: item.available,
    unavailableReason: item.unavailableReason,
    addedByUserId: Number(userId),
  }));
  if (created.length) await PlaylistItem.bulkCreate(created);
  await row.update({ itemCount: created.length });

  const items = await PlaylistItem.findAll({ where: { playlistId: row.id }, order: [['position', 'ASC'], ['id', 'ASC']] });
  return {
    playlist: serializePlaylist(row, { items, viewerId: userId }),
    imported: created.length,
    declaredCount: source.declaredCount,
    skipped: source.skipped,
    unavailable: created.filter((item) => !item.available).length,
  };
}

/**
 * Load the curated catalog from the reviewed JSON file. Idempotent: existing
 * curated rows are updated in place, so re-running after a catalog refresh never
 * duplicates items and never touches a user playlist.
 */
async function seedCuratedCatalog({ force = false } = {}) {
  // eslint-disable-next-line global-require
  const catalog = require('../../data/private-media-catalog.json');
  const applied = [];
  for (const entry of catalog.playlists || []) {
    const existing = await Playlist.findOne({ where: { slug: entry.slug } });
    if (existing && existing.kind !== 'curated') continue;
    if (existing && !force && Number(existing.itemCount) === entry.items.length && existing.verifiedAt) {
      applied.push({ slug: entry.slug, items: Number(existing.itemCount), skipped: true });
      continue;
    }
    const payload = {
      slug: entry.slug,
      ownerUserId: null,
      title: entry.title,
      description: entry.description,
      kind: 'curated',
      visibility: 'shared',
      playbackMode: entry.playbackMode,
      repeatMode: entry.repeatMode,
      sourceType: entry.sourceType,
      sourcePlaylistId: entry.sourcePlaylistId,
      sourceChannel: entry.sourceChannel,
      sourceUrl: entry.sourceUrl,
      coverUrl: entry.coverUrl,
      itemCount: entry.items.length,
      expectedCount: entry.expectedCount,
      verifiedAt: new Date(catalog.generatedAt),
    };
    const row = existing || await Playlist.create(payload);
    if (existing) await existing.update(payload);
    await PlaylistItem.destroy({ where: { playlistId: row.id } });
    await PlaylistItem.bulkCreate(entry.items.map((item) => ({
      playlistId: row.id,
      videoId: item.videoId,
      title: item.title,
      channelTitle: item.channelTitle,
      thumbnailUrl: item.thumbnailUrl,
      durationSeconds: item.durationSeconds,
      episodeNumber: item.episodeNumber,
      position: item.position,
      available: item.available !== false,
      unavailableReason: item.unavailableReason || null,
    })));
    applied.push({ slug: entry.slug, items: entry.items.length, skipped: false });
  }
  return applied;
}

module.exports = {
  PlaylistError,
  serializePlaylist,
  serializeItem,
  listPlaylists,
  getPlaylist,
  getPlayablePlaylist,
  recordProgress,
  getProgress,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addItems,
  removeItem,
  reorderItems,
  importPlaylist,
  seedCuratedCatalog,
};
