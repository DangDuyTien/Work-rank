'use strict';

/**
 * typingEngine.js
 *
 * Authoritative Typing Competition Engine:
 * - WPM & Accuracy calculation
 * - Plausibility & Anti-cheat verification
 * - Scalable scoring matrix (Solo, 1v1, 2v2, 3v3)
 * - Daily diminishing returns & WorkRank points calculation
 */

const DIFFICULTY_MULTIPLIERS = {
  EASY: 1.0,
  MEDIUM: 1.15,
  HARD: 1.3,
  EXPERT: 1.5,
};

const MAX_HUMAN_WPM_CAP = 250;
const MIN_DURATION_PER_WORD_MS = 100; // Even fastest typists take >100ms per word on average

/**
 * Calculates words per minute (WPM). Standard standard is 5 characters = 1 word.
 *
 * @param {number} charCount
 * @param {number} durationMs
 * @returns {number} WPM (rounded to 1 decimal)
 */
function calculateWPM(charCount, durationMs) {
  const chars = Number(charCount);
  const elapsedMs = Number(durationMs);
  if (!Number.isFinite(chars) || !Number.isFinite(elapsedMs) || chars <= 0 || elapsedMs <= 0) return 0;
  const rawWpm = (chars / 5) / (elapsedMs / 60000);
  if (!Number.isFinite(rawWpm) || rawWpm <= 0) return 0;
  return Math.round(rawWpm * 10) / 10;
}

/**
 * Calculates Accuracy percentage (0 - 100%).
 *
 * Accuracy is the proportion of retained input positions that match the challenge.
 * Corrected-away mistakes are not counted; this is a final-text metric, not a keystroke-attempt metric.
 *
 * @param {number} totalTypedChars
 * @param {number} errorCount
 * @returns {number} Accuracy (rounded to 1 decimal)
 */
function calculateAccuracy(totalTypedChars, errorCount = 0) {
  const typed = Number(totalTypedChars);
  const errors = Number(errorCount);
  if (!Number.isFinite(typed) || typed <= 0) return 0;
  const safeTyped = Math.max(0, Math.floor(typed));
  const safeErrors = Number.isFinite(errors) ? Math.min(safeTyped, Math.max(0, Math.floor(errors))) : safeTyped;
  const accuracy = ((safeTyped - safeErrors) / safeTyped) * 100;
  return Math.max(0, Math.min(100, Math.round(accuracy * 10) / 10));
}

/**
 * Validates typing submission plausibility against server authoritative clock & challenge length.
 *
 * @param {object} params
 * @param {number} params.challengeLength
 * @param {number} params.typedChars
 * @param {number} params.durationMs - Measured by server
 * @param {number} [params.clientDurationMs]
 * @param {number} [params.errorCount]
 * @returns {{ valid: boolean, reason?: string, wpm: number, accuracy: number }}
 */
function validateSubmissionPlausibility({
  challengeLength,
  typedChars,
  durationMs,
  clientDurationMs,
  errorCount = 0,
  maxWpmCap,
}) {
  const cleanChallengeLength = Number(challengeLength);
  if (!Number.isFinite(cleanChallengeLength) || cleanChallengeLength <= 0) {
    return { valid: false, reason: 'Nội dung bài thi đấu không hợp lệ', wpm: 0, accuracy: 0.0 };
  }

  const rawTyped = Number(typedChars);
  if (!Number.isFinite(rawTyped) || rawTyped < 0 || rawTyped > cleanChallengeLength) {
    return { valid: false, reason: 'Số ký tự gửi lên không hợp lệ', wpm: 0, accuracy: 0.0 };
  }
  const safeTyped = Math.floor(rawTyped);
  const rawErrors = Number(errorCount);
  if (!Number.isFinite(rawErrors) || rawErrors < 0 || rawErrors > safeTyped) {
    return { valid: false, reason: 'Số lỗi gửi lên không hợp lệ', wpm: 0, accuracy: 0.0 };
  }

  // Anti-cheat: reject non-participation / zero typed characters
  if (safeTyped <= 0) {
    return {
      valid: false,
      reason: 'Bài thi không có ký tự hợp lệ nào được gõ',
      wpm: 0,
      accuracy: 0.0,
    };
  }

  // Client duration is advisory only. The service must pass elapsed time measured from its own start timestamp.
  const serverElapsedMs = Number(durationMs);
  if (!Number.isFinite(serverElapsedMs) || serverElapsedMs <= 0) {
    return { valid: false, reason: 'Thời gian máy chủ không hợp lệ', wpm: 0, accuracy: 0.0 };
  }
  const effectiveDurationMs = serverElapsedMs;

  if (effectiveDurationMs < 1000) {
    return { valid: false, reason: 'Thời gian hoàn thành quá ngắn bất thường', wpm: 0, accuracy: 0.0 };
  }

  const correctChars = Math.max(0, safeTyped - rawErrors);
  const wpm = calculateWPM(correctChars, effectiveDurationMs);
  const accuracy = calculateAccuracy(safeTyped, errorCount);

  // Anti-cheat: Speed limit ceiling check
  const effectiveMaxWpm = maxWpmCap || MAX_HUMAN_WPM_CAP;
  if (wpm > effectiveMaxWpm) {
    return {
      valid: false,
      reason: `Tốc độ gõ (${wpm} WPM) vượt quá ngưỡng lý thuyết tối đa của con người`,
      wpm,
      accuracy,
    };
  }

  // Minimum time per character check (less than 25ms per character is inhuman)
  const minMsPerChar = 25;
  const msPerChar = effectiveDurationMs / Math.max(1, safeTyped);
  if (safeTyped > 30 && msPerChar < minMsPerChar) {
    return {
      valid: false,
      reason: 'Tốc độ nhấn phím bất thường (dấu hiệu bot hoặc autofill/paste)',
      wpm,
      accuracy,
    };
  }

  return {
    valid: true,
    wpm,
    accuracy,
  };
}

