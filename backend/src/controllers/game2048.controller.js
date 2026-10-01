'use strict';

const game2048Service = require('../services/game2048.service');

/**
 * POST /api/games/2048/start
 * Initializes a new game session with a unique session ID
 */
async function startSession(req, res) {
  const userId = req.user.id;
  const { boardState } = req.body || {};
  const result = await game2048Service.startSession(userId, { boardState });
  return res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/games/2048/checkpoint
 * Periodically saves in-progress score and board state during active gameplay
 */
async function checkpointSession(req, res) {
  const userId = req.user.id;
  const { score, maxTile, moves, gameSessionId, boardState } = req.body || {};

  const result = await game2048Service.checkpointSession({
    userId,
    score,
    maxTile,
    moves,
    gameSessionId,
    boardState,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/games/2048/submit
 * Submits a completed or exited 2048 game score (GAME OVER or EXIT before GAME OVER)
 */
async function submitScore(req, res) {
  const userId = req.user.id;
  const { score, maxTile, moves, gameSessionId, playedAt, status, boardState } = req.body || {};

  const result = await game2048Service.submitScore({
    userId,
    score,
    maxTile,
    moves,
    gameSessionId,
    playedAt,
    status,
    boardState,
  });

  return res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/games/2048/active-session
 * Retrieves current active session if any to restore gameplay upon reload
 */
async function getActiveSession(req, res) {
  const userId = req.user.id;
  const result = await game2048Service.getActiveSession(userId);

  return res.status(200).json({
    success: true,
    data: result,
  });
}

/**
 * GET /api/games/2048/leaderboard
 * Returns company-wide 2048 leaderboard and current user's standing
 */
async function getLeaderboard(req, res) {
  const currentUserId = req.user?.id || null;
  const limit = req.query.limit || 50;

  const result = await game2048Service.getLeaderboard({
    limit,
    currentUserId,
  });

  return res.status(200).json({
    success: true,
    data: result.leaderboard,
    myStats: result.myStats,
  });
}

/**
 * GET /api/games/2048/my-stats
 * Returns authenticated user's best score, highest tile, and company rank
 */
async function getMyStats(req, res) {
  const userId = req.user.id;
  const stats = await game2048Service.getMyStats(userId);

  return res.status(200).json({
    success: true,
    data: stats,
  });
}

module.exports = {
  startSession,
  checkpointSession,
  submitScore,
  getActiveSession,
  getLeaderboard,
  getMyStats,
};
