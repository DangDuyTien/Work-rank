'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, Game2048Score, Game2048UserStat } = require('../models');

const USER_ATTRIBUTES = ['id', 'name', 'email', 'role', 'teamId', 'jobTitle', 'department', 'isVerified', 'isDev'];

// Valid powers of 2 for 2048 tiles
const VALID_TILES = new Set([
  2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536, 131072
]);

/**
 * Validates 2048 game score plausibility to protect company leaderboard integrity
 */
function validateScorePlausibility(score, maxTile, moves) {
  const numScore = Number(score);
  const numTile = Number(maxTile);
  const numMoves = Number(moves);

  if (isNaN(numScore) || numScore < 0 || !Number.isInteger(numScore)) {
    throw new Error('Điểm số không hợp lệ');
  }

  if (isNaN(numMoves) || numMoves < 0 || !Number.isInteger(numMoves)) {
    throw new Error('Số lượt di chuyển không hợp lệ');
  }

  if (isNaN(numTile) || !VALID_TILES.has(numTile)) {
    throw new Error('Tile cao nhất không hợp lệ');
  }

  // A game with score > 0 must have at least 1 move
  if (numScore > 0 && numMoves <= 0) {
    throw new Error('Số lượt di chuyển phải lớn hơn 0 khi có điểm');
  }

  // Maximum theoretical limit on standard 4x4 grid is under 4,000,000
  if (numScore > 3932160) {
    throw new Error('Điểm số vượt quá giới hạn lý thuyết tối đa');
  }

  // Minimum points mathematically required to merge up to maxTile
  // Formula: (log2(tile) - 1) * tile (approx minimum points for a single tile of this size)
  if (numTile >= 4) {
    const k = Math.round(Math.log2(numTile));
    const minRequiredScore = (k - 1) * numTile;
    // Allow small 15% tolerance for initial spawned 4-tiles
    if (numScore < Math.floor(minRequiredScore * 0.85)) {
      throw new Error(`Điểm số (${numScore}) không tương xứng với tile cao nhất đạt được (${numTile})`);
    }
  }

  // Average points per move sanity check (standard average is 4-30 pts/move; upper bound 2500)
  if (numMoves > 0) {
    const ptsPerMove = numScore / numMoves;
    if (ptsPerMove > 2500) {
      throw new Error('Tỷ lệ điểm trên mỗi nước đi bất thường');
    }
  }

  return true;
}

/**
 * Starts a new 2048 game session
 */
async function startSession(userId) {
  const gameSessionId = 'g2048_' + crypto.randomBytes(16).toString('hex');
  return {
    gameSessionId,
    startedAt: Date.now(),
  };
}

/**
 * Submits a completed 2048 game result
 */
async function submitScore({ userId, score, maxTile, moves, gameSessionId, playedAt }) {
  if (!userId) throw new Error('Yêu cầu phiên đăng nhập người dùng');

  const cleanSessionId = String(gameSessionId || '').trim();
  if (!cleanSessionId) {
    throw new Error('Thiếu mã phiên chơi game (gameSessionId)');
  }

  const numScore = Math.max(0, Math.floor(Number(score) || 0));
  const numMaxTile = Math.max(2, Math.floor(Number(maxTile) || 2));
  const numMoves = Math.max(0, Math.floor(Number(moves) || 0));

  // Anti-tamper validation
  validateScorePlausibility(numScore, numMaxTile, numMoves);

  // IDEMPOTENCY: Check if this session was already processed
  const existingScore = await Game2048Score.findOne({
    where: { gameSessionId: cleanSessionId },
  });

  if (existingScore) {
    const userStat = await Game2048UserStat.findOne({ where: { userId } });
    return {
      success: true,
      score: existingScore.score,
      bestScore: userStat?.bestScore || existingScore.score,
      maxTile: existingScore.maxTile,
      isNewBest: false,
      alreadyProcessed: true,
    };
  }

  // Atomic database transaction
  const result = await sequelize.transaction(async (t) => {
    // 1. Record individual game session
    const scoreRecord = await Game2048Score.create(
      {
        userId,
        score: numScore,
        maxTile: numMaxTile,
        moves: numMoves,
        gameSessionId: cleanSessionId,
        playedAt: playedAt ? new Date(playedAt) : new Date(),
      },
      { transaction: t }
    );

    // 2. Update user career best stats
    const [stat, created] = await Game2048UserStat.findOrCreate({
      where: { userId },
      defaults: {
        bestScore: numScore,
        highestTile: numMaxTile,
        totalGames: 1,
        totalMoves: numMoves,
        firstAchievedAt: new Date(),
      },
      transaction: t,
    });

    let isNewBest = false;

    if (!created) {
      stat.totalGames = (stat.totalGames || 0) + 1;
      stat.totalMoves = BigInt(stat.totalMoves || 0) + BigInt(numMoves);

      if (numScore > (stat.bestScore || 0)) {
        stat.bestScore = numScore;
        stat.firstAchievedAt = new Date();
        isNewBest = true;
      }

      if (numMaxTile > (stat.highestTile || 0)) {
        stat.highestTile = numMaxTile;
      }

      await stat.save({ transaction: t });
    } else {
      isNewBest = numScore > 0;
    }

    return {
      scoreRecord,
      stat,
      isNewBest,
    };
  });

  return {
    success: true,
    score: numScore,
    bestScore: result.stat.bestScore,
    highestTile: result.stat.highestTile,
    isNewBest: result.isNewBest,
    alreadyProcessed: false,
  };
}

