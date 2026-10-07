'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  TypingRoom,
  TypingPlayer,
  TypingChallenge,
  TypingMatchResult,
  TypingUserStat,
  User,
  Team,
  Season,
  ScoreLedger,
  sequelize,
} = require('../models');

const typingEngine = require('./typingEngine');
const typingRealtime = require('./typingRealtime.service');
const { seedTypingChallenges } = require('../seeders/typingChallenges.seeder');
const projector = require('./competition/competitionReadModel.projector');
const effectEngine = require('./competition/effectEngine.service');

const {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
} = require('../utils/errors');

// In-memory timers for countdowns & auto-forfeits
const startCountdownTimers = new Map();
const matchDeadlineTimers = new Map();

// Helper to generate 4-character uppercase alphanumeric room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TYPE-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Ensure challenges exist
async function ensureChallengesExist() {
  const count = await TypingChallenge.count();
  if (count === 0) {
    await seedTypingChallenges().catch((err) => console.warn('Typing challenge seed warning:', err.message));
  }
}

// Clear countdown timer
function clearStartCountdown(roomId) {
  const numId = Number(roomId);
  if (startCountdownTimers.has(numId)) {
    clearTimeout(startCountdownTimers.get(numId));
    startCountdownTimers.delete(numId);
  }
}

// Schedule 5s start countdown
function scheduleStartCountdown(roomId) {
  const numId = Number(roomId);
  clearStartCountdown(numId);

  const timer = setTimeout(async () => {
    startCountdownTimers.delete(numId);
    try {
      const room = await TypingRoom.findByPk(numId, {
        include: [{ model: TypingPlayer, as: 'players' }],
      });
      if (!room || room.status !== 'STARTING') return;

      const players = room.players || [];
      const requiredPlayers = room.mode === 'SOLO' ? 1 : room.mode === '1V1' ? 2 : room.mode === '2V2' ? 4 : 6;

      if (players.length >= requiredPlayers && players.every((p) => p.isReady)) {
        await startMatch(numId, room.hostUserId, true);
      } else {
        room.status = 'WAITING';
        room.startAt = null;
        await room.save();
        const detail = await getRoomDetail(numId, room.hostUserId);
        typingRealtime.emitToRoom(numId, 'typing:startingCancelled', {
          roomId: numId,
          reason: 'PLAYERS_NOT_READY',
          room: detail ? detail.room : null,
          players: detail ? detail.players : [],
        });
        typingRealtime.emitToRoom(numId, 'typing:roomUpdated', { room: detail ? detail.room : null });
      }
    } catch (err) {
      console.error(`[TypingStartCountdown Error room ${numId}]:`, err.message);
    }
  }, 5000);

  startCountdownTimers.set(numId, timer);
}

// ── LOBBY & ROOM MANAGEMENT ──

async function listRooms(filters = {}) {
  await ensureChallengesExist();
  const where = {};

  if (filters.status) {
    where.status = filters.status;
  } else {
    where.status = { [Op.in]: ['WAITING', 'STARTING', 'PLAYING'] };
  }

  if (filters.mode) {
    where.mode = filters.mode;
  }
  if (filters.matchType) {
    where.matchType = filters.matchType;
  }

  const rooms = await TypingRoom.findAll({
    where,
    include: [
      { model: User, as: 'host', attributes: ['id', 'name', 'email', 'jobTitle', 'department'] },
      {
        model: TypingPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'department'] }],
      },
      { model: TypingChallenge, as: 'challenge', attributes: ['id', 'title', 'difficulty', 'language', 'wordCount'] },
    ],
    order: [['createdAt', 'DESC']],
    limit: filters.limit ? Number(filters.limit) : 30,
  });

  return rooms.map((r) => {
    const data = r.toJSON();
    return {
      ...data,
      playerCount: data.players ? data.players.length : 0,
      spectatorCount: typingRealtime.getSpectatorCount(r.id),
    };
  });
}

