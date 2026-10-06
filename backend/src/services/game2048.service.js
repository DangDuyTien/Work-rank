'use strict';

const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize, User, Game2048Score, Game2048UserStat } = require('../models');

const {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
} = require('../utils/errors');

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
    throw new ValidationError('Điểm số không hợp lệ');
  }

  if (isNaN(numMoves) || numMoves < 0 || !Number.isInteger(numMoves)) {
    throw new ValidationError('Số lượt di chuyển không hợp lệ');
  }

  if (isNaN(numTile) || !VALID_TILES.has(numTile)) {
    throw new ValidationError('Tile cao nhất không hợp lệ');
  }

  // A game with score > 0 must have at least 1 move
  if (numScore > 0 && numMoves <= 0) {
    throw new ValidationError('Số lượt di chuyển phải lớn hơn 0 khi có điểm');
  }

  // Maximum theoretical limit on standard 4x4 grid is under 4,000,000
  if (numScore > 3932160) {
    throw new ValidationError('Điểm số vượt quá giới hạn lý thuyết tối đa');
  }

  // Minimum points mathematically required to merge up to maxTile
  // Formula: (log2(tile) - 1) * tile (approx minimum points for a single tile of this size)
  if (numTile >= 4) {
    const k = Math.round(Math.log2(numTile));
    const minRequiredScore = (k - 1) * numTile;
    // Allow small 15% tolerance for initial spawned 4-tiles
    if (numScore < Math.floor(minRequiredScore * 0.85)) {
      throw new ValidationError(`Điểm số (${numScore}) không tương xứng với tile cao nhất đạt được (${numTile})`);
    }
  }

  // Average points per move sanity check (standard average is 4-30 pts/move; upper bound 2500)
  if (numMoves > 0) {
    const ptsPerMove = numScore / numMoves;
    if (ptsPerMove > 2500) {
      throw new ValidationError('Tỷ lệ điểm trên mỗi nước đi bất thường');
    }
  }

  return true;
}

/**
 * Starts a new 2048 game session and persists ACTIVE session record
 */
async function startSession(userId, initialData = {}) {
  if (!userId) throw new UnauthorizedError('Yêu cầu phiên đăng nhập người dùng');

  const gameSessionId = 'g2048_' + crypto.randomBytes(16).toString('hex');
  const now = new Date();

  // Create persistent ACTIVE session in database
  const sessionRecord = await Game2048Score.create({
    userId,
    score: 0,
    maxTile: 2,
    moves: 0,
    status: 'ACTIVE',
    gameSessionId,
    boardState: initialData.boardState ? JSON.stringify(initialData.boardState) : null,
    startedAt: now,
    lastActivityAt: now,
    playedAt: now,
  });

  return {
    gameSessionId,
    startedAt: sessionRecord.startedAt.getTime(),
    status: 'ACTIVE',
  };
}

/**
 * Checkpoints current session score & board state during active gameplay
 */
