'use strict';

/**
 * PRIVATE MEDIA — SYSTEM-WIDE CHAT ("CHAT CHUNG")
 *
 * One channel. Nghe riêng and Nghe chung are two playback modes, not two
 * conversations: whoever writes here is read by everybody, whichever mode they
 * happen to be in. There is deliberately no `room` parameter — a caller cannot
 * split the feed by passing one.
 *
 * Guarantees enforced here:
 *   - the sender is always the authenticated user id (never a body field)
 *   - content is plain text, control characters removed, length capped
 *   - a retry with the same `clientMessageId` returns the original row instead
 *     of creating a duplicate
 *   - the SERVER decides the day (Asia/Ho_Chi_Minh) and stamps every row with
 *     it, so a wrong client clock can neither hide nor leak yesterday's chat
 *   - history is paginated inside the current day and only readable with a
 *     Private Media entitlement
 *   - a revoked account loses both the REST endpoint (404) and the socket
 *
 * Legacy rows written before this change are stored with `channel = 'session'`
 * and are never returned by these queries: a private conversation must not be
 * merged into the public feed.
 */

const { Op } = require('sequelize');
const { PrivateMediaChatMessage: Message, PrivateMediaChatRead: Read, User } = require('../../models');
const access = require('./access.service');
const sessions = require('./session.service');
const chatTime = require('./chatTime');

const CHANNEL = 'global';
const LEGACY_CHANNEL = 'session';
const MAX_LENGTH = 1000;
const PAGE_SIZE = 30;
const RATE_WINDOW_MS = 15_000;
const RATE_MAX = 20;

const buckets = new Map();

class ChatError extends Error {
  constructor(code, message, status = 400) {
    super(message || code);
    this.name = 'ChatError';
    this.code = code;
    this.status = status;
  }
}
const fail = (code, message, status) => { throw new ChatError(code, message, status); };

async function requireEntitled(userId) {
  const entitlement = await access.getEntitlement(userId);
  if (!access.hasPermission(entitlement, 'view')) fail('NOT_FOUND', 'Not found', 404);
  return entitlement;
}

/** Sliding window, per user. Cheap, in-process and enough for one room. */
function consumeRate(userId) {
  const now = Date.now();
  const key = String(userId);
  const bucket = (buckets.get(key) || []).filter((at) => now - at < RATE_WINDOW_MS);
  if (bucket.length >= RATE_MAX) {
    buckets.set(key, bucket);
    fail('CHAT_RATE_LIMITED', 'Bạn gửi hơi nhanh, thử lại sau vài giây.', 429);
  }
  bucket.push(now);
  buckets.set(key, bucket);
  if (buckets.size > 500) {
    for (const [id, times] of buckets) if (!times.some((at) => now - at < RATE_WINDOW_MS)) buckets.delete(id);
  }
}

/**
 * Normalises user text: no markup interpretation, no control characters, no
 * zero-width padding. Newlines are preserved (Shift+Enter is a real feature).
 */
function cleanContent(value) {
  const raw = String(value ?? '');
  // eslint-disable-next-line no-control-regex
  const stripped = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g, '');
  const trimmed = stripped.replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim();
  if (!trimmed) fail('CHAT_EMPTY', 'Tin nhắn đang trống');
  if (trimmed.length > MAX_LENGTH) fail('CHAT_TOO_LONG', `Tin nhắn tối đa ${MAX_LENGTH} ký tự`);
  return trimmed;
}

function serialize(row, users) {
  const user = users?.get(Number(row.userId));
  return {
    id: Number(row.id),
    content: row.content,
    createdAt: row.createdAt,
    // The day the server filed this message under. A client that has already
    // rolled over to a new day uses it to ignore a message that crossed the
    // boundary while in flight.
    day: row.day || null,
    user: {
      id: Number(row.userId),
      name: user?.name || 'Thành viên',
      avatarUrl: user?.avatarUrl || null,
    },
  };
}

