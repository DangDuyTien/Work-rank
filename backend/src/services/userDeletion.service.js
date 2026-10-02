'use strict';

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const {
  User,
  Team,
  SeasonTeamMember,
  YouTubeChannel,
  UserProfilePreference,
  UserProfileImage,
  Friendship,
  ProfileLike,
  CompetitionAuditLog,
} = require('../models');
const competitionRealtime = require('./competition/competitionRealtime.service');

/**
 * Delete a user account (Admin Delete or Self Delete)
 *
 * @param {Object} options
 * @param {number|string} options.targetUserId - ID of the user to delete
 * @param {Object} options.actorUser - Currently authenticated user
 * @param {boolean} options.isSelfDelete - True if requested via self-delete endpoint
 * @param {Object} [options.req] - Express request object for socket broadcasting
 */
async function deleteUserAccount({ targetUserId, actorUser, isSelfDelete = false, req = null }) {
  if (!actorUser) {
    const error = new Error('Yêu cầu xác thực tài khoản');
    error.statusCode = 401;
    throw error;
  }

  const numTargetId = Number(targetUserId);
  if (!Number.isInteger(numTargetId) || numTargetId <= 0) {
    const error = new Error('ID người dùng không hợp lệ');
    error.statusCode = 400;
    throw error;
  }

  // Security Check 1: Self-delete MUST target actorUser.id
  if (isSelfDelete && numTargetId !== Number(actorUser.id)) {
    const error = new Error('Bạn chỉ có quyền xóa tài khoản của chính mình');
    error.statusCode = 403;
    throw error;
  }

  // Security Check 2: Non-self delete requires ADMIN role
  if (!isSelfDelete && actorUser.role !== 'admin') {
    const error = new Error('Chỉ Quản trị viên mới có quyền xóa tài khoản nhân sự khác');
    error.statusCode = 403;
    throw error;
  }

  // Security Check 3: Admin self-delete protection in Admin User Management
  if (!isSelfDelete && actorUser.role === 'admin' && numTargetId === Number(actorUser.id)) {
    const error = new Error('Admin không thể tự xóa tài khoản của chính mình qua quản trị người dùng. Nếu muốn xóa tài khoản, vui lòng sử dụng chức năng Xóa tài khoản trong Cài đặt.');
    error.statusCode = 400;
    throw error;
  }

  // Find target user
  const target = await User.findByPk(numTargetId);
  if (!target) {
    const error = new Error('Không tìm thấy tài khoản người dùng');
    error.statusCode = 404;
    throw error;
  }

  if (target.status === 'inactive') {
    const error = new Error('Tài khoản này đã bị xóa hoặc đã ngừng hoạt động');
    error.statusCode = 400;
    throw error;
  }

  const oldTeamId = target.teamId;
  const originalName = target.name;
  const originalEmail = target.email;
  const originalRole = target.role;

  const anonymizedEmail = `deleted_${target.id}_${Date.now()}@deleted.workrank.io`;
  const anonymizedName = 'Tài khoản đã xóa';

  // Execute deletion inside atomic transaction
  await sequelize.transaction(async (transaction) => {
    // 1. YouTube Channels: Decouple user from company channels
    await YouTubeChannel.update(
      { assignedUserId: null },
      { where: { assignedUserId: target.id }, transaction }
    );

    // 2. Team: Remove ownership if user is owner/leader
    await Team.update(
      { ownerId: null },
      { where: { ownerId: target.id }, transaction }
    );

    // 3. Season team membership: Remove from active season rosters
    await SeasonTeamMember.destroy({
      where: { userId: target.id },
      transaction,
    });

    // 4. Social & Profile cleanup
    await UserProfilePreference.destroy({
      where: { userId: target.id },
      transaction,
    });
    await UserProfileImage.destroy({
      where: { userId: target.id },
      transaction,
    });
    await Friendship.destroy({
      where: {
        [Op.or]: [{ requesterId: target.id }, { addresseeId: target.id }],
      },
      transaction,
    });
    await ProfileLike.destroy({
      where: {
        [Op.or]: [{ likerId: target.id }, { targetUserId: target.id }],
      },
      transaction,
    });

    // 5. Audit Log Entry
    try {
      await CompetitionAuditLog.create(
        {
          actorId: actorUser.id,
          action: isSelfDelete ? 'USER_SELF_DELETED' : 'USER_DELETED_BY_ADMIN',
          entityType: 'USER',
          entityId: String(target.id),
          beforeState: {
            id: target.id,
            name: originalName,
            email: originalEmail,
            role: originalRole,
            teamId: oldTeamId,
          },
          afterState: {
            status: 'inactive',
            teamId: null,
          },
          reason: isSelfDelete ? 'Người dùng yêu cầu tự xóa tài khoản' : `Admin #${actorUser.id} xóa tài khoản`,
        },
        { transaction }
      );
    } catch (auditErr) {
      console.warn('[userDeletion] Could not record CompetitionAuditLog:', auditErr.message);
    }

    // 6. User record soft delete & PII anonymization
    await target.update(
      {
        name: anonymizedName,
        email: anonymizedEmail,
        passwordHash: `DELETED_PWD_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        refreshTokenHash: null,
        status: 'inactive',
        teamId: null,
        phone: null,
        bio: null,
        jobTitle: null,
        department: null,
        isVerified: false,
        isDev: false,
        lastSeenAt: null,
      },
      { transaction }
    );
  });

  // Realtime & Socket propagation
  try {
    const io = req?.app?.get('io') || competitionRealtime.getIo();
    if (io) {
      io.emit('user:deleted', { userId: target.id });
      io.to(`user:${target.id}`).emit('auth:revoked', { message: 'Tài khoản đã bị xóa.' });
      if (oldTeamId) {
        io.emit('team:membership:updated', {
          userId: target.id,
          oldTeamId,
          newTeamId: null,
          teamName: null,
        });
        io.to(`team:${oldTeamId}`).emit('team:membership:updated', {
          userId: target.id,
          oldTeamId,
          newTeamId: null,
          teamName: null,
        });
      }
    }
  } catch (ioErr) {
    console.warn('[userDeletion] Socket emit error:', ioErr.message);
  }

  return {
    deletedUserId: target.id,
    originalName,
    originalEmail,
    success: true,
    data: {
      id: target.id,
      email: anonymizedEmail,
      status: 'inactive',
    },
  };
}

module.exports = {
  deleteUserAccount,
};
