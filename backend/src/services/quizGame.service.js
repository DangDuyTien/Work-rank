'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const {
  sequelize,
  User,
  QuizRoom,
  QuizPlayer,
  QuizQuestion,
  QuizAnswer,
  QuizUserStat,
} = require('../models');
const { DEFAULT_QUIZ_QUESTIONS } = require('../config/quizQuestionsTemplate');
const quizRealtime = require('./quizRealtime.service');

// Store active in-memory question timers to auto-reveal when time expires
const activeQuestionTimers = new Map();

/**
 * Auto-seeds default quiz questions if table is empty
 */
async function ensureSeedQuestions() {
  try {
    const count = await QuizQuestion.count();
    if (count === 0) {
      console.log('[QuizGame] Seeding default quiz questions...');
      await QuizQuestion.bulkCreate(DEFAULT_QUIZ_QUESTIONS);
      console.log(`[QuizGame] Seeded ${DEFAULT_QUIZ_QUESTIONS.length} quiz questions.`);
    }
  } catch (err) {
    console.error('[QuizGame] Error ensuring seed questions:', err.message);
  }
}

// Run seed check on module load
ensureSeedQuestions();

/**
 * Generate a random 6-character room code
 */
function generateRoomCode() {
  return 'QZ' + crypto.randomBytes(2).toString('hex').toUpperCase();
}

/**
 * Sanitizes a question for clients during active play (strips correctOption and explanation)
 */
function sanitizeQuestionForClient(question) {
  if (!question) return null;
  const q = question.toJSON ? question.toJSON() : { ...question };
  delete q.correctOption;
  delete q.correct_option;
  delete q.explanation;
  return q;
}

const USER_ATTRIBUTES = ['id', 'name', 'email', 'role', 'teamId', 'jobTitle', 'department', 'isVerified', 'isDev'];

/**
 * Lists rooms with filters
 */