function dayMeta(at = new Date()) {
  const window = chatTime.dayWindow(at);
  return { channel: CHANNEL, day: window.day, dayStartsAt: window.dayStartsAt, dayEndsAt: window.dayEndsAt, serverNow: window.serverNow };
}

async function loadUsers(rows) {
  const users = new Map();
  if (!rows.length) return users;
  const people = await User.findAll({
    where: { id: { [Op.in]: [...new Set(rows.map((row) => Number(row.userId)))] } },
    attributes: ['id', 'name', 'avatarUrl'],
  });
  people.forEach((person) => users.set(Number(person.id), person));
  return users;
}

async function readMarker(sessionId, userId) {
  if (!sessionId || !userId) return null;
  return Read.findOne({ where: { sessionId: Number(sessionId), userId: Number(userId) } });
}

/**
 * Unread = today's messages newer than this account's marker, written by
 * somebody else. Own messages never count, and a duplicated socket delivery
 * cannot inflate it because the count is derived from ids, not from events.
 *
 * A marker from yesterday is naturally older than every id of today, so the
 * count resets at 00:00 without any scheduled job.
 */
async function unreadCount({ sessionId, userId, lastReadMessageId, day }) {
  if (!sessionId) return 0;
  const where = {
    channel: CHANNEL,
    day,
    sessionId: Number(sessionId),
    deletedAt: null,
    userId: { [Op.ne]: Number(userId) },
  };
  if (lastReadMessageId) where.id = { [Op.gt]: Number(lastReadMessageId) };
  return Message.count({ where });
}

async function listMessages({ userId, beforeId = null, afterId = null, limit = PAGE_SIZE, at = new Date() } = {}) {
  await requireEntitled(userId);
  const anchor = await sessions.getChatAnchorSession();
  const meta = dayMeta(at);
  const take = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), 100);
  const where = { channel: CHANNEL, day: meta.day, sessionId: anchor.sessionId, deletedAt: null };
  const marker = await readMarker(anchor.sessionId, userId);
  const lastReadMessageId = marker?.lastReadMessageId == null ? null : Number(marker.lastReadMessageId);
  const unread = await unreadCount({ sessionId: anchor.sessionId, userId, lastReadMessageId, day: meta.day });

  // Reconnect catch-up: everything after the cursor this tab already holds.
  // Ascending order and the same shape as a page, so the client can merge.
  // A cursor from yesterday simply matches nothing and the whole day comes back.
  if (afterId) {
    const rows = await Message.findAll({
      where: { ...where, id: { [Op.gt]: Number(afterId) } },
      order: [['id', 'ASC']],
      limit: take,
    });
    const people = await loadUsers(rows);
    return {
      ...meta,
      sessionId: anchor.sessionId,
      messages: rows.map((row) => serialize(row, people)),
      hasMore: rows.length === take,
      nextBeforeId: null,
      nextAfterId: rows.length ? Number(rows[rows.length - 1].id) : Number(afterId),
      lastReadMessageId,
      unread,
      mode: 'after',
    };
  }

  if (beforeId) where.id = { [Op.lt]: Number(beforeId) };

  const rows = await Message.findAll({ where, order: [['id', 'DESC']], limit: take + 1 });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).reverse();
  const people = await loadUsers(page);
  return {
    ...meta,
    sessionId: anchor.sessionId,
    messages: page.map((row) => serialize(row, people)),
    hasMore,
    nextBeforeId: hasMore && page.length ? Number(page[0].id) : null,
    nextAfterId: page.length ? Number(page[page.length - 1].id) : null,
    lastReadMessageId,
    unread,
    mode: 'page',
  };
}

