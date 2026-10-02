'use strict';

const gameCatalogService = require('../services/gameCatalog.service');

async function getCatalog(req, res) {
  const games = await gameCatalogService.getCatalog();
  return res.json({ games });
}

async function getGame(req, res) {
  const game = await gameCatalogService.getGameByKey(req.params.gameKey);
  if (!game) {
    return res.status(404).json({ message: 'Game not found' });
  }
  return res.json(game);
}

async function updateGame(req, res) {
  const updated = await gameCatalogService.updateGameStatus(req.params.gameKey, req.body);
  return res.json(updated);
}

module.exports = {
  getCatalog,
  getGame,
  updateGame,
};
