'use strict';

const {
  SamRoom,
  SamPlayer,
  QuizRoom,
  QuizPlayer,
  GameRoom,
  GamePlayer,
} = require('../models');

/**
 * Validate whether a user can access a game room.
 *
 * @param {object} params
 * @param {number|string} params.userId
 * @param {string} [params.userRole]
 * @param {number|string} params.roomId - Numeric id or room code
 * @param {'sam'|'quiz'|'game'|'capital_board'} params.gameType
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

  if (gameType === 'sam') {
    let room = null;
    if (typeof roomId === 'number' || /^\d+$/.test(String(roomId))) {
      room = await SamRoom.findByPk(Number(roomId));
    }
    if (!room && roomId) {
      room = await SamRoom.findOne({ where: { code: String(roomId).trim().toUpperCase().replace(/^#/, '') } });
    }

    if (!room) {
      return { allowed: false, error: 'Phòng Sâm không tồn tại', code: 'ROOM_NOT_FOUND', status: 404 };
    }

    // Check test room authorization
    if (room.isTest && userRole !== 'admin') {
      return {
        allowed: false,
        error: 'Chỉ quản trị viên (Admin) mới có quyền truy cập phòng test kịch bản bot',
        code: 'FORBIDDEN',
        status: 403,
      };
    }

    const player = await SamPlayer.findOne({
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

    // Spectator policy: Only allow if match is actively PLAYING or FINISHED on a LIVE (non-test, non-private) room.
    // In WAITING or STARTING state, outside users who have not joined as a player are rejected with 403.
    const isLiveMatch = room.roomType === 'LIVE' && !room.isTest;
    const canSpectate = isLiveMatch && (room.status === 'PLAYING' || room.status === 'FINISHED');

    if (canSpectate) {
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
      error: 'Bạn không phải là người chơi trong phòng này và phòng chưa mở chế độ khán giả',
      code: 'FORBIDDEN',
      status: 403,
    };
  }

  if (gameType === 'quiz') {
    let room = null;
    if (typeof roomId === 'number' || /^\d+$/.test(String(roomId))) {
      room = await QuizRoom.findByPk(Number(roomId));
    }
    if (!room && roomId) {
      room = await QuizRoom.findOne({ where: { code: String(roomId).trim().toUpperCase().replace(/^#/, '') } });
    }

    if (!room) {
      return { allowed: false, error: 'Phòng Quiz không tồn tại', code: 'ROOM_NOT_FOUND', status: 404 };
    }

    const player = await QuizPlayer.findOne({
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

    // Quiz room: Spectators only allowed if explicitly in PLAYING/FINISHED status
    if (room.status === 'PLAYING' || room.status === 'FINISHED') {
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
      error: 'Bạn không phải là người chơi trong phòng Quiz này',
      code: 'FORBIDDEN',
      status: 403,
    };
  }

  if (gameType === 'game' || gameType === 'capital_board') {
    let room = null;
    if (typeof roomId === 'number' || /^\d+$/.test(String(roomId))) {
      room = await GameRoom.findByPk(Number(roomId));
    }
    if (!room && roomId) {
      room = await GameRoom.findOne({ where: { code: String(roomId).trim().toUpperCase().replace(/^#/, '') } });
    }

    if (!room) {
      return { allowed: false, error: 'Phòng Cờ tỷ phú không tồn tại', code: 'ROOM_NOT_FOUND', status: 404 };
    }

    const player = await GamePlayer.findOne({
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

    if (room.status === 'PLAYING' || room.status === 'FINISHED') {
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
      error: 'Bạn không phải là người chơi trong phòng Cờ tỷ phú này',
      code: 'FORBIDDEN',
      status: 403,
    };
  }

  return { allowed: false, error: `Loại game ${gameType} không được hỗ trợ`, code: 'INVALID_GAME_TYPE', status: 400 };
}

module.exports = {
  canAccessGameRoom,
};