// Helper to construct a rich continuous stream of words without any punctuation for timed tests
async function buildContinuousChallengeText({ durationLimitSeconds = 120, difficulty = 'MEDIUM', language = 'VI' }) {
  const targetWords = Math.max(80, Math.round((Number(durationLimitSeconds) / 60) * 120)); // ~120 words per minute of test
  const challenges = await TypingChallenge.findAll({
    where: {
      language: ['VI', 'EN', 'CODE'].includes(language) ? language : 'VI',
      isActive: true,
    },
    order: sequelize.random ? sequelize.random() : [['id', 'ASC']],
  });

  if (!challenges || challenges.length === 0) {
    return 'tốc độ và sự chính xác tạo nên sức mạnh vượt trội của mỗi thành viên trong công việc hàng ngày rèn luyện bản thân mỗi ngày để bứt phá giới hạn và vươn tới thành công';
  }

  // Shuffle challenges randomly for dynamic word progression
  const shuffled = [...challenges].sort(() => Math.random() - 0.5);

  let combined = '';
  let words = 0;
  let idx = 0;
  while (words < targetWords && idx < 30) {
    const pick = shuffled[idx % shuffled.length];
    const text = (pick.content || '')
      .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
    if (text) {
      combined = combined ? `${combined} ${text}` : text;
      words = combined.split(/\s+/).length;
    }
    idx++;
  }

  return combined;
}

async function createRoom(data, requestingUser) {
  await ensureChallengesExist();

  const actualUserId = requestingUser ? requestingUser.id : data.userId;
  if (!actualUserId) {
    throw new UnauthorizedError('Yêu cầu đăng nhập để tạo phòng thi đấu');
  }

  const {
    title = 'Đấu Trường Đánh Máy',
    mode = '1V1',
    matchType = 'RANKED',
    difficulty = 'MEDIUM',
    language = 'VI',
    challengeId = null,
    durationLimitSeconds = 120, // Default 2 minutes (120s), or 60s (1 min), 300s (5 min)
  } = data;

  const validModes = ['SOLO', '1V1', '2V2', '3V3'];
  const effectiveMode = validModes.includes(mode) ? mode : '1V1';
  const maxPlayers = effectiveMode === 'SOLO' ? 1 : effectiveMode === '1V1' ? 2 : effectiveMode === '2V2' ? 4 : 6;
  const cleanDuration = [30, 60, 120, 180, 300].includes(Number(durationLimitSeconds))
    ? Number(durationLimitSeconds)
    : 120;

  // Pick or construct continuous challenge for the specified duration
  let challengeText = null;
  let selectedChallenge = null;

  if (challengeId) {
    selectedChallenge = await TypingChallenge.findByPk(challengeId);
    if (selectedChallenge) {
      challengeText = (selectedChallenge.content || '')
        .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'<>]/g, '')
        .replace(/\s+/g, ' ')
        .toLowerCase()
        .trim();
    }
  }

  if (!challengeText) {
    challengeText = await buildContinuousChallengeText({
      durationLimitSeconds: cleanDuration,
      difficulty,
      language,
    });
  }

  const code = generateRoomCode();
  const result = await sequelize.transaction(async (t) => {
    const room = await TypingRoom.create(
      {
        code,
        title: title.trim() || 'Đấu Trường Đánh Máy',
        hostUserId: actualUserId,
        mode: effectiveMode,
        matchType: ['PRACTICE', 'RANKED', 'TOURNAMENT'].includes(matchType) ? matchType : 'RANKED',
        status: 'WAITING',
        maxPlayers,
        challengeId: selectedChallenge ? selectedChallenge.id : null,
        targetWordCount: challengeText.split(/\s+/).length,
        challengeText,
        difficulty: selectedChallenge ? selectedChallenge.difficulty : difficulty,
        durationLimitSeconds: cleanDuration,
        winnerTeam: 'NONE',
      },
      { transaction: t }
    );

    // Host occupies seat 0
    await TypingPlayer.create(
      {
        roomId: room.id,
        userId: actualUserId,
        team: effectiveMode === '2V2' || effectiveMode === '3V3' ? 'A' : 'NONE',
        seatIndex: 0,
        isReady: effectiveMode === 'SOLO', // Solo is automatically ready
        status: 'WAITING',
        progressPct: 0,
        typedChars: 0,
        wpm: 0,
        accuracy: 100.0,
        errorCount: 0,
      },
      { transaction: t }
    );

    return room;
  });

  typingRealtime.emitToRoom(result.id, 'typing:roomListChanged', { roomId: result.id });
  return getRoomDetail(result.id, actualUserId);
}

async function quickMatch(data, requestingUser) {
  const actualUserId = requestingUser ? requestingUser.id : data.userId;
  if (!actualUserId) throw new UnauthorizedError('Yêu cầu đăng nhập');

  const { mode = '1V1', matchType = 'RANKED' } = data;

  // Search for an open WAITING room with available slots
  const openRooms = await TypingRoom.findAll({
    where: {
      mode,
      matchType,
      status: 'WAITING',
    },
    include: [{ model: TypingPlayer, as: 'players' }],
    order: [['createdAt', 'ASC']],
  });

  for (const r of openRooms) {
    const isAlreadyIn = r.players.some((p) => Number(p.userId) === Number(actualUserId));
    if (isAlreadyIn) {
      return getRoomDetail(r.id, actualUserId);
    }
    if (r.players.length < r.maxPlayers) {
      return joinRoom(r.id, actualUserId);
    }
  }

  // If no suitable open room found, create a new room
  return createRoom(
    {
      title: `${mode} Matchmaking #${Math.floor(Math.random() * 900 + 100)}`,
      mode,
      matchType,
    },
    requestingUser
  );
}

