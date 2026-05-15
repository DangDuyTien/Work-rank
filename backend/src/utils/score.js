function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function calculateFocusScore(activeSeconds, idleSeconds) {
  const totalSeconds = activeSeconds + idleSeconds;
  if (!totalSeconds) return 0;
  const activeRatio = activeSeconds / totalSeconds;
  const sessionContinuity = activeSeconds >= 3600 ? 1 : activeSeconds / 3600;
  const healthyBreakScore = idleSeconds > 0 && idleSeconds <= activeSeconds * 0.25 ? 1 : 0.6;
  return clampScore(activeRatio * 60 + sessionContinuity * 25 + healthyBreakScore * 15);
}

function calculateRankScore(stats = {}) {
  const activeSeconds = Math.max(0, toSafeNumber(stats.activeSeconds));
  const idleSeconds = Math.max(0, toSafeNumber(stats.idleSeconds));
  const keystrokeCount = Math.max(0, toSafeNumber(stats.keystrokeCount));
  const mouseClickCount = Math.max(0, toSafeNumber(stats.mouseClickCount));
  const actionCount = keystrokeCount + mouseClickCount;

  if (!activeSeconds && !idleSeconds && !actionCount) return 0;

  const providedFocusScore = stats.focusScore ?? stats.focus_score;
  const focusScore = providedFocusScore === undefined
    ? calculateFocusScore(activeSeconds, idleSeconds)
    : clampScore(toSafeNumber(providedFocusScore));
  const activeMinutes = activeSeconds / 60;
  const actionScore = Math.round(actionCount);
  const activeTimeScore = Math.round(Math.min(300, activeMinutes * 2));
  const focusBonus = Math.round(focusScore * 0.5);

  return Math.max(0, actionScore + activeTimeScore + focusBonus);
}

module.exports = { calculateFocusScore, calculateRankScore };
