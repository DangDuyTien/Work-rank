'use strict';
const crypto = require('node:crypto');
const { Op } = require('sequelize');
const { TypingPracticeAttempt: Attempt, TypingUserStat: Stat, User, Season, ScoreLedger } = require('../models');
const transaction = require('./typingTransaction');
const { measureInput } = require('./typingMetrics');
const { ValidationError, NotFoundError } = require('../utils/errors');
const durations = [30, 60, 120, 180, 300];
const expose = (a) => ({ attemptId: a.id, status: a.status, durationLimitSeconds: a.durationSeconds, challengeText: a.challengeText, typedText: a.typedText, inputRevision: a.inputRevision, startedAt: a.startedAt, serverNow: new Date(), result: a.result });
async function owned(id, userId, t) {
  const attempt = await Attempt.findOne({ where: { id, userId }, transaction: t, ...(t ? { lock: t.LOCK.UPDATE } : {}) });
  if (!attempt) throw new NotFoundError('Không tìm thấy lượt luyện tập');
  return attempt;
}
async function create(data, user) {
  const duration = Number(data?.durationLimitSeconds ?? 120);
  if (!durations.includes(duration)) throw new ValidationError('Thời lượng luyện tập không hợp lệ');
  const challengeText = await require('./typingGame.service').buildContinuousChallengeText({ durationLimitSeconds: duration });
  return transaction(async (t) => {
    await User.findByPk(user.id, { transaction: t, lock: t.LOCK.UPDATE });
    const old = await Attempt.findOne({ where: { userId: user.id, status: { [Op.in]: ['READY', 'ACTIVE'] } }, order: [['createdAt', 'DESC']], transaction: t });
    if (old && !data?.restart) return expose(old);
    if (old) await Attempt.update({ status: 'ABANDONED' }, { where: { userId: user.id, status: { [Op.in]: ['READY', 'ACTIVE'] } }, transaction: t });
    return expose(await Attempt.create({ id: crypto.randomUUID(), userId: user.id, durationSeconds: duration, challengeText, typedText: '' }, { transaction: t }));
  });
}
async function active(userId) {
  const a = await Attempt.findOne({ where: { userId, status: { [Op.in]: ['READY', 'ACTIVE'] } }, order: [['createdAt', 'DESC']] });
  return a ? expose(a) : null;
}
function acceptInput(a, data) {
  const revision = Number(data?.inputRevision);
  if (typeof data?.typedText !== 'string' || !Number.isSafeInteger(revision) || revision < 0) return;
  if (revision <= a.inputRevision) return;
  if (Array.from(data.typedText).length > Array.from(a.challengeText).length) throw new ValidationError('Nội dung gõ vượt quá bài luyện tập');
  const incoming = data.typedText.normalize('NFC');
  const added = Math.max(0, Array.from(incoming).length - Array.from(a.typedText).length);
  const elapsedSinceSync = a.startedAt ? Math.max(0, Date.now() - new Date(a.updatedAt).getTime()) : 0;
  if (added > 8 + elapsedSinceSync / 25) a.result = { draftInvalidReason: 'Nội dung tăng quá nhanh giữa hai lần đồng bộ (paste/autofill).' };
  a.typedText = incoming;
  a.inputRevision = revision;
}
async function progress(id, userId, data) {
  return transaction(async (t) => {
    const a = await owned(id, userId, t);
    if (!['READY', 'ACTIVE'].includes(a.status)) return expose(a);
    const expired = a.startedAt && Date.now() - new Date(a.startedAt).getTime() >= a.durationSeconds * 1000;
    if (!expired) acceptInput(a, data);
    // IME can compose a whole word before committing text. Start the server
    // clock at composition start too, so that valid composition time counts.
    if (!a.startedAt && (a.typedText || data?.start === true)) { a.startedAt = new Date(); a.status = 'ACTIVE'; }
    await a.save({ transaction: t });
    return expose(a);
  });
}
async function finish(id, userId, data) {
  return transaction(async (t) => {
    const a = await owned(id, userId, t);
    if (a.status === 'FINISHED') return a.result;
    if (a.status === 'ABANDONED') throw new ValidationError('Lượt luyện tập này đã được thay thế');
    const elapsed = a.startedAt ? Math.max(0, Date.now() - new Date(a.startedAt).getTime()) : 0;
    // Final input is accepted only during the run or within a small delivery grace.
    // Later retries use the last persisted draft, not newly supplied text.
    if (elapsed <= a.durationSeconds * 1000 + 3000) acceptInput(a, data);
    const measured = measureInput(a.challengeText, a.typedText, Math.min(elapsed, a.durationSeconds * 1000));
    if (a.result?.draftInvalidReason) { measured.validSubmission = false; measured.eligible = false; measured.wpm = 0; measured.performanceScore = 0; measured.invalidReason = a.result.draftInvalidReason; }
    const recorded = measured.eligible && a.durationSeconds >= 120 && elapsed >= a.durationSeconds * 1000;
    const awardedXp = recorded ? Math.min(40, Math.max(5, Math.round(measured.wpm * measured.accuracy / 100 * (a.durationSeconds / 60) / 10))) : 0;
    const { text: privateText, ...publicMetrics } = measured;
    const finishedAt = new Date();
    const result = { ...publicMetrics, attemptId: a.id, userId, gameType: 'typing_battle', mode: 'SOLO', rank: 1, score: measured.performanceScore,
      startedAt: a.startedAt ? new Date(a.startedAt).toISOString() : null, finishedAt: finishedAt.toISOString(), validatedAt: finishedAt.toISOString(), createdAt: new Date(a.createdAt).toISOString(),
      recorded, awardedXp, reason: recorded ? null : (a.durationSeconds < 120 ? 'DURATION_LESS_THAN_2_MINUTES' : elapsed < a.durationSeconds * 1000 ? 'ATTEMPT_ENDED_EARLY' : 'INVALID_PARTICIPATION'), message: recorded ? 'Máy chủ đã xác minh thành tích luyện tập và ghi nhận một lần.' : 'Bài luyện tập này không đủ điều kiện ghi BXH hoặc nhận XP.' };
    if (recorded) {
      const [stat] = await Stat.findOrCreate({ where: { userId }, defaults: { userId }, transaction: t });
      await stat.reload({ transaction: t, lock: t.LOCK.UPDATE });
      const previous = Number(stat.totalMatches || 0);
      stat.totalMatches = previous + 1;
      stat.practiceMatches = Number(stat.practiceMatches || 0) + 1;
      stat.bestWpm = Math.max(Number(stat.bestWpm || 0), measured.wpm);
      stat.bestAccuracy = Math.max(Number(stat.bestAccuracy || 0), measured.accuracy);
      stat.avgWpm = (Number(stat.avgWpm || 0) * previous + measured.wpm) / stat.totalMatches;
      stat.avgAccuracy = (Number(stat.avgAccuracy || 0) * previous + measured.accuracy) / stat.totalMatches;
      stat.totalCharsTyped = Number(stat.totalCharsTyped || 0) + measured.typedChars;
      stat.totalErrors = Number(stat.totalErrors || 0) + measured.errorCount;
      stat.perfectRunsCount = Number(stat.perfectRunsCount || 0) + (measured.accuracy === 100 ? 1 : 0);
      stat.totalWorkRankPointsEarned = Number(stat.totalWorkRankPointsEarned || 0) + awardedXp;
      stat.lastPlayedAt = new Date();
      const user = await User.findByPk(userId, { transaction: t });
      const season = await Season.findOne({ where: { status: 'ACTIVE' }, order: [['id', 'DESC']], transaction: t });
      await ScoreLedger.create({ idempotencyKey: `typing_practice_attempt:${a.id}`, effectType: 'INDIVIDUAL_XP', pointsDelta: awardedXp, userId, teamId: user.teamId, seasonId: season?.id || null, eventId: crypto.randomUUID(), reason: 'Luyện tập đánh máy đã xác minh', metadata: { ...result, type: 'PRACTICE' } }, { transaction: t });
      await stat.save({ transaction: t });
    }
    a.status = 'FINISHED'; a.finishedAt = finishedAt; a.result = result;
    await a.save({ transaction: t });
    return result;
  });
}
module.exports = { create, active, progress, finish };
