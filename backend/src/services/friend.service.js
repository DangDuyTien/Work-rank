const { Op } = require('sequelize');
const { Friendship, User, UserProfilePreference } = require('../models');
const sanitizeUser = require('../utils/sanitizeUser');
const { decorateUserPresence } = require('./userPresence.service');

const userAttributes = ['id', 'name', 'email', 'role', 'teamId', 'isVerified', 'isSimulated', 'status', 'lastSeenAt'];
const userInclude = [{ model: UserProfilePreference, attributes: ['avatarData'], required: false }];

function normalizeId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function serializeUser(user) {
  const plain = sanitizeUser(user) || {};
  const preference = plain.UserProfilePreference || plain.userProfilePreference || null;
  delete plain.UserProfilePreference;
  delete plain.userProfilePreference;
  return decorateUserPresence({
    ...plain,
    avatarData: preference?.avatarData || null,
  });
}

function serializeFriendship(friendship, currentUserId) {
  const plain = friendship?.toJSON ? friendship.toJSON() : { ...(friendship || {}) };
  const currentId = String(currentUserId);
  const direction = String(plain.requesterId) === currentId ? 'outgoing' : 'incoming';
  const friend = direction === 'outgoing' ? plain.Addressee : plain.Requester;

  return {
    id: plain.id,
    friendshipId: plain.id,
    requesterId: plain.requesterId,
    addresseeId: plain.addresseeId,
    status: plain.status,
    direction,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    friend: friend ? serializeUser(friend) : null,
  };
}

async function findExistingBetween(userId, targetUserId) {
  return Friendship.findOne({
    where: {
      [Op.or]: [
        { requesterId: userId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: userId },
      ],
    },
  });
}

function friendshipInclude() {
  return [
    { model: User, as: 'Requester', attributes: userAttributes, include: userInclude },
    { model: User, as: 'Addressee', attributes: userAttributes, include: userInclude },
  ];
}

async function reloadFriendship(friendship) {
  return Friendship.findByPk(friendship.id, { include: friendshipInclude() });
}

async function listFriends(currentUserId) {
  const rows = await Friendship.findAll({
    where: {
      status: 'accepted',
      [Op.or]: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
    },
    include: friendshipInclude(),
    order: [['updatedAt', 'DESC']],
  });

  return rows.map((row) => serializeFriendship(row, currentUserId)).filter((row) => row.friend);
}

async function listRequests(currentUserId) {
  const rows = await Friendship.findAll({
    where: {
      status: 'pending',
      [Op.or]: [{ requesterId: currentUserId }, { addresseeId: currentUserId }],
    },
    include: friendshipInclude(),
    order: [['createdAt', 'DESC']],
  });

  const serialized = rows.map((row) => serializeFriendship(row, currentUserId)).filter((row) => row.friend);
  return {
    incoming: serialized.filter((row) => row.direction === 'incoming'),
    outgoing: serialized.filter((row) => row.direction === 'outgoing'),
  };
}

async function sendRequest(currentUserId, targetValue) {
  const targetUserId = normalizeId(targetValue);
  if (!targetUserId) {
    const err = new Error('User id không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (String(currentUserId) === String(targetUserId)) {
    const err = new Error('Không thể tự kết bạn với chính mình');
    err.status = 400;
    throw err;
  }

  const targetUser = await User.findOne({ where: { id: targetUserId, status: 'active' } });
  if (!targetUser) {
    const err = new Error('Không tìm thấy người dùng');
    err.status = 404;
    throw err;
  }

  const existing = await findExistingBetween(currentUserId, targetUserId);
  if (existing?.status === 'accepted') {
    const err = new Error('Hai tài khoản đã là bạn bè');
    err.status = 409;
    throw err;
  }

  if (existing?.status === 'pending') {
    const isIncoming = String(existing.addresseeId) === String(currentUserId);
    if (isIncoming) {
      await existing.update({ status: 'accepted' });
      return serializeFriendship(await reloadFriendship(existing), currentUserId);
    }

    const err = new Error('Lời mời kết bạn đã được gửi trước đó');
    err.status = 409;
    throw err;
  }

  const friendship = existing
    ? await existing.update({ requesterId: currentUserId, addresseeId: targetUserId, status: 'pending' })
    : await Friendship.create({ requesterId: currentUserId, addresseeId: targetUserId, status: 'pending' });

  return serializeFriendship(await reloadFriendship(friendship), currentUserId);
}

async function acceptRequest(currentUserId, requestId) {
  const friendship = await Friendship.findByPk(requestId);
  if (!friendship || friendship.status !== 'pending') {
    const err = new Error('Không tìm thấy lời mời đang chờ');
    err.status = 404;
    throw err;
  }
  if (String(friendship.addresseeId) !== String(currentUserId)) {
    const err = new Error('Bạn không có quyền chấp nhận lời mời này');
    err.status = 403;
    throw err;
  }

  await friendship.update({ status: 'accepted' });
  return serializeFriendship(await reloadFriendship(friendship), currentUserId);
}

async function declineRequest(currentUserId, requestId) {
  const friendship = await Friendship.findByPk(requestId);
  if (!friendship || friendship.status !== 'pending') {
    const err = new Error('Không tìm thấy lời mời đang chờ');
    err.status = 404;
    throw err;
  }
  if (String(friendship.addresseeId) !== String(currentUserId)) {
    const err = new Error('Bạn không có quyền từ chối lời mời này');
    err.status = 403;
    throw err;
  }

  await friendship.update({ status: 'declined' });
  return { ok: true };
}

async function cancelRequest(currentUserId, requestId) {
  const friendship = await Friendship.findByPk(requestId);
  if (!friendship || friendship.status !== 'pending') {
    const err = new Error('Không tìm thấy lời mời đang chờ');
    err.status = 404;
    throw err;
  }
  if (String(friendship.requesterId) !== String(currentUserId)) {
    const err = new Error('Bạn không có quyền hủy lời mời này');
    err.status = 403;
    throw err;
  }

  await friendship.destroy();
  return { ok: true };
}

async function removeFriend(currentUserId, targetValue) {
  const targetUserId = normalizeId(targetValue);
  if (!targetUserId) {
    const err = new Error('User id không hợp lệ');
    err.status = 400;
    throw err;
  }

  const deleted = await Friendship.destroy({
    where: {
      status: 'accepted',
      [Op.or]: [
        { requesterId: currentUserId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: currentUserId },
      ],
    },
  });

  if (!deleted) {
    const err = new Error('Không tìm thấy quan hệ bạn bè');
    err.status = 404;
    throw err;
  }

  return { ok: true };
}

module.exports = {
  acceptRequest,
  cancelRequest,
  declineRequest,
  listFriends,
  listRequests,
  removeFriend,
  sendRequest,
};
