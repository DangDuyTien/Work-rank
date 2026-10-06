'use strict';

const { Op } = require('sequelize');
const {
  SamRoom,
  SamPlayer,
  SamAction,
  SamResult,
  SamUserStat,
  User,
  sequelize,
} = require('../models');
const samEngine = require('../utils/samEngine');
const samBotAI = require('../utils/samBotAI');
const samRealtime = require('./samRealtime.service');
const {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../utils/errors');

/**
 * Sam Lốc Game Service (Server Authoritative)
 * Supports standard live multiplayer, real-time spectator mode,
 * and admin-only test bot simulation with zero production data pollution.
 */

// In-memory bot timer tracker to safely schedule and clear bot delays
const botTimers = new Map();

// In-memory start countdown timer tracker (5s server authoritative countdown)
const startCountdownTimers = new Map();

// In-memory sam phase timer tracker
const samPhaseTimers = new Map();

function scheduleStartCountdown(roomId) {
  const numId = Number(roomId);
  if (startCountdownTimers.has(numId)) {
    clearTimeout(startCountdownTimers.get(numId));
  }
  const timer = setTimeout(async () => {
    startCountdownTimers.delete(numId);
    try {
      const room = await SamRoom.findByPk(numId, {
        include: [{ model: SamPlayer, as: 'players' }],
      });
      if (!room || room.status !== 'STARTING') return;

      const players = room.players || [];
      if (players.length >= 2 && players.every((p) => p.isReady)) {
        await startMatch(numId, room.hostUserId, true);
      } else {
        // Player unreadied or left before countdown reached 0
        room.status = 'WAITING';
        room.samPhase = 'WAITING';
        room.startAt = null;
        await room.save();
        const detail = await getRoomDetail(numId, room.hostUserId).catch(() => null);
        samRealtime.emitToRoom(numId, 'sam:startingCancelled', {
          roomId: numId,
          reason: 'PLAYERS_NOT_READY',
          room: detail ? detail.room : null,
          players: detail ? detail.players : [],
        });
        samRealtime.emitToRoom(numId, 'sam:roomUpdated', { room: detail ? detail.room : null });
      }
    } catch (err) {
      console.error(`[SamStartCountdown Error room ${numId}]:`, err.message);
    }
  }, 5000);
  startCountdownTimers.set(numId, timer);
}

function clearStartCountdown(roomId) {
  const numId = Number(roomId);
  if (startCountdownTimers.has(numId)) {
    clearTimeout(startCountdownTimers.get(numId));
    startCountdownTimers.delete(numId);
  }
}

function scheduleBotTimer(roomId, fn, delayMs = 800) {
  const numId = Number(roomId);
  if (botTimers.has(numId)) {
    clearTimeout(botTimers.get(numId));
  }
  const timer = setTimeout(async () => {
    botTimers.delete(numId);
    try {
      await fn();
    } catch (err) {
      console.error(`[SamBotTimer Error room ${numId}]:`, err.message);
    }
  }, delayMs);
  botTimers.set(numId, timer);
}

function clearBotTimers(roomId) {
  const numId = Number(roomId);
  if (botTimers.has(numId)) {
    clearTimeout(botTimers.get(numId));
    botTimers.delete(numId);
  }
}

// Helper to generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SAM-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper to match player by userId or bot identifier
function isPlayerMatch(p, identifier) {
  if (!p || identifier == null) return false;
  if (p.userId != null && Number(p.userId) === Number(identifier)) return true;
  if (p.id != null && Number(p.id) === Number(identifier)) return true;
  if (p.botId && p.botId === String(identifier)) return true;
  if (String(identifier) === `bot_${p.seatIndex + 1}`) return true;
  return false;
}

// ── LOBBY & ROOM MANAGEMENT ──

async function listRooms(filters = {}, requestingUser = null) {
  const where = {};
  const isTestQuery = filters.isTest === 'true' || filters.isTest === true || filters.roomType === 'BOT_TEST';

  if (isTestQuery) {
    if (!requestingUser || requestingUser.role !== 'admin') {
      // Non-admins cannot see bot test rooms
      return [];
    }
    where.isTest = true;
  } else {
    // Regular members only see official LIVE rooms
    where.isTest = false;
  }

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { [Op.in]: ['WAITING', 'STARTING', 'PLAYING'] };
  }

  const rooms = await SamRoom.findAll({
    where,
    include: [
      { model: User, as: 'host', attributes: ['id', 'name', 'email', 'jobTitle', 'department'] },
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'department'] }],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: filters.limit ? Number(filters.limit) : 20,
  });

  return rooms.map((r) => {
    const data = r.toJSON();
    return {
      ...data,
      playerCount: data.players ? data.players.length : 0,
      spectatorCount: samRealtime.getSpectatorCount(r.id),
    };
  });
}

async function createRoom(data, requestingUser = null) {
  const { title = 'Phòng Đánh Sâm', maxPlayers = 4, userId } = data;

  const actualUserId = userId || (requestingUser ? requestingUser.id : null);
  if (!actualUserId) {
    throw new UnauthorizedError('Yêu cầu xác thực người dùng để tạo phòng');
  }

  const validMax = Math.min(4, Math.max(2, Number(maxPlayers) || 4));
  const code = generateRoomCode();

  const result = await sequelize.transaction(async (t) => {
    const room = await SamRoom.create(
      {
        code,
        title: title.trim() || 'Phòng Đánh Sâm',
        hostUserId: actualUserId,
        status: 'WAITING',
        maxPlayers: validMax,
        roundNumber: 1,
        passPlayerIds: [],
        samPhase: 'WAITING',
        roomType: 'LIVE',
        isTest: false,
        botDifficulty: 'NORMAL',
        botPaused: false,
        spectatorCount: 0,
      },
      { transaction: t }
    );

    // Host automatically occupies seat 0
    await SamPlayer.create(
      {
        roomId: room.id,
        userId: actualUserId,
        seatIndex: 0,
        handCards: [],
        remainingCardsCount: 0,
        status: 'WAITING',
        playerType: 'HUMAN',
        isBot: false,
      },
      { transaction: t }
    );

    return room;
  });

  samRealtime.emitToRoom(result.id, 'sam:roomListChanged', { roomId: result.id });
  return getRoomDetail(result.id, actualUserId);
}

// ── BOT TEST ROOM CREATION (ADMIN ONLY) ──

