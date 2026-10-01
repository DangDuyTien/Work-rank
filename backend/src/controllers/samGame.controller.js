'use strict';

const samGameService = require('../services/samGame.service');

/**
 * Sam Lốc Game Controller
 * Handles live multiplayer, spectator access, and admin-only test bot management.
 */

async function listRooms(req, res, next) {
  try {
    const { status, limit, isTest, roomType } = req.query;
    const rooms = await samGameService.listRooms({ status, limit, isTest, roomType }, req.user);
    return res.status(200).json(rooms);
  } catch (err) {
    return next(err);
  }
}

async function createRoom(req, res, next) {
  try {
    const { title, maxPlayers } = req.body;
    const room = await samGameService.createRoom(
      {
        title,
        maxPlayers,
        userId: req.user.id,
      },
      req.user
    );
    return res.status(201).json(room);
  } catch (err) {
    return next(err);
  }
}

async function getRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.getRoomDetail(Number(id), req.user.id, req.user.role);
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
    const room = await samGameService.joinRoom(Number(id), req.user.id, req.user);
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
    const room = await samGameService.startMatch(Number(id), req.user.id, req.user.role === 'admin');
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

// ── ADMIN BOT TEST CONTROLLER ACTIONS ──

async function createBotTestRoom(req, res, next) {
  try {
    const { title, playerCount, botCount, difficulty, scenario, includeAdmin } = req.body;
    const room = await samGameService.createBotTestRoom(
      {
        title,
        playerCount,
        botCount,
        difficulty,
        scenario,
        includeAdmin,
      },
      req.user
    );
    return res.status(201).json(room);
  } catch (err) {
    return next(err);
  }
}

async function listBotTestRooms(req, res, next) {
  try {
    const rooms = await samGameService.listRooms({ isTest: true }, req.user);
    return res.status(200).json(rooms);
  } catch (err) {
    return next(err);
  }
}

async function fillBots(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.fillBots(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function pauseBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.pauseBotTest(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function resumeBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.resumeBotTest(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function stepBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.stepBotTest(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function restartBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.restartBotTest(Number(id), req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function stopBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const result = await samGameService.stopBotTest(Number(id), req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getBotDebugState(req, res, next) {
  try {
    const { id } = req.params;
    const state = await samGameService.getBotDebugState(Number(id), req.user.id);
    return res.status(200).json(state);
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
  createBotTestRoom,
  listBotTestRooms,
  fillBots,
  pauseBotTest,
  resumeBotTest,
  stepBotTest,
  restartBotTest,
  stopBotTest,
  getBotDebugState,
};
