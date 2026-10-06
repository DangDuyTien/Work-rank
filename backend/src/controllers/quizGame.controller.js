'use strict';

const quizService = require('../services/quizGame.service');

const { QuizRoom } = require('../models');

async function resolveRoomId(param) {
  if (!param) return null;
  const str = String(param).trim().replace(/^#/, '');
  if (!str) return null;
  const num = Number(str);
  if (!Number.isNaN(num) && num > 0 && /^\d+$/.test(str)) {
    const room = await QuizRoom.findByPk(num);
    return room ? room.id : null;
  }
  const cleanCode = str.toUpperCase();
  const found = await QuizRoom.findOne({ where: { code: cleanCode } });
  return found ? found.id : null;
}

async function listRooms(req, res) {
  const { mode, status, limit } = req.query || {};
  const rooms = await quizService.listRooms({ mode, status, limit });
  return res.json({ data: rooms });
}

async function getActiveRoom(req, res) {
  const roomState = await quizService.getActiveRoomForUser(req.user.id);
  return res.json({ data: roomState });
}

async function getRoom(req, res) {
  const roomId = await resolveRoomId(req.params.id);
  if (!roomId) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });

  const roomState = await quizService.getRoomState(roomId, req.user.id);
  if (!roomState) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });

  return res.json({ data: roomState });
}

async function createRoom(req, res) {
  const { title, mode, maxPlayers, totalQuestions, quizSetId } = req.body || {};
  try {
    const roomState = await quizService.createRoom({
      hostUserId: req.user.id,
      title,
      mode,
      maxPlayers,
      totalQuestions,
      quizSetId,
    });
    return res.status(201).json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function listActiveSets(req, res) {
  const { QuizSet, QuizQuestion } = require('../models');
  const sets = await QuizSet.findAll({
    where: { isActive: true, status: 'PUBLISHED' },
    include: [{ model: QuizQuestion, as: 'questions', attributes: ['id', 'isActive'] }],
    order: [['title', 'ASC']],
  });
  const formatted = sets.map((s) => {
    const json = s.toJSON();
    json.questionCount = (json.questions || []).filter((q) => q.isActive).length;
    delete json.questions;
    return json;
  });
  return res.json({ data: formatted });
}

async function joinRoom(req, res) {
  const roomId = await resolveRoomId(req.params.id);
  if (!roomId) return res.status(404).json({ message: 'Không tìm thấy mã hoặc phòng chơi này' });

  try {
    const roomState = await quizService.joinRoom(roomId, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function leaveRoom(req, res) {
  const roomId = await resolveRoomId(req.params.id);
  if (!roomId) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });

  try {
    const result = await quizService.leaveRoom(roomId, req.user.id);
    return res.json({ data: result });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function startGame(req, res) {
  const roomId = await resolveRoomId(req.params.id);
  if (!roomId) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });

  try {
    const roomState = await quizService.startGame(roomId, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function submitAnswer(req, res) {
  const roomId = await resolveRoomId(req.params.id);
  const { questionId, selectedOption } = req.body || {};
  if (!roomId) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });
  if (!questionId) return res.status(400).json({ message: 'Thiếu questionId' });

  try {
    const result = await quizService.submitAnswer(
      roomId,
      Number(questionId),
      req.user.id,
      selectedOption
    );
    return res.json({ data: result });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function getLeaderboard(req, res) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const leaderboard = await quizService.getLeaderboard({ limit });
  const myStats = req.user?.id ? await quizService.getMyStats(req.user.id) : null;
  return res.json({ data: leaderboard, myStats });
}

async function getMyStats(req, res) {
  const stats = await quizService.getMyStats(req.user.id);
  return res.json({ data: stats });
}

module.exports = {
  listRooms,
  getActiveRoom,
  getRoom,
  createRoom,
  listActiveSets,
  joinRoom,
  leaveRoom,
  startGame,
  submitAnswer,
  getLeaderboard,
  getMyStats,
};
