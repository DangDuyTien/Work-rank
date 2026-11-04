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
const { PrivateMediaChatMessage: Message, User } = require('../../models');
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

async function listMessages({ userId, room, beforeId = null, limit = PAGE_SIZE } = {}) {
  await requireEntitled(userId);
  const state = await sessions.getSessionState(userId, room);
  const take = Math.min(Math.max(Number(limit) || PAGE_SIZE, 1), 100);
  const where = { sessionId: state.sessionId, deletedAt: null };
  if (beforeId) where.id = { [Op.lt]: Number(beforeId) };

  const rows = await Message.findAll({ where, order: [['id', 'DESC']], limit: take + 1 });
  const hasMore = rows.length > take;
  const page = rows.slice(0, take).reverse();
  const users = new Map();
  if (page.length) {
    const people = await User.findAll({ where: { id: { [Op.in]: [...new Set(page.map((row) => Number(row.userId)))] } }, attributes: ['id', 'name', 'avatarUrl'] });
    people.forEach((person) => users.set(Number(person.id), person));
  }
  return {
    sessionId: state.sessionId,
    sessionKey: state.sessionKey,
    messages: page.map((row) => serialize(row, users)),
    hasMore,
    nextBeforeId: hasMore && page.length ? page[0].id : null,
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
};
