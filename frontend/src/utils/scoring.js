function clampScore(score) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function toSafeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function calculateFocusScore(activeSeconds = 0, idleSeconds = 0) {
  const safeActiveSeconds = Math.max(0, toSafeNumber(activeSeconds));
  const safeIdleSeconds = Math.max(0, toSafeNumber(idleSeconds));
  const totalSeconds = safeActiveSeconds + safeIdleSeconds;
  if (!totalSeconds) return 0;
  const activeRatio = safeActiveSeconds / totalSeconds;
  const sessionContinuity = safeActiveSeconds >= 3600 ? 1 : safeActiveSeconds / 3600;
  const healthyBreakScore = safeIdleSeconds > 0 && safeIdleSeconds <= safeActiveSeconds * 0.25 ? 1 : 0.6;
  return clampScore(activeRatio * 60 + sessionContinuity * 25 + healthyBreakScore * 15);
}

export function calculateRankScore(stats = {}) {
  const activeSeconds = Math.max(0, toSafeNumber(stats.activeSeconds ?? stats.active_seconds ?? stats.total_active_seconds));
  const idleSeconds = Math.max(0, toSafeNumber(stats.idleSeconds ?? stats.idle_seconds ?? stats.total_idle_seconds));
  const keystrokeCount = Math.max(0, toSafeNumber(stats.keystrokeCount ?? stats.keystrokes ?? stats.total_keystrokes));
  const mouseClickCount = Math.max(0, toSafeNumber(stats.mouseClickCount ?? stats.mouse_clicks ?? stats.total_mouse_clicks));
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