async function listRooms({ mode, status, limit = 30 } = {}) {
  const where = {};
  if (mode && ['ALL', 'IMAGE', 'MUSIC'].includes(mode)) where.mode = mode;
  if (status && ['WAITING', 'PLAYING', 'SHOWING_RESULT', 'FINISHED'].includes(status)) {
    where.status = status;
  } else {
    where.status = { [Op.in]: ['WAITING', 'PLAYING', 'SHOWING_RESULT'] };
  }

  const rooms = await QuizRoom.findAll({
    where,
    include: [
      { model: User, as: 'host', attributes: USER_ATTRIBUTES },
      {
        model: QuizPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: Math.min(50, Math.max(1, Number(limit) || 30)),
  });

  return rooms.map((r) => {
    const json = r.toJSON();
    json.playerCount = json.players ? json.players.length : 0;
    return json;
  });
}

/**
 * Finds if user is in an active room
 */
async function getActiveRoomForUser(userId) {
  const player = await QuizPlayer.findOne({
    where: { userId },
    include: [
      {
        model: QuizRoom,
        as: 'room',
        where: { status: { [Op.in]: ['WAITING', 'PLAYING', 'SHOWING_RESULT'] } },
      },
    ],
    order: [['createdAt', 'DESC']],
  });

  if (!player || !player.room) return null;
  return getRoomState(player.room.id, userId);
}

/**
 * Gets complete state of a quiz room
 */
async function getRoomState(roomId, userId = null) {
  const room = await QuizRoom.findByPk(roomId, {
    include: [
      { model: User, as: 'host', attributes: USER_ATTRIBUTES },
      { model: User, as: 'winner', attributes: USER_ATTRIBUTES },
      {
        model: QuizPlayer,
        as: 'players',
        include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
      },
    ],
    order: [[{ model: QuizPlayer, as: 'players' }, 'score', 'DESC']],
  });

  if (!room) return null;

  const roomJson = room.toJSON();

  // Fetch current question if in game
  let currentQuestion = null;
  if (room.currentQuestionId) {
    const rawQuestion = await QuizQuestion.findByPk(room.currentQuestionId);
    if (rawQuestion) {
      if (room.status === 'PLAYING') {
        currentQuestion = sanitizeQuestionForClient(rawQuestion);
      } else {
        currentQuestion = rawQuestion.toJSON();
      }
    }
  }

  // Fetch answers for current question
  let currentAnswers = [];
  if (room.currentQuestionId) {
    currentAnswers = await QuizAnswer.findAll({
      where: { roomId: room.id, questionId: room.currentQuestionId },
      include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
      order: [['score', 'DESC'], ['responseTimeMs', 'ASC']],
    });
  }

  // Check if current user has already answered current question
  let myAnswer = null;
  if (userId && room.currentQuestionId) {
    const found = currentAnswers.find((a) => Number(a.userId) === Number(userId));
    if (found) {
      myAnswer = found.toJSON ? found.toJSON() : found;
    }
  }

  // If showing result or finished, include all answers summary
  let roundResults = null;
  if (room.status === 'SHOWING_RESULT' || room.status === 'FINISHED') {
    roundResults = currentAnswers.map((a) => (a.toJSON ? a.toJSON() : a));
  }

  return {
    room: roomJson,
    players: (roomJson.players || []).map((p, idx) => ({ ...p, rank: idx + 1 })),
    currentQuestion,
    currentAnswersCount: currentAnswers.length,
    myAnswer,
    roundResults,
  };
}

/**
 * Creates a new quiz game room
 */
async function createRoom({ hostUserId, title, mode = 'ALL', maxPlayers = 20, totalQuestions = 10 }) {
  await ensureSeedQuestions();

  const cleanTitle = (title || 'Phòng Quiz Thử Thách').trim().slice(0, 100);
  const cleanMode = ['ALL', 'IMAGE', 'MUSIC'].includes(mode) ? mode : 'ALL';
  const cleanMax = Math.min(20, Math.max(2, Number(maxPlayers) || 20));
  const cleanTotal = Math.min(20, Math.max(3, Number(totalQuestions) || 10));

  const room = await sequelize.transaction(async (t) => {
    // Generate unique code
    let code = generateRoomCode();
    let exists = await QuizRoom.findOne({ where: { code }, transaction: t });
    while (exists) {
      code = generateRoomCode();
      exists = await QuizRoom.findOne({ where: { code }, transaction: t });
    }

    const newRoom = await QuizRoom.create(
      {
        code,
        title: cleanTitle,
        hostUserId,
        mode: cleanMode,
        status: 'WAITING',
        maxPlayers: cleanMax,
        totalQuestions: cleanTotal,
        currentQuestionIndex: 0,
      },
      { transaction: t }
    );

    // Host joins automatically as player 1
    await QuizPlayer.create(
      {
        roomId: newRoom.id,
        userId: hostUserId,
        score: 0,
        correctAnswers: 0,
        totalAnswered: 0,
        rank: 1,
        isReady: true,
      },
      { transaction: t }
    );

    return newRoom;
  });

  const fullState = await getRoomState(room.id, hostUserId);
  quizRealtime.emitToRoom(room.id, 'quiz:roomUpdated', fullState);
  return fullState;
}

/**
 * Joins an existing quiz room
 */
async function joinRoom(roomId, userId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) throw new Error('Không tìm thấy phòng chơi');

  // Check if player already in room
  let player = await QuizPlayer.findOne({ where: { roomId, userId } });

  if (!player) {
    if (room.status !== 'WAITING') {
      throw new Error('Trận đấu đã bắt đầu hoặc đã kết thúc, không thể tham gia mới');
    }

    const currentCount = await QuizPlayer.count({ where: { roomId } });
    if (currentCount >= room.maxPlayers) {
      throw new Error('Phòng chơi đã đủ người');
    }

    player = await QuizPlayer.create({
      roomId,
      userId,
      score: 0,
      correctAnswers: 0,
      totalAnswered: 0,
      rank: currentCount + 1,
      isReady: true,
    });
  }

  const fullState = await getRoomState(roomId, userId);
  quizRealtime.emitToRoom(roomId, 'quiz:playerJoined', {
    player: player.toJSON(),
    players: fullState.players,
    room: fullState.room,
  });
  quizRealtime.emitToRoom(roomId, 'quiz:roomUpdated', fullState);
  return fullState;
}

/**
 * Leaves a quiz room
 */
async function leaveRoom(roomId, userId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) return { success: true };

  const player = await QuizPlayer.findOne({ where: { roomId, userId } });
  if (player) {
    if (room.status === 'WAITING') {
      await player.destroy();

      // If host left, reassign host or abandon
      if (Number(room.hostUserId) === Number(userId)) {
        const nextPlayer = await QuizPlayer.findOne({ where: { roomId }, order: [['joinedAt', 'ASC']] });
        if (nextPlayer) {
          room.hostUserId = nextPlayer.userId;
          await room.save();
        } else {
          room.status = 'FINISHED';
          await room.save();
        }
      }
    }
  }

  const fullState = await getRoomState(roomId, userId);
  quizRealtime.emitToRoom(roomId, 'quiz:playerLeft', {
    userId,
    players: fullState?.players || [],
    room: fullState?.room || null,
  });
  if (fullState) {
    quizRealtime.emitToRoom(roomId, 'quiz:roomUpdated', fullState);
  }
  return { success: true };
}

