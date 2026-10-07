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
    const room = await samGameService.getRoomDetail(id, req.user.id, req.user.role);
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
    const room = await samGameService.joinRoom(id, req.user.id, req.user);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function leaveRoom(req, res, next) {
  try {
    const { id } = req.params;
    const result = await samGameService.leaveRoom(id, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function toggleReady(req, res, next) {
  try {
    const { id } = req.params;
    const { isReady } = req.body;
    const room = await samGameService.toggleReady(id, req.user.id, isReady);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function startMatch(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.startMatch(id, req.user.id, req.user.role === 'admin');
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function declareSam(req, res, next) {
  try {
    const { id } = req.params;
    const { declare } = req.body;
    const room = await samGameService.declareSam(id, req.user.id, declare);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function playCards(req, res, next) {
  try {
    const { id } = req.params;
    const { cardIds } = req.body;
    const room = await samGameService.playCards(id, req.user.id, cardIds);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function passTurn(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.passTurn(id, req.user.id);
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

// ── PRACTICE ROOM & BOT CONTROLLER ACTIONS ──

async function createPracticeRoom(req, res, next) {
  try {
    const { botCount = 3 } = req.body;
    const room = await samGameService.createPracticeRoom(req.user.id, botCount);
    return res.status(201).json(room);
  } catch (err) {
    return next(err);
  }
}

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
    const room = await samGameService.fillBots(id, req.user.id, req.user.role === 'admin');
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function addBot(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.addBotToRoom(id, req.user.id, req.user.role === 'admin');
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function pauseBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.pauseBotTest(id, req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function resumeBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.resumeBotTest(id, req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function stepBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.stepBotTest(id, req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function restartBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const room = await samGameService.restartBotTest(id, req.user.id);
    return res.status(200).json(room);
  } catch (err) {
    return next(err);
  }
}

async function stopBotTest(req, res, next) {
  try {
    const { id } = req.params;
    const result = await samGameService.stopBotTest(id, req.user.id);
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}

async function getBotDebugState(req, res, next) {
  try {
    const { id } = req.params;
    const state = await samGameService.getBotDebugState(id, req.user.id);
    return res.status(200).json(state);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listRooms,
  createRoom,
  createPracticeRoom,
  getRoom,
  getActiveRoom,
  joinRoom,
  leaveRoom,
  toggleReady,
  startMatch,
  declareSam,
  playCards,
  passTurn,
  getLeaderboard,
  getMyStats,
  createBotTestRoom,
  listBotTestRooms,
  fillBots,
  addBot,
  pauseBotTest,
  resumeBotTest,
  stepBotTest,
  restartBotTest,
  stopBotTest,
  getBotDebugState,
};
