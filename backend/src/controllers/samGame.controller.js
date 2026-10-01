'use strict';

const samGameService = require('../services/samGame.service');

/**
 * Sam Lốc Game Controller
 */

async function listRooms(req, res, next) {
  try {
    const { status, limit } = req.query;
    const rooms = await samGameService.listRooms({ status, limit });
    return res.status(200).json(rooms);
  } catch (err) {
    return next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const { title, maxPlayers } = req.body;
    const room = await samGameService.createRoom({
      title,
      maxPlayers,
      userId: req.user.id,
    });
    return res.status(201).json(room);
  } catch (err) {
    return next(err);
  }
}

async function getRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.getRoomDetail(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function getActiveRoom(req, res, next) {
  try {
    const room = await samGameService.getActiveRoom(req.user.id);
    return res.status(200).json({ room });
  } catch (err) {
    return next(err);
  }
}

async function joinRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.joinRoom(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function leaveRoom(req, res, next) {
  try {
    const { id } = req.params;
    const result = await samGameService.leaveRoom(Number(id), req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function startMatch(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.startMatch(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function declareSam(req, res, next) {
  try {
    const { id } = req.params;
    const { declare } = req.body;
    const room = await samGameService.declareSam(Number(id), req.user.id, declare);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function playCards(req, res, next) {
  try {
    const { id } = req.params;
    const { cardIds } = req.body;
    const room = await samGameService.playCards(Number(id), req.user.id, cardIds);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function passTurn(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.passTurn(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function getLeaderboard(req, res, next) {
  try {
    const { limit } = req.query;
    const leaderboard = await samGameService.getLeaderboard(limit);
    return res.status(200).json({ data: leaderboard });
  } catch (err) {
    return next(err);
  }
}

async function getMyStats(req, res, next) {
  try {
    const stats = await samGameService.getMyStats(req.user.id);
    return res.status(200).json(stats);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listRooms,
  createRoom,
  getRoom,
  getActiveRoom,
  joinRoom,
  leaveRoom,
  startMatch,
  declareSam,
  playCards,
  passTurn,
  getLeaderboard,
  getMyStats,
};