/**
 * Computes base performance score from WPM, Accuracy, Errors, and Difficulty.
 */
function computeBasePerformanceScore({
  wpm,
  accuracy,
  errorCount = 0,
  completed = true,
  difficulty = 'MEDIUM',
}) {
  const diffMultiplier = DIFFICULTY_MULTIPLIERS[difficulty] || 1.15;
  const safeWpm = Number.isFinite(Number(wpm)) ? Math.max(0, Number(wpm)) : 0;
  const safeAccuracy = Number.isFinite(Number(accuracy)) ? Math.max(0, Math.min(100, Number(accuracy))) : 0;
  const safeErrorCount = Number.isFinite(Number(errorCount)) ? Math.max(0, Number(errorCount)) : 0;
  const speedComponent = safeWpm * 0.6;
  const accuracyComponent = (safeAccuracy / 100) * 40;
  const completionBonus = completed ? 20 : 0;
  const errorPenalty = safeErrorCount * 1.5;

  const rawScore = (speedComponent + accuracyComponent + completionBonus - errorPenalty) * diffMultiplier;
  return Number.isFinite(rawScore) ? Math.max(0, Math.round(rawScore * 10) / 10) : 0;
}

/**
 * Deterministic final-result ordering. Valid participation and completion come first;
 * the product's existing composite performance score is the primary tiebreaker,
 * followed by accuracy, WPM, elapsed time, and stable identity.
 * Return a negative number when `a` should be placed before `b`.
 */
function compareTypingResults(a = {}, b = {}) {
  const isEligible = (player) => player.eligible !== undefined
    ? Boolean(player.eligible)
    : Number(player.typedChars || 0) >= 20 && Number(player.performanceScore || 0) > 0 && player.validSubmission !== false;
  const eligibleA = isEligible(a);
  const eligibleB = isEligible(b);
  if (eligibleA !== eligibleB) return eligibleA ? -1 : 1;

  const isCompleted = (player) => player.completed !== undefined
    ? Boolean(player.completed)
    : Number(player.progressPct || 0) >= 90;
  const completedA = isCompleted(a);
  const completedB = isCompleted(b);
  if (completedA !== completedB) return completedA ? -1 : 1;

  const scoreDiff = (Number(b.performanceScore) || 0) - (Number(a.performanceScore) || 0);
  if (scoreDiff) return scoreDiff;
  const accuracyDiff = (Number(b.accuracy) || 0) - (Number(a.accuracy) || 0);
  if (accuracyDiff) return accuracyDiff;
  const wpmDiff = (Number(b.wpm) || 0) - (Number(a.wpm) || 0);
  if (wpmDiff) return wpmDiff;

  const timeA = Number.isFinite(Number(a.completionTimeMs)) && Number(a.completionTimeMs) > 0
    ? Number(a.completionTimeMs)
    : Number.POSITIVE_INFINITY;
  const timeB = Number.isFinite(Number(b.completionTimeMs)) && Number(b.completionTimeMs) > 0
    ? Number(b.completionTimeMs)
    : Number.POSITIVE_INFINITY;
  if (timeA !== timeB) return timeA - timeB;

  const idA = Number(a.userId || a.id || a.seatIndex || 0);
  const idB = Number(b.userId || b.id || b.seatIndex || 0);
  return idA - idB;
}