async function checkpointSession({ userId, score, maxTile, moves, gameSessionId, boardState }) {
  if (!userId) throw new UnauthorizedError('Yêu cầu phiên đăng nhập người dùng');

  const cleanSessionId = String(gameSessionId || '').trim();
  if (!cleanSessionId) {
    throw new ValidationError('Thiếu mã phiên chơi game (gameSessionId)');
  }

  const numScore = Math.floor(Number(score) || 0);
  const numMaxTile = Math.floor(Number(maxTile) || 2);
  const numMoves = Math.floor(Number(moves) || 0);

  validateScorePlausibility(score, maxTile, moves);

  const result = await sequelize.transaction(async (t) => {
    let sessionRecord = await Game2048Score.findOne({
      where: { gameSessionId: cleanSessionId },
      transaction: t,
    });

    const now = new Date();
    const boardStateStr = boardState ? (typeof boardState === 'string' ? boardState : JSON.stringify(boardState)) : null;

    if (sessionRecord) {
      if (numScore > sessionRecord.score) {
        sessionRecord.score = numScore;
      }
      if (numMaxTile > sessionRecord.maxTile) {
        sessionRecord.maxTile = numMaxTile;
      }
      if (numMoves > sessionRecord.moves) {
        sessionRecord.moves = numMoves;
      }
      if (boardStateStr) {
        sessionRecord.boardState = boardStateStr;
      }
      sessionRecord.lastActivityAt = now;
      await sessionRecord.save({ transaction: t });
    } else {
      sessionRecord = await Game2048Score.create(
        {
          userId,
          score: numScore,
          maxTile: numMaxTile,
          moves: numMoves,
          status: 'ACTIVE',
          gameSessionId: cleanSessionId,
          boardState: boardStateStr,
          startedAt: now,
          lastActivityAt: now,
          playedAt: now,
        },
        { transaction: t }
      );
    }

    // Update career best if current score exceeds user's personal best
    const [stat, created] = await Game2048UserStat.findOrCreate({
      where: { userId },
      defaults: {
        bestScore: numScore,
        highestTile: numMaxTile,
        totalGames: 1,
        totalMoves: numMoves,
        firstAchievedAt: now,
      },
      transaction: t,
    });

    let isNewBest = false;

    if (!created) {
      if (numScore > (stat.bestScore || 0)) {
        stat.bestScore = numScore;
        stat.firstAchievedAt = now;
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
      sessionRecord,
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
    status: result.sessionRecord.status,
  };
}

/**
 * Submits a completed or exited 2048 game result (GAME OVER, EXIT, or ABANDONED)
 */
async function submitScore({ userId, score, maxTile, moves, gameSessionId, playedAt, status, boardState }) {
  if (!userId) throw new UnauthorizedError('Yêu cầu phiên đăng nhập người dùng');

  const cleanSessionId = String(gameSessionId || '').trim();
  if (!cleanSessionId) {
    throw new ValidationError('Thiếu mã phiên chơi game (gameSessionId)');
  }

  const numScore = Math.floor(Number(score) || 0);
  const numMaxTile = Math.floor(Number(maxTile) || 2);
  const numMoves = Math.floor(Number(moves) || 0);
  const finalStatus = status === 'ABANDONED' ? 'ABANDONED' : 'COMPLETED';

  // Anti-tamper validation
  validateScorePlausibility(score, maxTile, moves);

  // Atomic database transaction with idempotency and update support
  const result = await sequelize.transaction(async (t) => {
    const existingScore = await Game2048Score.findOne({
      where: { gameSessionId: cleanSessionId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const now = new Date();
    const boardStateStr = boardState ? (typeof boardState === 'string' ? boardState : JSON.stringify(boardState)) : null;
    let scoreRecord;
    let isAlreadyFinalized = false;

    if (existingScore) {
      isAlreadyFinalized = existingScore.status === 'COMPLETED' || existingScore.status === 'ABANDONED';

      // Check if identical submission already processed
      if (isAlreadyFinalized && existingScore.score === numScore && existingScore.moves === numMoves) {
        const userStat = await Game2048UserStat.findOne({ where: { userId }, transaction: t });
        return {
          scoreRecord: existingScore,
          stat: userStat,
          isNewBest: false,
          alreadyProcessed: true,
        };
      }

      // Update session with latest final score and status
      existingScore.score = Math.max(existingScore.score, numScore);
      existingScore.maxTile = Math.max(existingScore.maxTile, numMaxTile);
      existingScore.moves = Math.max(existingScore.moves, numMoves);
      existingScore.status = finalStatus;
      existingScore.endedAt = now;
      existingScore.lastActivityAt = now;
      if (boardStateStr) existingScore.boardState = boardStateStr;
      if (playedAt) existingScore.playedAt = new Date(playedAt);

      scoreRecord = await existingScore.save({ transaction: t });
    } else {
      scoreRecord = await Game2048Score.create(
        {
          userId,
          score: numScore,
          maxTile: numMaxTile,
          moves: numMoves,
          status: finalStatus,
          gameSessionId: cleanSessionId,
          boardState: boardStateStr,
          startedAt: now,
          endedAt: now,
          lastActivityAt: now,
          playedAt: playedAt ? new Date(playedAt) : now,
        },
        { transaction: t }
      );
    }

    // Update career best stats for leaderboard
    const [stat, created] = await Game2048UserStat.findOrCreate({
      where: { userId },
      defaults: {
        bestScore: numScore,
        highestTile: numMaxTile,
        totalGames: 1,
        totalMoves: numMoves,
        firstAchievedAt: now,
      },
      transaction: t,
    });

    let isNewBest = false;

    if (!created) {
      if (!isAlreadyFinalized) {
        stat.totalGames = (stat.totalGames || 0) + 1;
        stat.totalMoves = BigInt(stat.totalMoves || 0) + BigInt(numMoves);
      }

      if (numScore > (stat.bestScore || 0)) {
        stat.bestScore = numScore;
        stat.firstAchievedAt = now;
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
      alreadyProcessed: false,
    };
  });

  return {
    success: true,
    score: numScore,
    bestScore: result.stat?.bestScore ?? numScore,
    highestTile: result.stat?.highestTile ?? numMaxTile,
    isNewBest: result.isNewBest,
    alreadyProcessed: result.alreadyProcessed,
    status: result.scoreRecord.status,
  };
}

/**
 * Gets active session for user to restore gameplay on refresh / reconnect
 */
async function getActiveSession(userId) {
  if (!userId) return null;

  const session = await Game2048Score.findOne({
    where: {
      userId,
      status: 'ACTIVE',
    },
    order: [['lastActivityAt', 'DESC']],
  });

  if (!session) return null;

  let boardState = null;
  if (session.boardState) {
    try {
      boardState = JSON.parse(session.boardState);
    } catch (e) {
      boardState = null;
    }
  }

  return {
    gameSessionId: session.gameSessionId,
    score: session.score,
    maxTile: session.maxTile,
    moves: session.moves,
    boardState,
    startedAt: session.startedAt,
    lastActivityAt: session.lastActivityAt,
    status: session.status,
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
  checkpointSession,
  submitScore,
  getActiveSession,
  getLeaderboard,
  getMyStats,
};
