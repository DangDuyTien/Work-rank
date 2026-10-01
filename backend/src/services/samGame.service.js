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
const samRealtime = require('./samRealtime.service');

/**
 * Sam Lốc Game Service (Server Authoritative)
 */

// Helper to generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'SAM-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ── LOBBY & ROOM MANAGEMENT ──

async function listRooms(filters = {}) {
  const where = {};
  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { [Op.in]: ['WAITING', 'PLAYING'] };
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
    };
  });
}

async function createRoom(data) {
  const { title = 'Phòng Đánh Sâm', maxPlayers = 4, userId } = data;

  if (!userId) {
    throw new Error('Yêu cầu xác thực người dùng để tạo phòng');
  }

  const validMax = Math.min(4, Math.max(2, Number(maxPlayers) || 4));

  const code = generateRoomCode();

  const result = await sequelize.transaction(async (t) => {
    const room = await SamRoom.create(
      {
        code,
        title: title.trim() || 'Phòng Đánh Sâm',
        hostUserId: userId,
        status: 'WAITING',
        maxPlayers: validMax,
        roundNumber: 1,
        passPlayerIds: [],
        samPhase: 'WAITING',
      },
      { transaction: t }
    );

    // Host automatically occupies seat 0
    await SamPlayer.create(
      {
        roomId: room.id,
        userId,
        seatIndex: 0,
        handCards: [],
        remainingCardsCount: 0,
        status: 'WAITING',
      },
      { transaction: t }
    );

    return room;
  });

  samRealtime.emitToRoom(result.id, 'sam:roomListChanged', { roomId: result.id });
  return getRoomDetail(result.id, userId);
}

async function joinRoom(roomId, userId) {
  if (!roomId || !userId) {
    throw new Error('Thiếu roomId hoặc userId');
  }

  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room) {
    throw new Error('Phòng chơi không tồn tại');
  }

  if (room.status !== 'WAITING') {
    // Check if player is already in this playing room -> reconnect
    const existingPlayer = room.players.find((p) => Number(p.userId) === Number(userId));
    if (existingPlayer) {
      return getRoomDetail(room.id, userId);
    }
    throw new Error('Phòng đã bắt đầu ván hoặc đã kết thúc');
  }

  // Check if player already in room
  const alreadyIn = room.players.find((p) => Number(p.userId) === Number(userId));
  if (alreadyIn) {
    return getRoomDetail(room.id, userId);
  }

  if (room.players.length >= room.maxPlayers) {
    throw new Error('Phòng chơi đã đủ người');
  }

  // Find next available seat index (0, 1, 2, 3)
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
  });

  const detail = await getRoomDetail(room.id, userId);
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

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) {
    return { success: true };
  }

  if (room.status === 'WAITING') {
    await player.destroy();

    const remainingPlayers = await SamPlayer.findAll({
      where: { roomId: room.id },
      order: [['seatIndex', 'ASC']],
    });

    if (remainingPlayers.length === 0) {
      room.status = 'ABANDONED';
      await room.save();
    } else if (Number(room.hostUserId) === Number(userId)) {
      // Transfer host to next player
      room.hostUserId = remainingPlayers[0].userId;
      await room.save();
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

  // If in active playing game -> surrender / disconnect
  player.status = 'SURRENDERED';
  await player.save();

  // If only 1 active player remains, that player wins!
  const activeRemaining = room.players.filter(
    (p) => Number(p.userId) !== Number(userId) && p.status === 'ACTIVE'
  );

  if (activeRemaining.length === 1) {
    await finishMatch(room.id, activeRemaining[0].userId, 'SURRENDER_WIN');
  }

  return { success: true };
}

// ── MATCH LIFECYCLE ──

async function startMatch(roomId, hostUserId) {
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
    throw new Error('Phòng chơi không tồn tại');
  }

  if (Number(room.hostUserId) !== Number(hostUserId)) {
    throw new Error('Chỉ có chủ phòng mới có quyền bắt đầu trận đấu');
  }

  if (room.status !== 'WAITING' && room.status !== 'FINISHED') {
    throw new Error('Phòng đang trong trận đấu');
  }

  const players = room.players;
  if (players.length < 2) {
    throw new Error('Cần ít nhất 2 người chơi để bắt đầu Đánh Sâm');
  }

  // 1. Deal 10 cards to each player using Server Authority
  const dealtHands = samEngine.dealCards(players.length);

  await sequelize.transaction(async (t) => {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      p.handCards = dealtHands[i];
      p.remainingCardsCount = dealtHands[i].length;
      p.status = 'ACTIVE';
      p.hasDeclaredSam = false;
      p.isBaoMot = false;
      p.scoreDelta = 0;
      p.rank = null;
      await p.save({ transaction: t });
    }

    // 2. Set phase to SAM_DECLARING (players have 10s window to declare Sâm)
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

    // Default first turn: host (seat 0)
    room.currentTurnUserId = room.hostUserId;
    room.currentTurnSeat = 0;
    // 10s window for declaring Sam
    room.turnDeadline = new Date(Date.now() + 10 * 1000);
    await room.save({ transaction: t });

    await SamAction.create(
      {
        roomId: room.id,
        userId: hostUserId,
        actionType: 'DEAL',
        metadata: { playerCount: players.length },
      },
      { transaction: t }
    );
  });

  // 3. Broadcast match started to room
  const detail = await getRoomDetail(room.id, hostUserId);
  samRealtime.emitToRoom(room.id, 'sam:started', {
    roomId: room.id,
    room: detail.room,
    players: detail.players,
    samPhase: 'SAM_DECLARING',
    samDeadline: room.turnDeadline,
  });

  // 4. Send private hand cards exclusively to each player
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    samRealtime.emitToUser(p.userId, 'sam:handCards', {
      roomId: room.id,
      handCards: dealtHands[i],
    });
  }

  return detail;
}