/**
 * Starts the quiz game match
 */
async function startGame(roomId, hostUserId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) throw new Error('Không tìm thấy phòng chơi');
  if (Number(room.hostUserId) !== Number(hostUserId)) {
    throw new Error('Chỉ có chủ phòng (host) mới có quyền bắt đầu trận đấu');
  }
  if (room.status !== 'WAITING') {
    throw new Error('Trận đấu đã bắt đầu hoặc đã kết thúc');
  }

  const playerCount = await QuizPlayer.count({ where: { roomId } });
  if (playerCount < 1) {
    throw new Error('Cần ít nhất 1 người chơi để bắt đầu');
  }

  // Ensure questions exist in DB
  await ensureSeedQuestions();

  // Query pool of questions based on mode
  const questionWhere = { isActive: true };
  if (room.mode === 'IMAGE') questionWhere.type = 'IMAGE';
  if (room.mode === 'MUSIC') questionWhere.type = 'MUSIC';

  const availableQuestions = await QuizQuestion.findAll({
    where: questionWhere,
    attributes: ['id'],
  });

  if (availableQuestions.length === 0) {
    throw new Error('Không có đủ câu hỏi trong hệ thống cho chế độ này');
  }

  // Shuffle and pick totalQuestions
  const shuffledIds = availableQuestions
    .map((q) => q.id)
    .sort(() => 0.5 - Math.random())
    .slice(0, room.totalQuestions);

  const firstQuestionId = shuffledIds[0];
  const firstQuestion = await QuizQuestion.findByPk(firstQuestionId);

  const durationMs = (firstQuestion?.timeLimit || 10) * 1000;
  const startTime = Date.now();

  room.selectedQuestionIds = shuffledIds;
  room.totalQuestions = shuffledIds.length;
  room.currentQuestionIndex = 0;
  room.currentQuestionId = firstQuestionId;
  room.status = 'PLAYING';
  room.startedAt = new Date();
  room.questionStartTime = startTime;
  room.questionDurationMs = durationMs;
  await room.save();

  // Reset player scores
  await QuizPlayer.update(
    { score: 0, correctAnswers: 0, totalAnswered: 0, totalResponseTimeMs: 0 },
    { where: { roomId } }
  );

  // Clear previous answers if any
  await QuizAnswer.destroy({ where: { roomId } });

  const sanitizedQ = sanitizeQuestionForClient(firstQuestion);
  const fullState = await getRoomState(roomId, hostUserId);

  // Emit game started & first question
  quizRealtime.emitToRoom(roomId, 'quiz:started', {
    room: fullState.room,
    players: fullState.players,
    question: sanitizedQ,
    questionIndex: 0,
    totalQuestions: shuffledIds.length,
    questionStartTime: startTime,
    questionDurationMs: durationMs,
  });

  quizRealtime.emitToRoom(roomId, 'quiz:question', {
    question: sanitizedQ,
    questionIndex: 0,
    totalQuestions: shuffledIds.length,
    questionStartTime: startTime,
    questionDurationMs: durationMs,
  });

  // Schedule auto timeout reveal
  scheduleQuestionTimeout(roomId, firstQuestionId, durationMs);

  return fullState;
}

