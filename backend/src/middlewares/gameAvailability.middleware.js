'use strict';

const gameCatalogService = require('../services/gameCatalog.service');

/**
 * Middleware that blocks non-admin users if the requested game is COMING_SOON or disabled.
 *
 * @param {string} gameKey - 'capital_board' | 'game_2048' | 'quiz' | 'sam'
 */
function requireGameAvailable(gameKey) {
  return async (req, res, next) => {
    try {
      const result = await gameCatalogService.checkGameAvailability(gameKey, req.user);
      if (!result.allowed) {
        return res.status(403).json({
          error: 'GAME_COMING_SOON',
          status: result.reason,
          gameKey: result.gameKey,
          gameName: result.gameName,
          message: result.message,
        });
      }
      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireGameAvailable };
