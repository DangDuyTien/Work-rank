'use strict';

/**
 * ranking.controller.js
 *
 * REST Controller for Unified Ranking & Leaderboard Hub.
 */

const rankingService = require('../services/ranking/ranking.service');

async function getOverview(req, res) {
  const data = await rankingService.getRankingOverview();
  return res.json({ success: true, ...data });
}

async function getTeams(req, res) {
  const { scope, seasonId, grandId, limit, page } = req.query;
  const result = await rankingService.getTeamRankings({
    scope,
    seasonId,
    grandId,
    limit,
    page,
  });
  return res.json({ success: true, ...result });
}

async function getIndividuals(req, res) {
  const { scope = 'all-time', seasonId, grandId, teamId, search, limit, page } = req.query;
  const result = await rankingService.getIndividualRankings({
    scope,
    seasonId,
    grandId,
    teamId,
    search,
    limit,
    page,
  });
  return res.json({ success: true, ...result });
}

async function getSeasons(req, res) {
  const seasons = await rankingService.getAvailableSeasons();
  return res.json({ success: true, seasons });
}

async function getGrands(req, res) {
  const grands = await rankingService.getAvailableGrands();
  return res.json({ success: true, grands });
}

async function getYouTube(req, res) {
  const { view, teamId, search, sortBy, limit, page } = req.query;
  const result = await rankingService.getYouTubeRankings({ view, teamId, search, sortBy, limit, page });
  return res.json({ success: true, ...result });
}

async function getTopPerformers(req, res) {
  const result = await rankingService.getTopPerformers();
  return res.json({ success: true, ...result });
}

module.exports = {
  getOverview,
  getTeams,
  getIndividuals,
  getSeasons,
  getGrands,
  getYouTube,
  getTopPerformers,
};