/**
 * Schedules a server timer to automatically reveal question result when time expires
 */
function scheduleQuestionTimeout(roomId, questionId, durationMs) {
  // Clear any existing timer for this room
  if (activeQuestionTimers.has(roomId)) {
    clearTimeout(activeQuestionTimers.get(roomId));
    activeQuestionTimers.delete(roomId);
  }

  // Grace buffer: 1.5s past time limit to allow network in-flight submissions
  const timer = setTimeout(async () => {
    try {
      const room = await QuizRoom.findByPk(roomId);
      if (room && room.status === 'PLAYING' && Number(room.currentQuestionId) === Number(questionId)) {
        await revealQuestionResult(roomId);
      }
    } catch (err) {
      console.error('[QuizGame] Error in question timeout handler:', err);
    } finally {
      activeQuestionTimers.delete(roomId);
    }
  }, durationMs + 1500);

  activeQuestionTimers.set(roomId, timer);
}

/**
 * Submits an answer for the current question
 */
async function submitAnswer(roomId, questionId, userId, selectedOption) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) throw new Error('Không tìm thấy phòng chơi');
  if (room.status !== 'PLAYING') {
    throw new Error('Câu hỏi hiện tại đã kết thúc hoặc trận đấu chưa bắt đầu');
  }
  if (Number(room.currentQuestionId) !== Number(questionId)) {
    throw new Error('Câu hỏi không khớp với câu hỏi hiện tại');
  }

  const validOptions = ['A', 'B', 'C', 'D'];
  const cleanOption = String(selectedOption || '').toUpperCase().trim();
  if (!validOptions.includes(cleanOption)) {
    throw new Error('Đáp án không hợp lệ (phải là A, B, C hoặc D)');
  }

  const player = await QuizPlayer.findOne({ where: { roomId, userId } });
  if (!player) throw new Error('Người chơi không thuộc phòng đấu này');

  // Check IDEMPOTENCY — already answered?
  const existingAnswer = await QuizAnswer.findOne({
    where: { roomId, questionId, userId },
  });
  if (existingAnswer) {
    return {
      success: true,
      answer: existingAnswer,
      alreadySubmitted: true,
    };
  }

  const question = await QuizQuestion.findByPk(questionId);
  if (!question) throw new Error('Không tìm thấy dữ liệu câu hỏi');

  const now = Date.now();
  const startTime = Number(room.questionStartTime) || now;
  const elapsedMs = Math.max(0, now - startTime);
  const timeLimitMs = (question.timeLimit || 10) * 1000;

  let isCorrect = false;
  let score = 0;

  // Check correctness and compute time-based score
  if (cleanOption === question.correctOption) {
    isCorrect = true;
    // Base score = 1000, scaled by remaining time with min 100
    const remainingTimeRatio = Math.max(0, (timeLimitMs - elapsedMs) / timeLimitMs);
    score = Math.max(100, Math.round(1000 * remainingTimeRatio));
  }

  // Atomically create answer & update player score
  const createdAnswer = await sequelize.transaction(async (t) => {
    const ans = await QuizAnswer.create(
      {
        roomId,
        questionId,
        questionIndex: room.currentQuestionIndex,
        userId,
        selectedOption: cleanOption,
        isCorrect,
        responseTimeMs: elapsedMs,
        score,
        submittedAt: now,
      },
      { transaction: t }
    );

    player.score = (player.score || 0) + score;
    player.totalAnswered = (player.totalAnswered || 0) + 1;
    if (isCorrect) {
      player.correctAnswers = (player.correctAnswers || 0) + 1;
    }
    player.totalResponseTimeMs = (player.totalResponseTimeMs || 0) + elapsedMs;
    await player.save({ transaction: t });

    return ans;
  });

  // Re-rank all players in room
  const allPlayers = await QuizPlayer.findAll({
    where: { roomId },
    order: [['score', 'DESC'], ['correctAnswers', 'DESC'], ['totalResponseTimeMs', 'ASC']],
  });
  for (let i = 0; i < allPlayers.length; i++) {
    allPlayers[i].rank = i + 1;
    await allPlayers[i].save();
  }

  const answeredCount = await QuizAnswer.count({ where: { roomId, questionId } });
  const totalPlayersCount = allPlayers.length;

  // Emit answer submission update (without leaking correct option)
  quizRealtime.emitToRoom(roomId, 'quiz:answerSubmitted', {
    userId,
    answeredCount,
    totalPlayersCount,
  });

  // If ALL players have answered, immediately reveal results early!
  if (answeredCount >= totalPlayersCount && totalPlayersCount > 0) {
    if (activeQuestionTimers.has(roomId)) {
      clearTimeout(activeQuestionTimers.get(roomId));
      activeQuestionTimers.delete(roomId);
    }
    // Small 300ms breather before reveal
    setTimeout(() => {
      revealQuestionResult(roomId).catch((err) => console.error('[QuizGame] Early reveal error:', err));
    }, 300);
  }

  return {
    success: true,
    answer: createdAnswer,
    alreadySubmitted: false,
  };
}

