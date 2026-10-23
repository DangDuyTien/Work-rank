'use strict';

/**
 * Server-authoritative scoring for Đua Gõ Theo Nhạc.
 *
 * The client sends evidence, never a score. Everything below is derived from
 * three things the server can check by itself:
 *   1. the published song (line texts + durations),
 *   2. the lyric text the player actually typed,
 *   3. the server-measured elapsed time.
 *
 * `pauseCount` is the only number the client contributes, and it is bounded by
 * elapsed time: a 60-second song cannot be "finished" in 70 seconds with zero
 * pauses if the player spent two minutes typing.
 *
 * The formula here must stay identical to `frontend/src/games/music/engine.js`
 * (computeMusicScore / flowPercent); `music_race_engine.test.js` asserts parity.
 */

const { chars, foldCase, normalizeText, measureInput } = require('./typingMetrics');

const MAX_PAUSE_MS = 30000;
const PAUSE_TOLERANCE_MS = 4000;
const MIN_TYPED_CHARS = 20;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value) || 0));
}

function flowPercent(totalLines, pauseCount) {
  const total = Math.max(1, Number(totalLines) || 1);
  const pauses = clamp(pauseCount, 0, total);
  return Math.round(((total - pauses) / total) * 1000) / 10;
}

function computeMusicScore({ accuracy = 0, completedLines = 0, totalLines = 1, flowPct = 0, bestNoPauseStreak = 0 } = {}) {
  const safeAccuracy = clamp(accuracy, 0, 100);
  const total = Math.max(1, Number(totalLines) || 1);
  const completion = clamp(Number(completedLines) / total, 0, 1);
  const flow = clamp(flowPct, 0, 100);
  const streak = Math.max(0, Number(bestNoPauseStreak) || 0);
  const raw = safeAccuracy * 5 + completion * 300 + flow * 4 + streak * 15;
  return Math.round(raw * 6);
}

const linesOf = (song) => (Array.isArray(song?.lines) ? song.lines : []);

const lyricText = (song) => linesOf(song).map((line) => normalizeText(line.text)).join('\n');

/** How many lines are fully and correctly typed, counted from the first line. */
function countCompletedLines(song, typedText) {
  const lines = linesOf(song);
  const segments = String(typedText ?? '').split('\n');
  let completed = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const segment = segments[index];
    if (typeof segment !== 'string') break;
    // Normalise before folding: an NFD keyboard (or a copy from macOS) must
    // compare equal to the NFC lyric, exactly like the client does.
    const typed = normalizeText(segment);
    const target = normalizeText(lines[index].text);
    if (foldCase(typed) !== foldCase(target)) break;
    completed += 1;
  }
  return completed;
}

/** Published songs must be playable: audio, timings, lyrics and rights metadata. */
function validateSongForPublish(song) {
  const errors = [];
  if (!song || typeof song !== 'object') return ['Bài hát không hợp lệ'];
  if (!song.id || !String(song.id).trim()) errors.push('Thiếu id bài hát');
  if (!song.title) errors.push('Thiếu tên bài hát');
  if (!song.audioSource?.url) errors.push('Thiếu audio');
  if (!song.audioSource?.licence) errors.push('Thiếu metadata bản quyền audio');
  if (!song.lyricsSource?.rightsStatus) errors.push('Thiếu metadata bản quyền lời');
  const supported = ['HOSTED_LICENSED', 'ROYALTY_FREE'];
  if (song.audioSource && !supported.includes(song.audioSource.type)) {
    errors.push('Nguồn audio không được hỗ trợ cho chế độ xếp hạng');
  }
  const lines = linesOf(song);
  if (lines.length === 0) {
    errors.push('Bài hát chưa có câu hát');
    return errors;
  }
  if (lines.some((line) => !String(line.text || '').trim())) errors.push('Có câu hát rỗng');
  let previousEnd = -1;
  lines.forEach((line, index) => {
    const start = Number(line.startMs);
    const end = Number(line.endMs);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      errors.push(`Câu ${index + 1} thiếu mốc thời gian`);
      return;
    }
    if (end <= start) errors.push(`Câu ${index + 1} có thời lượng không hợp lệ`);
    if (start < previousEnd - 1) errors.push(`Câu ${index + 1} chồng lên câu trước`);
    previousEnd = end;
  });
  if (Number(song.durationMs) > 0 && previousEnd > Number(song.durationMs) + 500) {
    errors.push('Câu hát vượt quá thời lượng bài');
  }
  return errors;
}

/**
 * @returns {{
 *   valid: boolean, reason: string|null, linesCompleted: number, totalLines: number,
 *   pauseCount: number, flowPct: number, bestNoPauseStreak: number,
 *   accuracy: number, wpm: number, score: number, completed: boolean,
 *   typedChars: number, errorCount: number, elapsedMs: number
 * }}
 */
function evaluateMusicEvidence({ song, typedText, elapsedMs, evidence = {}, durationMs }) {
  const lines = linesOf(song);
  const totalLines = lines.length;
  const safeElapsed = Math.max(0, Number(elapsedMs) || 0);
  const text = String(typedText ?? '');
  const measured = measureInput(lyricText(song), text, Math.max(1000, safeElapsed));
  const linesCompleted = countCompletedLines(song, text);

  // How many stops the clock can prove. Every extra second beyond the song
  // length had to be spent waiting for the player, and a single stop can only
  // explain MAX_PAUSE_MS of it before it becomes a second stop.
  const songDurationMs = Math.max(1000, Number(song?.durationMs) || Number(durationMs) || 1);
  const extraMs = Math.max(0, safeElapsed - songDurationMs);
  const minPauses = Math.ceil(Math.max(0, extraMs - PAUSE_TOLERANCE_MS) / MAX_PAUSE_MS);
  const claimedPauses = Math.max(0, Math.floor(Number(evidence.pauseCount) || 0));
  const pauseCount = Math.min(totalLines, Math.max(claimedPauses, minPauses));

  const claimedStreak = Math.max(0, Math.floor(Number(evidence.bestNoPauseStreak) || 0));
  // A streak is a run of clean boundaries; it can never exceed what was finished,
  // and it must shrink when the clock proves stops the client did not report.
  const bestNoPauseStreak = Math.min(claimedStreak, Math.max(0, linesCompleted - Math.max(0, minPauses)));

  const flowPct = flowPercent(totalLines, pauseCount);
  const accuracy = measured.accuracy;
  const score = computeMusicScore({ accuracy, completedLines: linesCompleted, totalLines, flowPct, bestNoPauseStreak });

  const valid = measured.typedChars >= MIN_TYPED_CHARS && accuracy > 0 && safeElapsed >= 1000;
  const completed = totalLines > 0 && linesCompleted >= totalLines;

  return {
    valid,
    reason: valid ? null : 'Bằng chứng chơi không hợp lệ',
    linesCompleted,
    totalLines,
    pauseCount,
    flowPct,
    bestNoPauseStreak,
    accuracy,
    wpm: measured.wpm,
    score,
    completed,
    typedChars: measured.typedChars,
    errorCount: measured.errorCount,
    elapsedMs: Math.round(safeElapsed),
  };
}

module.exports = {
  MAX_PAUSE_MS,
  PAUSE_TOLERANCE_MS,
  MIN_TYPED_CHARS,
  flowPercent,
  computeMusicScore,
  countCompletedLines,
  validateSongForPublish,
  evaluateMusicEvidence,
  lyricText,
  linesOf,
  chars,
};