async function joinRoom(roomId, userId) {
  if (!roomId || !userId) {
    throw new ValidationError('Thiếu roomId hoặc userId');
  }

  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room) {
    throw new NotFoundError('Phòng thi đấu không tồn tại');
  }

  // If player already in room -> return detail
  const existingPlayer = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
  if (existingPlayer) {
    return getRoomDetail(room.id, userId);
  }

  if (room.status !== 'WAITING') {
    // Room is already in play -> allow spectating
    return getRoomDetail(room.id, userId);
  }

  if (room.players.length >= room.maxPlayers) {
    throw new ConflictError('Phòng thi đấu đã đủ người');
  }

  // Determine team & seat index
  const takenSeats = room.players.map((p) => p.seatIndex);
  let availableSeat = 0;
  for (let s = 0; s < room.maxPlayers; s++) {
    if (!takenSeats.includes(s)) {
      availableSeat = s;
      break;
    }
  }

  let assignedTeam = 'NONE';
  if (room.mode === '2V2' || room.mode === '3V3') {
    const teamACount = room.players.filter((p) => p.team === 'A').length;
    const teamBCount = room.players.filter((p) => p.team === 'B').length;
    assignedTeam = teamACount <= teamBCount ? 'A' : 'B';
  }

  await TypingPlayer.create({
    roomId: room.id,
    userId,
    team: assignedTeam,
    seatIndex: availableSeat,
    isReady: false,
    status: 'WAITING',
    progressPct: 0,
    typedChars: 0,
    wpm: 0,
    accuracy: 100.0,
    errorCount: 0,
  });

  const detail = await getRoomDetail(room.id, userId);
  typingRealtime.emitToRoom(room.id, 'typing:playerJoined', {
    roomId: room.id,
    userId,
    players: detail.players,
  });
  typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });

  return detail;
}

async function switchTeam(roomId, userId, targetTeam) {
  if (!['A', 'B'].includes(targetTeam)) {
    throw new ValidationError('Đội phải là Team A hoặc Team B');
  }

  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });
  if (!room || room.status !== 'WAITING') {
    throw new ConflictError('Không thể đổi đội khi phòng đã bắt đầu hoặc không tồn tại');
  }

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) throw new NotFoundError('Người chơi không ở trong phòng');

  if (player.team === targetTeam) {
    return getRoomDetail(room.id, userId);
  }

  const maxPerTeam = room.mode === '2V2' ? 2 : room.mode === '3V3' ? 3 : 1;
  const currentInTargetTeam = room.players.filter((p) => p.team === targetTeam && Number(p.userId) !== Number(userId)).length;
  if (currentInTargetTeam >= maxPerTeam) {
    throw new ConflictError(`Đội ${targetTeam} đã đủ thành viên`);
  }

  player.team = targetTeam;
  player.isReady = false; // Reset ready on team change
  await player.save();

  const detail = await getRoomDetail(room.id, userId);
  typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });
  return detail;
}

async function leaveRoom(roomId, userId) {
  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room) return { success: true };

  const player = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
  if (!player) return { success: true };

  if (room.status === 'WAITING' || room.status === 'STARTING') {
    if (room.status === 'STARTING') {
      clearStartCountdown(room.id);
      room.status = 'WAITING';
      room.startAt = null;
      await room.save();
      typingRealtime.emitToRoom(room.id, 'typing:startingCancelled', {
        roomId: room.id,
        reason: 'PLAYER_LEFT',
        userId,
      });
    }

    await player.destroy();

    const remainingPlayers = await TypingPlayer.findAll({ where: { roomId: room.id } });
    if (remainingPlayers.length === 0) {
      room.status = 'ABANDONED';
      await room.save();
    } else if (Number(room.hostUserId) === Number(userId)) {
      room.hostUserId = remainingPlayers[0].userId;
      await room.save();
    }

    const detail = await getRoomDetail(room.id, userId).catch(() => null);
    typingRealtime.emitToRoom(room.id, 'typing:playerLeft', {
      roomId: room.id,
      userId,
      players: detail ? detail.players : [],
    });
    typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail ? detail.room : null });
    return { success: true };
  }

  // If match in PLAYING -> mark player SURRENDERED
  player.status = 'SURRENDERED';
  await player.save();

  // Check if all remaining players finished/surrendered
  const activeRemaining = await TypingPlayer.findAll({
    where: { roomId: room.id, status: 'TYPING' },
  });

  if (activeRemaining.length === 0) {
    await finalizeMatch(room.id);
  }

  return { success: true };
}

