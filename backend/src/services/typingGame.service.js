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
const typingTransaction = require('./typingTransaction');
const { measureInput, chars, METRIC_VERSION } = require('./typingMetrics');
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
const liveMetricTimers = new Map();
const matchFinalizationPromises = new Map();
const TYPING_DRAFT_KEY = '_typingDraft';

function getTypingDraft(player) {
  const payload = player?.finalPayload;
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload[TYPING_DRAFT_KEY] || {}
    : {};
}

function withTypingDraft(player, text, revision, valid = true) {
  const payload = player.finalPayload && typeof player.finalPayload === 'object' && !Array.isArray(player.finalPayload)
    ? player.finalPayload
    : {};
  player.finalPayload = {
    ...payload,
    [TYPING_DRAFT_KEY]: {
      text,
      revision,
      valid,
    },
  };
}

function deriveTypingInput(challengeText, submittedText) {
  if (chars(submittedText).length > chars(challengeText).length) throw new ValidationError('Nội dung gõ vượt quá bài thi');
  const measured = measureInput(challengeText, submittedText, 60000);
  return { text: measured.text, typedChars: measured.typedChars, errorCount: measured.errorCount, accuracy: measured.accuracy };
}

function liveStandings(room, players) {
  const elapsed = Math.min(Math.max(1, Date.now() - new Date(room.startedAt || Date.now()).getTime()), Number(room.durationLimitSeconds || 120) * 1000);
  const rows = players.map((p) => {
    const draft = getTypingDraft(p);
    const duration = p.status === 'FINISHED' ? Number(p.completionTimeMs || elapsed) : elapsed;
    const metrics = measureInput(room.challengeText, draft.text || '', duration, room.difficulty);
    if (draft.cheatDetected) { metrics.validSubmission = false; metrics.eligible = false; metrics.performanceScore = 0; }
    return { userId: Number(p.userId), ...metrics, text: undefined, inputRevision: Number(draft.revision || 0) };
  }).sort(typingEngine.compareTypingResults);
  return rows.map((r, i) => ({ ...r, liveRank: r.eligible ? i + 1 : null }));
}

async function broadcastLiveMetrics(roomId) {
  const detail = await getRoomDetail(roomId);
  if (detail.room.status !== 'PLAYING') {
    clearInterval(liveMetricTimers.get(Number(roomId)));
    liveMetricTimers.delete(Number(roomId));
    return;
  }
  for (const p of detail.players) {
    const { inputText, finalPayload, user, ...publicMetrics } = p;
    typingRealtime.queueProgressUpdate(roomId, p.userId, publicMetrics);
  }
}

