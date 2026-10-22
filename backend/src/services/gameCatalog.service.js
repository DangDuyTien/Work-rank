'use strict';

const { GameCatalog } = require('../models');

async function getDefaultGames() {
  const { GAME_TYPES, ARCADE_GAME_REGISTRY } = await import('../../../shared/gameRegistry.mjs');
  return [
    {
      gameKey: GAME_TYPES.TYPING_BATTLE,
      name: 'WorkRank Typing Battle', status: 'AVAILABLE', enabled: true, sortOrder: 1,
      description: 'Đấu trường thi đấu đánh máy tốc độ cao, realtime 1v1, 2v2, 3v3 tích hợp trực tiếp BXH công ty.',
      icon: 'Keyboard', route: '/games/typing',
    },
    {
      gameKey: GAME_TYPES.DRAWING,
      name: 'Góc Sáng Tạo (Game Vẽ)', status: 'AVAILABLE', enabled: true, sortOrder: 2,
      description: 'Không gian sáng tạo nghệ thuật, vẽ tranh canvas siêu lớn và chia sẻ ngay lên trang chủ WorkRank.',
      icon: 'Palette', route: '/games/drawing',
    },
    ...ARCADE_GAME_REGISTRY.map((game, index) => ({
      gameKey: game.id,
      name: game.name,
      status: 'AVAILABLE',
      enabled: true,
      sortOrder: index + 3,
      description: game.subtitle,
      icon: game.icon,
      route: `/games/arcade/${game.id}`,
    })),
  ];
}

async function ensureDefaultCatalog() {
  for (const g of await getDefaultGames()) {
    const existing = await GameCatalog.findOne({ where: { gameKey: g.gameKey } });
    if (!existing) {
      await GameCatalog.create(g).catch(() => {});
    }
  }
}

/**
 * Returns all games in the catalog.
 */
async function getCatalog() {
  await ensureDefaultCatalog().catch(() => {});
  const defaults = await getDefaultGames();
  const games = await GameCatalog.findAll({
    where: { gameKey: defaults.map((g) => g.gameKey) },
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