async function toggleReady(roomId, userId, isReady) {
  const room = await TypingRoom.findByPk(roomId, {
    include: [
      {
        model: TypingPlayer,
        as: 'players',
        include: [{ model: User, as: 'user' }],
      },
    ],
  });

  if (!room) throw new NotFoundError('Phòng không tồn tại');
  if (room.status === 'PLAYING') throw new ConflictError('Trận đấu đang diễn ra');

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) throw new NotFoundError('Người chơi không ở trong phòng');

  player.isReady = Boolean(isReady);
  await player.save();

  const allPlayers = await TypingPlayer.findAll({
    where: { roomId: room.id },
    include: [{ model: User, as: 'user' }],
  });

  const requiredCount = room.mode === 'SOLO' ? 1 : room.mode === '1V1' ? 2 : room.mode === '2V2' ? 4 : 6;
  const allReady = allPlayers.length >= requiredCount && allPlayers.every((p) => p.isReady);

  if (allReady) {
    room.status = 'STARTING';
    room.startAt = new Date(Date.now() + 5000);
    await room.save();

    scheduleStartCountdown(room.id);

    const detail = await getRoomDetail(room.id, userId);
    typingRealtime.emitToRoom(room.id, 'typing:starting', {
      roomId: room.id,
      startAt: room.startAt,
      serverTime: new Date().toISOString(),
      room: detail.room,
      players: detail.players,
    });
    typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });
    return detail;
  } else if (room.status === 'STARTING') {
    clearStartCountdown(room.id);
    room.status = 'WAITING';
    room.startAt = null;
    await room.save();

    const detail = await getRoomDetail(room.id, userId);
    typingRealtime.emitToRoom(room.id, 'typing:startingCancelled', {
      roomId: room.id,
      reason: 'PLAYER_UNREADY',
      userId,
      room: detail.room,
      players: detail.players,
    });
    typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });
    return detail;
  }

  const detail = await getRoomDetail(room.id, userId);
  typingRealtime.emitToRoom(room.id, 'typing:playerReady', {
    roomId: room.id,
    userId,
    isReady: Boolean(isReady),
    players: detail.players,
  });
  typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });
  return detail;
}

// ── MATCH START & PROGRESS ──

async function startMatch(roomId, hostUserId, isAutomated = false) {
  const room = await TypingRoom.findByPk(roomId, {
    include: [
      {
        model: TypingPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'jobTitle', 'department'] }],
      },
    ],
  });

  if (!room) throw new NotFoundError('Phòng không tồn tại');
  clearStartCountdown(roomId);

  if (!isAutomated && Number(room.hostUserId) !== Number(hostUserId)) {
    throw new ForbiddenError('Chỉ chủ phòng mới có quyền bắt đầu trận đấu');
  }

  // Ensure challenge text is assigned
  if (!room.challengeText) {
    const continuousText = await buildContinuousChallengeText({
      durationLimitSeconds: room.durationLimitSeconds || 120,
      difficulty: room.difficulty,
    });
    room.challengeText = continuousText;
    room.targetWordCount = continuousText.split(/\s+/).length;
    await room.save();
  }

  await sequelize.transaction(async (t) => {
    for (const p of room.players) {
      p.status = 'TYPING';
      p.progressPct = 0;
      p.typedChars = 0;
      p.wpm = 0;
      p.accuracy = 100.0;
      p.errorCount = 0;
      p.completionTimeMs = null;
      p.individualRank = null;
      p.scoreDelta = 0;
      await p.save({ transaction: t });
    }

    room.status = 'PLAYING';
    room.startedAt = new Date();
    room.startAt = null;
    room.winnerTeam = 'NONE';
    room.winnerUserId = null;
    await room.save({ transaction: t });
  });

  const detail = await getRoomDetail(room.id, hostUserId);
  typingRealtime.emitToRoom(room.id, 'typing:started', {
    roomId: room.id,
    room: detail.room,
    players: detail.players,
    challengeText: room.challengeText,
    startedAt: room.startedAt,
    durationLimitSeconds: room.durationLimitSeconds,
  });

  // Schedule auto-finish if match duration limit is reached
  const matchTimer = setTimeout(() => {
    finalizeMatch(room.id).catch((e) => console.error('Match timeout error:', e.message));
  }, (room.durationLimitSeconds + 3) * 1000);
  matchDeadlineTimers.set(room.id, matchTimer);

  return detail;
}