// Helper to generate 4-character uppercase alphanumeric room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'TYPE-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Ensure challenges and tables exist
async function ensureChallengesExist() {
  try {
    const { ensureTypingSchema } = require('./typingSchemaCheck');
    await ensureTypingSchema(sequelize);
  } catch (err) {
    console.warn('[TypingService] ensureChallengesExist warning:', err.message);
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

// ── STALE ROOMS CLEANUP & SELF-HEALING ──

async function cleanupStaleTypingRooms(t = null) {
  try {
    const now = new Date();
    const staleCutoff = new Date(now.getTime() - 15 * 60 * 1000); // 15 min for playing

    const staleRooms = await TypingRoom.findAll({
      where: {
        status: 'PLAYING',
        startedAt: { [Op.lt]: staleCutoff },
      },
      transaction: t,
    });

    for (const sr of staleRooms) {
      sr.status = 'ABANDONED';
      sr.finishedAt = new Date();
      await sr.save({ transaction: t });
      await TypingPlayer.update(
        { status: 'FINISHED' },
        { where: { roomId: sr.id, status: 'TYPING' }, transaction: t }
      );
    }

    // Clean up empty WAITING rooms with 0 players
    const emptyWaiting = await TypingRoom.findAll({
      where: { status: 'WAITING' },
      include: [{ model: TypingPlayer, as: 'players' }],
      transaction: t,
    });

    for (const er of emptyWaiting) {
      if (!er.players || er.players.length === 0) {
        er.status = 'ABANDONED';
        await er.save({ transaction: t });
      }
    }
  } catch (err) {
    console.warn('[TypingService] cleanupStaleTypingRooms warning:', err.message);
  }
}

// ── LOBBY & ROOM MANAGEMENT ──

async function listRooms(filters = {}) {
  await ensureChallengesExist();
  await cleanupStaleTypingRooms().catch(() => {});
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

  const activeRooms = rooms.filter((r) => {
    if (r.status === 'WAITING' && (!r.players || r.players.length === 0)) return false;
    return true;
  });

  return activeRooms.map((r) => {
    const data = r.toJSON();
    return {
      ...data,
      players: (data.players || []).map(({ finalPayload, ...p }) => p),
      playerCount: data.players ? data.players.length : 0,
      spectatorCount: typingRealtime.getSpectatorCount(r.id),
    };
  });
}

// Helper to construct a rich continuous stream of words without any punctuation for timed tests
async function buildContinuousChallengeText({ durationLimitSeconds = 120, difficulty = 'MEDIUM', language = 'VI' }) {
  const targetWords = Math.max(200, Math.round((Number(durationLimitSeconds) / 60) * 300)); // ~120 words per minute of test
  let challenges = [];
  try {
    challenges = await TypingChallenge.findAll({
      where: {
        language: ['VI', 'EN', 'CODE'].includes(language) ? language : 'VI',
        isActive: true,
      },
      order: [['id', 'ASC']],
    });
  } catch (err) {
    console.warn('[TypingService] findAll challenges warning:', err.message);
  }

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
      .normalize('NFC');
    if (text) {
      combined = combined ? `${combined} ${text}` : text;
      words = combined.split(/\s+/).length;
    }
    idx++;
  }

  return combined || 'tốc độ và sự chính xác tạo nên sức mạnh vượt trội của mỗi thành viên';
}

async function createRoom(data, requestingUser) {
  await ensureChallengesExist();

  const actualUserId = Number(requestingUser ? requestingUser.id : data.userId);
  if (!actualUserId || isNaN(actualUserId)) {
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
    try {
      selectedChallenge = await TypingChallenge.findByPk(challengeId);
      if (selectedChallenge) {
        challengeText = (selectedChallenge.content || '')
          .normalize('NFC');
      }
    } catch (err) {
      console.warn('[TypingService] findByPk challenge error:', err.message);
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
  const result = await typingTransaction(async (t) => {
    await cleanupStaleTypingRooms(t);

    // Clean up any old WAITING seat for this user and mark orphaned rooms abandoned
    const oldWaiting = await TypingPlayer.findAll({
      where: { userId: actualUserId, status: 'WAITING' },
      include: [{ model: TypingRoom, as: 'room', where: { status: 'WAITING' } }],
      transaction: t,
    });
    for (const ow of oldWaiting) {
      const oldRoomId = ow.roomId;
      await ow.destroy({ transaction: t });
      const remaining = await TypingPlayer.count({ where: { roomId: oldRoomId }, transaction: t });
      if (remaining === 0) {
        await TypingRoom.update({ status: 'ABANDONED' }, { where: { id: oldRoomId }, transaction: t });
      }
    }

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
        accuracy: 0,
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

  const joinResult = await typingTransaction(async (t) => {
    // 1. Clean up any stale waiting seats the user might have in other rooms
    const oldWaiting = await TypingPlayer.findAll({
      where: { userId: Number(userId), status: 'WAITING', roomId: { [Op.ne]: Number(roomId) } },
      include: [{ model: TypingRoom, as: 'room', where: { status: 'WAITING' } }],
      transaction: t,
    });
    for (const ow of oldWaiting) {
      const oldRoomId = ow.roomId;
      await ow.destroy({ transaction: t });
      const remaining = await TypingPlayer.count({ where: { roomId: oldRoomId }, transaction: t });
      if (remaining === 0) {
        await TypingRoom.update({ status: 'ABANDONED' }, { where: { id: oldRoomId }, transaction: t });
      }
    }

    const room = await TypingRoom.findByPk(roomId, {
      include: [{ model: TypingPlayer, as: 'players' }],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!room) {
      throw new NotFoundError('Phòng thi đấu không tồn tại');
    }

    // If player already in room -> return detail
    const existingPlayer = room.players.find((p) => p.userId && Number(p.userId) === Number(userId));
    if (existingPlayer) {
      return { roomId: room.id, userId, isNewJoin: false };
    }

    if (room.status !== 'WAITING') {
      // Room is already in play -> allow spectating
      return { roomId: room.id, userId, isNewJoin: false };
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

    await TypingPlayer.create(
      {
        roomId: room.id,
        userId: Number(userId),
        team: assignedTeam,
        seatIndex: availableSeat,
        isReady: false,
        status: 'WAITING',
        progressPct: 0,
        typedChars: 0,
        wpm: 0,
        accuracy: 0,
        errorCount: 0,
      },
      { transaction: t }
    );

    return { roomId: room.id, userId, isNewJoin: true };
  });

  const detail = await getRoomDetail(joinResult.roomId, joinResult.userId);
  if (joinResult.isNewJoin) {
    typingRealtime.emitToRoom(joinResult.roomId, 'typing:playerJoined', {
      roomId: joinResult.roomId,
      userId: joinResult.userId,
      players: detail.players,
    });
    typingRealtime.emitToRoom(joinResult.roomId, 'typing:roomUpdated', { room: detail.room });
    typingRealtime.emitToRoom(joinResult.roomId, 'typing:roomListChanged', { roomId: joinResult.roomId });
  }

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

  await typingTransaction(async (t) => {
    for (const p of room.players) {
      p.status = 'TYPING';
      p.progressPct = 0;
      p.typedChars = 0;
      p.wpm = 0;
      p.accuracy = 0;
      p.errorCount = 0;
      p.finalPayload = { [TYPING_DRAFT_KEY]: { text: '', revision: 0, valid: true } };
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
  if (liveMetricTimers.has(room.id)) clearInterval(liveMetricTimers.get(room.id));
  let updating = false;
  const liveTimer = setInterval(async () => {
    if (updating) return;
    updating = true;
    try { await broadcastLiveMetrics(room.id); }
    catch (error) { console.error('Typing live metrics:', error.message); }
    finally { updating = false; }
  }, 1000);
  liveTimer.unref?.();
  liveMetricTimers.set(room.id, liveTimer);
  const matchTimer = setTimeout(() => {
    finalizeMatch(room.id).catch((e) => console.error('Match timeout error:', e.message));
  }, (room.durationLimitSeconds + 3) * 1000);
  matchDeadlineTimers.set(room.id, matchTimer);

  return detail;
}

async function updateProgress(roomId, userId, data) {
  if (typeof data?.typedText !== 'string') return;
  let update = null;
  await typingTransaction(async (transaction) => {
    const room = await TypingRoom.findByPk(roomId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!room || room.status !== 'PLAYING') return;
    if (Date.now() > new Date(room.startedAt).getTime() + Number(room.durationLimitSeconds) * 1000) return;

    const player = await TypingPlayer.findOne({
      where: { roomId, userId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!player || player.status !== 'TYPING') return;

    const currentDraft = getTypingDraft(player);
    const currentRevision = Number.isSafeInteger(Number(currentDraft.revision)) ? Number(currentDraft.revision) : 0;
    const suppliedRevision = Number(data.inputRevision);
    const nextRevision = Number.isSafeInteger(suppliedRevision) && suppliedRevision >= 0
      ? suppliedRevision
      : currentRevision + 1;
    if (nextRevision <= currentRevision) return;

    const metrics = deriveTypingInput(room.challengeText, data.typedText);
    const totalLength = Math.max(1, chars(room.challengeText).length);
    const progressPct = Math.min(100, Math.round((metrics.typedChars / totalLength) * 1000) / 10);
    const serverStartedAt = new Date(room.startedAt || 0).getTime();
    const serverDurationMs = Date.now() - serverStartedAt;
    const plausibility = typingEngine.validateSubmissionPlausibility({
      challengeLength: totalLength,
      typedChars: metrics.typedChars,
      durationMs: serverDurationMs,
      errorCount: metrics.errorCount,
    });

    player.typedChars = metrics.typedChars;
    player.progressPct = progressPct;
    player.wpm = plausibility.valid ? plausibility.wpm : 0;
    player.accuracy = metrics.accuracy;
    player.errorCount = metrics.errorCount;
    withTypingDraft(player, metrics.text, nextRevision, plausibility.valid);
    player.performanceScore = plausibility.valid && metrics.typedChars >= 20 ? typingEngine.computeBasePerformanceScore({ wpm: player.wpm, accuracy: metrics.accuracy, errorCount: metrics.errorCount, completed: progressPct >= 90, difficulty: room.difficulty }) : 0;
    await player.save({ transaction });
    update = {
      userId: Number(userId),
      progressPct,
      typedChars: metrics.typedChars,
      wpm: player.wpm,
      accuracy: metrics.accuracy,
      errorCount: metrics.errorCount,
      team: player.team,
    };
  });

  if (update) {
    await broadcastLiveMetrics(roomId);
  }
}

// ── MATCH COMPLETION & SCORING SETTLE ──

async function submitFinish(roomId, userId, data) {
  const { clientDurationMs = 0, finalPayload = {} } = data || {};

  const room = await TypingRoom.findByPk(roomId, {
    include: [{ model: TypingPlayer, as: 'players' }],
  });

  if (!room) throw new NotFoundError('Phòng thi đấu không tồn tại');
  const player = room.players.find((p) => Number(p.userId) === Number(userId));
  if (!player) throw new NotFoundError('Không tìm thấy người chơi trong phòng');

  if (room.status !== 'PLAYING') {
    if (room.status === 'FINISHED' && player.status === 'FINISHED') {
      return getRoomDetail(room.id, userId);
    }
    throw new ConflictError('Trận đấu đã kết thúc hoặc không trong trạng thái đang thi đấu');
  }

  if (player.status === 'FINISHED') {
    return getRoomDetail(room.id, userId);
  }

  const storedDraft = getTypingDraft(player);
  const suppliedRevision = Number(data?.inputRevision);
  const hasSuppliedRevision = Number.isSafeInteger(suppliedRevision) && suppliedRevision >= 0;
  const storedRevision = Number.isSafeInteger(Number(storedDraft.revision)) ? Number(storedDraft.revision) : 0;
  const deadlinePassed = Date.now() > new Date(room.startedAt).getTime() + Number(room.durationLimitSeconds) * 1000 + 3000;
  const submittedSnapshotIsStale = deadlinePassed || (hasSuppliedRevision && suppliedRevision < storedRevision);
  const submittedText = submittedSnapshotIsStale
    ? (typeof storedDraft.text === 'string' ? storedDraft.text : null)
    : (typeof data?.typedText === 'string'
      ? data.typedText
      : (typeof storedDraft.text === 'string' ? storedDraft.text : null));
  if (submittedText === null) {
    throw new ValidationError('Thiếu nội dung đã gõ để máy chủ xác minh kết quả');
  }
  const metrics = deriveTypingInput(room.challengeText, submittedText);
  let safeChars = metrics.typedChars;
  let effectiveErrorCount = metrics.errorCount;
  const challengeLen = Math.max(1, chars(room.challengeText).length);
  const startedAtMs = new Date(room.startedAt || 0).getTime();
  const measuredServerDuration = Date.now() - startedAtMs;
  const durationLimitMs = Math.max(1000, Number(room.durationLimitSeconds || 0) * 1000);
  const effectiveDuration = Math.min(Math.max(0, measuredServerDuration), durationLimitMs);

  // Anti-cheat verification retains the client-reported duration for compatibility; completion time is server bounded.
  const plausibility = typingEngine.validateSubmissionPlausibility({
    challengeLength: challengeLen,
    typedChars: safeChars,
    durationMs: effectiveDuration,
    clientDurationMs,
    errorCount: effectiveErrorCount,
  });

  if (!plausibility.valid) {
    console.warn(`[Typing Anti-Cheat Warning] User #${userId} in Room #${roomId} rejected: ${plausibility.reason}`);
  }

  let finalWpm = plausibility.valid ? plausibility.wpm : 0;
  let finalAcc = metrics.accuracy;

  const finishedCount = room.players.filter((p) => p.status === 'FINISHED').length;

  // Completion is based on reaching 90% of the challenge text, matching the existing product rule.
  const targetChars = Math.ceil(challengeLen * 0.9);
  let isCompleted = safeChars >= targetChars;

  // Minimum participation threshold: minimum 20 chars and passing anti-cheat plausibility
  let meetsParticipation = safeChars >= 20 && plausibility.valid;

  player.status = 'FINISHED';
  player.progressPct = Math.min(100, Math.round((safeChars / Math.max(1, challengeLen)) * 100));
  player.typedChars = safeChars;
  player.wpm = finalWpm;
  player.accuracy = finalAcc;
  player.errorCount = effectiveErrorCount;
  player.completionTimeMs = effectiveDuration;
  player.individualRank = finishedCount + 1;
  player.performanceScore = meetsParticipation
    ? typingEngine.computeBasePerformanceScore({
        wpm: finalWpm,
        accuracy: finalAcc,
        errorCount: effectiveErrorCount,
        completed: isCompleted,
        difficulty: room.difficulty,
      })
    : 0;
  let finalRevision = hasSuppliedRevision
    ? Math.max(suppliedRevision, storedRevision)
    : storedRevision;
  let finalText = metrics.text;
  let finalValid = plausibility.valid;
  // Re-read the persisted draft at the finish boundary. A throttled socket update
  // may have arrived after the initial room snapshot; do not persist older text.
  const latestPlayer = await TypingPlayer.findByPk(player.id);
  const latestDraft = getTypingDraft(latestPlayer);
  const latestRevision = Number.isSafeInteger(Number(latestDraft.revision)) ? Number(latestDraft.revision) : 0;
  if (latestPlayer && latestRevision > finalRevision && typeof latestDraft.text === 'string') {
    const latestMetrics = deriveTypingInput(room.challengeText, latestDraft.text);
    const latestPlausibility = typingEngine.validateSubmissionPlausibility({
      challengeLength: challengeLen,
      typedChars: latestMetrics.typedChars,
      durationMs: effectiveDuration,
      clientDurationMs,
      errorCount: latestMetrics.errorCount,
    });
    safeChars = latestMetrics.typedChars;
    effectiveErrorCount = latestMetrics.errorCount;
    finalWpm = latestPlausibility.valid ? latestPlausibility.wpm : 0;
    finalAcc = latestMetrics.accuracy;
    player.typedChars = safeChars;
    player.progressPct = Math.min(100, Math.round((safeChars / Math.max(1, challengeLen)) * 100));
    player.wpm = finalWpm;
    player.accuracy = finalAcc;
    player.errorCount = effectiveErrorCount;
    player.performanceScore = safeChars >= 20 && latestPlausibility.valid
      ? typingEngine.computeBasePerformanceScore({ wpm: finalWpm, accuracy: finalAcc, errorCount: effectiveErrorCount, completed: safeChars >= targetChars, difficulty: room.difficulty })
      : 0;
    finalRevision = latestRevision;
    finalText = latestMetrics.text;
    finalValid = latestPlausibility.valid;
    isCompleted = safeChars >= targetChars;
    meetsParticipation = safeChars >= 20 && latestPlausibility.valid;
    player.performanceScore = meetsParticipation
      ? typingEngine.computeBasePerformanceScore({ wpm: finalWpm, accuracy: finalAcc, errorCount: effectiveErrorCount, completed: isCompleted, difficulty: room.difficulty })
      : 0;
  }
  player.finalPayload = {
    ...(finalPayload && typeof finalPayload === 'object' && !Array.isArray(finalPayload) ? finalPayload : {}),
    [TYPING_DRAFT_KEY]: { text: finalText, revision: finalRevision, valid: finalValid },
  };
  await player.save();

  typingRealtime.emitToRoom(room.id, 'typing:playerFinished', {
    roomId: room.id,
    userId: Number(userId),
    individualRank: player.individualRank,
    wpm: finalWpm,
    accuracy: finalAcc,
    progressPct: player.progressPct,
    typedChars: player.typedChars,
    completionTimeMs: effectiveDuration,
  });

  // If all players are now finished, finalize match
  // Read the committed state after saving this player's finish. Two players can finish
  // simultaneously, so the pre-save room snapshot is not a reliable completion check.
  const remainingTyping = await TypingPlayer.count({ where: { roomId, status: 'TYPING' } });
  if (remainingTyping === 0) {
    return finalizeMatch(room.id);
  }

  return getRoomDetail(room.id, userId);
}

/**
 * Finalizes the match, computes winner, settles scores into ScoreLedger, and awards stats.
 */
async function finalizeMatch(roomId) {
  const key = String(roomId);
  const inFlight = matchFinalizationPromises.get(key);
  if (inFlight) return inFlight;

  const finalization = finalizeMatchOnce(roomId);
  matchFinalizationPromises.set(key, finalization);
  try {
    return await finalization;
  } finally {
    if (matchFinalizationPromises.get(key) === finalization) {
      matchFinalizationPromises.delete(key);
    }
  }
}

async function finalizeMatchOnce(roomId) {
  roomId = Number(roomId);
  if (liveMetricTimers.has(roomId)) {
    clearInterval(liveMetricTimers.get(roomId));
    liveMetricTimers.delete(roomId);
  }
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

  // Close unfinished players at the authoritative match deadline before resolving winners.
  // This makes timeout results eligible for the same deterministic scoring rules as submissions.
  for (const player of room.players) {
    if (player.status !== 'TYPING') continue;
    player.status = 'FINISHED';
    player.completionTimeMs = Math.min(
      Math.max(1000, room.startedAt ? now.getTime() - new Date(room.startedAt).getTime() : 1000),
      Math.max(1000, Number(room.durationLimitSeconds || 0) * 1000)
    );
    const draft = getTypingDraft(player);
    const metrics = measureInput(room.challengeText, draft.text || '', player.completionTimeMs, room.difficulty);
    player.typedChars = metrics.typedChars;
    player.errorCount = metrics.errorCount;
    player.accuracy = metrics.accuracy;
    player.wpm = metrics.wpm;
    player.progressPct = metrics.progressPct;
    player.performanceScore = draft.cheatDetected ? 0 : metrics.performanceScore;
    withTypingDraft(player, metrics.text, Number(draft.revision || 0), metrics.validSubmission && !draft.cheatDetected);
  }

  const eligibleForRanking = (player) =>
    (player.typedChars || 0) >= 20
    && (player.performanceScore || 0) > 0
    && getTypingDraft(player).valid !== false;
  const finalRanking = [...room.players].sort((a, b) => typingEngine.compareTypingResults({
    ...a.toJSON(),
    eligible: eligibleForRanking(a),
    completed: (a.progressPct || 0) >= 90,
  }, {
    ...b.toJSON(),
    eligible: eligibleForRanking(b),
    completed: (b.progressPct || 0) >= 90,
  }));
  finalRanking.forEach((player, index) => {
    player.individualRank = eligibleForRanking(player) ? index + 1 : null;
  });

  // Resolve Team Results or Solo/1v1 winners
  let winnerTeam = 'NONE';
  let winnerUserId = null;

  if (room.mode === '2V2' || room.mode === '3V3') {
    const teamResult = typingEngine.calculateTeamMatchResult(room.players);
    winnerTeam = teamResult.winnerTeam;
  } else if (room.mode === '1V1') {
    const winner = finalRanking.find(eligibleForRanking);
    winnerUserId = winner?.userId || null;
  } else if (room.mode === 'SOLO') {
    const p = room.players[0];
    winnerUserId = p && eligibleForRanking(p) ? p.userId : null;
  }

  room.status = 'FINISHED';
  room.finishedAt = now;
  room.winnerTeam = winnerTeam;
  room.winnerUserId = winnerUserId;

  // Compute individual points & update ScoreLedger atomically
  const playerResultList = [];
  let claimedFinalization = false;

  await typingTransaction(async (t) => {
    // Claim the finalization inside the same transaction as stat, ledger, and result
    // writes. Concurrent finish/retry calls can settle a room only once; a rollback
    // leaves it PLAYING so a later retry can safely complete the work.
    const [claimedRows] = await TypingRoom.update(
      {
        status: 'FINISHED',
        finishedAt: now,
        winnerTeam,
        winnerUserId,
      },
      {
        where: { id: room.id, status: 'PLAYING' },
        transaction: t,
      }
    );
    if (Number(claimedRows) !== 1) return;
    claimedFinalization = true;

    for (const player of room.players) {
      if (!player.userId) continue;

      // Handle players who timed out while still TYPING
      if (player.status === 'TYPING') {
        player.status = 'FINISHED';
        if (!player.completionTimeMs) {
          player.completionTimeMs = (room.durationLimitSeconds || 30) * 1000;
        }
        const pChars = player.typedChars || 0;
        const pCompleted = (player.progressPct || 0) >= 90;
        if (!player.performanceScore && pChars >= 20 && getTypingDraft(player).valid !== false) {
          player.performanceScore = typingEngine.computeBasePerformanceScore({
            wpm: player.wpm || 0,
            accuracy: player.accuracy ?? 0,
            errorCount: player.errorCount || 0,
            completed: pCompleted,
            difficulty: room.difficulty,
          });
        }
      }

      const meetsParticipation = eligibleForRanking(player);

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

      const isWinner = meetsParticipation && (
        (room.mode === '1V1' && Number(player.userId) === Number(winnerUserId)) ||
        (room.mode === 'SOLO' && player.status === 'FINISHED') ||
        ((room.mode === '2V2' || room.mode === '3V3') && player.team === winnerTeam)
      );

      const isDraw = winnerTeam === 'DRAW';

      let awardedPoints = 0;
      if (meetsParticipation) {
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
        awardedPoints = pointsCalc.workrankPoints;
      }

      player.scoreDelta = awardedPoints;
      await player.save({ transaction: t });

      // 2. Insert into ScoreLedger (Immutable Ledger for WorkRank Company BXH)
      if (awardedPoints > 0 && room.matchType === 'RANKED') {
        const idempotencyKey = `typing_match:${room.id}:${new Date(room.startedAt).getTime()}:${player.userId}`;
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

      if (meetsParticipation) {
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

        // Recalculate rolling average WPM & accuracy
        const prevMatches = stat.totalMatches - 1;
        stat.avgWpm = Math.round(((stat.avgWpm * prevMatches + player.wpm) / stat.totalMatches) * 10) / 10;
        stat.avgAccuracy = Math.round(((stat.avgAccuracy * prevMatches + player.accuracy) / stat.totalMatches) * 10) / 10;
      }
      stat.lastPlayedAt = now;
      await stat.save({ transaction: t });

      playerResultList.push({
        metricVersion: METRIC_VERSION,
        validSubmission: getTypingDraft(player).valid !== false,
        rawWpm: typingEngine.calculateWPM(player.typedChars, player.completionTimeMs),
        correctChars: player.typedChars - player.errorCount,
        userId: player.userId,
        name: player.user?.name || `Player #${player.userId}`,
        team: player.team,
        individualRank: player.individualRank,
        wpm: player.wpm,
        accuracy: player.accuracy,
        errorCount: player.errorCount,
        completionTimeMs: player.completionTimeMs,
        typedChars: player.typedChars,
        progressPct: player.progressPct,
        completed: (player.progressPct || 0) >= 90,
        eligible: meetsParticipation,
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

  if (!claimedFinalization) return getRoomDetail(roomId);

  playerResultList.sort(typingEngine.compareTypingResults);

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
  const latestResult = await TypingMatchResult.findOne({ where: { roomId: room.id }, order: [['id', 'DESC']] });
  data.result = room.status === 'FINISHED' ? latestResult?.toJSON() || null : null;
  const live = room.status === 'PLAYING' ? liveStandings(room, room.players) : [];
  data.players = (data.players || []).map((player) => {
    const draft = player.finalPayload && typeof player.finalPayload === 'object'
      ? player.finalPayload[TYPING_DRAFT_KEY]
      : null;
    const publicPayload = player.finalPayload && typeof player.finalPayload === 'object'
      ? { ...player.finalPayload }
      : null;
    if (publicPayload) delete publicPayload[TYPING_DRAFT_KEY];
    const isOwner = requestingUserId && Number(player.userId) === Number(requestingUserId);
    return {
      ...player,
      ...(live.find((r) => r.userId === Number(player.userId)) || {}),
      inputRevision: Number(draft?.revision || 0),
      ...(isOwner && typeof draft?.text === 'string' ? { inputText: draft.text } : {}),
      finalPayload: publicPayload && Object.keys(publicPayload).length ? publicPayload : null,
    };
  });
  const spectatorCount = typingRealtime.getSpectatorCount(room.id);
  const spectators = typingRealtime.getSpectatorsList(room.id);

  return {
    room: {
      ...data,
      spectatorCount,
      spectators,
    },
    players: data.players || [],
    challenge: data.challenge,
    result: data.result,
    spectatorCount,
    spectators,
  };
}

async function getMyStats(userId) {
  if (!userId) return null;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  const [stat] = await typingTransaction((transaction) => TypingUserStat.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      dailyResetDate: todayStr,
    },
    transaction,
  }));

  const verified = (await require('./typingVerifiedRecords')()).get(Number(userId));
  return {
    verificationStatus: 'VERIFIED_RESULTS_ONLY',
    hasUnverifiableHistory: Number(stat.bestWpm || 0) > Number(verified?.bestWpm || 0),
    userId: stat.userId,
    totalMatches: stat.totalMatches,
    rankedMatches: stat.rankedMatches,
    practiceMatches: stat.practiceMatches,
    winsCount: stat.winsCount,
    teamWinsCount: stat.teamWinsCount,
    bestWpm: Number(verified?.bestWpm || 0),
    avgWpm: Number(stat.avgWpm || 0),
    bestAccuracy: Number(verified?.bestAccuracy || 0),
    avgAccuracy: Number(stat.avgAccuracy || 0),
    currentWinStreak: stat.currentWinStreak,
    maxWinStreak: stat.maxWinStreak,
    perfectRunsCount: stat.perfectRunsCount,
    totalWorkRankPointsEarned: Number(stat.totalWorkRankPointsEarned || 0),
    dailyRankedCount: stat.dailyResetDate === todayStr ? stat.dailyRankedCount : 0,
    dailyPointsEarned: stat.dailyResetDate === todayStr ? stat.dailyPointsEarned : 0,
  };
}

async function getTypingLeaderboard({ limit = 50, currentUserId = null } = {}) {
  const records = await require('./typingVerifiedRecords')();
  const ordered = [...records.entries()].map(([userId, r]) => ({ ...r.best, userId, bestWpm: r.best.wpm, bestAccuracy: r.best.accuracy, verifiedBestWpm: r.bestWpm })).sort(typingEngine.compareTypingResults);
  const ids = ordered.map((r) => r.userId);
  const users = ids.length ? await User.findAll({ where: { id: ids, status: 'active' }, attributes: ['id', 'name', 'jobTitle', 'department', 'teamId'], include: [{ model: Team, attributes: ['id', 'name'] }] }) : [];
  const active = ordered.filter((r) => users.some((u) => Number(u.id) === r.userId));
  const ranked = active.map((r, i) => ({ ...r, rank: i + 1, user: users.find((u) => Number(u.id) === r.userId), teamName: users.find((u) => Number(u.id) === r.userId)?.Team?.name || '—' }));
  return { verificationStatus: 'VERIFIED_RESULTS_ONLY', leaderboard: ranked.slice(0, Math.min(100, Math.max(1, Number(limit) || 50))), myPosition: ranked.find((r) => r.userId === Number(currentUserId)) || null, myStats: currentUserId ? await getMyStats(currentUserId) : null };
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

  await typingTransaction(async (t) => {
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
      p.accuracy = 0;
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

/** Legacy route now requires a server-issued attempt; client metric-only requests cannot score. */
async function submitPracticeResult(data, requestingUser) {
  if (!data?.attemptId) throw new ValidationError('Thiếu attemptId do máy chủ cấp. Hãy bắt đầu lượt luyện tập mới.');
  return require('./typingPractice.service').finish(data.attemptId, requestingUser.id, data);
}

async function getActiveRoom(userId) {
  if (!userId) return null;
  await cleanupStaleTypingRooms().catch(() => {});
  const activePlayer = await TypingPlayer.findOne({
    where: {
      userId: Number(userId),
      status: { [Op.in]: ['WAITING', 'TYPING'] },
    },
    include: [
      {
        model: TypingRoom,
        as: 'room',
        where: { status: { [Op.in]: ['WAITING', 'STARTING', 'PLAYING'] } },
      },
    ],
  });

  if (!activePlayer || !activePlayer.room) {
    return null;
  }

  return getRoomDetail(activePlayer.room.id, userId);
}

module.exports = {
  ensureChallengesExist,
  buildContinuousChallengeText,
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
  submitPracticeResult,
  finalizeMatch,
  getRoomDetail,
  getActiveRoom,
  getMyStats,
  getTypingLeaderboard,
  getChallenges,
};

