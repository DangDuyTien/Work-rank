'use strict';
const { TypingMatchResult, TypingPracticeAttempt } = require('../models');
const { compareTypingResults } = require('./typingEngine');
const { METRIC_VERSION } = require('./typingMetrics');
async function verifiedRecords() {
  const [matches, practices] = await Promise.all([
    TypingMatchResult.findAll({ attributes: ['results'] }),
    TypingPracticeAttempt.findAll({ where: { status: 'FINISHED' }, attributes: ['userId', 'result'] }),
  ]);
  const records = matches.flatMap((m) => Array.isArray(m.results) ? m.results : [])
    .concat(practices.filter((a) => a.result?.recorded).map((a) => ({ ...a.result, userId: a.userId })));
  const byUser = new Map();
  for (const r of records) {
    // Music runs are ranked on flow-weighted score in their own leaderboard;
    // letting them into the WPM board would compare two different games.
    if (r.songId || r.music) continue;
    if (Number(r.metricVersion) !== METRIC_VERSION || !r.eligible || !r.validSubmission || !Number.isFinite(r.wpm)) continue;
    const id = Number(r.userId);
    const current = byUser.get(id) || { bestWpm: 0, bestAccuracy: 0, count: 0, best: null };
    current.bestWpm = Math.max(current.bestWpm, r.wpm);
    current.bestAccuracy = Math.max(current.bestAccuracy, r.accuracy);
    current.count++;
    if (!current.best || compareTypingResults(r, current.best) < 0) current.best = { ...r, userId: id };
    byUser.set(id, current);
  }
  return byUser;
}
module.exports = verifiedRecords;
