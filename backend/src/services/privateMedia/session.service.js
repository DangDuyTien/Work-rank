'use strict';

// One existing session per private account, plus the opt-in room:shared session.
// All surfaces use the same locked command journal and server reference clock.
//
// V2 adds a playlist source to the same engine. There is exactly ONE advance
// path (`advance`) used by NEXT, ENDED, the hotkey and Telegram; manual queue
// items always win, then the playlist cycle continues.
const crypto = require('node:crypto');
const env = require('../../config/env');
const { PrivateMediaSession: Session, PrivateMediaCommand: Command } = require('../../models');
const transaction = require('../typingTransaction');
const access = require('./access.service');
const audit = require('./audit.service');
const DEFAULT_SESSION_KEY = env.privateMedia?.sessionKey || 'primary';
const SHARED_ROOM_KEY = 'room:shared';
const MAX_HISTORY = 50;
const normalizeRoom = (room) => String(room || '').toLowerCase() === 'shared' ? 'shared' : 'private';
async function sessionKeyFor(userId, room) {
  if (normalizeRoom(room) === 'shared') return SHARED_ROOM_KEY;
  return !userId || await access.isOwner(userId) ? DEFAULT_SESSION_KEY : `user:${Number(userId)}`;
}
const ACTIONS = Object.freeze(Object.fromEntries([
  'LOAD_VIDEO', 'QUEUE_ADD', 'QUEUE_REMOVE', 'QUEUE_REORDER', 'QUEUE_CLEAR',
  'PLAY', 'PAUSE', 'TOGGLE_PLAY_PAUSE', 'STOP', 'NEXT', 'PREVIOUS', 'SEEK',
  'PLAYLIST_PLAY', 'PLAYLIST_SHUFFLE', 'PLAYLIST_STOP', 'PLAYLIST_QUEUE',
].map((x) => [x, x])));
const ACTION_LIST = Object.values(ACTIONS);
class PrivateMediaCommandError extends Error {
  constructor(code, message, status = 400) { super(message || code); this.code = code; this.status = status; }
}
const fail = (code, message, status) => { throw new PrivateMediaCommandError(code, message, status); };
const number = (value, min = 0, max = 86400) => Math.min(max, Math.max(min, Number(value) || 0));
const normalizeVideoId = (value) => /^[A-Za-z0-9_-]{11}$/.test(String(value || '').trim()) ? String(value).trim() : null;
function video(entry) {
  const videoId = normalizeVideoId(entry?.videoId);
  if (!videoId) fail('INVALID_VIDEO_ID', 'Video không hợp lệ');
  return {
    videoId, title: String(entry.title || '').slice(0, 255) || null,
    channelTitle: String(entry.channelTitle || '').slice(0, 191) || null,
    thumbnailUrl: String(entry.thumbnailUrl || '').slice(0, 512) || null,
    durationSeconds: entry.durationSeconds > 0 ? Math.round(number(entry.durationSeconds)) : null,
  };
}
function position(session, now = Date.now()) {
  const elapsed = session.status === 'PLAYING' && session.referenceTime
    ? Math.max(0, (now - new Date(session.referenceTime).getTime()) / 1000) : 0;
  return number(Number(session.currentTime || 0) + elapsed, 0, Number(session.durationSeconds) || 86400);
}
function playlistSummary(s) {
  const order = Array.isArray(s.playlistOrder) ? s.playlistOrder : [];
  if (!s.activePlaylistId || !order.length) return null;
  const cursor = Math.min(Math.max(0, Number(s.playlistCursor) || 0), order.length);
  const upcoming = order.slice(cursor).filter((entry) => entry && !entry.skipped);
  const current = order.find((entry) => entry && entry.id === s.currentQueueItemId) || null;
  return {
    id: Number(s.activePlaylistId),
    title: s.playlistTitle || 'Danh sách phát',
    mode: s.playlistMode === 'shuffle' ? 'shuffle' : 'sequential',
    repeat: s.playlistRepeat === 'all' ? 'all' : 'off',
    total: order.length,
    played: cursor,
    remaining: upcoming.length,
    next: upcoming[0] ? { videoId: upcoming[0].videoId, title: upcoming[0].title } : null,
    // Which playlist row is playing right now — used for the resume bookmark
    // and to highlight the current episode in the list.
    currentItemId: current?.itemId ?? null,
    currentEpisode: current?.episodeNumber ?? null,
  };
}
function serializeSession(s) {
  if (!s) return null;
  return {
    sessionId: s.id, sessionKey: s.sessionKey, sessionRevision: Number(s.revision),
    currentQueueItemId: s.currentQueueItemId, status: s.status,
    video: s.currentVideoId ? { videoId: s.currentVideoId, title: s.title, channelTitle: s.channelTitle, thumbnailUrl: s.thumbnailUrl, durationSeconds: s.durationSeconds } : null,
    currentTime: position(s), positionAtReference: Number(s.currentTime || 0),
    serverReferenceTime: s.referenceTime, serverNow: Date.now(),
    queue: (s.queue || []).filter((q) => q.status === 'QUEUED').map(({ addedBy, ...q }, i) => ({ ...q, source: q.source || 'manual', position: i + 1 })),
    playlist: playlistSummary(s),
    playerOnline: Boolean(s.playerOnline), controllerUserId: s.controllerUserId,
    participantCount: require('./realtime.service').playerCount(s.sessionKey),
    lastFailure: s.lastFailure || null, updatedAt: s.updatedAt,
  };
}
async function getSession(userId, room, t) {
  const sessionKey = await sessionKeyFor(userId, room);
  const [s] = await Session.findOrCreate({ where: { sessionKey }, defaults: { sessionKey }, transaction: t });
  if (t) await s.reload({ transaction: t, lock: t.LOCK.UPDATE });
  // Upgrade the old queue/index shape once, without changing the current song.
  if ((s.queue || []).some((q) => !q.id || !q.status) || (s.currentVideoId && !s.currentQueueItemId)) {
    const index = Number(s.queueIndex ?? -1);
    const queue = (s.queue || []).map((q, i) => ({ ...video(q), id: q.id || crypto.randomUUID(), status: i <= index ? 'PLAYED' : 'QUEUED' }));
    s.queue = queue;
    s.currentQueueItemId = s.currentQueueItemId || (s.currentVideoId ? crypto.randomUUID() : null);
    s.referenceTime = s.referenceTime || new Date();
    if (s.status === 'LOADING') s.status = 'PLAYING';
    await s.save({ transaction: t });
  }
  return s;
}
async function getSessionById(id) { return id ? Session.findByPk(id) : null; }
async function getSessionState(userId, room) {
  return transaction(async (t) => serializeSession(await getSession(userId, room, t)));
}
function clearPlaylist(s) {
  Object.assign(s, {
    activePlaylistId: null, playlistTitle: null, playlistMode: null,
    playlistRepeat: null, playlistOrder: [], playlistCursor: 0, playlistHistory: [],
  });
}
function pushHistory(s) {
  if (!s.currentVideoId || !s.currentQueueItemId) return;
  const entry = {
    id: s.currentQueueItemId, videoId: s.currentVideoId, title: s.title,
    channelTitle: s.channelTitle, thumbnailUrl: s.thumbnailUrl, durationSeconds: s.durationSeconds,
  };
  const history = Array.isArray(s.playlistHistory) ? s.playlistHistory : [];
  const last = history[history.length - 1];
  if (last && last.id === entry.id) return;
  s.playlistHistory = [...history, entry].slice(-MAX_HISTORY);
}
function setCurrent(s, item, { record = true } = {}) {
  if (record) pushHistory(s);
  const queue = s.queue || [];
  s.queue = queue.map((q) => q.status === 'PLAYING' ? { ...q, status: 'PLAYED' } : q);
  if (!item) {
    Object.assign(s, { status: 'IDLE', currentVideoId: null, title: null, channelTitle: null, thumbnailUrl: null, durationSeconds: null, currentQueueItemId: null, currentTime: 0 });
  } else {
    Object.assign(s, {
      status: 'PLAYING', currentVideoId: item.videoId, title: item.title,
      channelTitle: item.channelTitle, thumbnailUrl: item.thumbnailUrl,
      durationSeconds: item.durationSeconds, currentQueueItemId: item.id, currentTime: 0,
    });
    s.queue = s.queue.map((q) => q.id === item.id ? { ...q, status: 'PLAYING' } : q);
  }
}
/** Entries are self-contained: editing the playlist never mutates a running cycle. */
function toCycleEntry(item) {
  return {
    id: crypto.randomUUID(), itemId: item.itemId ?? item.id ?? null,
    videoId: item.videoId, title: item.title || null, channelTitle: item.channelTitle || null,
    thumbnailUrl: item.thumbnailUrl || null, durationSeconds: item.durationSeconds || null,
    episodeNumber: item.episodeNumber ?? null,
  };
}
function fisherYates(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
/**
 * Build one shuffle "bag": every entry appears exactly once before any repeat.
 * The first entry never matches the track that just finished (when there is a
 * real alternative), so a shuffle cannot play the same video twice in a row.
 */
function buildCycle(items, mode, lastVideoId) {
  let list = items.map(toCycleEntry);
  if (mode === 'shuffle' && list.length > 1) {
    list = fisherYates(list);
    if (lastVideoId && list[0].videoId === lastVideoId) {
      const swapAt = list.findIndex((entry, index) => index > 0 && entry.videoId !== lastVideoId);
      if (swapAt > 0) [list[0], list[swapAt]] = [list[swapAt], list[0]];
    }
  }
  return list;
}
function nextPlaylistEntry(s) {
  const order = Array.isArray(s.playlistOrder) ? s.playlistOrder : [];
  while ((Number(s.playlistCursor) || 0) < order.length) {
    const entry = order[Number(s.playlistCursor)];
    s.playlistCursor = (Number(s.playlistCursor) || 0) + 1;
    if (!entry || entry.skipped) continue;
    return entry;
  }
  return null;
}
function advance(s, failed = false) {
  if (failed) s.queue = (s.queue || []).map((q) => q.id === s.currentQueueItemId ? { ...q, status: 'FAILED' } : q);
  // 1. Manual queue wins — this is what makes "add to queue" feel immediate.
  const nextManual = (s.queue || []).find((q) => q.status === 'QUEUED');
  if (nextManual) { setCurrent(s, nextManual); return true; }
  // 2. Continue the playlist cycle.
  const nextFromPlaylist = nextPlaylistEntry(s);
  if (nextFromPlaylist) { setCurrent(s, nextFromPlaylist); return true; }
  // 3. Repeat: a fresh bag, never the track that just ended first.
  const order = Array.isArray(s.playlistOrder) ? s.playlistOrder : [];
  if (s.playlistRepeat === 'all' && order.length) {
    const lastVideoId = s.currentVideoId;
    const cycle = buildCycle(order, s.playlistMode, lastVideoId);
    s.playlistOrder = cycle;
    s.playlistCursor = 0;
    const entry = nextPlaylistEntry(s);
    if (entry) { setCurrent(s, entry); return true; }
  }
  // 4. Nothing left.
  clearPlaylist(s);
  setCurrent(s, null);
  return false;
}
function startPlaylist(s, playlist, { mode, startItemId, repeat }) {
  const items = (playlist.items || []).filter((item) => item.available !== false);
  if (!items.length) fail('PLAYLIST_EMPTY', 'Danh sách phát chưa có video nào');
  const ordered = [...items].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const startIndex = startItemId ? ordered.findIndex((item) => String(item.id) === String(startItemId)) : 0;
  if (startItemId && startIndex < 0) fail('PLAYLIST_ITEM_NOT_FOUND', 'Không tìm thấy video trong danh sách phát');
  const rotated = startIndex > 0 ? [...ordered.slice(startIndex), ...ordered.slice(0, startIndex)] : ordered;
  const cycle = buildCycle(rotated, mode, s.currentVideoId);
  s.activePlaylistId = playlist.id;
  s.playlistTitle = playlist.title;
  s.playlistMode = mode === 'shuffle' ? 'shuffle' : 'sequential';
  s.playlistRepeat = repeat === 'all' ? 'all' : 'off';
  s.playlistOrder = cycle;
  s.playlistCursor = 0;
  s.playlistHistory = [];
  const entry = nextPlaylistEntry(s);
  setCurrent(s, entry, { record: false });
}
function transition(s, action, payload, actorUserId, room, context = {}) {
  if (['LOAD_VIDEO', 'QUEUE_ADD'].includes(action)) {
    const raw = Array.isArray(payload.queue) && payload.queue.length ? payload.queue : [payload];
    if (raw.length > 50) fail('QUEUE_LIMIT', 'Mỗi lần thêm tối đa 50 bài');
    const incoming = raw.map((q) => ({ ...video(q), id: crypto.randomUUID(), source: 'manual', requestedByUserId: actorUserId, createdAt: new Date().toISOString(), status: 'QUEUED' }));
    const selected = video(payload);
    if (!incoming.some((q) => q.videoId === selected.videoId)) incoming.unshift({ ...selected, id: crypto.randomUUID(), source: 'manual', requestedByUserId: actorUserId, createdAt: new Date().toISOString(), status: 'QUEUED' });
    const old = (s.queue || []).filter((q) => ['QUEUED', 'PLAYING'].includes(q.status)).concat((s.queue || []).filter((q) => !['QUEUED', 'PLAYING'].includes(q.status)).slice(-50));
    if (old.filter((q) => q.status === 'QUEUED').length + incoming.length > 100) fail('QUEUE_LIMIT', 'Hàng chờ tối đa 100 bài');
    s.queue = action === 'LOAD_VIDEO' && normalizeRoom(room) !== 'shared' ? incoming : [...old, ...incoming];
    if (action === 'LOAD_VIDEO') {
      s.lastFailure = null;
      // An explicit "play this now" replaces whatever playlist was running.
      clearPlaylist(s);
      setCurrent(s, incoming.find((q) => q.videoId === selected.videoId), { record: false });
    } else if (!s.currentVideoId || s.status === 'IDLE') advance(s);
    return;
  }
  if (action === 'QUEUE_REMOVE') {
    if (!(s.queue || []).some((q) => q.id === payload.itemId && q.status === 'QUEUED')) fail('QUEUE_ITEM_NOT_FOUND', 'Bài không còn trong hàng chờ');
    s.queue = s.queue.map((q) => q.id === payload.itemId ? { ...q, status: 'REMOVED' } : q); return;
  }
  if (action === 'QUEUE_CLEAR') { s.queue = (s.queue || []).map((q) => q.status === 'QUEUED' ? { ...q, status: 'REMOVED' } : q); return; }
  if (action === 'QUEUE_REORDER') {
    const waiting = (s.queue || []).filter((q) => q.status === 'QUEUED');
    const ids = payload.itemIds;
    if (!Array.isArray(ids) || ids.length !== waiting.length || new Set(ids).size !== ids.length || ids.some((id) => !waiting.some((q) => q.id === id))) fail('INVALID_QUEUE_ORDER', 'Hàng chờ đã thay đổi, vui lòng thử lại');
    s.queue = [...s.queue.filter((q) => q.status !== 'QUEUED'), ...ids.map((id) => waiting.find((q) => q.id === id))]; return;
  }
  if (action === 'PLAYLIST_PLAY' || action === 'PLAYLIST_SHUFFLE') {
    if (!context.playlist) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
    const mode = action === 'PLAYLIST_SHUFFLE' ? 'shuffle' : (payload.mode === 'shuffle' ? 'shuffle' : 'sequential');
    startPlaylist(s, context.playlist, { mode, startItemId: payload.startItemId, repeat: payload.repeat });
    s.lastFailure = null;
    return;
  }
  if (action === 'PLAYLIST_QUEUE') {
    if (!context.playlist) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
    const items = (context.playlist.items || []).filter((item) => item.available !== false);
    if (!items.length) fail('PLAYLIST_EMPTY', 'Danh sách phát chưa có video nào');
    const waiting = (s.queue || []).filter((q) => q.status === 'QUEUED');
    const capacity = Math.max(0, 100 - waiting.length);
    if (!capacity) fail('QUEUE_LIMIT', 'Hàng chờ đã đầy');
    const added = items.slice(0, capacity).map((item) => ({
      ...video(item), id: crypto.randomUUID(), source: 'playlist', playlistId: Number(context.playlist.id),
      requestedByUserId: actorUserId, createdAt: new Date().toISOString(), status: 'QUEUED',
    }));
    s.queue = [...(s.queue || []).filter((q) => q.status !== 'REMOVED'), ...added];
    if (!s.currentVideoId || s.status === 'IDLE') advance(s);
    return;
  }
  if (action === 'PLAYLIST_STOP') {
    clearPlaylist(s);
    return;
  }
  if (!s.currentVideoId) fail('NO_ACTIVE_MEDIA_SESSION', 'Chưa có video nào đang phát', 409);
  switch (action) {
    case 'PLAY': s.status = 'PLAYING'; break;
    case 'PAUSE': s.status = 'PAUSED'; break;
    case 'TOGGLE_PLAY_PAUSE': s.status = s.status === 'PLAYING' ? 'PAUSED' : 'PLAYING'; break;
    case 'STOP': s.status = 'STOPPED'; s.currentTime = 0; break;
    case 'SEEK': s.currentTime = number(payload.position, 0, Number(s.durationSeconds) || 86400); break;
    case 'NEXT': s.lastFailure = null; advance(s); break;
    case 'PREVIOUS': {
      const history = Array.isArray(s.playlistHistory) ? s.playlistHistory : [];
      const previous = history[history.length - 1];
      if (previous) { s.playlistHistory = history.slice(0, -1); setCurrent(s, previous, { record: false }); break; }
      const fromQueue = [...(s.queue || [])].reverse().find((q) => q.status === 'PLAYED');
      if (!fromQueue) fail('NO_PREVIOUS_TRACK', 'Không có video trước đó');
      setCurrent(s, fromQueue, { record: false }); break;
    }
    default: fail('UNKNOWN_ACTION', 'Lệnh không hợp lệ');
  }
}
function serializeCommand(c) {
  return c ? { commandId: c.commandId, action: c.action, source: c.source, status: c.status, errorCode: c.errorCode, createdAt: c.createdAt, executedAt: c.executedAt } : null;
}
async function authorize(actorUserId, action, source) {
  const e = await access.getEntitlement(actorUserId);
  // Only "add something to the queue" is available to a queue-only grant; every
  // other mutation moves the shared playhead and therefore needs CONTROL.
  const permission = action === 'QUEUE_ADD' || action === 'PLAYLIST_QUEUE' ? 'queue' : 'control';
  if (!access.hasPermission(e, permission) || (source === 'HOTKEY' && !access.hasPermission(e, 'hotkey')) || (source === 'TELEGRAM' && !access.hasPermission(e, 'telegram'))) fail('NOT_FOUND', 'Not found', 404);
}
/** Playlists are loaded before the session lock: no network/DB reads inside the transaction. */
async function loadPlaylistContext(payload) {
  const playlistService = require('./playlist.service');
  const playlistId = Number(payload.playlistId);
  if (!playlistId) fail('PLAYLIST_NOT_FOUND', 'Không tìm thấy danh sách phát', 404);
  return { playlist: await playlistService.getPlayablePlaylist(playlistId) };
}
async function issueCommand({ commandId, action, source = 'WEB', actorUserId, payload = {}, room }) {
  action = String(action || '').toUpperCase();
  await authorize(actorUserId, action, source);
  if (!ACTION_LIST.includes(action)) fail('UNKNOWN_ACTION', 'Lệnh không hợp lệ');
  const key = String(commandId || '').trim();
  if (!key || key.length > 64) fail('MISSING_COMMAND_ID', 'Mã lệnh không hợp lệ');
  // Explicit whitelist: output preferences never enter the journal or broadcasts.
  const safe = Object.fromEntries(['videoId', 'title', 'channelTitle', 'thumbnailUrl', 'durationSeconds', 'queue', 'position', 'itemId', 'itemIds', 'playlistId', 'mode', 'startItemId', 'repeat'].filter((k) => payload[k] !== undefined).map((k) => [k, payload[k]]));
  if (safe.queue) {
    if (!Array.isArray(safe.queue)) fail('INVALID_QUEUE', 'Hàng chờ không hợp lệ');
    safe.queue = safe.queue.map(video);
  }
  const context = ['PLAYLIST_PLAY', 'PLAYLIST_SHUFFLE', 'PLAYLIST_QUEUE'].includes(action) ? await loadPlaylistContext(safe) : {};
  const result = await transaction(async (t) => {
    const s = await getSession(actorUserId, room, t);
    const existing = await Command.findOne({ where: { commandId: key }, transaction: t, lock: t.LOCK.UPDATE });
    if (existing) {
      if (Number(existing.sessionId) !== Number(s.id) || Number(existing.issuedByUserId) !== Number(actorUserId)) fail('COMMAND_ID_CONFLICT', 'Mã lệnh đã được dùng', 409);
      return { command: serializeCommand(existing), state: serializeSession(s), duplicate: true };
    }
    s.currentTime = position(s);
    transition(s, action, safe, actorUserId, room, context);
    s.referenceTime = new Date(); s.revision++; s.controllerUserId = actorUserId;
    const c = await Command.create({ commandId: key, sessionId: s.id, action, source, issuedByUserId: actorUserId, payload: safe, status: 'EXECUTED', executedAt: new Date() }, { transaction: t });
    await s.save({ transaction: t });
    return { command: serializeCommand(c), state: serializeSession(s), duplicate: false };
  }).catch((error) => {
    if (error.name === 'SequelizeUniqueConstraintError') fail('COMMAND_ID_CONFLICT', 'Mã lệnh đã được dùng', 409);
    throw error;
  });
  if (!result.duplicate) await audit.record({ action: action === 'LOAD_VIDEO' ? 'VIDEO_SELECTED' : action, actorUserId, source, metadata: { commandId: key, sessionId: result.state.sessionId, videoId: result.state.video?.videoId } });
  // Resume bookmark: which episode of which playlist this account reached.
  if (!result.duplicate && result.state?.playlist?.currentItemId && result.state?.video) {
    await require('./playlist.service').recordProgress({
      playlistId: result.state.playlist.id,
      userId: actorUserId,
      itemId: result.state.playlist.currentItemId,
      videoId: result.state.video.videoId,
      episodeNumber: result.state.playlist.currentEpisode,
    }).catch(() => {});
  }
  return result;
}
async function acknowledgeCommand({ commandId, actorUserId, room }) {
  // Browser facts (buffering, autoplay, volume) cannot overwrite session intent.
  const s = await getSessionState(actorUserId, room);
  const c = await Command.findOne({ where: { commandId, sessionId: s.sessionId } });
  return { applied: Boolean(c), command: serializeCommand(c), state: s };
}
async function setPlayerPresence(online, userId, room) {
  return transaction(async (t) => {
    const s = await getSession(userId, room, t);
    await s.update({ playerOnline: Boolean(online), playerLastSeenAt: new Date() }, { transaction: t });
    return serializeSession(s);
  });
}
async function syncPlayerProgress(payload, userId, room) {
  return transaction(async (t) => {
    const s = await getSession(userId, room, t);
    // Time/status belong to the server. Only learn duration for this exact track.
    if (payload.currentQueueItemId === s.currentQueueItemId && !s.durationSeconds && payload.durationSeconds > 0) {
      s.durationSeconds = Math.round(number(payload.durationSeconds)); s.revision++;
      await s.save({ transaction: t });
    }
    return serializeSession(s);
  });
}
async function autoAdvance({ userId, room, currentQueueItemId, errorCode } = {}) {
  if (!access.hasPermission(await access.getEntitlement(userId), 'view')) fail('NOT_FOUND', 'Not found', 404);
  const result = await transaction(async (t) => {
    const s = await getSession(userId, room, t);
    if (!currentQueueItemId || currentQueueItemId !== s.currentQueueItemId || !s.currentVideoId) return { advanced: false, stale: true, state: serializeSession(s) };
    const failed = ['2', '5', '100', '101', '150', '153'].includes(String(errorCode));
    // A player-reported ENDED for the CURRENT item is authoritative. The guard
    // only rejects an early report when we actually know the track length, which
    // is what protects against stale/heartbeat-driven transitions.
    const early = s.status !== 'PLAYING' || (Boolean(s.durationSeconds) && position(s) < s.durationSeconds - 3);
    if (!failed && early) return { advanced: false, premature: true, state: serializeSession(s) };
    const previousId = s.currentQueueItemId;
    if (!failed) s.lastFailure = null;
    if (failed) s.lastFailure = { itemId: previousId, at: new Date().toISOString(), message: 'Không thể phát bài này, đã chuyển sang bài tiếp theo.' };
    const advanced = advance(s, failed);
    s.referenceTime = new Date(); s.revision++;
    await s.save({ transaction: t });
    await audit.record({ action: 'AUTO_ADVANCE', actorUserId: userId, source: 'SYSTEM', metadata: { sessionId: s.id, previousId, failed, advanced } });
    return { advanced, state: serializeSession(s) };
  });
  // Bookmark outside the transaction: one write, never inside the session lock.
  if (result.state?.playlist?.currentItemId && result.state?.video) {
    await require('./playlist.service').recordProgress({
      playlistId: result.state.playlist.id,
      userId,
      itemId: result.state.playlist.currentItemId,
      videoId: result.state.video.videoId,
      episodeNumber: result.state.playlist.currentEpisode,
    }).catch(() => {});
  }
  return result;
}
async function recentCommands({ limit = 20, userId, room } = {}) {
  const s = await getSessionState(userId, room);
  return (await Command.findAll({ where: { sessionId: s.sessionId }, order: [['id', 'DESC']], limit: Math.min(Number(limit) || 20, 100) })).map(serializeCommand);
}
async function recentVideos({ limit = 12, userId, room } = {}) {
  const s = await getSessionState(userId, room);
  const rows = await Command.findAll({ where: { sessionId: s.sessionId, action: 'LOAD_VIDEO' }, order: [['id', 'DESC']], limit: 120 });
  const seen = new Set();
  return rows.filter((r) => { const id = r.payload?.videoId; if (!normalizeVideoId(id) || seen.has(id)) return false; seen.add(id); return true; }).slice(0, Math.min(Number(limit) || 12, 50)).map((r) => ({ ...video(r.payload), lastPlayedAt: r.createdAt, lastSource: r.source }));
}

/**
 * Keep a running cycle coherent while its playlist is edited.
 *  - added items are appended to the remaining cycle (they still play this round)
 *  - removed items are marked `skipped`, so the rest of the bag is untouched
 */
async function syncActiveCycle({ playlistId, addedItems = [], removedItemIds = [] }) {
  const sessions = await Session.findAll({ where: { activePlaylistId: Number(playlistId) } });
  for (const s of sessions) {
    let order = Array.isArray(s.playlistOrder) ? [...s.playlistOrder] : [];
    if (!order.length) continue;
    if (removedItemIds.length) {
      const removed = new Set(removedItemIds.map(String));
      order = order.map((entry) => removed.has(String(entry.itemId)) ? { ...entry, skipped: true } : entry);
    }
    if (addedItems.length) {
      const present = new Set(order.map((entry) => String(entry.itemId)));
      const appended = addedItems.filter((item) => !present.has(String(item.id))).map(toCycleEntry);
      order = [...order, ...appended];
    }
    s.playlistOrder = order;
    await s.save();
  }
}
module.exports = {
  ACTIONS, ACTION_LIST, PrivateMediaCommandError, DEFAULT_SESSION_KEY, SHARED_ROOM_KEY,
  normalizeRoom, sessionKeyFor, getSession, getSessionById, getSessionState, serializeSession,
  issueCommand, acknowledgeCommand, setPlayerPresence, syncPlayerProgress, autoAdvance,
  recentCommands, recentVideos, normalizeVideoId, syncActiveCycle,
  // exported for tests
  buildCycle, advance,
};
