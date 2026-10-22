'use strict';

const { TypingRoom, TypingPlayer } = require('../models');

/**
 * Validate whether a user can access a game room.
 *
 * Game Center currently ships Typing Battle and Drawing. Drawing is a
 * single-player canvas (no rooms), so room authorization only covers the
 * typing room contract. New room-based games must add their branch here.
 *
 * @param {object} params
 * @param {number|string} params.userId
 * @param {string} [params.userRole] - Reserved for admin-only room modes
 * @param {number|string} params.roomId - Numeric id or room code
 * @param {'typing'|'typing_battle'} params.gameType
 * @param {boolean} [params.clientSpectatorHint] - Client hint if they want spectator mode
 * @returns {Promise<{
 *   allowed: boolean,
 *   roomId?: number,
 *   isSpectator?: boolean,
 *   isPlayer?: boolean,
 *   role?: 'player' | 'spectator',
 *   error?: string,
 *   code?: string,
 *   status?: number,
 * }>}
 */
async function canAccessGameRoom({
  userId,
  userRole = 'user',
  roomId,
  gameType,
  clientSpectatorHint = false,
}) {
  const uid = Number(userId);
  if (!uid) {
    return { allowed: false, error: 'User ID không hợp lệ', code: 'UNAUTHORIZED', status: 401 };
  }

  if (gameType === 'typing' || gameType === 'typing_battle') {
    let room = null;
    if (typeof roomId === 'number' || /^\d+$/.test(String(roomId))) {
      room = await TypingRoom.findByPk(Number(roomId));
    }
    if (!room && roomId) {
      room = await TypingRoom.findOne({ where: { code: String(roomId).trim().toUpperCase().replace(/^#/, '') } });
    }

    if (!room) {
      return { allowed: false, error: 'Phòng thi đấu đánh máy không tồn tại', code: 'ROOM_NOT_FOUND', status: 404 };
    }

    const player = await TypingPlayer.findOne({
      where: { roomId: room.id, userId: uid },
    });

    const isHost = Number(room.hostUserId) === uid;
    const isPlayer = !!player;

    if (isPlayer || isHost) {
      return {
        allowed: true,
        roomId: room.id,
        isSpectator: false,
        isPlayer: true,
        role: 'player',
      };
    }

    if (room.status === 'WAITING' || room.status === 'STARTING') {
      if (clientSpectatorHint) {
        return {
          allowed: true,
          roomId: room.id,
          isSpectator: true,
          isPlayer: false,
          role: 'spectator',
        };
      }
      return {
        allowed: false,
        error: 'Phòng đang chờ người chơi. Vui lòng tham gia phòng trước khi kết nối.',
        code: 'FORBIDDEN',
        status: 403,
      };
    }

    // In PLAYING or FINISHED state, allow spectator
    return {
      allowed: true,
      roomId: room.id,
      isSpectator: true,
      isPlayer: false,
      role: 'spectator',
    };
  }

  return { allowed: false, error: `Loại game ${gameType} không được hỗ trợ`, code: 'INVALID_GAME_TYPE', status: 400 };
}

module.exports = {
  canAccessGameRoom,
};