async function createBotTestRoom(data, adminUser) {
  if (!adminUser || adminUser.role !== 'admin') {
    throw new ForbiddenError('Chỉ Quản trị viên (Admin) mới có quyền tạo phòng Bot Test');
  }

  const {
    title = 'Đánh Sâm — Bot Test',
    playerCount = 4,
    botCount = 3,
    difficulty = 'NORMAL',
    scenario = 'DEFAULT_TEST',
    includeAdmin = true,
  } = data;

  const totalSeats = Math.min(4, Math.max(2, Number(playerCount) || 4));
  const validDifficulty = ['EASY', 'NORMAL', 'HARD'].includes(difficulty) ? difficulty : 'NORMAL';
  const code = generateRoomCode();

  const result = await sequelize.transaction(async (t) => {
    const room = await SamRoom.create(
      {
        code,
        title: title.trim() || 'Đánh Sâm — Bot Test',
        hostUserId: adminUser.id,
        status: 'WAITING',
        maxPlayers: totalSeats,
        roundNumber: 1,
        passPlayerIds: [],
        samPhase: 'WAITING',
        roomType: 'BOT_TEST',
        isTest: true,
        botDifficulty: validDifficulty,
        testScenario: scenario,
        botPaused: false,
        spectatorCount: 0,
      },
      { transaction: t }
    );

    let currentSeat = 0;

    // Optional: Add Admin as Player in seat 0
    if (includeAdmin) {
      await SamPlayer.create(
        {
          roomId: room.id,
          userId: adminUser.id,
          seatIndex: currentSeat++,
          handCards: [],
          remainingCardsCount: 0,
          status: 'WAITING',
          playerType: 'HUMAN',
          isBot: false,
        },
        { transaction: t }
      );
    }

    // Add Bots for remaining seats
    const numBotsToAdd = includeAdmin ? Math.min(botCount, totalSeats - 1) : totalSeats;
    for (let b = 1; b <= numBotsToAdd && currentSeat < totalSeats; b++) {
      const botIndex = currentSeat + 1;
      await SamPlayer.create(
        {
          roomId: room.id,
          userId: null,
          seatIndex: currentSeat++,
          handCards: [],
          remainingCardsCount: 0,
          status: 'WAITING',
          isReady: true,
          playerType: 'BOT',
          isBot: true,
          botId: `BOT_TEST_0${botIndex}`,
          botName: `BOT-0${botIndex}`,
        },
        { transaction: t }
      );
    }

    return room;
  });

  samRealtime.emitToRoom(result.id, 'sam:roomListChanged', { roomId: result.id });
  return getRoomDetail(result.id, adminUser.id, 'admin');
}

async function joinRoom(roomId, userId, requestingUser = null) {
  if (!roomId || !userId) {
    throw new ValidationError('Thiếu roomId hoặc userId');
  }

  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room) {
    throw new NotFoundError('Phòng chơi không tồn tại');
  }

  // If this is a test room, verify admin role
  const userRole = requestingUser ? requestingUser.role : (await User.findByPk(userId))?.role;
  if (room.isTest && userRole !== 'admin') {
    throw new ForbiddenError('Bạn không có quyền tham gia phòng thử nghiệm này');
  }

  if (room.status !== 'WAITING') {
    // Check if player is already in this playing room -> reconnect
    const existingPlayer = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
    if (existingPlayer) {
      return getRoomDetail(room.id, userId, userRole);
    }
    // If not a player, allow spectating
    return getRoomDetail(room.id, userId, userRole);
  }

  // Check if player already in room
  const alreadyIn = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
  if (alreadyIn) {
    return getRoomDetail(room.id, userId, userRole);
  }

  if (room.players.length >= room.maxPlayers) {
    throw new ConflictError('Phòng chơi đã đủ người');
  }

  // Find next available seat index
  const takenSeats = room.players.map((p) => p.seatIndex);
  let availableSeat = 0;
  for (let s = 0; s < room.maxPlayers; s++) {
    if (!takenSeats.includes(s)) {
      availableSeat = s;
      break;
    }
  }

  await SamPlayer.create({
    roomId: room.id,
    userId,
    seatIndex: availableSeat,
    handCards: [],
    remainingCardsCount: 0,
    status: 'WAITING',
    playerType: 'HUMAN',
    isBot: false,
  });

  const detail = await getRoomDetail(room.id, userId, userRole);
  samRealtime.emitToRoom(room.id, 'sam:playerJoined', {
    roomId: room.id,
    userId,
    players: detail.players,
  });
  samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });

  return detail;
}

async function leaveRoom(roomId, userId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room) {
    throw new Error('Phòng chơi không tồn tại');
  }

  const player = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
  if (!player) {
    return { success: true };
  }

  if (room.status === 'WAITING' || room.status === 'STARTING') {
    if (room.status === 'STARTING') {
      clearStartCountdown(room.id);
      room.status = 'WAITING';
      room.samPhase = 'WAITING';
      room.startAt = null;
      await room.save();
      samRealtime.emitToRoom(room.id, 'sam:startingCancelled', {
        roomId: room.id,
        reason: 'PLAYER_LEFT',
        userId,
      });
    }

    await player.destroy();

    const remainingPlayers = await SamPlayer.findAll({
      where: { roomId: room.id },
      order: [['seatIndex', 'ASC']],
    });

    if (remainingPlayers.length === 0 || remainingPlayers.every((p) => p.isBot)) {
      clearBotTimers(room.id);
      room.status = 'ABANDONED';
      await room.save();
    } else if (Number(room.hostUserId) === Number(userId)) {
      // Transfer host to next human player if available
      const nextHuman = remainingPlayers.find((p) => !p.isBot && p.userId);
      if (nextHuman) {
        room.hostUserId = nextHuman.userId;
        await room.save();
      }
    }

    const detail = await getRoomDetail(room.id, userId).catch(() => null);
    samRealtime.emitToRoom(room.id, 'sam:playerLeft', {
      roomId: room.id,
      userId,
      players: detail ? detail.players : [],
    });
    samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail ? detail.room : null });
    return { success: true };
  }

  // If in active playing game -> surrender
  player.status = 'SURRENDERED';
  await player.save();

  // If only 1 active player remains, that player wins!
  const activeRemaining = room.players.filter(
    (p) => (!p.userId || Number(p.userId) !== Number(userId)) && p.status === 'ACTIVE'
  );

  if (activeRemaining.length === 1) {
    await finishMatch(room.id, activeRemaining[0].userId || activeRemaining[0].botId, 'SURRENDER_WIN');
  }

  return { success: true };
}

