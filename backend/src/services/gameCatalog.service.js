'use strict';

const { GameCatalog } = require('../models');

const DEFAULT_GAMES = [
  {
    gameKey: 'typing_battle',
    name: 'WorkRank Typing Battle',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 1,
    description: 'Đấu trường thi đấu đánh máy tốc độ cao, realtime 1v1, 2v2, 3v3 tích hợp trực tiếp BXH công ty.',
    icon: 'Keyboard',
    route: '/games/typing',
  },
  {
    gameKey: 'capital_board',
    name: 'Cờ Tỷ Phú',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 2,
    description: 'Trò chơi bàn cờ tỷ phú kinh doanh và đầu tư bất động sản thời gian thực.',
    icon: 'Gamepad2',
    route: '/games/capital-board',
  },
  {
    gameKey: 'game_2048',
    name: '2048',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 3,
    description: 'Trò chơi ghép số 2048 trí tuệ, thử thách tư duy và bảng xếp hạng công ty.',
    icon: 'LayoutGrid',
    route: '/games/2048',
  },
  {
    gameKey: 'sam',
    name: 'Đánh Sâm',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 4,
    description: 'Trò chơi bài dân gian Đánh Sâm 2–4 người thời gian thực kịch tính.',
    icon: 'Club',
    route: '/games/sam',
  },
  {
    gameKey: 'quiz',
    name: 'Đoán Hình & Đoán Nhạc',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 5,
    description: 'Mini game đoán hình ảnh & đoán bài hát tốc độ cao nhiều người chơi.',
    icon: 'Sparkles',
    route: '/games/quiz',
  },
  {
    gameKey: 'drawing',
    name: 'Góc Sáng Tạo (Game Vẽ)',
    status: 'AVAILABLE',
    enabled: true,
    sortOrder: 6,
    description: 'Không gian sáng tạo nghệ thuật, vẽ tranh canvas siêu lớn và chia sẻ ngay lên trang chủ WorkRank.',
    icon: 'Palette',
    route: '/games/drawing',
  },
];

async function ensureDefaultCatalog() {
  for (const g of DEFAULT_GAMES) {
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