async function declareSam(roomId, userId, declare = true) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new Error('Trận đấu không tồn tại hoặc chưa bắt đầu');
  }

  if (room.samPhase !== 'SAM_DECLARING') {
    throw new Error('Đã qua thời gian báo Sâm');
  }

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) {
    throw new Error('Người chơi không ở trong phòng này');
  }

  player.hasDeclaredSam = !!declare;
  await player.save();

  await SamAction.create({
    roomId: room.id,
    userId,
    actionType: declare ? 'DECLARE_SAM' : 'SKIP_SAM',
  });

  if (declare) {
    // First player who successfully declares Sam gets prioritized turn
    if (!room.samDeclarerId) {
      room.samDeclarerId = userId;
      room.samPhase = 'PLAYING';
      room.currentTurnUserId = userId;
      room.currentTurnSeat = player.seatIndex;
      room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
      await room.save();

      samRealtime.emitToRoom(room.id, 'sam:samDeclared', {
        roomId: room.id,
        userId,
        declarerSeat: player.seatIndex,
        currentTurnUserId: userId,
        turnDeadline: room.turnDeadline,
      });

      return getRoomDetail(room.id, userId);
    }
  }

  // Check if all players have made their decision (or skipped)
  const allDecided = room.players.every((p) => p.hasDeclaredSam !== false);
  if (allDecided && !room.samDeclarerId) {
    // No one declared Sam -> proceed to normal playing phase
    room.samPhase = 'PLAYING';
    room.currentTurnUserId = room.hostUserId;
    room.currentTurnSeat = 0;
    room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
    await room.save();

    samRealtime.emitToRoom(room.id, 'sam:turnChanged', {
      roomId: room.id,
      currentTurnUserId: room.currentTurnUserId,
      currentTurnSeat: 0,
      turnDeadline: room.turnDeadline,
    });
  }

  return getRoomDetail(room.id, userId);
}

// ── PLAY CARDS & PASS TURN ──

async function playCards(roomId, userId, cardIds) {
  if (!Array.isArray(cardIds) || cardIds.length === 0) {
    throw new Error('Vui lòng chọn ít nhất 1 lá bài để đánh');
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
    throw new Error('Trận đấu chưa bắt đầu hoặc đã kết thúc');
  }

  // Auto-transition from SAM_DECLARING to PLAYING if timer expired
  if (room.samPhase === 'SAM_DECLARING') {
    room.samPhase = 'PLAYING';
    await room.save();
  }

  if (Number(room.currentTurnUserId) !== Number(userId)) {
    throw new Error('Chưa đến lượt của bạn');
  }

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) {
    throw new Error('Người chơi không tồn tại trong phòng');
  }

  // 1. Verify card ownership (Security check against client forgery)
  const hand = player.handCards || [];
  const hasAllCards = cardIds.every((c) => hand.includes(c));
  if (!hasAllCards) {
    throw new Error('Bài đánh ra chứa lá bài không có trên tay bạn');
  }

  // 2. Validate move against current board state
  const prevCards = room.lastPlayedCards ? room.lastPlayedCards.cards : null;
  const beatCheck = samEngine.canBeat(cardIds, prevCards);
  if (!beatCheck.canBeat) {
    throw new Error(beatCheck.reason || 'Nước đi không hợp lệ');
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
      userId,
      playerName: player.user ? player.user.name : 'Người chơi',
    });
  }

  await player.save();

  // 4. Record action and chop events
  let isChop = !!beatCheck.isChop;
  let chopReward = 0;
  if (isChop && room.lastPlayUserId) {
    // 15 points penalty for chopped two
    chopReward = 15;
    const victim = room.players.find((p) => Number(p.userId) === Number(room.lastPlayUserId));
    if (victim) {
      victim.scoreDelta -= chopReward;
      await victim.save();
    }
    player.scoreDelta += chopReward;
    await player.save();

    samRealtime.emitToRoom(room.id, 'sam:chopped', {
      roomId: room.id,
      chopperId: userId,
      victimId: room.lastPlayUserId,
      points: chopReward,
      chopType: beatCheck.chopType,
    });
  }

  await SamAction.create({
    roomId: room.id,
    userId,
    actionType: isChop ? 'CHOP' : 'PLAY',
    cards: cardIds,
    comboType: beatCheck.combo.type,
    metadata: {
      isChop,
      chopReward,
      remainingCards: player.remainingCardsCount,
    },
  });

  // 5. Update room board state
  room.lastPlayedCards = {
    cards: cardIds,
    userId,
    comboType: beatCheck.combo.type,
    rankValue: beatCheck.combo.rankValue,
    name: beatCheck.combo.name,
  };
  room.lastPlayUserId = userId;

  // 6. Check Win (Finished Hand)
  if (player.remainingCardsCount === 0) {
    // Check Thối 2 on final play
    const wasThoi2 = samEngine.checkThoi2(cardIds, hand);
    if (wasThoi2) {
      // Ending on a 2 is a penalty!
      return handleThoi2Finish(room, player, cardIds);
    }

    // Normal or Sâm win
    return handleGameWin(room, player);
  }

  // 7. Advance turn to next active player who hasn't passed in this round
  const nextPlayer = findNextTurnPlayer(room, player.seatIndex);
  room.currentTurnUserId = nextPlayer.userId;
  room.currentTurnSeat = nextPlayer.seatIndex;
  room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
  await room.save();

  // 8. Realtime notifications
  samRealtime.emitToRoom(room.id, 'sam:cardsPlayed', {
    roomId: room.id,
    userId,
    cards: cardIds,
    comboName: beatCheck.combo.name,
    remainingCount: player.remainingCardsCount,
    nextTurnUserId: nextPlayer.userId,
    turnDeadline: room.turnDeadline,
  });

  // Send private hand update to player
  samRealtime.emitToUser(userId, 'sam:handCards', {
    roomId: room.id,
    handCards: player.handCards,
  });

  return getRoomDetail(room.id, userId);
}

async function passTurn(roomId, userId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [{ model: SamPlayer, as: 'players' }],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new Error('Trận đấu chưa bắt đầu hoặc đã kết thúc');
  }

  if (Number(room.currentTurnUserId) !== Number(userId)) {
    throw new Error('Chưa đến lượt của bạn để bỏ lượt');
  }

  if (!room.lastPlayedCards) {
    throw new Error('Bạn đang là người đánh đầu vòng, không thể bỏ lượt');
  }

  const passList = Array.isArray(room.passPlayerIds) ? [...room.passPlayerIds] : [];
  if (!passList.includes(Number(userId))) {
    passList.push(Number(userId));
  }
  room.passPlayerIds = passList;

  await SamAction.create({
    roomId: room.id,
    userId,
    actionType: 'PASS',
  });

  // Check if all OTHER players have passed
  const activePlayers = room.players.filter((p) => p.status === 'ACTIVE' && p.remainingCardsCount > 0);
  const eligiblePlayers = activePlayers.filter((p) => !passList.includes(Number(p.userId)));

  if (eligiblePlayers.length <= 1) {
    // Round is finished! The last play user takes the new round
    const roundWinnerId = room.lastPlayUserId;
    const roundWinner = room.players.find((p) => Number(p.userId) === Number(roundWinnerId)) || eligiblePlayers[0];

    room.lastPlayedCards = null;
    room.passPlayerIds = [];
    room.roundNumber += 1;
    room.currentTurnUserId = roundWinner ? roundWinner.userId : room.hostUserId;
    room.currentTurnSeat = roundWinner ? roundWinner.seatIndex : 0;
    room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
    await room.save();

    samRealtime.emitToRoom(room.id, 'sam:roundReset', {
      roomId: room.id,
      roundWinnerId: room.currentTurnUserId,
      roundNumber: room.roundNumber,
      turnDeadline: room.turnDeadline,
    });

    return getRoomDetail(room.id, userId);
  }

  // Next player in round
  const nextPlayer = findNextTurnPlayer(room, room.currentTurnSeat);
  room.currentTurnUserId = nextPlayer.userId;
  room.currentTurnSeat = nextPlayer.seatIndex;
  room.turnDeadline = new Date(Date.now() + room.turnDurationSeconds * 1000);
  await room.save();

  samRealtime.emitToRoom(room.id, 'sam:pass', {
    roomId: room.id,
    userId,
    nextTurnUserId: nextPlayer.userId,
    turnDeadline: room.turnDeadline,
  });

  return getRoomDetail(room.id, userId);
}

// ── ROUND & TURN HELPERS ──

function findNextTurnPlayer(room, currentSeatIndex) {
  const players = room.players.filter((p) => p.status === 'ACTIVE' && p.remainingCardsCount > 0);
  const passList = Array.isArray(room.passPlayerIds) ? room.passPlayerIds : [];

  // Sort players by seat index ascending
  players.sort((a, b) => a.seatIndex - b.seatIndex);

  // Search sequentially starting from next seat index (circular counter-clockwise)
  const totalSeats = 4;
  for (let step = 1; step <= totalSeats; step++) {
    const targetSeat = (currentSeatIndex + step) % totalSeats;
    const candidate = players.find((p) => p.seatIndex === targetSeat);
    if (candidate && !passList.includes(Number(candidate.userId))) {
      return candidate;
    }
  }

  // Fallback to first active player
  return players[0];
}

// ── GAME WIN & RESULT CALCULATIONS ──

async function handleGameWin(room, winnerPlayer) {
  const winnerUserId = winnerPlayer.userId;
  const isSamWin = room.samDeclarerId && Number(room.samDeclarerId) === Number(winnerUserId);
  const isDenSam = room.samDeclarerId && Number(room.samDeclarerId) !== Number(winnerUserId);

  let totalWinPoints = 0;
  const playerResults = [];

  for (const p of room.players) {
    if (Number(p.userId) === Number(winnerUserId)) {
      continue;
    }

    let penalty = 0;
    let reason = 'THUA';

    if (isSamWin) {
      penalty = 20; // 20 points per player when Sam is won
      reason = 'THUA_SAM';
    } else if (isDenSam && Number(p.userId) === Number(room.samDeclarerId)) {
      // Sam declarer got blocked! Pays full village penalty to the winner
      penalty = 20 * (room.players.length - 1);
      reason = 'DEN_SAM';
    } else if (!isDenSam) {
      // Normal win: 1 point per remaining card, 15 points if burned (Cóng)
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
    p.rank = 2; // Runner up
    await p.save();

    playerResults.push({
      userId: p.userId,
      name: p.user ? p.user.name : `Người chơi ${p.seatIndex + 1}`,
      seatIndex: p.seatIndex,
      remainingCards: p.remainingCardsCount,
      scoreDelta: -penalty,
      reason,
      rank: 2,
    });
  }

  winnerPlayer.scoreDelta += totalWinPoints;
  winnerPlayer.rank = 1;
  await winnerPlayer.save();

  playerResults.unshift({
    userId: winnerPlayer.userId,
    name: winnerPlayer.user ? winnerPlayer.user.name : `Người chơi ${winnerPlayer.seatIndex + 1}`,
    seatIndex: winnerPlayer.seatIndex,
    remainingCards: 0,
    scoreDelta: totalWinPoints,
    reason: isSamWin ? 'THANG_SAM' : 'VE_NHAT',
    rank: 1,
  });

  room.status = 'FINISHED';
  room.winnerUserId = winnerUserId;
  room.finishedAt = new Date();
  await room.save();

  // Save game result
  const gameResult = await SamResult.create({
    roomId: room.id,
    winnerUserId,
    details: playerResults,
  });

  // Update user stats
  await updateUserStats(playerResults, winnerUserId, isSamWin);

  samRealtime.emitToRoom(room.id, 'sam:gameFinished', {
    roomId: room.id,
    winnerUserId,
    results: playerResults,
    isSamWin,
  });

  return getRoomDetail(room.id, winnerUserId);
}

async function handleThoi2Finish(room, player, cardIds) {
  // Ending on 2: Player receives 20 points penalty, runner up with least cards wins
  const penalty = 20;
  player.scoreDelta -= penalty;
  player.rank = room.players.length;
  await player.save();

  // Find candidate with lowest remaining cards
  const otherPlayers = room.players.filter((p) => Number(p.userId) !== Number(player.userId));
  otherPlayers.sort((a, b) => a.remainingCardsCount - b.remainingCardsCount);
  const substituteWinner = otherPlayers[0];

  substituteWinner.scoreDelta += penalty;
  substituteWinner.rank = 1;
  await substituteWinner.save();

  room.status = 'FINISHED';
  room.winnerUserId = substituteWinner.userId;
  room.finishedAt = new Date();
  await room.save();

  const playerResults = [
    {
      userId: substituteWinner.userId,
      name: substituteWinner.user?.name || 'Người chơi',
      seatIndex: substituteWinner.seatIndex,
      scoreDelta: penalty,
      reason: 'THANG_DO_DOI_THU_THOI_2',
      rank: 1,
    },
    {
      userId: player.userId,
      name: player.user?.name || 'Người chơi',
      seatIndex: player.seatIndex,
      scoreDelta: -penalty,
      reason: 'THOI_2',
      rank: room.players.length,
    },
  ];

  await SamResult.create({
    roomId: room.id,
    winnerUserId: substituteWinner.userId,
    details: playerResults,
  });

  await updateUserStats(playerResults, substituteWinner.userId, false);

  samRealtime.emitToRoom(room.id, 'sam:gameFinished', {
    roomId: room.id,
    winnerUserId: substituteWinner.userId,
    results: playerResults,
    isThoi2: true,
  });

  return getRoomDetail(room.id, player.userId);
}

async function updateUserStats(playerResults, winnerUserId, isSamWin) {
  for (const pr of playerResults) {
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

// ── GET ROOM DETAIL (SECURITY & RECONNECT SAFE) ──

async function getRoomDetail(roomId, requestingUserId) {
  const room = await SamRoom.findByPk(roomId, {
    include: [
      { model: User, as: 'host', attributes: ['id', 'name', 'email', 'jobTitle', 'department'] },
      {
        model: SamPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId'] }],
      },
      { model: SamResult, as: 'result' },
    ],
  });

  if (!room) {
    throw new Error('Phòng không tồn tại');
  }

  // Format players securely: NEVER expose opponent hand cards!
  let myHandCards = [];
  const sanitizedPlayers = room.players.map((p) => {
    const isMe = requestingUserId && Number(p.userId) === Number(requestingUserId);
    if (isMe) {
      myHandCards = p.handCards || [];
    }

    return {
      id: p.id,
      userId: p.userId,
      seatIndex: p.seatIndex,
      remainingCardsCount: p.remainingCardsCount,
      status: p.status,
      hasDeclaredSam: p.hasDeclaredSam,
      isBaoMot: p.isBaoMot,
      scoreDelta: p.scoreDelta,
      rank: p.rank,
      user: p.user,
      isHost: Number(room.hostUserId) === Number(p.userId),
      // Opponent cards are masked completely
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
      winnerUserId: room.winnerUserId,
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
      host: room.host,
    },
    players: sanitizedPlayers,
    myHandCards,
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
        where: { status: { [Op.in]: ['WAITING', 'PLAYING'] } },
      },
    ],
  });

  if (!activePlayer || !activePlayer.room) {
    return null;
  }

  return getRoomDetail(activePlayer.room.id, userId);
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
  joinRoom,
  leaveRoom,
  startMatch,
  declareSam,
  playCards,
  passTurn,
  getRoomDetail,
  getActiveRoom,
  getLeaderboard,
  getMyStats,
};