async function toggleReady(roomId, userId, isReady) {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user' }],
      },
    ],
  });

  if (!room) {
    throw new NotFoundError('Phòng chơi không tồn tại');
  }

  if (room.status === 'PLAYING') {
    throw new ConflictError('Phòng đang trong trận đấu');
  }

  const player = room.players.find((p) => isPlayerMatch(p, userId));
  if (!player) {
    throw new NotFoundError('Người chơi không tồn tại trong phòng');
  }

  const readyVal = Boolean(isReady);
  player.isReady = readyVal;
  await player.save();

  // Re-fetch all players
  const allPlayers = await SamPlayer.findAll({
    where: { roomId: room.id },
    include: [{ model: User, as: 'user' }],
    order: [['seatIndex', 'ASC']],
  });

  const numPlayers = allPlayers.length;
  const allReady = numPlayers >= 2 && allPlayers.every((p) => p.isReady);

  if (allReady) {
    room.status = 'STARTING';
    room.samPhase = 'STARTING';
    const startAt = new Date(Date.now() + 5000);
    room.startAt = startAt;
    await room.save();

    scheduleStartCountdown(room.id);

    const detail = await getRoomDetail(room.id, userId);
    samRealtime.emitToRoom(room.id, 'sam:playerReady', {
      roomId: room.id,
      userId,
      isReady: readyVal,
      players: detail.players,
    });
    samRealtime.emitToRoom(room.id, 'sam:starting', {
      roomId: room.id,
      startAt: room.startAt,
      serverTime: new Date().toISOString(),
      room: detail.room,
      players: detail.players,
    });
    samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
    return detail;
  } else {
    // If room was in STARTING state and someone cancelled ready
    if (room.status === 'STARTING') {
      clearStartCountdown(room.id);
      room.status = 'WAITING';
      room.samPhase = 'WAITING';
      room.startAt = null;
      await room.save();

      const detail = await getRoomDetail(room.id, userId);
      samRealtime.emitToRoom(room.id, 'sam:startingCancelled', {
        roomId: room.id,
        reason: 'PLAYER_UNREADY',
        userId,
        room: detail.room,
        players: detail.players,
      });
      samRealtime.emitToRoom(room.id, 'sam:playerReady', {
        roomId: room.id,
        userId,
        isReady: readyVal,
        players: detail.players,
      });
      samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
      return detail;
    }

    const detail = await getRoomDetail(room.id, userId);
    samRealtime.emitToRoom(room.id, 'sam:playerReady', {
      roomId: room.id,
      userId,
      isReady: readyVal,
      players: detail.players,
    });
    samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
    return detail;
  }
}

// ── MATCH LIFECYCLE ──

async function startMatch(roomId, hostUserId, isAdmin = false) {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'department'] }],
      },
    ],
  });

  if (!room) {
    throw new NotFoundError('Phòng chơi không tồn tại');
  }

  clearStartCountdown(roomId);

  if (!isAdmin && Number(room.hostUserId) !== Number(hostUserId)) {
    throw new ForbiddenError('Chỉ có chủ phòng mới có quyền bắt đầu trận đấu');
  }

  if (room.status !== 'WAITING' && room.status !== 'STARTING' && room.status !== 'FINISHED' && !isAdmin && !room.isTest) {
    throw new ConflictError('Phòng đang trong trận đấu');
  }

  const players = room.players;
  if (players.length < 2) {
    throw new ValidationError('Cần ít nhất 2 người chơi để bắt đầu Đánh Sâm');
  }

  // 1. Deal 10 cards to each player using Server Authority
  const dealtHands = samEngine.dealCards(players.length);

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      p.handCards = dealtHands[i];
      p.remainingCardsCount = dealtHands[i].length;
      p.status = 'ACTIVE';
      p.hasDeclaredSam = null;
      p.isBaoMot = false;
      p.scoreDelta = 0;
      p.rank = null;
      await p.save({ transaction: t });
    }

    // 2. Set phase to SAM_DECLARING (10s window to declare Sâm)
    room.startAt = null;
    room.status = 'PLAYING';
    room.samPhase = 'SAM_DECLARING';
    room.samDeclarerId = null;
    room.lastPlayedCards = null;
    room.lastPlayUserId = null;
    room.passPlayerIds = [];
    room.roundNumber = 1;
    room.winnerUserId = null;
    room.startedAt = new Date();
    room.finishedAt = null;
    room.botPaused = false;

    // Default first turn: seat 0
    room.currentTurnUserId = players[0].userId || null;
    room.currentTurnSeat = 0;
    // 10s window for declaring Sam
    room.turnDeadline = new Date(Date.now() + 10 * 1000);
    await room.save({ transaction: t });

    await SamAction.create(
      {
        roomId: room.id,
        userId: hostUserId || players[0].userId || 1,
        actionType: 'DEAL',
        metadata: { playerCount: players.length, isTest: room.isTest },
      },
      { transaction: t }
    );
  });

  // 3. Broadcast match started to room
  const detail = await getRoomDetail(room.id, hostUserId, isAdmin ? 'admin' : 'user');
  samRealtime.emitToRoom(room.id, 'sam:started', {
    roomId: room.id,
    room: detail.room,
    players: detail.players,
    samPhase: 'SAM_DECLARING',
    samDeadline: room.turnDeadline,
  });

  // 4. Send private hand cards exclusively to human players
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    if (!p.isBot && p.userId) {
      samRealtime.emitToUser(p.userId, 'sam:handCards', {
        roomId: room.id,
        handCards: dealtHands[i],
      });
    }
  }

  // 5. Schedule server-side timeout to auto-resolve Sâm phase if timer expires
  scheduleSamPhaseTimer(room.id);

  // 6. If test room with bots, trigger bot AI lifecycle
  if (room.isTest) {
    triggerBotLifecycle(room.id);
  }

  return detail;
}

// ── SÂM DECLARATION ──

function findSmallestCardPlayer(players) {
  let bestPlayer = null;
  let minRankValue = 999;

  for (const p of players) {
    if (!Array.isArray(p.handCards)) continue;
    for (const card of p.handCards) {
      const parsed = samEngine.parseCard(card);
      if (parsed && parsed.rankValue < minRankValue) {
        minRankValue = parsed.rankValue;
        bestPlayer = p;
      }
    }
  }

  return bestPlayer;
}

function scheduleSamPhaseTimer(roomId) {
  const numId = Number(roomId);
  if (samPhaseTimers.has(numId)) {
    clearTimeout(samPhaseTimers.get(numId));
  }
  const timer = setTimeout(async () => {
    samPhaseTimers.delete(numId);
    try {
      const room = await SamRoom.findByPk(numId, {
        include: [{ model: SamPlayer, as: 'players', include: [{ model: User, as: 'user' }] }],
      });
      if (!room || room.status !== 'PLAYING' || room.samPhase !== 'SAM_DECLARING') {
        return;
      }

      // Mark all undecided players as hasDeclaredSam = false
      for (const p of room.players) {
        if (p.hasDeclaredSam === null || p.hasDeclaredSam === undefined) {
          p.hasDeclaredSam = false;
          await p.save();
        }
      }

      if (!room.samDeclarerId) {
        room.samPhase = 'PLAYING';
        const firstPlayer =
          findSmallestCardPlayer(room.players) ||
          room.players.find((p) => p.seatIndex === 0) ||
          room.players[0];
        room.currentTurnUserId = firstPlayer.userId || null;
        room.currentTurnSeat = firstPlayer.seatIndex;
        room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
        await room.save();

        samRealtime.emitToRoom(room.id, 'sam:samResolved', {
          roomId: room.id,
          isSam: false,
          declarerSeat: null,
          currentTurnUserId: room.currentTurnUserId,
          currentTurnSeat: room.currentTurnSeat,
          turnDeadline: room.turnDeadline,
        });

        samRealtime.emitToRoom(room.id, 'sam:turnChanged', {
          roomId: room.id,
          currentTurnUserId: room.currentTurnUserId,
          currentTurnSeat: room.currentTurnSeat,
          turnDeadline: room.turnDeadline,
        });
      }

      if (room.isTest) {
        triggerBotLifecycle(room.id);
      }
    } catch (err) {
      console.error('scheduleSamPhaseTimer error:', err);
    }
  }, process.env.NODE_ENV === 'test' ? 400 : 10500);
  samPhaseTimers.set(numId, timer);
}

