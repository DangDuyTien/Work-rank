'use strict';

const quizService = require('../services/quizGame.service');

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
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  const roomState = await quizService.getRoomState(roomId, req.user.id);
  if (!roomState) return res.status(404).json({ message: 'Không tìm thấy phòng chơi' });

  return res.json({ data: roomState });
}

async function createRoom(req, res) {
  const { title, mode, maxPlayers, totalQuestions } = req.body || {};
  try {
    const roomState = await quizService.createRoom({
      hostUserId: req.user.id,
      title,
      mode,
      maxPlayers,
      totalQuestions,
    });
    return res.status(201).json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function joinRoom(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const roomState = await quizService.joinRoom(roomId, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function leaveRoom(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const result = await quizService.leaveRoom(roomId, req.user.id);
    return res.json({ data: result });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function startGame(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const roomState = await quizService.startGame(roomId, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function submitAnswer(req, res) {
  const roomId = Number(req.params.id);
  const { questionId, selectedOption } = req.body || {};
  if (!roomId || !questionId) return res.status(400).json({ message: 'Invalid parameters' });

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
  joinRoom,
  leaveRoom,
  startGame,
  submitAnswer,
  getLeaderboard,
  getMyStats,
};
