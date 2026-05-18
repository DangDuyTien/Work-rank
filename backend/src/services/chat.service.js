const { Op, UniqueConstraintError } = require('sequelize');
const { ChatMessage, Friendship, sequelize } = require('../models');

const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 80;

function normalizeId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeLimit(value) {
  const limit = Number(value || DEFAULT_LIMIT);
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit)));
}

function normalizeBody(value) {
  const body = String(value || '').replace(/\r\n/g, '\n').trim();
  return body.slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeClientMessageId(value) {
  const id = String(value || '').trim();
  if (!id) return null;
  return id.slice(0, 80);
}

function serializeMessage(message) {
  const plain = message?.toJSON ? message.toJSON() : { ...(message || {}) };
  return {
    id: plain.id,
    senderId: plain.senderId,
    receiverId: plain.receiverId,
    body: plain.body,
    clientMessageId: plain.clientMessageId || null,
    readAt: plain.readAt || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
}

async function areFriends(userId, friendId) {
  return Boolean(await Friendship.findOne({
    where: {
      status: 'accepted',
      [Op.or]: [
        { requesterId: userId, addresseeId: friendId },
        { requesterId: friendId, addresseeId: userId },
      ],
    },
    attributes: ['id'],
  }));
}

async function assertCanChat(userId, friendValue) {
  const friendId = normalizeId(friendValue);
  if (!friendId || String(friendId) === String(userId)) {
    const err = new Error('Người nhận không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (!(await areFriends(userId, friendId))) {
    const err = new Error('Chỉ có thể nhắn tin với bạn bè');
    err.status = 403;
    throw err;
  }
  return friendId;
}

async function listMessages(currentUserId, friendValue, options = {}) {
  const friendId = await assertCanChat(currentUserId, friendValue);
  const limit = normalizeLimit(options.limit);
  const beforeId = normalizeId(options.beforeId);
  const where = {
    [Op.or]: [
      { senderId: currentUserId, receiverId: friendId },
      { senderId: friendId, receiverId: currentUserId },
    ],
  };
  if (beforeId) where.id = { [Op.lt]: beforeId };

  const rows = await ChatMessage.findAll({
    where,
    order: [['id', 'DESC']],
    limit: limit + 1,
  });
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const data = pageRows.reverse().map(serializeMessage);
  return {
    data,
    pagination: {
      hasMore,
      nextBeforeId: hasMore && data[0] ? data[0].id : null,
      limit,
    },
  };
}

async function sendMessage(currentUserId, friendValue, bodyValue, clientMessageValue) {
  const friendId = await assertCanChat(currentUserId, friendValue);
  const body = normalizeBody(bodyValue);
  if (!body) {
    const err = new Error('Tin nhắn không được để trống');
    err.status = 400;
    throw err;
  }

  const clientMessageId = normalizeClientMessageId(clientMessageValue);
  if (clientMessageId) {
    const existing = await ChatMessage.findOne({ where: { senderId: currentUserId, clientMessageId } });
    if (existing && String(existing.receiverId) === String(friendId)) return serializeMessage(existing);
    if (existing) {
      const err = new Error('Mã tin nhắn client không hợp lệ');
      err.status = 409;
      throw err;
    }
  }

  try {
    const message = await ChatMessage.create({
      senderId: currentUserId,
      receiverId: friendId,
      body,
      clientMessageId,
    });
    return serializeMessage(message);
  } catch (error) {
    if (clientMessageId && error instanceof UniqueConstraintError) {
      const existing = await ChatMessage.findOne({ where: { senderId: currentUserId, clientMessageId } });
      if (existing && String(existing.receiverId) === String(friendId)) return serializeMessage(existing);
    }
    throw error;
  }
}

async function unreadCounts(currentUserId) {
  const friendships = await Friendship.findAll({
    where: {
      status: 'accepted',
      [Op.or]: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
    },
    attributes: ['requesterId', 'addresseeId'],
    raw: true,
  });
  const friendIds = friendships.map((row) => (
    String(row.requesterId) === String(currentUserId) ? row.addresseeId : row.requesterId
  ));
  if (friendIds.length === 0) return {};

  const rows = await ChatMessage.findAll({
    attributes: [
      'senderId',
      [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
    ],
    where: {
      receiverId: currentUserId,
      senderId: { [Op.in]: friendIds },
      readAt: null,
    },
    group: ['senderId'],
    raw: true,
  });

  return rows.reduce((acc, row) => {
    acc[String(row.senderId)] = Number(row.count || 0);
    return acc;
  }, {});
}

async function markRead(currentUserId, friendValue) {
  const friendId = await assertCanChat(currentUserId, friendValue);
  const readAt = new Date();
  const [count] = await ChatMessage.update(
    { readAt },
    {
      where: {
        senderId: friendId,
        receiverId: currentUserId,
        readAt: null,
      },
    },
  );
  return { friendId, count, readAt: readAt.toISOString() };
}

module.exports = {
  areFriends,
  listMessages,
  markRead,
  sendMessage,
  unreadCounts,
};