function clearSamPhaseTimer(roomId) {
  const numId = Number(roomId);
  if (samPhaseTimers.has(numId)) {
    clearTimeout(samPhaseTimers.get(numId));
    samPhaseTimers.delete(numId);
  }
}

async function declareSam(roomId, userOrBotId, declare = true) {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      },
    ],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new ConflictError('Trận đấu không tồn tại hoặc chưa bắt đầu');
  }

  if (room.samPhase !== 'SAM_DECLARING') {
    throw new ValidationError('Đã qua thời gian báo Sâm');
  }

  const player = room.players.find((p) => isPlayerMatch(p, userOrBotId));
  if (!player) {
    throw new NotFoundError('Người chơi không ở trong phòng này');
  }

  player.hasDeclaredSam = !!declare;
  await player.save();

  if (player.userId) {
    await SamAction.create({
      roomId: room.id,
      userId: player.userId,
      actionType: declare ? 'DECLARE_SAM' : 'SKIP_SAM',
    }).catch(() => {});
  }

  // Broadcast decision to all clients
  samRealtime.emitToRoom(room.id, 'sam:samDecision', {
    roomId: room.id,
    userId: player.userId || player.botId,
    seatIndex: player.seatIndex,
    hasDeclaredSam: player.hasDeclaredSam,
  });

  if (declare) {
    // First player who successfully declares Sam gets prioritized turn
    if (!room.samDeclarerId) {
      room.samDeclarerId = player.userId || player.id;
      room.samPhase = 'PLAYING';
      room.currentTurnUserId = player.userId || null;
      room.currentTurnSeat = player.seatIndex;
      room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
      await room.save();

      const declarerName = player.isBot ? player.botName : (player.user?.name || 'Người chơi');

      samRealtime.emitToRoom(room.id, 'sam:samDeclared', {
        roomId: room.id,
        userId: player.userId || player.botId,
        declarerSeat: player.seatIndex,
        declarerName,
        currentTurnUserId: room.currentTurnUserId,
        currentTurnSeat: room.currentTurnSeat,
        turnDeadline: room.turnDeadline,
        isSam: true,
      });

      samRealtime.emitToRoom(room.id, 'sam:samResolved', {
        roomId: room.id,
        isSam: true,
        declarerSeat: player.seatIndex,
        declarerName,
        currentTurnUserId: room.currentTurnUserId,
        currentTurnSeat: room.currentTurnSeat,
        turnDeadline: room.turnDeadline,
      });

      if (room.isTest) {
        triggerBotLifecycle(room.id);
      }

      return getRoomDetail(room.id, userOrBotId);
    }
  }

  // Check if all players have made their decision (or skipped)
  const allDecided = room.players.every((p) => p.hasDeclaredSam !== null && p.hasDeclaredSam !== undefined);
  if (allDecided && !room.samDeclarerId) {
    // No one declared Sam -> proceed to normal playing phase
    room.samPhase = 'PLAYING';
    const firstPlayer =
      findSmallestCardPlayer(room.players) ||
      room.players.find((p) => p.seatIndex === 0) ||
      room.players[0];
    room.currentTurnUserId = firstPlayer.userId || null;
    room.currentTurnSeat = firstPlayer.seatIndex;
    room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
    await room.save();

    samRealtime.emitToRoom(room.id, 'sam:samResolved', {
      roomId: room.id,
      isSam: false,
      declarerSeat: null,
      currentTurnUserId: room.currentTurnUserId,
      currentTurnSeat: room.currentTurnSeat,
      turnDeadline: room.turnDeadline,
    });

    samRealtime.emitToRoom(room.id, 'sam:turnChanged', {
      roomId: room.id,
      currentTurnUserId: room.currentTurnUserId,
      currentTurnSeat: room.currentTurnSeat,
      turnDeadline: room.turnDeadline,
    });
  }

  if (room.isTest) {
    triggerBotLifecycle(room.id);
  }

  return getRoomDetail(room.id, userOrBotId);
}

// ── PLAY CARDS & PASS TURN ──

