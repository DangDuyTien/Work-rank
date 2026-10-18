const OFFSET = 7 * 60 * 60 * 1000;

function localDayStart(now = new Date()) {
  const local = new Date(now.getTime() + OFFSET);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - OFFSET);
}

function weekBounds(now = new Date()) {
  const local = new Date(now.getTime() + OFFSET);
  const day = (local.getUTCDay() + 6) % 7;
  const start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - day) - OFFSET);
  return { start, end: new Date(start.getTime() + 7 * 86400000) };
}

function rangeBounds(range, now = new Date()) {
  const normalized = range === 'daily' ? 'today' : range === 'weekly' ? 'week' : range;
  if (normalized === 'week') return weekBounds(now);

  const local = new Date(now.getTime() + OFFSET);
  let start;
  if (normalized === 'month') {
    start = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - OFFSET);
  } else if (normalized === 'year') {
    start = new Date(Date.UTC(local.getUTCFullYear(), 0, 1) - OFFSET);
  } else {
    start = localDayStart(now);
  }
  const nextLocal = new Date(start.getTime() + OFFSET);
  if (normalized === 'month') {
    return { start, end: new Date(Date.UTC(nextLocal.getUTCFullYear(), nextLocal.getUTCMonth() + 1, 1) - OFFSET) };
  }
  if (normalized === 'year') {
    return { start, end: new Date(Date.UTC(nextLocal.getUTCFullYear() + 1, 0, 1) - OFFSET) };
  }
  return { start, end: new Date(start.getTime() + 86400000) };
}

function scoreHistory(entries) {
  let score = 0;
  let reachedAt = Infinity;
  for (const entry of entries) {
    const delta = Number(entry.pointsDelta || 0);
    if (!delta) continue;
    score += delta;
    reachedAt = new Date(entry.createdAt).getTime();
  }
  return { score, reachedAt };
}

function compareWeekly(a, b) {
  return b.score - a.score || b.mvpCount - a.mvpCount
    || (a.reachedAt === b.reachedAt ? 0 : a.reachedAt - b.reachedAt)
    || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    || Number(a.userId) - Number(b.userId);
}

module.exports = { weekBounds, rangeBounds, scoreHistory, compareWeekly };