async function updateProgress(roomId, userId, data) {
  const { typedChars = 0, errorCount = 0, clientDurationMs = 0 } = data;

  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room || room.status !== 'PLAYING') return;

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player || player.status !== 'TYPING') return;

  const totalLength = room.challengeText ? room.challengeText.length : 100;
  const progressPct = Math.min(100, Math.round((typedChars / totalLength) * 1000) / 10);

  const serverDurationMs = room.startedAt ? Date.now() - new Date(room.startedAt).getTime() : 1000;
  const effectiveDuration = clientDurationMs > 0 ? clientDurationMs : serverDurationMs;

  const wpm = typingEngine.calculateWPM(typedChars, effectiveDuration);
  const accuracy = typingEngine.calculateAccuracy(typedChars, typedChars, errorCount);

  player.typedChars = typedChars;
  player.progressPct = progressPct;
  player.wpm = wpm;
  player.accuracy = accuracy;
  player.errorCount = errorCount;
  await player.save();

  // Queue throttled progress broadcast
  typingRealtime.queueProgressUpdate(roomId, userId, {
    userId: Number(userId),
    progressPct,
    typedChars,
    wpm,
    accuracy,
    errorCount,
    team: player.team,
  });
}

// ── MATCH COMPLETION & SCORING SETTLE ──

async function submitFinish(roomId, userId, data) {
  const { typedChars = 0, errorCount = 0, clientDurationMs = 0, finalPayload = {} } = data;

  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room || room.status !== 'PLAYING') {
    throw new ConflictError('Trận đấu đã kết thúc hoặc không trong trạng thái đang thi đấu');
  }

  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) throw new NotFoundError('Không tìm thấy người chơi trong phòng');

  if (player.status === 'FINISHED') {
    return getRoomDetail(room.id, userId);
  }

  const serverDurationMs = room.startedAt ? Date.now() - new Date(room.startedAt).getTime() : 1000;
  const challengeLen = room.challengeText ? room.challengeText.length : (typedChars || 100);
  const actualTyped = Number(typedChars) || 0;

  // Anti-cheat verification
  const plausibility = typingEngine.validateSubmissionPlausibility({
    challengeLength: challengeLen,
    typedChars: actualTyped,
    durationMs: serverDurationMs,
    clientDurationMs,
    errorCount,
  });

  if (!plausibility.valid) {
    console.warn(`[Typing Anti-Cheat Warning] User #${userId} in Room #${roomId} rejected: ${plausibility.reason}`);
  }

  const effectiveDuration = Math.max(1000, clientDurationMs > 0 ? clientDurationMs : serverDurationMs);
  const finalWpm = plausibility.wpm;
  const finalAcc = plausibility.accuracy;

  const finishedCount = room.players.filter((p) => p.status === 'FINISHED').length;

  player.status = 'FINISHED';
  player.progressPct = Math.min(100, Math.round((actualTyped / Math.max(1, challengeLen)) * 100));
  player.typedChars = actualTyped;
  player.wpm = finalWpm;
  player.accuracy = finalAcc;
  player.errorCount = errorCount;
  player.completionTimeMs = effectiveDuration;
  player.individualRank = finishedCount + 1;
  player.performanceScore = typingEngine.computeBasePerformanceScore({
    wpm: finalWpm,
    accuracy: finalAcc,
    errorCount,
    completed: true,
    difficulty: room.difficulty,
  });
  player.finalPayload = finalPayload;
  await player.save();

  typingRealtime.emitToRoom(room.id, 'typing:playerFinished', {
    roomId: room.id,
    userId: Number(userId),
    individualRank: player.individualRank,
    wpm: finalWpm,
    accuracy: finalAcc,
    completionTimeMs: effectiveDuration,
  });

  // If all players are now finished, finalize match
  const remainingTyping = room.players.filter((p) => p.id !== player.id && p.status === 'TYPING');
  if (remainingTyping.length === 0) {
    return finalizeMatch(room.id);
  }

  return getRoomDetail(room.id, userId);
}

/**
 * Finalizes the match, computes winner, settles scores into ScoreLedger, and awards stats.
 */