async function playCards(roomId, userOrBotId, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    throw new ValidationError('Vui lòng chọn ít nhất 1 lá bài để đánh');
  }

  const room = await SamRoom.findByPk(roomId, {
    include: [
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'department'] }],
      },
    ],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new ConflictError('Trận đấu chưa bắt đầu hoặc đã kết thúc');
  }

  // Auto-transition from SAM_DECLARING to PLAYING if timer expired
  if (room.samPhase === 'SAM_DECLARING') {
    room.samPhase = 'PLAYING';
    await room.save();
  }

  const player = room.players.find((p) => isPlayerMatch(p, userOrBotId));
  if (!player) {
    throw new NotFoundError('Người chơi không tồn tại trong phòng');
  }

  if (room.currentTurnSeat !== player.seatIndex && (!player.userId || Number(room.currentTurnUserId) !== Number(player.userId))) {
    throw new ValidationError('Chưa đến lượt của bạn');
  }

  // 1. Verify card ownership
  const hand = player.handCards || [];
  const hasAllCards = cardIds.every((c) => hand.includes(c));
  if (!hasAllCards) {
    throw new ValidationError('Bài đánh ra chứa lá bài không có trên tay bạn');
  }

  // 2. Validate move against current board state
  const prevCards = room.lastPlayedCards ? room.lastPlayedCards.cards : null;
  const beatCheck = samEngine.canBeat(cardIds, prevCards);
  if (!beatCheck.canBeat) {
    throw new ValidationError(beatCheck.reason || 'Nước đi không hợp lệ');
  }

  // 3. Remove played cards from player's hand
  const newHand = hand.filter((c) => !cardIds.includes(c));
  player.handCards = samEngine.sortCards(newHand);
  player.remainingCardsCount = newHand.length;

  // Check Báo 1 rule: player has exactly 1 card left
  if (player.remainingCardsCount === 1) {
    player.isBaoMot = true;
    samRealtime.emitToRoom(room.id, 'sam:baoMot', {
      roomId: room.id,
      userId: player.userId || player.botId,
      playerName: player.isBot ? (player.botName || 'Bot') : (player.user ? player.user.name : 'Người chơi'),
    });
  }

  await player.save();

  // 4. Record action and chop events
  let isChop = !!beatCheck.isChop;
  let chopReward = 0;
  if (isChop && room.lastPlayUserId) {
    chopReward = 15;
    const victim = room.players.find((p) => isPlayerMatch(p, room.lastPlayUserId));
    if (victim) {
      victim.scoreDelta -= chopReward;
      await victim.save();
    }
    player.scoreDelta += chopReward;
    await player.save();

    samRealtime.emitToRoom(room.id, 'sam:chopped', {
      roomId: room.id,
      chopperId: player.userId || player.botId,
      victimId: room.lastPlayUserId,
      points: chopReward,
      chopType: beatCheck.chopType,
    });
  }

  if (player.userId) {
    await SamAction.create({
      roomId: room.id,
      userId: player.userId,
      actionType: isChop ? 'CHOP' : 'PLAY',
      cards: cardIds,
      comboType: beatCheck.combo.type,
      metadata: {
        isChop,
        chopReward,
        remainingCards: player.remainingCardsCount,
      },
    }).catch(() => {});
  }

  // 5. Update room board state
  room.lastPlayedCards = {
    cards: cardIds,
    userId: player.userId || player.botId,
    comboType: beatCheck.combo.type,
    rankValue: beatCheck.combo.rankValue,
    name: beatCheck.combo.name,
  };
  room.lastPlayUserId = player.userId || player.id;

  // 6. Check Win (Finished Hand)
  if (player.remainingCardsCount === 0) {
    // Check Thối 2 on final play
    const wasThoi2 = samEngine.checkThoi2(cardIds, hand);
    if (wasThoi2) {
      return handleThoi2Finish(room, player, cardIds);
    }

    return handleGameWin(room, player);
  }

  // 7. Advance turn to next active player
  const nextPlayer = findNextTurnPlayer(room, player.seatIndex);
  room.currentTurnUserId = nextPlayer.userId || null;
  room.currentTurnSeat = nextPlayer.seatIndex;
  room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
  await room.save();

  // 8. Realtime notifications
  samRealtime.emitToRoom(room.id, 'sam:cardsPlayed', {
    roomId: room.id,
    userId: player.userId || player.botId,
    cards: cardIds,
    comboName: beatCheck.combo.name,
    remainingCount: player.remainingCardsCount,
    nextTurnUserId: nextPlayer.userId || nextPlayer.botId,
    nextTurnSeat: nextPlayer.seatIndex,
    turnDeadline: room.turnDeadline,
  });

  // Send private hand update to player (if human)
  if (!player.isBot && player.userId) {
    samRealtime.emitToUser(player.userId, 'sam:handCards', {
      roomId: room.id,
      handCards: player.handCards,
    });
  }

  // 9. If next player is a bot in test room, schedule bot move
  if (room.isTest) {
    triggerBotLifecycle(room.id);
  }

  return getRoomDetail(room.id, userOrBotId);
}

async function passTurn(roomId, userOrBotId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new ConflictError('Trận đấu chưa bắt đầu hoặc đã kết thúc');
  }

  const player = room.players.find((p) => isPlayerMatch(p, userOrBotId));
  if (!player) {
    throw new NotFoundError('Người chơi không tồn tại');
  }

  if (room.currentTurnSeat !== player.seatIndex && (!player.userId || Number(room.currentTurnUserId) !== Number(player.userId))) {
    throw new ValidationError('Chưa đến lượt của bạn để bỏ lượt');
  }

  if (!room.lastPlayedCards) {
    throw new ValidationError('Bạn đang là người đánh đầu vòng, không thể bỏ lượt');
  }

  const playerId = player.userId ? Number(player.userId) : player.id;
  const passList = Array.isArray(room.passPlayerIds) ? [...room.passPlayerIds] : [];
  if (!passList.includes(playerId)) {
    passList.push(playerId);
  }
  room.passPlayerIds = passList;

  if (player.userId) {
    await SamAction.create({
      roomId: room.id,
      userId: player.userId,
      actionType: 'PASS',
    }).catch(() => {});
  }

  // Check if all OTHER players have passed
  const activePlayers = room.players.filter((p) => p.status === 'ACTIVE' && p.remainingCardsCount > 0);
  const eligiblePlayers = activePlayers.filter((p) => {
    const pid = p.userId ? Number(p.userId) : p.id;
    return !passList.includes(pid);
  });

  if (eligiblePlayers.length <= 1) {
    // Round is finished! The last play user takes the new round
    const roundWinnerId = room.lastPlayUserId;
    const roundWinner = room.players.find((p) => isPlayerMatch(p, roundWinnerId)) || eligiblePlayers[0] || room.players[0];

    room.lastPlayedCards = null;
    room.passPlayerIds = [];
    room.roundNumber += 1;
    room.currentTurnUserId = roundWinner.userId || null;
    room.currentTurnSeat = roundWinner.seatIndex;
    room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
    await room.save();

    samRealtime.emitToRoom(room.id, 'sam:roundReset', {
      roomId: room.id,
      roundWinnerId: roundWinner.userId || roundWinner.botId,
      roundWinnerSeat: roundWinner.seatIndex,
      roundNumber: room.roundNumber,
      turnDeadline: room.turnDeadline,
    });

    if (room.isTest) {
      triggerBotLifecycle(room.id);
    }

    return getRoomDetail(room.id, userOrBotId);
  }

  // Next player in round
  const nextPlayer = findNextTurnPlayer(room, room.currentTurnSeat);
  room.currentTurnUserId = nextPlayer.userId || null;
  room.currentTurnSeat = nextPlayer.seatIndex;
  room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
  await room.save();

  samRealtime.emitToRoom(room.id, 'sam:pass', {
    roomId: room.id,
    userId: player.userId || player.botId,
    seatIndex: player.seatIndex,
    nextTurnUserId: nextPlayer.userId || nextPlayer.botId,
    nextTurnSeat: nextPlayer.seatIndex,
    turnDeadline: room.turnDeadline,
  });

  if (room.isTest) {
    triggerBotLifecycle(room.id);
  }

  return getRoomDetail(room.id, userOrBotId);
}

// ── ROUND & TURN HELPERS ──