/**
 * Reveals the results of the current question
 */
async function revealQuestionResult(roomId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room || room.status !== 'PLAYING') return;

  const question = await QuizQuestion.findByPk(room.currentQuestionId);
  if (!question) return;

  room.status = 'SHOWING_RESULT';
  await room.save();

  // Fetch all answers for this question
  const answers = await QuizAnswer.findAll({
    where: { roomId, questionId: room.currentQuestionId },
    include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
    order: [['score', 'DESC'], ['responseTimeMs', 'ASC']],
  });

  // Fetch current live leaderboard
  const players = await QuizPlayer.findAll({
    where: { roomId },
    include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
    order: [['score', 'DESC'], ['correctAnswers', 'DESC'], ['totalResponseTimeMs', 'ASC']],
  });

  const rankedPlayers = players.map((p, idx) => ({ ...p.toJSON(), rank: idx + 1 }));

  // Emit question result
  quizRealtime.emitToRoom(roomId, 'quiz:questionResult', {
    correctOption: question.correctOption,
    explanation: question.explanation,
    answers: answers.map((a) => a.toJSON()),
    leaderboard: rankedPlayers,
    questionIndex: room.currentQuestionIndex,
    totalQuestions: room.totalQuestions,
    isLastQuestion: room.currentQuestionIndex + 1 >= room.totalQuestions,
  });

  // Auto-advance after 3.5 seconds
  setTimeout(async () => {
    try {
      const currentRoom = await QuizRoom.findByPk(roomId);
      if (currentRoom && currentRoom.status === 'SHOWING_RESULT') {
        if (currentRoom.currentQuestionIndex + 1 < currentRoom.totalQuestions) {
          await advanceToNextQuestion(roomId);
        } else {
          await finishGame(roomId);
        }
      }
    } catch (err) {
      console.error('[QuizGame] Error advancing after reveal:', err);
    }
  }, 3500);
}

/**
 * Advances to the next question in the match
 */
async function advanceToNextQuestion(roomId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) return;

  const nextIndex = room.currentQuestionIndex + 1;
  const selectedIds = room.selectedQuestionIds || [];
  if (nextIndex >= selectedIds.length) {
    return finishGame(roomId);
  }

  const nextQuestionId = selectedIds[nextIndex];
  const nextQuestion = await QuizQuestion.findByPk(nextQuestionId);
  if (!nextQuestion) {
    return finishGame(roomId);
  }

  const durationMs = (nextQuestion.timeLimit || 10) * 1000;
  const startTime = Date.now();

  room.currentQuestionIndex = nextIndex;
  room.currentQuestionId = nextQuestionId;
  room.status = 'PLAYING';
  room.questionStartTime = startTime;
  room.questionDurationMs = durationMs;
  await room.save();

  const sanitizedQ = sanitizeQuestionForClient(nextQuestion);

  quizRealtime.emitToRoom(roomId, 'quiz:question', {
    question: sanitizedQ,
    questionIndex: nextIndex,
    totalQuestions: room.totalQuestions,
    questionStartTime: startTime,
    questionDurationMs: durationMs,
  });

  // Schedule auto timeout
  scheduleQuestionTimeout(roomId, nextQuestionId, durationMs);
}

