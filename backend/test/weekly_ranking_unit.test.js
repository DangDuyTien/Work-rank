const { test } = require('node:test');
const assert = require('node:assert/strict');
const { weekBounds, rangeBounds, scoreHistory, compareWeekly } = require('../src/services/ranking/weeklyRanking');

test('week starts on Monday midnight in Vietnam, including Sunday UTC', () => {
  assert.equal(weekBounds(new Date('2026-10-04T18:00:00Z')).start.toISOString(), '2026-10-04T17:00:00.000Z');
  assert.equal(weekBounds(new Date('2026-10-04T16:59:59Z')).end.toISOString(), '2026-10-04T17:00:00.000Z');
});
test('date ranges use Vietnam-local calendar boundaries', () => {
  const now = new Date('2026-10-18T02:00:00Z');
  assert.deepEqual(rangeBounds('today', now), {
    start: new Date('2026-10-17T17:00:00Z'), end: new Date('2026-10-18T17:00:00Z'),
  });
  assert.deepEqual(rangeBounds('month', now), {
    start: new Date('2026-09-30T17:00:00Z'), end: new Date('2026-10-31T17:00:00Z'),
  });
});

test('weekly ranking applies deterministic tie-breakers', () => {
  const base = { score: 10, mvpCount: 0, reachedAt: 100, createdAt: '2026-01-01', userId: 1 };
  assert.ok(compareWeekly({ ...base, score: 20 }, { ...base, mvpCount: 2 }) < 0);
  assert.ok(compareWeekly({ ...base, mvpCount: 1 }, base) < 0);
  assert.ok(compareWeekly(base, { ...base, reachedAt: 200 }) < 0);
  assert.ok(compareWeekly({ ...base, score: 0, reachedAt: Infinity }, { ...base, score: 0, reachedAt: Infinity, createdAt: '2026-02-01' }) < 0);
});
test('reversals reset achievement time; zero deltas do not', () => {
  const result = scoreHistory([
    { pointsDelta: 10, createdAt: '2026-10-05T01:00:00Z' },
    { pointsDelta: 5, createdAt: '2026-10-05T02:00:00Z' },
    { pointsDelta: -5, createdAt: '2026-10-05T03:00:00Z' },
    { pointsDelta: 0, createdAt: '2026-10-05T04:00:00Z' },
  ]);
  assert.equal(result.score, 10);
  assert.equal(result.reachedAt, Date.parse('2026-10-05T03:00:00Z'));
});