function findNextTurnPlayer(room, currentSeatIndex) {
  const players = room.players.filter((p) => p.status === 'ACTIVE' && p.remainingCardsCount > 0);
  const passList = Array.isArray(room.passPlayerIds) ? room.passPlayerIds : [];

  // Sort players by seat index ascending
  players.sort((a, b) => a.seatIndex - b.seatIndex);

  // Search sequentially starting from next seat index
  const totalSeats = room.maxPlayers || 4;
  for (let step = 1; step <= totalSeats; step++) {
    const targetSeat = (currentSeatIndex + step) % totalSeats;
    const candidate = players.find((p) => p.seatIndex === targetSeat);
    if (candidate) {
      const cid = candidate.userId ? Number(candidate.userId) : candidate.id;
      if (!passList.includes(cid)) {
        return candidate;
      }
    }
  }

  return players[0];
}

// ── GAME WIN & RESULT CALCULATIONS ──

async function handleGameWin(room, winnerPlayer) {
  clearBotTimers(room.id);
  const winnerUserId = winnerPlayer.userId || winnerPlayer.id;
  const isSamWin = room.samDeclarerId && isPlayerMatch(winnerPlayer, room.samDeclarerId);
  const isDenSam = room.samDeclarerId && !isPlayerMatch(winnerPlayer, room.samDeclarerId);

  let totalWinPoints = 0;
  const playerResults = [];

  for (const p of room.players) {
    if (isPlayerMatch(p, winnerUserId)) {
      continue;
    }

    let penalty = 0;
    let reason = 'THUA';

    if (isSamWin) {
      penalty = 20;
      reason = 'THUA_SAM';
    } else if (isDenSam && isPlayerMatch(p, room.samDeclarerId)) {
      penalty = 20 * (room.players.length - 1);
      reason = 'DEN_SAM';
    } else if (!isDenSam) {
      const remaining = p.remainingCardsCount;
      if (remaining === 10) {
        penalty = 15;
        reason = 'CONG';
      } else {
        penalty = remaining;
        reason = 'THUA_DIEM';
      }
    }

    p.scoreDelta -= penalty;
    totalWinPoints += penalty;
    p.rank = 2;
    await p.save();

    playerResults.push({
      userId: p.userId || p.botId,
      name: p.isBot ? (p.botName || `BOT-0${p.seatIndex + 1}`) : (p.user ? p.user.name : `Người chơi ${p.seatIndex + 1}`),
      seatIndex: p.seatIndex,
      remainingCards: p.remainingCardsCount,
      scoreDelta: -penalty,
      reason,
      rank: 2,
      isBot: p.isBot || false,
    });
  }

  winnerPlayer.scoreDelta += totalWinPoints;
  winnerPlayer.rank = 1;
  await winnerPlayer.save();

  playerResults.unshift({
    userId: winnerPlayer.userId || winnerPlayer.botId,
    name: winnerPlayer.isBot ? (winnerPlayer.botName || `BOT-0${winnerPlayer.seatIndex + 1}`) : (winnerPlayer.user ? winnerPlayer.user.name : `Người chơi ${winnerPlayer.seatIndex + 1}`),
    seatIndex: winnerPlayer.seatIndex,
    remainingCards: 0,
    scoreDelta: totalWinPoints,
    reason: isSamWin ? 'THANG_SAM' : 'VE_NHAT',
    rank: 1,
    isBot: winnerPlayer.isBot || false,
  });

  room.status = 'FINISHED';
  room.winnerUserId = winnerPlayer.userId || null;
  room.finishedAt = new Date();
  await room.save();

  // Save game result
  await SamResult.create({
    roomId: room.id,
    winnerUserId: winnerPlayer.userId || null,
    details: playerResults,
  }).catch(() => {});

  // STRICT DATA ISOLATION: Never update production stats for Bot Test rooms!
  if (!room.isTest && room.roomType !== 'BOT_TEST') {
    await updateUserStats(playerResults, winnerPlayer.userId, isSamWin);
  }

  samRealtime.emitToRoom(room.id, 'sam:gameFinished', {
    roomId: room.id,
    winnerUserId: winnerPlayer.userId || winnerPlayer.botId,
    results: playerResults,
    isSamWin,
    isTest: room.isTest || false,
  });

  return getRoomDetail(room.id, winnerUserId, room.isTest ? 'admin' : 'user');
}

async function handleThoi2Finish(room, player, cardIds) {
  clearBotTimers(room.id);
  const penalty = 20;
  player.scoreDelta -= penalty;
  player.rank = room.players.length;
  await player.save();

  const otherPlayers = room.players.filter((p) => !isPlayerMatch(p, player.userId || player.id));
  otherPlayers.sort((a, b) => a.remainingCardsCount - b.remainingCardsCount);
  const substituteWinner = otherPlayers[0];

  substituteWinner.scoreDelta += penalty;
  substituteWinner.rank = 1;
  await substituteWinner.save();

  room.status = 'FINISHED';
  room.winnerUserId = substituteWinner.userId || null;
  room.finishedAt = new Date();
  await room.save();

  const playerResults = [
    {
      userId: substituteWinner.userId || substituteWinner.botId,
      name: substituteWinner.isBot ? (substituteWinner.botName || 'Bot') : (substituteWinner.user?.name || 'Người chơi'),
      seatIndex: substituteWinner.seatIndex,
      scoreDelta: penalty,
      reason: 'THANG_DO_DOI_THU_THOI_2',
      rank: 1,
      isBot: substituteWinner.isBot || false,
    },
    {
      userId: player.userId || player.botId,
      name: player.isBot ? (player.botName || 'Bot') : (player.user?.name || 'Người chơi'),
      seatIndex: player.seatIndex,
      scoreDelta: -penalty,
      reason: 'THOI_2',
      rank: room.players.length,
      isBot: player.isBot || false,
    },
  ];

  await SamResult.create({
    roomId: room.id,
    winnerUserId: substituteWinner.userId || null,
    details: playerResults,
  }).catch(() => {});

  if (!room.isTest && room.roomType !== 'BOT_TEST') {
    await updateUserStats(playerResults, substituteWinner.userId, false);
  }

  samRealtime.emitToRoom(room.id, 'sam:gameFinished', {
    roomId: room.id,
    winnerUserId: substituteWinner.userId || substituteWinner.botId,
    results: playerResults,
    isThoi2: true,
    isTest: room.isTest || false,
  });

  return getRoomDetail(room.id, player.userId || player.id, room.isTest ? 'admin' : 'user');
}

async function finishMatch(roomId, winnerId, reason = 'NORMAL') {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });
  if (!room) return;
  const winner = room.players.find((p) => isPlayerMatch(p, winnerId)) || room.players[0];
  if (winner) {
    return handleGameWin(room, winner);
  }
}

