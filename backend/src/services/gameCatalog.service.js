'use strict';

const { GameCatalog } = require('../models');

/**
 * Returns all games in the catalog.
 */
async function getCatalog() {
  const games = await GameCatalog.findAll({
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });
  return games;
}

/**
 * Returns single game by gameKey.
 */
async function getGameByKey(gameKey) {
  return GameCatalog.findOne({ where: { gameKey } });
}

/**
 * Updates game status / metadata (Admin only).
 */
async function updateGameStatus(gameKey, data) {
  const game = await GameCatalog.findOne({ where: { gameKey } });
  if (!game) {
    const err = new Error(`Game '${gameKey}' not found in catalog`);
    err.status = 404;
    throw err;
  }

  const updates = {};
  if (data.status !== undefined) {
    const normalizedStatus = String(data.status).toUpperCase();
    if (!['AVAILABLE', 'COMING_SOON'].includes(normalizedStatus)) {
      const err = new Error('Invalid status. Must be AVAILABLE or COMING_SOON');
      err.status = 400;
      throw err;
    }
    updates.status = normalizedStatus;
  }
  if (data.enabled !== undefined) {
    updates.enabled = Boolean(data.enabled);
  }
  if (data.sortOrder !== undefined) {
    updates.sortOrder = Number(data.sortOrder);
  }
  if (data.name !== undefined) {
    updates.name = String(data.name).trim();
  }
  if (data.description !== undefined) {
    updates.description = String(data.description).trim();
  }

  await game.update(updates);
  return game;
}

/**
 * Guard / check whether a user is allowed to access/play a game.
 * If status is COMING_SOON or disabled, regular members are blocked.
 * Admins are ALWAYS allowed (to preview/test).
 */
async function checkGameAvailability(gameKey, user) {
  const game = await GameCatalog.findOne({ where: { gameKey } });
  if (!game) {
    // If not found in catalog, allow by default or return error
    return { allowed: true };
  }

  const isAdmin = user && (user.role === 'admin' || user.isDev);

  if (game.status === 'COMING_SOON' && !isAdmin) {
    return {
      allowed: false,
      reason: 'COMING_SOON',
      gameKey,
      gameName: game.name,
      message: `Trò chơi ${game.name} đang trong giai đoạn chuẩn bị và sắp ra mắt.`,
    };
  }

  if (!game.enabled && !isAdmin) {
    return {
      allowed: false,
      reason: 'DISABLED',
      gameKey,
      gameName: game.name,
      message: `Trò chơi ${game.name} hiện đang tạm đóng.`,
    };
  }

  return {
    allowed: true,
    gameKey,
    gameName: game.name,
    status: game.status,
  };
}

module.exports = {
  getCatalog,
  getGameByKey,
  updateGameStatus,
  checkGameAvailability,
};
