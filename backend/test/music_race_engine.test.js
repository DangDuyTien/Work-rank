'use strict';

/**
 * Đua Gõ Theo Nhạc — server scoring authority.
 *
 * These tests are the contract the client cannot talk its way out of:
 * the score is recomputed from typed lyrics + the server clock, and a client
 * that claims "zero pauses" on a run that took three times the song length is
 * still scored as a stopped run.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');

const scoring = require('../src/services/musicScoring');

const SONG = {
  id: 'test-song',
  durationMs: 12000,
  lines: [
    { id: 'l1', startMs: 0, endMs: 4000, text: 'Ngày hôm nay trời xanh' },
    { id: 'l2', startMs: 4000, endMs: 8000, text: 'Gió nhẹ qua hàng cây' },
    { id: 'l3', startMs: 8000, endMs: 12000, text: 'Ta đi trên phố dài' },
  ],
};

const fullText = SONG.lines.map((line) => line.text).join('\n');

test('counts only fully typed lines, in order, and never skips ahead', () => {
  assert.equal(scoring.countCompletedLines(SONG, ''), 0);
  assert.equal(scoring.countCompletedLines(SONG, 'Ngày hôm nay'), 0);
  assert.equal(scoring.countCompletedLines(SONG, `Ngày hôm nay trời xanh\nGió nhẹ`), 1);
  assert.equal(scoring.countCompletedLines(SONG, fullText), 3);
  // A skipped line stops the count even if the following text is right.
  assert.equal(scoring.countCompletedLines(SONG, `Ngày hôm nay trời xanh\nTa đi trên phố dài`), 1);
});

test('Vietnamese comparison is case-insensitive but accent-sensitive', () => {
  assert.equal(scoring.countCompletedLines(SONG, 'NGÀY HÔM NAY TRỜI XANH'), 1);
  assert.equal(scoring.countCompletedLines(SONG, 'Ngay hom nay troi xanh'), 0);
  assert.equal(scoring.countCompletedLines(SONG, 'Ngày hôm nay trời xanh'.normalize('NFD')), 1);
});

test('a clean full run scores 100% flow with no pauses', () => {
  const result = scoring.evaluateMusicEvidence({ song: SONG, typedText: fullText, elapsedMs: 12200, evidence: { pauseCount: 0, bestNoPauseStreak: 3 } });
  assert.equal(result.valid, true);
  assert.equal(result.linesCompleted, 3);
  assert.equal(result.pauseCount, 0);
  assert.equal(result.flowPct, 100);
  assert.equal(result.accuracy, 100);
  assert.ok(result.score > 0);
  assert.equal(result.completed, true);
});

test('a client that claims zero pauses cannot hide a run that took three songs', () => {
  const honest = scoring.evaluateMusicEvidence({ song: SONG, typedText: fullText, elapsedMs: 12200, evidence: { pauseCount: 0 } });
  const cheating = scoring.evaluateMusicEvidence({ song: SONG, typedText: fullText, elapsedMs: 62000, evidence: { pauseCount: 0 } });
  assert.equal(cheating.pauseCount, 2, 'extra wall-clock time is converted into provable stops');
  assert.ok(cheating.flowPct < honest.flowPct);
  assert.ok(cheating.score < honest.score);
});

test('reported pauses are capped by the number of boundaries', () => {
  const result = scoring.evaluateMusicEvidence({ song: SONG, typedText: fullText, elapsedMs: 13000, evidence: { pauseCount: 99 } });
  assert.equal(result.pauseCount, 3);
  assert.equal(result.flowPct, 0);
});

test('best streak is bounded by what was actually finished', () => {
  const result = scoring.evaluateMusicEvidence({ song: SONG, typedText: fullText, elapsedMs: 12200, evidence: { pauseCount: 0, bestNoPauseStreak: 50 } });
  assert.equal(result.bestNoPauseStreak, 3);
});

test('partial runs stay valid but never complete', () => {
  const partial = `${SONG.lines[0].text}\n${SONG.lines[1].text.slice(0, 6)}`;
  const result = scoring.evaluateMusicEvidence({ song: SONG, typedText: partial, elapsedMs: 9000, evidence: { pauseCount: 1 } });
  assert.equal(result.valid, true);
  assert.equal(result.linesCompleted, 1);
  assert.equal(result.completed, false);
  assert.ok(result.flowPct < 100);
});

test('an empty submission is invalid, not a zero score that still ranks', () => {
  const result = scoring.evaluateMusicEvidence({ song: SONG, typedText: '', elapsedMs: 12000, evidence: {} });
  assert.equal(result.valid, false);
  assert.equal(result.linesCompleted, 0);
});

test('publishing is blocked without audio, timings or rights metadata', () => {
  assert.ok(scoring.validateSongForPublish({ id: 'x', title: 'X' }).length >= 3);
  const broken = {
    ...SONG,
    title: 'Test',
    audioSource: { url: '/a.mp3', type: 'YOUTUBE_EMBED', licence: 'x' },
    lyricsSource: { rightsStatus: 'OWNED' },
    lines: [
      { startMs: 0, endMs: 4000, text: 'a' },
      { startMs: 3000, endMs: 5000, text: 'b' },
    ],
  };
  const errors = scoring.validateSongForPublish(broken);
  assert.ok(errors.some((error) => error.includes('không được hỗ trợ')));
  assert.ok(errors.some((error) => error.includes('chồng lên câu trước')));
  assert.equal(scoring.validateSongForPublish({ ...SONG, title: 'Test', audioSource: { url: '/a.mp3', type: 'HOSTED_LICENSED', licence: 'own' }, lyricsSource: { rightsStatus: 'OWNED' } }).length, 0);
});

test('client and server compute the exact same score and flow', async () => {
  const client = await import('../../frontend/src/games/music/engine.js');
  for (const accuracy of [0, 42.5, 77.7, 98.2, 100]) {
    for (const totalLines of [1, 3, 12, 14]) {
      for (const completedLines of [0, 1, Math.floor(totalLines / 2), totalLines]) {
        for (const pauseCount of [0, 1, 2, totalLines]) {
          const flowPct = client.flowPercent(totalLines, pauseCount);
          const expected = client.computeMusicScore({ accuracy, completedLines, totalLines, flowPct, bestNoPauseStreak: 4 });
          const actual = scoring.computeMusicScore({ accuracy, completedLines, totalLines, flowPct, bestNoPauseStreak: 4 });
          assert.equal(actual, expected, `score mismatch at ${accuracy}/${completedLines}/${totalLines}/${pauseCount}`);
          assert.equal(scoring.flowPercent(totalLines, pauseCount), flowPct, 'flow mismatch');
        }
      }
    }
  }
});
