function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateFocusScore(activeSeconds, idleSeconds) {
  const totalSeconds = activeSeconds + idleSeconds;
  if (!totalSeconds) return 0;
  const activeRatio = activeSeconds / totalSeconds;
  const sessionContinuity = activeSeconds >= 3600 ? 1 : activeSeconds / 3600;
  const healthyBreakScore = idleSeconds > 0 && idleSeconds <= activeSeconds * 0.25 ? 1 : 0.6;
  return clampScore(activeRatio * 60 + sessionContinuity * 25 + healthyBreakScore * 15);
}

module.exports = { calculateFocusScore };