async function finalizeMatch(roomId) {
  if (matchDeadlineTimers.has(roomId)) {
    clearTimeout(matchDeadlineTimers.get(roomId));
    matchDeadlineTimers.delete(roomId);
  }
  typingRealtime.clearProgressThrottle(roomId);

  const room = await TypingRoom.findByPk(roomId, {
    include: [
      {
        model: TypingPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'teamId'] }],
      },
      { model: TypingChallenge, as: 'challenge' },
    ],
  });

  if (!room || room.status === 'FINISHED') {
    return getRoomDetail(roomId);
  }

  const activeSeason = await Season.findOne({
    where: { status: 'ACTIVE' },
    order: [['id', 'DESC']],
  });

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Resolve Team Results or Solo/1v1 winners
  let winnerTeam = 'NONE';
  let winnerUserId = null;

  if (room.mode === '2V2' || room.mode === '3V3') {
    const teamResult = typingEngine.calculateTeamMatchResult(room.players);
    winnerTeam = teamResult.winnerTeam;
  } else if (room.mode === '1V1') {
    const sorted = [...room.players].sort((a, b) => {
      if (a.status === 'FINISHED' && b.status !== 'FINISHED') return -1;
      if (b.status === 'FINISHED' && a.status !== 'FINISHED') return 1;
      if (a.completionTimeMs && b.completionTimeMs) return a.completionTimeMs - b.completionTimeMs;
      return (b.performanceScore || 0) - (a.performanceScore || 0);
    });
    winnerUserId = sorted[0]?.userId || null;
  } else if (room.mode === 'SOLO') {
    winnerUserId = room.players[0]?.userId || null;
  }

  room.status = 'FINISHED';
  room.finishedAt = now;
  room.winnerTeam = winnerTeam;
  room.winnerUserId = winnerUserId;
  await room.save();

  // Compute individual points & update ScoreLedger atomically
  const playerResultList = [];

  await sequelize.transaction(async (t) => {
    for (const player of room.players) {
      if (!player.userId) continue;

      // 1. Fetch or create User Typing Stat
      const [stat] = await TypingUserStat.findOrCreate({
        where: { userId: player.userId },
        defaults: {
          userId: player.userId,
          dailyResetDate: todayStr,
        },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      // Reset daily counts if day changed
      if (stat.dailyResetDate !== todayStr) {
        stat.dailyResetDate = todayStr;
        stat.dailyRankedCount = 0;
        stat.dailyPointsEarned = 0;
      }

      const isWinner =
        (room.mode === '1V1' && Number(player.userId) === Number(winnerUserId)) ||
        (room.mode === 'SOLO' && player.status === 'FINISHED') ||
        ((room.mode === '2V2' || room.mode === '3V3') && player.team === winnerTeam);

      const isDraw = winnerTeam === 'DRAW';

      const pointsCalc = typingEngine.calculateAwardedPoints({
        matchType: room.matchType,
        mode: room.mode,
        performanceScore: player.performanceScore || 0,
        isWinner,
        isDraw,
        teamContributionRatio: 1.0,
        dailyRankedCount: stat.dailyRankedCount,
        dailyPointsEarned: stat.dailyPointsEarned,
      });

      const awardedPoints = pointsCalc.workrankPoints;
      player.scoreDelta = awardedPoints;
      await player.save({ transaction: t });

      // 2. Insert into ScoreLedger (Immutable Ledger for WorkRank Company BXH)
      if (awardedPoints > 0 && room.matchType === 'RANKED') {
        const idempotencyKey = `typing_match:${room.id}:${player.userId}`;
        const existingLedger = await ScoreLedger.findOne({
          where: { idempotencyKey, effectType: 'INDIVIDUAL_XP' },
          transaction: t,
        });

        if (!existingLedger) {
          await ScoreLedger.create(
            {
              idempotencyKey,
              effectType: 'INDIVIDUAL_XP',
              pointsDelta: awardedPoints,
              userId: player.userId,
              teamId: player.user?.teamId || null,
              seasonId: activeSeason ? activeSeason.id : null,
              eventId: crypto.randomUUID(),
              reason: `Typing Battle (${room.mode}) WPM: ${player.wpm}, Acc: ${player.accuracy}%`,
              metadata: {
                roomId: room.id,
                mode: room.mode,
                wpm: player.wpm,
                accuracy: player.accuracy,
                completionTimeMs: player.completionTimeMs,
                isWinner,
              },
            },
            { transaction: t }
          );
        }
      }

      // 3. Update TypingUserStat career metrics
      stat.totalMatches += 1;
      if (room.matchType === 'RANKED') {
        stat.rankedMatches += 1;
        stat.dailyRankedCount += 1;
        stat.dailyPointsEarned += awardedPoints;
        stat.totalWorkRankPointsEarned = Number(stat.totalWorkRankPointsEarned || 0) + Number(awardedPoints || 0);
      } else {
        stat.practiceMatches += 1;
      }

      if (isWinner && room.mode !== 'SOLO') {
        stat.winsCount += 1;
        stat.currentWinStreak += 1;
        if (stat.currentWinStreak > stat.maxWinStreak) {
          stat.maxWinStreak = stat.currentWinStreak;
        }
        if (room.mode === '2V2' || room.mode === '3V3') {
          stat.teamWinsCount += 1;
        }
      } else if (!isDraw && room.mode !== 'SOLO') {
        stat.currentWinStreak = 0;
      }

      if (player.wpm > (stat.bestWpm || 0)) {
        stat.bestWpm = player.wpm;
      }
      if (player.accuracy > (stat.bestAccuracy || 0)) {
        stat.bestAccuracy = player.accuracy;
      }
      if (player.accuracy >= 100.0 && player.progressPct >= 100.0) {
        stat.perfectRunsCount += 1;
      }

      stat.totalCharsTyped = Number(stat.totalCharsTyped || 0) + Number(player.typedChars || 0);
      stat.totalErrors = Number(stat.totalErrors || 0) + Number(player.errorCount || 0);
      stat.lastPlayedAt = now;

      // Recalculate rolling average WPM & accuracy
      const prevMatches = stat.totalMatches - 1;
      stat.avgWpm = Math.round(((stat.avgWpm * prevMatches + player.wpm) / stat.totalMatches) * 10) / 10;
      stat.avgAccuracy = Math.round(((stat.avgAccuracy * prevMatches + player.accuracy) / stat.totalMatches) * 10) / 10;
      await stat.save({ transaction: t });

      playerResultList.push({
        userId: player.userId,
        name: player.user?.name || `Player #${player.userId}`,
        team: player.team,
        individualRank: player.individualRank,
        wpm: player.wpm,
        accuracy: player.accuracy,
        errorCount: player.errorCount,
        completionTimeMs: player.completionTimeMs,
        scoreDelta: awardedPoints,
        isWinner,
        performanceScore: player.performanceScore,
      });
    }

    // 4. Save immutable Match Result snapshot
    await TypingMatchResult.create(
      {
        roomId: room.id,
        mode: room.mode,
        matchType: room.matchType,
        seasonId: activeSeason ? activeSeason.id : null,
        winnerUserId,
        winnerTeam,
        teamAScore: room.mode === '2V2' || room.mode === '3V3' ? typingEngine.calculateTeamMatchResult(room.players).teamAScore : 0,
        teamBScore: room.mode === '2V2' || room.mode === '3V3' ? typingEngine.calculateTeamMatchResult(room.players).teamBScore : 0,
        results: playerResultList,
        playedAt: now,
      },
      { transaction: t }
    );
  });

  // Re-project company leaderboard so point changes appear immediately on BXH
  if (activeSeason) {
    projector.projectSeasonIndividualLeaderboard(activeSeason.id).catch(() => {});
    projector.projectSeasonLeaderboard(activeSeason.id).catch(() => {});
  }

  const detail = await getRoomDetail(room.id);
  typingRealtime.emitToRoom(room.id, 'typing:matchFinished', {
    roomId: room.id,
    winnerUserId,
    winnerTeam,
    results: playerResultList,
    room: detail ? detail.room : null,
  });

  return detail;
}

// ── DETAIL & LEADERBOARDS ──

async function getRoomDetail(roomId, requestingUserId = null) {
  const room = await TypingRoom.findByPk(roomId, {
    include: [
      { model: User, as: 'host', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'role'] },
      {
        model: TypingPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId', 'role'] }],
      },
      { model: TypingChallenge, as: 'challenge' },
      { model: TypingMatchResult, as: 'result' },
    ],
  });

  if (!room) throw new NotFoundError('Phòng thi đấu không tồn tại');

  const data = room.toJSON();
  const spectatorCount = typingRealtime.getSpectatorCount(room.id);

  return {
    room: {
      ...data,
      spectatorCount,
    },
    players: data.players || [],
    challenge: data.challenge,
    result: data.result,
  };
}