/** Move the marker forward only. Returns the stored value and the new unread. */
async function markRead({ userId, messageId = null, at = new Date() } = {}) {
  await requireEntitled(userId);
  const anchor = await sessions.getChatAnchorSession();
  const meta = dayMeta(at);
  let target = messageId == null ? null : Number(messageId);
  if (target == null) {
    const newest = await Message.findOne({
      where: { channel: CHANNEL, day: meta.day, sessionId: anchor.sessionId, deletedAt: null },
      order: [['id', 'DESC']],
      attributes: ['id'],
    });
    target = newest ? Number(newest.id) : null;
  }
  const existing = await readMarker(anchor.sessionId, userId);
  if (target == null) {
    return {
      ...meta,
      sessionId: anchor.sessionId,
      lastReadMessageId: existing?.lastReadMessageId == null ? null : Number(existing.lastReadMessageId),
      unread: 0,
    };
  }
  if (existing) {
    if (!existing.lastReadMessageId || Number(existing.lastReadMessageId) < target) {
      await existing.update({ lastReadMessageId: target });
    }
  } else {
    await Read.create({ sessionId: anchor.sessionId, userId: Number(userId), lastReadMessageId: target });
  }
  const stored = Math.max(target, Number(existing?.lastReadMessageId) || 0);
  return {
    ...meta,
    sessionId: anchor.sessionId,
    lastReadMessageId: stored,
    unread: await unreadCount({ sessionId: anchor.sessionId, userId, lastReadMessageId: stored, day: meta.day }),
  };
}

async function getUnread({ userId, at = new Date() } = {}) {
  await requireEntitled(userId);
  const anchor = await sessions.getChatAnchorSession();
  const meta = dayMeta(at);
  const marker = await readMarker(anchor.sessionId, userId);
  const lastReadMessageId = marker?.lastReadMessageId == null ? null : Number(marker.lastReadMessageId);
  return {
    ...meta,
    sessionId: anchor.sessionId,
    lastReadMessageId,
    unread: await unreadCount({ sessionId: anchor.sessionId, userId, lastReadMessageId, day: meta.day }),
  };
}

async function createMessage({ userId, content, clientMessageId = null, at = new Date() } = {}) {
  await requireEntitled(userId);
  consumeRate(userId);

  const text = cleanContent(content);
  const anchor = await sessions.getChatAnchorSession();
  const meta = dayMeta(at);
  const key = clientMessageId ? String(clientMessageId).slice(0, 64) : null;
  const scope = { channel: CHANNEL, day: meta.day, sessionId: anchor.sessionId, userId: Number(userId) };

  if (key) {
    const existing = await Message.findOne({ where: { ...scope, clientMessageId: key } });
    if (existing) {
      const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
      return {
        ...meta,
        message: serialize(existing, new Map([[Number(userId), user]])),
        duplicate: true,
        sessionId: anchor.sessionId,
      };
    }
  }

  let row;
  try {
    row = await Message.create({
      ...scope,
      content: text,
      clientMessageId: key,
    });
  } catch (error) {
    // Concurrent retry of the same client id: return the winner.
    if (error?.name === 'SequelizeUniqueConstraintError' && key) {
      const existing = await Message.findOne({ where: { ...scope, clientMessageId: key } });
      if (existing) {
        const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
        return {
          ...meta,
          message: serialize(existing, new Map([[Number(userId), user]])),
          duplicate: true,
          sessionId: anchor.sessionId,
        };
      }
    }
    throw error;
  }

  const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
  return {
    ...meta,
    message: serialize(row, new Map([[Number(userId), user]])),
    duplicate: false,
    sessionId: anchor.sessionId,
  };
}

/** Test seam: clears one user's window so suites do not depend on timing. */
function resetRateLimit(userId) {
  buckets.delete(String(userId));
}

module.exports = {
  ChatError,
  CHANNEL,
  LEGACY_CHANNEL,
  MAX_LENGTH,
  PAGE_SIZE,
  listMessages,
  createMessage,
  cleanContent,
  resetRateLimit,
  markRead,
  getUnread,
  unreadCount,
  dayMeta,
};
