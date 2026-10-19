'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, User, TypingPracticeAttempt: Attempt, TypingUserStat: Stat, ScoreLedger } = require('../src/models');
const practice = require('../src/services/typingPractice.service');
const game = require('../src/services/typingGame.service');
const { measureInput } = require('../src/services/typingMetrics');
const sqlDate = (ms) => new Date(ms).toISOString().replace('T', ' ').replace('Z', ' +00:00');

test('Practice attempts verify content/time, reject forged legacy metrics, and settle once', async (t) => {
  const user = await User.create({ name: 'Practice authority fixture', email: `practice-${Date.now()}@audit.test`, passwordHash: 'test', status: 'active', role: 'user' });
  const foreign = await User.create({ name: 'Foreign fixture', email: `foreign-${Date.now()}@audit.test`, passwordHash: 'test', status: 'active', role: 'user' });
  await game.ensureChallengesExist();
  await t.test('legacy arbitrary metrics cannot write stats or rewards', async () => {
    await assert.rejects(() => game.submitPracticeResult({ wpm: 249, accuracy: 100, durationLimitSeconds: 120, elapsedSeconds: 1 }, user), /attemptId/);
    assert.equal(await ScoreLedger.count({ where: { userId: user.id } }), 0);
  });
  const attempt = await practice.create({ durationLimitSeconds: 120 }, user);
  const input = Array.from(attempt.challengeText).slice(0, 100).join('');
  await t.test('owner, revision, and corrections are server checked', async () => {
    await assert.rejects(() => practice.progress(attempt.attemptId, foreign.id, { typedText: input, inputRevision: 1 }), /Không tìm thấy/);
    await practice.progress(attempt.attemptId, user.id, { typedText: input.slice(0, 1), inputRevision: 1 });
    await sequelize.getQueryInterface().bulkUpdate('typing_practice_attempts', { started_at: sqlDate(Date.now() - 5000), updated_at: sqlDate(Date.now() - 5000) }, { id: attempt.attemptId });
    await practice.progress(attempt.attemptId, user.id, { typedText: input, inputRevision: 2, wpm: 9999 });
    await practice.progress(attempt.attemptId, user.id, { typedText: input.slice(0, 60), inputRevision: 3 });
    await practice.progress(attempt.attemptId, user.id, { typedText: '', inputRevision: 1 });
    const row = await Attempt.findByPk(attempt.attemptId);
    assert.equal(row.typedText, input.slice(0, 60));
    assert.equal(row.inputRevision, 3);
  });
  await t.test('fake final duration/WPM/accuracy and concurrent retries cannot award twice', async () => {
    await Attempt.update({ startedAt: new Date(Date.now() - 120100) }, { where: { id: attempt.attemptId } });
    await sequelize.getQueryInterface().bulkUpdate('typing_practice_attempts', { updated_at: sqlDate(Date.now() - 5000) }, { id: attempt.attemptId });
    const fake = { typedText: input, inputRevision: 4, wpm: 9999, accuracy: 1, typedChars: 999999, errorCount: 9999, durationLimitSeconds: 1, elapsedSeconds: 1, score: 9999 };
    const [a, b] = await Promise.all([practice.finish(attempt.attemptId, user.id, fake), practice.finish(attempt.attemptId, user.id, fake)]);
    assert.equal(a.wpm, 10);
    assert.equal(a.accuracy, 100);
    assert.equal(a.recorded, true);
    assert.deepEqual(b, a);
    assert.equal(await ScoreLedger.count({ where: { idempotencyKey: `typing_practice_attempt:${attempt.attemptId}` } }), 1);
    assert.equal((await Stat.findOne({ where: { userId: user.id } })).practiceMatches, 1);
  });
  await t.test('old cached fake record is excluded from verified leaderboard', async () => {
    await Stat.update({ bestWpm: 9999 }, { where: { userId: user.id } });
    const stats = await game.getMyStats(user.id);
    assert.equal(stats.bestWpm, 10);
    assert.equal(stats.hasUnverifiableHistory, true);
    const board = await game.getTypingLeaderboard({ currentUserId: user.id });
    assert.equal(board.myPosition.bestWpm, 10);
    assert.equal(board.verificationStatus, 'VERIFIED_RESULTS_ONLY');
  });
  await t.test('early/zero run cannot score even with a forged duration', async () => {
    const a = await practice.create({ durationLimitSeconds: 120, restart: true }, user);
    const result = await practice.finish(a.attemptId, user.id, { wpm: 250, accuracy: 100, elapsedSeconds: 9999 });
    assert.equal(result.awardedXp, 0);
    assert.equal(result.accuracy, 0);
    assert.equal(result.recorded, false);
  });
  await t.test('IME composition starts an authoritative clock before text commit', async () => {
    const a = await practice.create({ durationLimitSeconds: 30, restart: true }, user);
    const started = await practice.progress(a.attemptId, user.id, { start: true, typedText: '', inputRevision: 0 });
    assert.ok(started.startedAt);
    assert.equal(started.typedText, '');
    assert.equal(started.status, 'ACTIVE');
    const result = await practice.finish(a.attemptId, user.id, { elapsedSeconds: 9999 });
    assert.equal(result.awardedXp, 0);
  });
  await t.test('NFC Vietnamese, emoji, punctuation and repeated spaces use positional correctness', () => {
    const m = measureInput('á😀,  bc', 'a\u0301😀,  bx', 60000);
    assert.equal(m.typedChars, 7);
    assert.equal(m.errorCount, 1);
    assert.equal(m.correctChars, 6);
    assert.equal(m.accuracy, 85.7);
    assert.equal(m.wpm, 1.2);
  });
  await t.test('practice migration can create, re-run and roll back in an isolated database', async () => {
    const S = require('sequelize');
    const db = new S.Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
    const q = db.getQueryInterface();
    const migration = require('../src/migrations/20261019010000-create-typing-practice-attempts');
    try {
      await q.createTable('users', { id: { type: S.BIGINT.UNSIGNED, primaryKey: true } });
      await migration.up(q, S);
      await migration.up(q, S);
      const columns = await q.describeTable('typing_practice_attempts');
      assert.ok(columns.input_revision && columns.started_at && columns.result);
      await migration.down(q);
      await assert.rejects(() => q.describeTable('typing_practice_attempts'));
    } finally { await db.close(); }
  });
});