async function getMyStats(userId) {
  if (!userId) return null;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [stat] = await TypingUserStat.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      dailyResetDate: todayStr,
    },
  });

  return {
    userId: stat.userId,
    totalMatches: stat.totalMatches,
    rankedMatches: stat.rankedMatches,
    practiceMatches: stat.practiceMatches,
    winsCount: stat.winsCount,
    teamWinsCount: stat.teamWinsCount,
    bestWpm: Number(stat.bestWpm || 0),
    avgWpm: Number(stat.avgWpm || 0),
    bestAccuracy: Number(stat.bestAccuracy || 100),
    avgAccuracy: Number(stat.avgAccuracy || 100),
    currentWinStreak: stat.currentWinStreak,
    maxWinStreak: stat.maxWinStreak,
    perfectRunsCount: stat.perfectRunsCount,
    totalWorkRankPointsEarned: Number(stat.totalWorkRankPointsEarned || 0),
    dailyRankedCount: stat.dailyResetDate === todayStr ? stat.dailyRankedCount : 0,
    dailyPointsEarned: stat.dailyResetDate === todayStr ? stat.dailyPointsEarned : 0,
  };
}

async function getTypingLeaderboard({ limit = 50, currentUserId = null } = {}) {
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  const stats = await TypingUserStat.findAll({
    where: {
      bestWpm: { [Op.gt]: 0 },
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'name', 'email', 'jobTitle', 'department', 'teamId'],
        include: [{ model: Team, attributes: ['id', 'name'] }],
      },
    ],
    order: [
      ['bestWpm', 'DESC'],
      ['bestAccuracy', 'DESC'],
      ['winsCount', 'DESC'],
    ],
    limit: cleanLimit,
  });

  const formatted = stats.map((item, idx) => ({
    rank: idx + 1,
    userId: item.userId,
    user: item.user,
    teamName: item.user?.Team?.name || '—',
    bestWpm: Number(item.bestWpm || 0),
    avgWpm: Number(item.avgWpm || 0),
    bestAccuracy: Number(item.bestAccuracy || 100),
    winsCount: item.winsCount,
    totalMatches: item.totalMatches,
    totalPoints: Number(item.totalWorkRankPointsEarned || 0),
  }));

  let myStats = null;
  if (currentUserId) {
    myStats = await getMyStats(currentUserId);
  }

  return {
    leaderboard: formatted,
    myStats,
  };
}

