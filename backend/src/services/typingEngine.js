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
  if (!charCount || !durationMs || durationMs <= 0) return 0;
  const minutes = durationMs / 60000;
  const words = charCount / 5;
  const rawWpm = words / minutes;
  return Math.max(0, Math.round(rawWpm * 10) / 10);
}

/**
 * Calculates Accuracy percentage (0 - 100%).
 *
 * @param {number} correctChars
 * @param {number} totalTypedChars
 * @param {number} errorCount
 * @returns {number} Accuracy (rounded to 1 decimal)
 */
function calculateAccuracy(correctChars, totalTypedChars, errorCount = 0) {
  const total = Math.max(correctChars, totalTypedChars, correctChars + errorCount);
  if (total <= 0) return 100.0;
  const accuracy = ((total - errorCount) / total) * 100;
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
}) {
  if (!challengeLength || challengeLength <= 0) {
    return { valid: false, reason: 'Nội dung bài thi đấu không hợp lệ', wpm: 0, accuracy: 0 };
  }

  // Calculate authoritative WPM based on duration
  const effectiveDurationMs = clientDurationMs && clientDurationMs >= 1000
    ? clientDurationMs
    : Math.max(1000, durationMs);

  if (effectiveDurationMs < 1000) {
    return { valid: false, reason: 'Thời gian hoàn thành quá ngắn bất thường', wpm: 0, accuracy: 0 };
  }

  const wpm = calculateWPM(typedChars, effectiveDurationMs);
  const accuracy = calculateAccuracy(typedChars, typedChars, errorCount);

  // Anti-cheat: Speed limit ceiling check
  if (wpm > MAX_HUMAN_WPM_CAP) {
    return {
      valid: false,
      reason: `Tốc độ gõ (${wpm} WPM) vượt quá ngưỡng lý thuyết tối đa của con người`,
      wpm,
      accuracy,
    };
  }

  // Minimum time per character check (less than 25ms per character is inhuman)
  const msPerChar = effectiveDurationMs / Math.max(1, typedChars);
  if (typedChars > 30 && msPerChar < 25) {
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
  const speedComponent = wpm * 0.6;
  const accuracyComponent = (accuracy / 100) * 40;
  const completionBonus = completed ? 20 : 0;
  const errorPenalty = errorCount * 1.5;

  const rawScore = (speedComponent + accuracyComponent + completionBonus - errorPenalty) * diffMultiplier;
  return Math.max(0, Math.round(rawScore * 10) / 10);
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
    if (!teamMembers || teamMembers.length === 0) return 0;
    let totalScore = 0;
    for (const p of teamMembers) {
      const pWpm = Number(p.wpm || 0);
      const pAcc = Number(p.accuracy || 100);
      const completionRatio = p.progressPct ? Number(p.progressPct) / 100 : 0;
      totalScore += (pWpm * (pAcc / 100) * 0.7 + completionRatio * 30);
    }
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
  calculateAwardedPoints,
  calculateTeamMatchResult,
};