async function updateUserStats(playerResults, winnerUserId, isSamWin) {
  for (const pr of playerResults) {
    // Strictly ignore bot players
    if (pr.isBot || !pr.userId || typeof pr.userId === 'string' && pr.userId.startsWith('BOT')) {
      continue;
    }

    const isWinner = Number(pr.userId) === Number(winnerUserId);
    const [stat] = await SamUserStat.findOrCreate({
      where: { userId: pr.userId },
      defaults: {
        userId: pr.userId,
        gamesPlayed: 0,
        gamesWon: 0,
        samDeclared: 0,
        samWon: 0,
        totalPoints: 0,
        winStreak: 0,
        maxWinStreak: 0,
      },
    });

    stat.gamesPlayed += 1;
    stat.totalPoints += pr.scoreDelta;

    if (isWinner) {
      stat.gamesWon += 1;
      stat.winStreak += 1;
      if (stat.winStreak > stat.maxWinStreak) {
        stat.maxWinStreak = stat.winStreak;
      }
      if (isSamWin) {
        stat.samWon += 1;
        stat.samDeclared += 1;
      }
    } else {
      stat.winStreak = 0;
    }

    await stat.save();
  }
}

// ── GET ROOM DETAIL (SECURITY & SPECTATOR & RECONNECT SAFE) ──

async function getRoomDetail(roomId, requestingUserId, requestingUserRole = 'user') {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      { model: User, as: 'host', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'role'] },
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId', 'role'] }],
      },
      { model: SamResult, as: 'result' },
    ],
  });

  if (!room) {
    throw new Error('Phòng không tồn tại');
  }

  // Security: Non-admins cannot access bot test rooms
  if (room.isTest && requestingUserRole !== 'admin') {
    if (requestingUserId && Number(room.hostUserId) === Number(requestingUserId)) {
      // Host is admin
    } else {
      const error = new Error('Bạn không có quyền truy cập phòng thử nghiệm');
      error.status = 403;
      throw error;
    }
  }

  // Determine if requesting user is a player or spectator
  const isPlayer = room.players.some((p) => p.userId && requestingUserId && Number(p.userId) === Number(requestingUserId));
  const isSpectator = !isPlayer;

  let myHandCards = [];
  const sanitizedPlayers = room.players.map((p) => {
    const isMe = p.userId && requestingUserId && Number(p.userId) === Number(requestingUserId);
    if (isMe) {
      myHandCards = p.handCards || [];
    }

    const userObj = p.isBot
      ? {
          id: `bot_${p.seatIndex + 1}`,
          name: p.botName || `BOT_TEST_0${p.seatIndex + 1}`,
          jobTitle: 'Test Bot',
          department: 'QA & Testing',
          isBot: true,
          botId: p.botId,
        }
      : p.user;

    return {
      id: p.id,
      userId: p.userId || `bot_${p.seatIndex + 1}`,
      seatIndex: p.seatIndex,
      remainingCardsCount: p.remainingCardsCount,
      status: p.status,
      hasDeclaredSam: p.hasDeclaredSam,
      isBaoMot: p.isBaoMot,
      scoreDelta: p.scoreDelta,
      rank: p.rank,
      user: userObj,
      isHost: Number(room.hostUserId) === Number(p.userId),
      isReady: Boolean(p.isReady),
      isBot: p.isBot || false,
      botId: p.botId,
      playerType: p.playerType,
      // Private Hand Security: Opponents and Spectators NEVER receive handCards!
      handCards: isMe ? p.handCards : undefined,
    };
  });

  return {
    room: {
      id: room.id,
      code: room.code,
      title: room.title,
      hostUserId: room.hostUserId,
      status: room.status,
      maxPlayers: room.maxPlayers,
      currentTurnUserId: room.currentTurnUserId,
      currentTurnSeat: room.currentTurnSeat,
      turnDeadline: room.turnDeadline,
      turnDurationSeconds: room.turnDurationSeconds,
      roundNumber: room.roundNumber,
      lastPlayedCards: room.lastPlayedCards,
      lastPlayUserId: room.lastPlayUserId,
      passPlayerIds: room.passPlayerIds || [],
      samDeclarerId: room.samDeclarerId,
      samPhase: room.samPhase,
      roomType: room.roomType || 'LIVE',
      isTest: room.isTest || false,
      botDifficulty: room.botDifficulty || 'NORMAL',
      botPaused: room.botPaused || false,
      testScenario: room.testScenario,
      spectatorCount: samRealtime.getSpectatorCount(room.id),
      winnerUserId: room.winnerUserId,
      startAt: room.startAt ? (room.startAt instanceof Date ? room.startAt.toISOString() : new Date(room.startAt).toISOString()) : null,
      serverTime: new Date().toISOString(),
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
      host: room.host,
    },
    players: sanitizedPlayers,
    myHandCards: isSpectator ? [] : myHandCards,
    isSpectator,
    spectatorCount: samRealtime.getSpectatorCount(room.id),
    result: room.result ? room.result.details : null,
  };
}

async function getActiveRoom(userId) {
  if (!userId) return null;
  const activePlayer = await SamPlayer.findOne({
    where: {
      userId,
      status: { [Op.in]: ['WAITING', 'ACTIVE'] },
    },
    include: [
      {
        model: SamRoom,
        as: 'room',
        where: { status: { [Op.in]: ['WAITING', 'STARTING', 'PLAYING'] }, isTest: false },
      },
    ],
  });

  if (!activePlayer || !activePlayer.room) {
    return null;
  }

  return getRoomDetail(activePlayer.room.id, userId);
}

// ── BOT AUTOMATION & LIFECYCLE ──

function triggerBotLifecycle(roomId) {
  scheduleBotTimer(
    roomId,
    async () => {
      const room = await SamRoom.findByPk(roomId, {
        include: [{ model: SamPlayer, as: 'players' }],
      });

      if (!room || room.status !== 'PLAYING' || room.botPaused) {
        return;
      }

      // 1. Sâm declaration phase for bots
      if (room.samPhase === 'SAM_DECLARING') {
        const undecidedBots = room.players.filter(
          (p) => p.isBot && p.hasDeclaredSam === null
        );

        if (undecidedBots.length > 0) {
          const bot = undecidedBots[0];
          const shouldDeclare = samBotAI.decideSam(bot.handCards, room.botDifficulty);
          await declareSam(room.id, bot.botId || bot.id, shouldDeclare);
          return;
        }
      }

      // 2. Playing turn phase for bot at current turn
      if (room.samPhase === 'PLAYING') {
        const currentSeat = room.currentTurnSeat;
        const currentBot = room.players.find(
          (p) => p.seatIndex === currentSeat && p.isBot && p.status === 'ACTIVE'
        );

        if (!currentBot) return;

        const anyOpponentBaoMot = room.players.some(
          (p) => p.seatIndex !== currentSeat && p.isBaoMot
        );

        const move = samBotAI.chooseMove(
          currentBot.handCards,
          room.lastPlayedCards,
          anyOpponentBaoMot,
          room.botDifficulty
        );

        samRealtime.emitToRoom(room.id, 'sam:botDebug', {
          botId: currentBot.botId,
          seatIndex: currentBot.seatIndex,
          action: move.action,
          cardIds: move.cardIds,
          comboName: move.combo?.name,
          decisionReason: move.decisionReason,
          legalMoveCount: move.allLegalMoves?.length || 0,
        });

        if (move.action === 'PLAY' && move.cardIds && move.cardIds.length > 0) {
          await playCards(room.id, currentBot.botId || currentBot.id, move.cardIds);
        } else {
          await passTurn(room.id, currentBot.botId || currentBot.id);
        }
      }
    },
    // Random natural delay between 600ms and 1400ms
    process.env.NODE_ENV === 'test' ? 50 : Math.floor(Math.random() * 800) + 600
  );
}