async function resetRoom(roomId, requestingUserId) {
  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room) throw new NotFoundError('Phòng thi đấu không tồn tại');

  if (Number(room.hostUserId) !== Number(requestingUserId)) {
    throw new ForbiddenError('Chỉ chủ phòng mới có quyền đặt lại phòng để chơi ván mới');
  }

  // Generate fresh continuous text for new game
  const freshText = await buildContinuousChallengeText({
    durationLimitSeconds: room.durationLimitSeconds || 120,
    difficulty: room.difficulty,
    language: room.language || 'VI',
  });

  await sequelize.transaction(async (t) => {
    room.status = 'WAITING';
    room.startAt = null;
    room.startedAt = null;
    room.finishedAt = null;
    room.winnerUserId = null;
    room.winnerTeam = 'NONE';
    room.challengeText = freshText;
    room.targetWordCount = freshText.split(/\s+/).length;
    await room.save({ transaction: t });

    for (const p of room.players) {
      p.status = 'WAITING';
      p.isReady = room.mode === 'SOLO';
      p.progressPct = 0;
      p.typedChars = 0;
      p.wpm = 0;
      p.accuracy = 100.0;
      p.errorCount = 0;
      p.completionTimeMs = null;
      p.individualRank = null;
      p.scoreDelta = 0;
      p.performanceScore = 0;
      p.finalPayload = null;
      await p.save({ transaction: t });
    }
  });

  const detail = await getRoomDetail(room.id, requestingUserId);
  typingRealtime.emitToRoom(room.id, 'typing:roomReset', {
    roomId: room.id,
    room: detail.room,
    players: detail.players,
    challengeText: room.challengeText,
  });
  typingRealtime.emitToRoom(room.id, 'typing:roomUpdated', { room: detail.room });

  return detail;
}

async function getChallenges(filters = {}) {
  await ensureChallengesExist();
  const where = { isActive: true };
  if (filters.difficulty) where.difficulty = filters.difficulty;
  if (filters.language) where.language = filters.language;

  return TypingChallenge.findAll({
    where,
    order: [['difficulty', 'ASC'], ['id', 'ASC']],
  });
}

module.exports = {
  ensureChallengesExist,
  listRooms,
  createRoom,
  quickMatch,
  joinRoom,
  switchTeam,
  leaveRoom,
  toggleReady,
  startMatch,
  resetRoom,
  updateProgress,
  submitFinish,
  finalizeMatch,
  getRoomDetail,
  getMyStats,
  getTypingLeaderboard,
  getChallenges,
};

