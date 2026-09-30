'use strict';

const gameService = require('../services/capitalBoardGame.service');

async function listRooms(req, res) {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 30));
  const rooms = await gameService.listRooms({ limit });
  return res.json({ data: rooms });
}

async function getActiveRoom(req, res) {
  const roomState = await gameService.getActiveRoomForUser(req.user.id);
  return res.json({ data: roomState });
}

async function getRoom(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  const roomState = await gameService.getRoomState(roomId, req.user.id);
  if (!roomState) return res.status(404).json({ message: 'Không tìm thấy phòng game' });

  return res.json({ data: roomState });
}

async function createRoom(req, res) {
  const { title, maxPlayers } = req.body || {};
  try {
    const room = await gameService.createRoom({
      hostUserId: req.user.id,
      title,
      maxPlayers,
    });
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.status(201).json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function joinRoom(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const room = await gameService.joinRoom(roomId, req.user.id);
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function leaveRoom(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const result = await gameService.leaveRoom(roomId, req.user.id);
    return res.json({ data: result });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function startGame(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const room = await gameService.startGame(roomId, req.user.id);
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function rollDice(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const room = await gameService.rollDice(roomId, req.user.id);
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function buyProperty(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const room = await gameService.buyProperty(roomId, req.user.id);
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function endTurn(req, res) {
  const roomId = Number(req.params.id);
  if (!roomId) return res.status(400).json({ message: 'Invalid room ID' });

  try {
    const room = await gameService.endTurn(roomId, req.user.id);
    const roomState = await gameService.getRoomState(room.id, req.user.id);
    return res.json({ data: roomState });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

async function getLeaderboard(req, res) {
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const page = Math.max(1, Number(req.query.page) || 1);
  const result = await gameService.getLeaderboard({
    limit,
    page,
    currentUserId: req.user?.id,
  });
  return res.json({ data: result });
}

async function getMyHistory(req, res) {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const history = await gameService.getUserHistory(req.user.id, { limit });
  return res.json({ data: history });
}

module.exports = {
  listRooms,
  getActiveRoom,
  getRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  startGame,
  rollDice,
  buyProperty,
  endTurn,
  getLeaderboard,
  getMyHistory,
};