/**
 * Calculates a specific user's company-wide rank
 */
async function calculateUserRank(userId, userBestScore, userFirstAchievedAt) {
  if (!userBestScore || userBestScore <= 0) return null;

  // Rank = 1 + count of users with higher score OR (same score achieved earlier)
  const higherCount = await Game2048UserStat.count({
    where: {
      [Op.or]: [
        { bestScore: { [Op.gt]: userBestScore } },
        {
          bestScore: userBestScore,
          firstAchievedAt: { [Op.lt]: userFirstAchievedAt },
          userId: { [Op.ne]: userId },
        },
      ],
    },
  });

  return higherCount + 1;
}

/**
 * Gets company-wide 2048 Leaderboard with tie-breaking and current user's standing
 */
async function getLeaderboard({ limit = 50, currentUserId = null } = {}) {
  const cleanLimit = Math.min(100, Math.max(1, Number(limit) || 50));

  const stats = await Game2048UserStat.findAll({
    where: {
      bestScore: { [Op.gt]: 0 },
    },
    include: [
      {
        model: User,
        as: 'user',
        attributes: USER_ATTRIBUTES,
      },
    ],
    order: [
      ['bestScore', 'DESC'],
      ['firstAchievedAt', 'ASC'],
      ['id', 'ASC'],
    ],
    limit: cleanLimit,
  });

  const formattedLeaderboard = stats.map((item, idx) => {
    const json = item.toJSON();
    return {
      rank: idx + 1,
      userId: json.userId,
      user: json.user,
      bestScore: json.bestScore,
      highestTile: json.highestTile,
      totalGames: json.totalGames,
      firstAchievedAt: json.firstAchievedAt,
    };
  });

  let myStats = null;
  if (currentUserId) {
    const userStat = await Game2048UserStat.findOne({
      where: { userId: currentUserId },
    });

    if (userStat && userStat.bestScore > 0) {
      const myRank = await calculateUserRank(
        currentUserId,
        userStat.bestScore,
        userStat.firstAchievedAt
      );

      myStats = {
        bestScore: userStat.bestScore,
        highestTile: userStat.highestTile,
        totalGames: userStat.totalGames,
        rank: myRank,
      };
    } else {
      myStats = {
        bestScore: 0,
        highestTile: 2,
        totalGames: 0,
        rank: null,
      };
    }
  }

  return {
    leaderboard: formattedLeaderboard,
    myStats,
  };
}

/**
 * Gets personal best and stats for the authenticated user
 */
async function getMyStats(userId) {
  const [stat] = await Game2048UserStat.findOrCreate({
    where: { userId },
    defaults: {
      bestScore: 0,
      highestTile: 2,
      totalGames: 0,
      totalMoves: 0,
      firstAchievedAt: new Date(),
    },
  });

  let rank = null;
  if (stat.bestScore > 0) {
    rank = await calculateUserRank(userId, stat.bestScore, stat.firstAchievedAt);
  }

  return {
    bestScore: stat.bestScore,
    highestTile: stat.highestTile,
    totalGames: stat.totalGames,
    totalMoves: Number(stat.totalMoves || 0),
    rank,
  };
}

module.exports = {
  validateScorePlausibility,
  startSession,
  submitScore,
  getLeaderboard,
  getMyStats,
};
