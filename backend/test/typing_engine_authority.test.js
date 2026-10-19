'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const typingEngine = require('../src/services/typingEngine');

test('typing metrics and ranking use bounded server-authoritative inputs', async (t) => {
  await t.test('accuracy is zero for empty input and counts only correct retained characters', () => {
    assert.equal(typingEngine.calculateAccuracy(0, 0), 0);
    assert.equal(typingEngine.calculateAccuracy(50, 2), 96);
    assert.equal(typingEngine.calculateAccuracy(50, 50), 0);
  });

  await t.test('WPM never returns NaN or Infinity for hostile numeric inputs', () => {
    for (const [chars, duration] of [
      [Infinity, 1000],
      [100, Infinity],
      [NaN, 1000],
      [-1, 1000],
      [100, -1],
    ]) {
      const result = typingEngine.calculateWPM(chars, duration);
      assert.ok(Number.isFinite(result));
      assert.ok(result >= 0);
    }
  });

  await t.test('client duration cannot override server elapsed time', () => {
    const instant = typingEngine.validateSubmissionPlausibility({ challengeLength: 100, typedChars: 20, durationMs: 1, errorCount: 0 });
    assert.equal(instant.valid, false, 'A one-millisecond server run must not be rounded up into a rewardable result');
    const baseline = typingEngine.validateSubmissionPlausibility({
      challengeLength: 500,
      typedChars: 100,
      durationMs: 60000,
      errorCount: 0,
      maxWpmCap: 1000,
    });
    assert.equal(baseline.wpm, 20);

    const correctedSpeed = typingEngine.validateSubmissionPlausibility({
      challengeLength: 500,
      typedChars: 100,
      durationMs: 60000,
      errorCount: 10,
      maxWpmCap: 1000,
    });
    assert.equal(correctedSpeed.wpm, 18, 'final WPM uses retained correct characters, matching the live metric');

    for (const clientDurationMs of [0, 1, -500, 1000, 1e12]) {
      const result = typingEngine.validateSubmissionPlausibility({
        challengeLength: 500,
        typedChars: 100,
        durationMs: 60000,
        clientDurationMs,
        errorCount: 0,
        maxWpmCap: 1000,
      });
      assert.equal(result.wpm, baseline.wpm, `client duration ${clientDurationMs} must be ignored`);
    }
  });

  await t.test('final ranking prefers validated performance over raw WPM and elapsed time', () => {
    const fastInaccurate = {
      userId: 1,
      eligible: true,
      completed: true,
      performanceScore: typingEngine.computeBasePerformanceScore({
        wpm: 180,
        accuracy: 40,
        errorCount: 60,
        completed: true,
      }),
      accuracy: 40,
      wpm: 180,
      completionTimeMs: 1000,
    };
    const slowerAccurate = {
      userId: 2,
      eligible: true,
      completed: true,
      performanceScore: typingEngine.computeBasePerformanceScore({
        wpm: 95,
        accuracy: 98,
        errorCount: 2,
        completed: true,
      }),
      accuracy: 98,
      wpm: 95,
      completionTimeMs: 10000,
    };

    assert.ok(slowerAccurate.performanceScore > fastInaccurate.performanceScore);
    assert.ok(typingEngine.compareTypingResults(slowerAccurate, fastInaccurate) < 0);
    assert.ok(typingEngine.compareTypingResults({ ...fastInaccurate, eligible: false }, slowerAccurate) > 0);
  });

  await t.test('team scoring does not reinterpret zero accuracy as 100%', () => {
    const result = typingEngine.calculateTeamMatchResult([
      { userId: 1, team: 'A', typedChars: 100, wpm: 180, accuracy: 0, progressPct: 100, performanceScore: 0 },
      { userId: 2, team: 'B', typedChars: 100, wpm: 95, accuracy: 98, progressPct: 100, performanceScore: 130 },
    ]);
    assert.equal(result.winnerTeam, 'B');
  });
});