// ── ADMIN BOT TEST CONTROLS ──

async function fillBots(roomId, adminUserId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room) throw new Error('Phòng không tồn tại');
  if (!room.isTest) throw new Error('Chỉ có thể thêm bot vào phòng Bot Test');

  const takenSeats = room.players.map((p) => p.seatIndex);
  for (let s = 0; s < room.maxPlayers; s++) {
    if (!takenSeats.includes(s)) {
      await SamPlayer.create({
        roomId: room.id,
        userId: null,
        seatIndex: s,
        handCards: [],
        remainingCardsCount: 0,
        status: 'WAITING',
        isReady: true,
        playerType: 'BOT',
        isBot: true,
        botId: `BOT_TEST_0${s + 1}`,
        botName: `BOT-0${s + 1}`,
      });
    }
  }

  const detail = await getRoomDetail(room.id, adminUserId, 'admin');
  samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
  return detail;
}

async function pauseBotTest(roomId, adminUserId) {
  const room = await SamRoom.findByPk(roomId);
  if (!room) throw new Error('Phòng không tồn tại');
  room.botPaused = true;
  await room.save();
  clearBotTimers(room.id);
  const detail = await getRoomDetail(room.id, adminUserId, 'admin');
  samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
  return detail;
}

async function resumeBotTest(roomId, adminUserId) {
  const room = await SamRoom.findByPk(roomId);
  if (!room) throw new Error('Phòng không tồn tại');
  room.botPaused = false;
  await room.save();
  triggerBotLifecycle(room.id);
  const detail = await getRoomDetail(room.id, adminUserId, 'admin');
  samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: detail.room });
  return detail;
}

async function stepBotTest(roomId, adminUserId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });
  if (!room || room.status !== 'PLAYING') throw new Error('Trận đấu chưa bắt đầu');

  const currentBot = room.players.find(
    (p) => p.seatIndex === room.currentTurnSeat && p.isBot
  );
  if (!currentBot) throw new Error('Lượt hiện tại không phải của Bot');

  const anyOpponentBaoMot = room.players.some((p) => p.seatIndex !== room.currentTurnSeat && p.isBaoMot);
  const move = samBotAI.chooseMove(currentBot.handCards, room.lastPlayedCards, anyOpponentBaoMot, room.botDifficulty);

  if (move.action === 'PLAY' && move.cardIds) {
    return playCards(room.id, currentBot.botId || currentBot.id, move.cardIds);
  }
  return passTurn(room.id, currentBot.botId || currentBot.id);
}

async function restartBotTest(roomId, adminUserId) {
  clearBotTimers(roomId);
  return startMatch(roomId, adminUserId, true);
}

async function stopBotTest(roomId, adminUserId) {
  clearBotTimers(roomId);
  const room = await SamRoom.findByPk(roomId);
  if (room) {
    room.status = 'ABANDONED';
    await room.save();
    samRealtime.emitToRoom(room.id, 'sam:roomUpdated', { room: null });
  }
  return { success: true };
}

async function getBotDebugState(roomId, adminUserId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name'] }],
      },
    ],
  });
  if (!room) throw new Error('Phòng không tồn tại');

  return {
    roomId: room.id,
    status: room.status,
    samPhase: room.samPhase,
    currentTurnSeat: room.currentTurnSeat,
    botPaused: room.botPaused,
    lastPlayedCards: room.lastPlayedCards,
    players: room.players.map((p) => ({
      seatIndex: p.seatIndex,
      isBot: p.isBot,
      botId: p.botId,
      name: p.isBot ? p.botName : p.user?.name,
      handCards: p.handCards,
      remainingCardsCount: p.remainingCardsCount,
      legalMoves: samBotAI.getLegalMoves(p.handCards, room.lastPlayedCards),
    })),
  };
}

// ── LEADERBOARD & STATS ──

async function getLeaderboard(limit = 50) {
  const stats = await SamUserStat.findAll({
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'teamId'] }],
    order: [
      ['totalPoints', 'DESC'],
      ['gamesWon', 'DESC'],
      ['maxWinStreak', 'DESC'],
    ],
    limit: Number(limit) || 50,
  });

  return stats.map((s, idx) => ({
    rank: idx + 1,
    userId: s.userId,
    user: s.user,
    gamesPlayed: s.gamesPlayed,
    gamesWon: s.gamesWon,
    winRate: s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0,
    samWon: s.samWon,
    totalPoints: s.totalPoints,
    winStreak: s.winStreak,
    maxWinStreak: s.maxWinStreak,
  }));
}

async function getMyStats(userId) {
  if (!userId) return null;
  const stat = await SamUserStat.findOne({
    where: { userId },
    include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle'] }],
  });

  if (!stat) {
    return {
      userId,
      gamesPlayed: 0,
      gamesWon: 0,
      winRate: 0,
      samWon: 0,
      totalPoints: 0,
      winStreak: 0,
      maxWinStreak: 0,
    };
  }

  return {
    userId: stat.userId,
    user: stat.user,
    gamesPlayed: stat.gamesPlayed,
    gamesWon: stat.gamesWon,
    winRate: stat.gamesPlayed > 0 ? Math.round((stat.gamesWon / stat.gamesPlayed) * 100) : 0,
    samWon: stat.samWon,
    totalPoints: stat.totalPoints,
    winStreak: stat.winStreak,
    maxWinStreak: stat.maxWinStreak,
  };
}

module.exports = {
  listRooms,
  createRoom,
  createBotTestRoom,
  joinRoom,
  leaveRoom,
  toggleReady,
  startMatch,
  clearStartCountdown,
  clearBotTimers,
  clearSamPhaseTimer,
  declareSam,
  playCards,
  passTurn,
  getRoomDetail,
  getActiveRoom,
  fillBots,
  pauseBotTest,
  resumeBotTest,
  stepBotTest,
  restartBotTest,
  stopBotTest,
  getBotDebugState,
  getLeaderboard,
  getMyStats,
  finishMatch,
};
