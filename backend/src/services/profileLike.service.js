const { User, ProfileLike } = require('../models');

function vietnamDateKey(value = new Date()) {
  const vietnamTime = new Date(value.getTime() + 7 * 60 * 60 * 1000);
  return vietnamTime.toISOString().slice(0, 10);
}

async function ensureActiveTarget(targetUserId) {
  const user = await User.findOne({ where: { id: targetUserId, status: 'active' } });
  if (!user) {
    const err = new Error('Không tìm thấy người dùng');
    err.status = 404;
    throw err;
  }
  return user;
}

function normalizeId(value) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

async function getProfileLikes({ viewerId, targetUserId }) {
  const targetId = normalizeId(targetUserId);
  if (!targetId) {
    const err = new Error('User id không hợp lệ');
    err.status = 400;
    throw err;
  }
  await ensureActiveTarget(targetId);

  const today = vietnamDateKey();
  const [totalCount, todayCount, likedToday] = await Promise.all([
    ProfileLike.count({ where: { targetUserId: targetId } }),
    ProfileLike.count({ where: { targetUserId: targetId, likedDate: today } }),
    viewerId
      ? ProfileLike.count({ where: { likerId: viewerId, targetUserId: targetId, likedDate: today } })
      : 0,
  ]);

  return {
    totalCount,
    todayCount,
    likedToday: Number(likedToday || 0) > 0,
    likedDate: today,
    canLikeToday: String(viewerId || '') !== String(targetId) && Number(likedToday || 0) === 0,
  };
}

async function likeProfile({ likerId, targetUserId }) {
  const targetId = normalizeId(targetUserId);
  if (!targetId) {
    const err = new Error('User id không hợp lệ');
    err.status = 400;
    throw err;
  }
  if (String(likerId) === String(targetId)) {
    const err = new Error('Không thể tự tim hồ sơ của chính mình');
    err.status = 400;
    throw err;
  }

  await ensureActiveTarget(targetId);
  const today = vietnamDateKey();

  const [like, created] = await ProfileLike.findOrCreate({
    where: { likerId, targetUserId: targetId, likedDate: today },
    defaults: { likerId, targetUserId: targetId, likedDate: today },
  });

  const summary = await getProfileLikes({ viewerId: likerId, targetUserId: targetId });
  return {
    ...summary,
    created,
    likeId: like.id,
  };
}

module.exports = {
  getProfileLikes,
  likeProfile,
  vietnamDateKey,
};
