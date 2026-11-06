'use strict';

/**
 * PRIVATE MEDIA — SHARED LISTENING CHAT
 *
 * Guarantees enforced here:
 *   - the sender is always the authenticated user id (never a body field)
 *   - content is plain text, control characters removed, length capped
 *   - a retry with the same `clientMessageId` returns the original row instead
 *     of creating a duplicate
 *   - history is paginated and only readable with a Private Media entitlement
 *     for the same playback session
 *   - a revoked account loses both the REST endpoint (404) and the socket
 */

const { Op } = require('sequelize');
const { PrivateMediaChatMessage: Message, PrivateMediaChatRead: Read, User } = require('../../models');
const access = require('./access.service');
const sessions = require('./session.service');

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
    user: {
      id: Number(row.userId),
      name: user?.name || 'Thành viên',
      avatarUrl: user?.avatarUrl || null,
    },
  };
}

async function listMessages({ userId, room, beforeId = null, afterId = null, limit = PAGE_SIZE } = {}) {
  await requireEntitled(userId);
  const state = await sessions.getSessionState(userId, room);
  const take = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), 100);
  const where = { sessionId: state.sessionId, deletedAt: null };
  const marker = await readMarker(state.sessionId, userId);
  const lastReadMessageId = marker?.lastReadMessageId == null ? null : Number(marker.lastReadMessageId);

  // Reconnect catch-up: everything after the cursor this tab already holds.
  // Ascending order and the same shape as a page, so the client can merge.
  if (afterId) {
    const rows = await Message.findAll({
      where: { ...where, id: { [Op.gt]: Number(afterId) } },
      order: [['id', 'ASC']],
      limit: take,
    });
    const people = await loadUsers(rows);
    return {
      sessionId: state.sessionId,
      sessionKey: state.sessionKey,
      messages: rows.map((row) => serialize(row, people)),
      hasMore: rows.length === take,
      nextBeforeId: null,
      nextAfterId: rows.length ? rows[rows.length - 1].id : Number(afterId),
      lastReadMessageId,
      unread: await unreadCount(state.sessionId, userId, lastReadMessageId),
      mode: 'after',
    };
  }

  if (beforeId) where.id = { [Op.lt]: Number(beforeId) };

  const rows = await Message.findAll({ where, order: [['id', 'DESC']], limit: take + 1 });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).reverse();
  const users = await loadUsers(page);
  return {
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    messages: page.map((row) => serialize(row, users)),
    hasMore,
    nextBeforeId: hasMore && page.length ? page[0].id : null,
    nextAfterId: page.length ? page[page.length - 1].id : null,
    lastReadMessageId,
    unread: await unreadCount(state.sessionId, userId, lastReadMessageId),
    mode: 'page',
  };
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
 * Unread = messages newer than this account's marker, written by somebody else.
 * Own messages never count, and a duplicated socket delivery cannot inflate it
 * because the count is derived from ids, not from an event counter.
 */
async function unreadCount(sessionId, userId, lastReadMessageId) {
  if (!sessionId) return 0;
  const where = {
    sessionId: Number(sessionId),
    deletedAt: null,
    userId: { [Op.ne]: Number(userId) },
  };
  if (lastReadMessageId) where.id = { [Op.gt]: Number(lastReadMessageId) };
  return Message.count({ where });
}

/** Move the marker forward only. Returns the stored value and the new unread. */
async function markRead({ userId, room, messageId = null } = {}) {
  await requireEntitled(userId);
  const state = await sessions.getSessionState(userId, room);
  let target = messageId == null ? null : Number(messageId);
  if (target == null) {
    const newest = await Message.findOne({
      where: { sessionId: state.sessionId, deletedAt: null },
      order: [['id', 'DESC']],
      attributes: ['id'],
    });
    target = newest ? Number(newest.id) : null;
  }
  const existing = await readMarker(state.sessionId, userId);
  if (target == null) {
    return { sessionId: state.sessionId, lastReadMessageId: existing?.lastReadMessageId ?? null, unread: 0 };
  }
  if (existing) {
    if (!existing.lastReadMessageId || Number(existing.lastReadMessageId) < target) {
      await existing.update({ lastReadMessageId: target });
    }
  } else {
    await Read.create({ sessionId: state.sessionId, userId: Number(userId), lastReadMessageId: target });
  }
  const stored = Math.max(target, Number(existing?.lastReadMessageId) || 0);
  return {
    sessionId: state.sessionId,
    lastReadMessageId: stored,
    unread: await unreadCount(state.sessionId, userId, stored),
  };
}

async function getUnread({ userId, room } = {}) {
  await requireEntitled(userId);
  const state = await sessions.getSessionState(userId, room);
  const marker = await readMarker(state.sessionId, userId);
  const lastReadMessageId = marker?.lastReadMessageId == null ? null : Number(marker.lastReadMessageId);
  return {
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    lastReadMessageId,
    unread: await unreadCount(state.sessionId, userId, lastReadMessageId),
  };
}

async function createMessage({ userId, room, content, clientMessageId = null } = {}) {
  await requireEntitled(userId);
  consumeRate(userId);

  const text = cleanContent(content);
  const state = await sessions.getSessionState(userId, room);
  const key = clientMessageId ? String(clientMessageId).slice(0, 64) : null;

  if (key) {
    const existing = await Message.findOne({ where: { sessionId: state.sessionId, userId: Number(userId), clientMessageId: key } });
    if (existing) {
      const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
      return { message: serialize(existing, new Map([[Number(userId), user]])), duplicate: true, sessionId: state.sessionId, sessionKey: state.sessionKey };
    }
  }

  let row;
  try {
    row = await Message.create({
      sessionId: state.sessionId,
      userId: Number(userId),
      content: text,
      clientMessageId: key,
    });
  } catch (error) {
    // Concurrent retry of the same client id: return the winner.
    if (error?.name === 'SequelizeUniqueConstraintError' && key) {
      const existing = await Message.findOne({ where: { sessionId: state.sessionId, userId: Number(userId), clientMessageId: key } });
      if (existing) {
        const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
        return { message: serialize(existing, new Map([[Number(userId), user]])), duplicate: true, sessionId: state.sessionId, sessionKey: state.sessionKey };
      }
    }
    throw error;
  }

  const user = await User.findByPk(Number(userId), { attributes: ['id', 'name', 'avatarUrl'] });
  return {
    message: serialize(row, new Map([[Number(userId), user]])),
    duplicate: false,
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
  };
}

/** Test seam: clears one user's window so suites do not depend on timing. */
function resetRateLimit(userId) {
  buckets.delete(String(userId));
}

module.exports = {
  ChatError,
  MAX_LENGTH,
  listMessages,
  createMessage,
  cleanContent,
  resetRateLimit,
  markRead,
  getUnread,
  unreadCount,
};