/**
 * Determines WorkRank points awarded per match based on mode, outcome, and daily diminishing returns.
 *
 * @param {object} params
 * @param {'PRACTICE'|'RANKED'|'TOURNAMENT'} params.matchType
 * @param {'SOLO'|'1V1'|'2V2'|'3V3'} params.mode
 * @param {number} params.performanceScore
 * @param {boolean} params.isWinner
 * @param {boolean} params.isDraw
 * @param {number} [params.teamContributionRatio=1.0]
 * @param {number} [params.dailyRankedCount=0]
 * @param {number} [params.dailyPointsEarned=0]
 * @returns {{ workrankPoints: number, diminishingRate: number, isDailyCapped: boolean }}
 */
function calculateAwardedPoints({
  matchType = 'RANKED',
  mode = '1V1',
  performanceScore = 0,
  isWinner = false,
  isDraw = false,
  teamContributionRatio = 1.0,
  dailyRankedCount = 0,
  dailyPointsEarned = 0,
}) {
  // Practice matches grant 0 WorkRank points (purely for practice & personal stats)
  if (matchType === 'PRACTICE') {
    return { workrankPoints: 0, diminishingRate: 0, isDailyCapped: false };
  }

  // Zero participation or invalid performance receives zero points
  if (!performanceScore || performanceScore <= 0) {
    return { workrankPoints: 0, diminishingRate: 1.0, isDailyCapped: false };
  }

  // Daily Diminishing Returns:
  // Match 1-3: 100% rate
  // Match 4-5: 50% rate
  // Match >5: 0% rate (Daily cap of 5 ranked matches per day or max 150 points)
  let diminishingRate = 1.0;
  let isDailyCapped = false;

  if (dailyRankedCount >= 5 || dailyPointsEarned >= 150) {
    diminishingRate = 0;
    isDailyCapped = true;
  } else if (dailyRankedCount >= 3) {
    diminishingRate = 0.5;
  }

  let rawPoints = 0;

  if (mode === 'SOLO') {
    // Solo Ranked: primarily based on raw performance
    rawPoints = Math.floor(performanceScore * 0.22);
    // Cap solo to max 25 points before diminishing
    rawPoints = Math.min(25, rawPoints);
  } else if (mode === '1V1') {
    if (isWinner) {
      rawPoints = Math.floor(performanceScore * 0.25) + 15; // Win bonus
    } else if (isDraw) {
      rawPoints = Math.floor(performanceScore * 0.2) + 8;
    } else {
      rawPoints = Math.floor(performanceScore * 0.2) + 4; // Effort points
    }
  } else if (mode === '2V2' || mode === '3V3') {
    const contributionFactor = Math.max(0.4, Math.min(1.6, teamContributionRatio));
    const baseIndiv = Math.floor(performanceScore * 0.2);
    const teamBonus = isWinner ? 20 : isDraw ? 10 : 5;
    rawPoints = Math.floor(baseIndiv + teamBonus * contributionFactor);
  }

  const finalPoints = Math.floor(rawPoints * diminishingRate);

  return {
    workrankPoints: Math.max(0, finalPoints),
    diminishingRate,
    isDailyCapped,
  };
}

/**
 * Calculates Team Scores for 2v2 / 3v3 multiplayer modes.
 *
 * @param {Array<object>} players - Array of player records with { team, wpm, accuracy, typedChars, totalChars }
 * @returns {{ teamAScore: number, teamBScore: number, winnerTeam: 'A'|'B'|'DRAW' }}
 */
function calculateTeamMatchResult(players) {
  const teamAPlayers = players.filter((p) => p.team === 'A');
  const teamBPlayers = players.filter((p) => p.team === 'B');

  function getTeamMetrics(teamMembers) {
    const rankedMembers = (teamMembers || []).filter((player) =>
      Number(player.typedChars || 0) >= 20 && Number(player.performanceScore || 0) > 0 && player.validSubmission !== false
    );
    if (rankedMembers.length === 0) return 0;
    const totalScore = rankedMembers.reduce((sum, player) => sum + Number(player.performanceScore || 0), 0);
    // AFK/invalid members contribute zero; dropping them from the denominator
    // would reward a team for not participating.
    return Math.round((totalScore / teamMembers.length) * 10) / 10;
  }

  const teamAScore = getTeamMetrics(teamAPlayers);
  const teamBScore = getTeamMetrics(teamBPlayers);

  let winnerTeam = 'DRAW';
  if (teamAScore > teamBScore) {
    winnerTeam = 'A';
  } else if (teamBScore > teamAScore) {
    winnerTeam = 'B';
  }

  return {
    teamAScore,
    teamBScore,
    winnerTeam,
  };
}

module.exports = {
  DIFFICULTY_MULTIPLIERS,
  MAX_HUMAN_WPM_CAP,
  calculateWPM,
  calculateAccuracy,
  validateSubmissionPlausibility,
  computeBasePerformanceScore,
  compareTypingResults,
  calculateAwardedPoints,
  calculateTeamMatchResult,
};