/**
 * Finishes the game match and computes final leaderboard & stats
 */
async function finishGame(roomId) {
  const room = await QuizRoom.findByPk(roomId);
  if (!room) return;

  const players = await QuizPlayer.findAll({
    where: { roomId },
    include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
    order: [['score', 'DESC'], ['correctAnswers', 'DESC'], ['totalResponseTimeMs', 'ASC']],
  });

  const winnerUserId = players.length > 0 ? players[0].userId : null;

  room.status = 'FINISHED';
  room.finishedAt = new Date();
  room.winnerUserId = winnerUserId;
  await room.save();

  // Update user stats
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    p.rank = i + 1;
    await p.save();

    const isWinner = i === 0 && p.score > 0;
    const [stat] = await QuizUserStat.findOrCreate({
      where: { userId: p.userId },
      defaults: {
        gamesPlayed: 0,
        gamesWon: 0,
        totalScore: 0,
        totalCorrect: 0,
        totalAnswered: 0,
        highestScore: 0,
      },
    });

    stat.gamesPlayed = (stat.gamesPlayed || 0) + 1;
    if (isWinner) stat.gamesWon = (stat.gamesWon || 0) + 1;
    stat.totalScore = BigInt(stat.totalScore || 0) + BigInt(p.score || 0);
    stat.totalCorrect = (stat.totalCorrect || 0) + (p.correctAnswers || 0);
    stat.totalAnswered = (stat.totalAnswered || 0) + (p.totalAnswered || 0);
    if ((p.score || 0) > (stat.highestScore || 0)) {
      stat.highestScore = p.score;
    }
    await stat.save();
  }

  const finalPlayers = players.map((p, idx) => ({
    ...p.toJSON(),
    rank: idx + 1,
    avgResponseTimeMs: p.totalAnswered > 0 ? Math.round(p.totalResponseTimeMs / p.totalAnswered) : 0,
  }));

  quizRealtime.emitToRoom(roomId, 'quiz:finished', {
    room: room.toJSON(),
    winnerUserId,
    players: finalPlayers,
  });

  const fullState = await getRoomState(roomId);
  quizRealtime.emitToRoom(roomId, 'quiz:roomUpdated', fullState);

  return fullState;
}

/**
 * Gets the global career Quiz Leaderboard
 */
async function getLeaderboard({ limit = 50 } = {}) {
  const stats = await QuizUserStat.findAll({
    include: [{ model: User, as: 'user', attributes: USER_ATTRIBUTES }],
    order: [['totalScore', 'DESC'], ['gamesWon', 'DESC'], ['totalCorrect', 'DESC']],
    limit: Math.min(100, Math.max(1, Number(limit) || 50)),
  });

  return stats.map((s, idx) => {
    const json = s.toJSON();
    json.rank = idx + 1;
    json.accuracy = json.totalAnswered > 0 ? Math.round((json.totalCorrect / json.totalAnswered) * 100) : 0;
    return json;
  });
}

/**
 * Gets career stats for a specific user
 */
async function getMyStats(userId) {
  const [stat] = await QuizUserStat.findOrCreate({
    where: { userId },
    defaults: {
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      totalCorrect: 0,
      totalAnswered: 0,
      highestScore: 0,
    },
  });

  const json = stat.toJSON();
  json.accuracy = json.totalAnswered > 0 ? Math.round((json.totalCorrect / json.totalAnswered) * 100) : 0;
  return json;
}

module.exports = {
  ensureSeedQuestions,
  listRooms,
  getActiveRoomForUser,
  getRoomState,
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  submitAnswer,
  revealQuestionResult,
  advanceToNextQuestion,
  finishGame,
  getLeaderboard,
  getMyStats,
};
