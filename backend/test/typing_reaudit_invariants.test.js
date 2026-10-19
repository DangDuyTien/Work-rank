'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const game = require('../src/services/typingGame.service');
const engine = require('../src/services/typingEngine');
const { User, TypingRoom, TypingPlayer, TypingMatchResult, ScoreLedger } = require('../src/models');

test('Typing re-audit: deadlines, rematches, team participation and ranking ties', async (t) => {
  const user = await User.create({ name: 'Typing invariants', email: `typing-invariants-${Date.now()}@audit.test`, passwordHash: 'test', status: 'active', role: 'user' });
  const detail = await game.createRoom({ mode: 'SOLO', durationLimitSeconds: 30, matchType: 'RANKED' }, user);
  const roomId = detail.room.id;
  await game.startMatch(roomId, user.id);
  await TypingRoom.update({ startedAt: new Date(Date.now() - 20000) }, { where: { id: roomId } });
  const prefix = Array.from(detail.room.challengeText).slice(0, 80).join('');
  await game.updateProgress(roomId, user.id, { typedText: prefix, inputRevision: 1 });
  await t.test('deadline rejects newly supplied progress and late finish content', async () => {
    await TypingRoom.update({ startedAt: new Date(Date.now() - 35000) }, { where: { id: roomId } });
    await game.updateProgress(roomId, user.id, { typedText: prefix + prefix, inputRevision: 2 });
    assert.equal((await TypingPlayer.findOne({ where: { roomId } })).typedChars, 80);
    const result = await game.submitFinish(roomId, user.id, { typedText: prefix + prefix, inputRevision: 3, clientDurationMs: 1 });
    assert.equal(result.result.results[0].typedChars, 80);
    assert.equal(result.result.results[0].wpm, 32);
    assert.equal(result.result.results[0].individualRank, 1);
  });
  await t.test('a new run in the same room has its own immutable result and reward key', async () => {
    await game.resetRoom(roomId, user.id);
    const reset = await game.getRoomDetail(roomId, user.id);
    assert.equal(reset.result, null);
    await game.startMatch(roomId, user.id);
    await TypingRoom.update({ startedAt: new Date(Date.now() - 21000) }, { where: { id: roomId } });
    const next = Array.from(reset.room.challengeText).slice(0, 80).join('');
    await game.submitFinish(roomId, user.id, { typedText: next, inputRevision: 1 });
    assert.equal(await TypingMatchResult.count({ where: { roomId } }), 2);
    assert.equal(await ScoreLedger.count({ where: { userId: user.id } }), 2);
    await game.submitFinish(roomId, user.id, { typedText: next, inputRevision: 1 });
    assert.equal(await ScoreLedger.count({ where: { userId: user.id } }), 2);
  });
  await t.test('AFK team members contribute zero instead of increasing the team average', () => {
    const result = engine.calculateTeamMatchResult([
      { team: 'A', typedChars: 100, performanceScore: 100 }, { team: 'A', typedChars: 0, performanceScore: 0 },
      { team: 'B', typedChars: 100, performanceScore: 70 }, { team: 'B', typedChars: 100, performanceScore: 70 },
    ]);
    assert.equal(result.teamAScore, 50); assert.equal(result.teamBScore, 70); assert.equal(result.winnerTeam, 'B');
  });
  await t.test('ties have stable server identity order and invalid participants never outrank eligible users', () => {
    const p = { eligible: true, completed: false, performanceScore: 100, accuracy: 99, wpm: 80, completionTimeMs: 30000 };
    assert.ok(engine.compareTypingResults({ ...p, userId: 1 }, { ...p, userId: 2 }) < 0);
    assert.ok(engine.compareTypingResults({ ...p, userId: 1, eligible: false, wpm: 9999 }, { ...p, userId: 2 }) > 0);
  });
});
