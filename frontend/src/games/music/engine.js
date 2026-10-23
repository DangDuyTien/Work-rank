/**
 * Đua Gõ Theo Nhạc — gameplay engine.
 *
 * The whole game is one rule:
 *
 *   a wrong character never cuts the music.
 *   the music only ever stops on a line boundary, and only when that line
 *   is not finished yet.
 *
 * Everything else (karaoke highlight, streak, flow score, 2D scene) reads from
 * this state machine. It has no React, no DOM and no timers of its own: the
 * host drives `tick(audioTimeMs)` from a rAF loop and calls `applyInput()` from
 * the native input event. That keeps the boundary gate testable with a fake
 * clock and keeps keystrokes off the audio clock.
 */

import { createTypingSession } from '../../utils/typingSession.js';
import { graphemes } from '../../utils/typingText.js';

export const AUDIO_STATE = Object.freeze({
  PREPARING: 'PREPARING',
  PLAYING_LINE: 'PLAYING_LINE',
  LINE_READY: 'LINE_READY',
  WAITING_AT_BOUNDARY: 'WAITING_AT_BOUNDARY',
  RESUMING: 'RESUMING',
  FINISHED: 'FINISHED',
});

export const LINE_STATE = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  WAITING_CORRECTION: 'WAITING_CORRECTION',
});

/** How far the audio may overshoot a boundary before we still snap back to it. */
export const BOUNDARY_SNAP_MS = 320;
/** Minimum audible gap between two boundary pauses at the same line. */
export const RESUME_SETTLE_MS = 180;
/** A publish cadence that keeps meters alive without re-rendering at 60fps. */
const TIME_PUBLISH_MS = 90;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * Deterministic score. The server recomputes this from values it derives
 * itself, so every term must be a function of measurable facts:
 * accuracy, completed lines, flow and the best clean streak.
 */
export function computeMusicScore({ accuracy = 0, completedLines = 0, totalLines = 1, flowPct = 0, bestNoPauseStreak = 0 } = {}) {
  const safeAccuracy = clamp(Number(accuracy) || 0, 0, 100);
  const total = Math.max(1, Number(totalLines) || 1);
  const completion = clamp((Number(completedLines) || 0) / total, 0, 1);
  const flow = clamp(Number(flowPct) || 0, 0, 100);
  const streak = Math.max(0, Number(bestNoPauseStreak) || 0);
  const raw = safeAccuracy * 5 + completion * 300 + flow * 4 + streak * 15;
  return Math.round(raw * 6);
}

export function flowPercent(totalLines, pauseCount) {
  const total = Math.max(1, Number(totalLines) || 1);
  const pauses = clamp(Number(pauseCount) || 0, 0, total);
  return Math.round(((total - pauses) / total) * 1000) / 10;
}

function emptyLineStats(count) {
  return Array.from({ length: count }, () => ({ typedChars: 0, errorCount: 0, completed: false, completedAtMs: null, paused: false }));
}

/**
 * @param {object} options
 * @param {object} options.song      Normalised song ({ lines: [{ id, startMs, endMs, text }] })
 * @param {object} options.adapter   MusicPlaybackAdapter
 * @param {(event: object) => void} [options.onEvent]  Game-feel hooks (line complete, pause, resume…)
 */
export function createMusicRaceEngine({ song, adapter, onEvent = () => {}, resumeSettleMs = RESUME_SETTLE_MS }) {
  if (!song || !Array.isArray(song.lines) || song.lines.length === 0) {
    throw new Error('createMusicRaceEngine: song.lines is required');
  }

  const lines = song.lines.map((line, index) => ({
    index,
    id: line.id || `l${index + 1}`,
    startMs: Number(line.startMs) || 0,
    endMs: Number(line.endMs) || 0,
    text: String(line.text ?? '').normalize('NFC'),
    chars: graphemes(String(line.text ?? '')),
  }));

  const totalLines = lines.length;
  const sessions = lines.map((line) => createTypingSession(line.text));

  let state = AUDIO_STATE.PREPARING;
  let lineIndex = 0;
  let lineStates = lines.map(() => LINE_STATE.NOT_STARTED);
  let lineStats = emptyLineStats(totalLines);
  let pauseCount = 0;
  let noPauseStreak = 0;
  let bestNoPauseStreak = 0;
  let pauses = [];
  let startedAtMs = null;
  let finishedAtMs = null;
  let resumeAt = null;
  let lastPublishAt = 0;
  let bufferingMs = 0;
  let bufferingSince = null;
  let linesExhausted = false;
  let pauseStartedAtWall = null;
  let loaded = false;
  let disposed = false;

  const listeners = new Set();
  let snapshot = null;

  // ── Snapshot ──────────────────────────────────────────────────────────────
  function totals() {
    let typedChars = 0;
    let errorCount = 0;
    let completedLines = 0;
    for (let i = 0; i < totalLines; i += 1) {
      const stat = lineStats[i];
      typedChars += stat.typedChars;
      errorCount += stat.errorCount;
      if (stat.completed) completedLines += 1;
    }
    const correctChars = Math.max(0, typedChars - errorCount);
    const accuracy = typedChars > 0 ? Math.round((correctChars / typedChars) * 1000) / 10 : 0;
    const flowPct = flowPercent(totalLines, pauseCount);
    const elapsedMs = startedAtMs ? Math.max(0, (finishedAtMs || Date.now()) - startedAtMs) : 0;
    const wpm = elapsedMs > 600 ? Math.round((correctChars / 5) / (elapsedMs / 60000) * 10) / 10 : 0;
    return {
      typedChars,
      correctChars,
      errorCount,
      accuracy,
      completedLines,
      flowPct,
      wpm,
      score: computeMusicScore({ accuracy, completedLines, totalLines, flowPct, bestNoPauseStreak }),
    };
  }

  function buildSnapshot() {
    const active = lines[lineIndex] || lines[totalLines - 1];
    const audioMs = Math.max(0, Number(adapter.getCurrentTime?.() || 0));
    const lineProgress = active && active.endMs > active.startMs
      ? clamp((audioMs - active.startMs) / (active.endMs - active.startMs), 0, 1)
      : 0;
    const currentSession = sessions[lineIndex];
    const typedChars = currentSession ? currentSession.getSnapshot().charCount : 0;
    const expectedChars = Math.round(lineProgress * (active?.chars.length || 0));
    const aggregate = totals();
    return {
      state,
      songId: song.id,
      lineIndex,
      line: active ? { id: active.id, index: active.index, startMs: active.startMs, endMs: active.endMs, text: active.text, charCount: active.chars.length } : null,
      lineState: lineStates[lineIndex] || LINE_STATE.NOT_STARTED,
      lineStates: lineStates.slice(),
      lineProgress,
      audioMs,
      expectedChars,
      typedChars,
      typedValue: currentSession ? currentSession.getDisplayValue() : '',
      behindChars: typedChars - expectedChars,
      ...aggregate,
      totalLines,
      pauseCount,
      noPauseStreak,
      bestNoPauseStreak,
      pauses: pauses.slice(),
      buffering: Boolean(adapter.isBuffering?.()),
      bufferingMs,
      elapsedMs: startedAtMs ? Math.max(0, (finishedAtMs || Date.now()) - startedAtMs) : 0,
      ready: state !== AUDIO_STATE.PREPARING,
      finished: state === AUDIO_STATE.FINISHED,
    };
  }

  function publish({ force = false } = {}) {
    if (disposed) return;
    const now = Date.now();
    if (!force && now - lastPublishAt < TIME_PUBLISH_MS) return;
    lastPublishAt = now;
    snapshot = buildSnapshot();
    listeners.forEach((fn) => {
      try { fn(snapshot); } catch { /* a broken subscriber must not stop the game */ }
    });
  }

  function emit(type, payload = {}) {
    try { onEvent({ type, ...payload }); } catch { /* game feel is never load-bearing */ }
  }

  // ── Line lifecycle ────────────────────────────────────────────────────────
  function activateLine(index) {
    lineIndex = index;
    if (lineStates[index] === LINE_STATE.NOT_STARTED) lineStates[index] = LINE_STATE.ACTIVE;
    sessions[index].reset('');
    publish({ force: true });
  }

  function completeLine(index, atMs) {
    if (lineStats[index].completed) return false;
    const stat = sessions[index].getSnapshot();
    lineStats[index] = {
      ...lineStats[index],
      typedChars: stat.charCount,
      errorCount: stat.errorCount,
      completed: true,
      completedAtMs: atMs,
    };
    lineStates[index] = LINE_STATE.COMPLETED;
    return true;
  }

  /** Moves the playhead to the next line. Audio state is the caller's job. */
  function advanceLine() {
    if (lineIndex >= totalLines - 1) {
      // Last line finished: the outro plays out untouched and the audio
      // `ended` event closes the run.
      linesExhausted = true;
      noPauseStreak += 1;
      bestNoPauseStreak = Math.max(bestNoPauseStreak, noPauseStreak);
      emit('song:lines-complete', { atMs: lines[lineIndex].endMs });
      return;
    }
    noPauseStreak += 1;
    bestNoPauseStreak = Math.max(bestNoPauseStreak, noPauseStreak);
    activateLine(lineIndex + 1);
    emit('line:advance', { index: lineIndex });
  }

  function pauseAtBoundary(atMs, reason = 'BOUNDARY') {
    const line = lines[lineIndex];
    adapter.pause();
    // Snap to the musical boundary when the loop overshot by a frame or two:
    // the next line must start exactly where the previous one ended.
    const drift = atMs - line.endMs;
    if (drift > 0 && drift <= BOUNDARY_SNAP_MS) {
      try { adapter.seek(line.endMs); } catch { /* adapter without seek still pauses */ }
    }
    lineStates[lineIndex] = LINE_STATE.WAITING_CORRECTION;
    lineStats[lineIndex].paused = true;
    pauseCount += 1;
    noPauseStreak = 0;
    pauseStartedAtWall = Date.now();
    pauses.push({ lineIndex, atMs: Math.round(atMs), durationMs: null, reason, startedAtWall: pauseStartedAtWall });
    state = AUDIO_STATE.WAITING_AT_BOUNDARY;
    emit('boundary:pause', { index: lineIndex, atMs });
    publish({ force: true });
  }

  function resumeFromBoundary(atMs) {
    if (state !== AUDIO_STATE.WAITING_AT_BOUNDARY) return false;
    // Exactly-once: the transition is the guard. Input, compositionend, a
    // React effect and a socket update can all land in the same tick — only the
    // first one observes WAITING_AT_BOUNDARY and is allowed to call play().
    state = AUDIO_STATE.RESUMING;
    resumeAt = Date.now();
    const openPause = pauses[pauses.length - 1];
    if (openPause && openPause.durationMs === null) {
      openPause.durationMs = Math.max(0, Date.now() - (openPause.startedAtWall || Date.now()));
    }
    pauseStartedAtWall = null;
    try {
      adapter.play();
    } catch {
      // A blocked play() (autoplay policy) leaves the run paused; the UI keeps
      // showing the boundary prompt and the next user gesture retries.
      state = AUDIO_STATE.WAITING_AT_BOUNDARY;
      publish({ force: true });
      return false;
    }
    advanceLine();
    emit('boundary:resume', { index: lineIndex, atMs });
    publish({ force: true });
    return true;
  }

  function finish(reason = 'SONG_END') {
    if (state === AUDIO_STATE.FINISHED) return;
    const openPause = pauses[pauses.length - 1];
    if (openPause && openPause.durationMs === null) {
      openPause.durationMs = Math.max(0, Date.now() - (openPause.startedAtWall || Date.now()));
      pauseStartedAtWall = null;
    }
    finishedAtMs = Date.now();
    state = AUDIO_STATE.FINISHED;
    emit('song:finished', { reason, ...totals() });
    publish({ force: true });
  }

  // ── Public API ────────────────────────────────────────────────────────────
  async function prepare() {
    state = AUDIO_STATE.PREPARING;
    loaded = false;
    lineIndex = 0;
    lineStates = lines.map(() => LINE_STATE.NOT_STARTED);
    lineStats = emptyLineStats(totalLines);
    pauseCount = 0;
    noPauseStreak = 0;
    bestNoPauseStreak = 0;
    pauses = [];
    startedAtMs = null;
    finishedAtMs = null;
    linesExhausted = false;
    pauseStartedAtWall = null;
    bufferingMs = 0;
    bufferingSince = null;
    await adapter.load();
    loaded = true;
    publish({ force: true });
  }

  /** Must be called from a real user gesture — never from an effect. */
  function start() {
    // The audio-ready gate: never start a race on a file that is still loading.
    if (state !== AUDIO_STATE.PREPARING || !loaded) return false;
    startedAtMs = Date.now();
    lineIndex = 0;
    linesExhausted = false;
    lineStates = lines.map((_, i) => (i === 0 ? LINE_STATE.ACTIVE : LINE_STATE.NOT_STARTED));
    sessions[0].reset('');
    state = AUDIO_STATE.PLAYING_LINE;
    adapter.seek(0);
    const playback = adapter.play();
    if (playback && typeof playback.catch === 'function') {
      // Autoplay policy or a dead source: fall back to PREPARING so the UI can
      // ask for another gesture instead of pretending the song is running.
      playback.catch(() => {
        if (state !== AUDIO_STATE.PLAYING_LINE) return;
        state = AUDIO_STATE.PREPARING;
        startedAtMs = null;
        publish({ force: true });
      });
    }
    emit('song:start', {});
    publish({ force: true });
    return true;
  }

  /**
   * Boundary gate. Called from rAF with the adapter's own clock.
   * Returns the state after the gate so tests can assert transitions.
   */
  function tick(audioMsOverride) {
    if (disposed) return state;
    if (state === AUDIO_STATE.PREPARING || state === AUDIO_STATE.FINISHED) return state;

    const buffering = Boolean(adapter.isBuffering?.());
    if (buffering && bufferingSince === null) bufferingSince = Date.now();
    if (!buffering && bufferingSince !== null) {
      bufferingMs += Date.now() - bufferingSince;
      bufferingSince = null;
    }
    // Network buffering is not the player's fault: freeze the gate instead of
    // scoring a boundary the player never had a chance to reach.
    if (buffering) {
      publish();
      return state;
    }

    if (state === AUDIO_STATE.RESUMING) {
      if (Date.now() - resumeAt >= resumeSettleMs) {
        state = AUDIO_STATE.PLAYING_LINE;
        publish({ force: true });
      }
      return state;
    }

    if (state === AUDIO_STATE.WAITING_AT_BOUNDARY) {
      publish();
      return state;
    }

    const audioMs = Number.isFinite(Number(audioMsOverride))
      ? Number(audioMsOverride)
      : Math.max(0, Number(adapter.getCurrentTime?.() || 0));

    if (adapter.hasEnded?.()) {
      finish('SONG_END');
      return state;
    }

    if (linesExhausted) {
      publish();
      return state;
    }

    const line = lines[lineIndex];
    if (!line) return state;

    if (audioMs >= line.endMs) {
      const session = sessions[lineIndex];
      const snap = session.getSnapshot();
      const lineComplete = snap.charCount === line.chars.length && snap.errorCount === 0;
      if (lineComplete) {
        completeLine(lineIndex, line.endMs);
        advanceLine();
        if (state !== AUDIO_STATE.RESUMING) state = AUDIO_STATE.PLAYING_LINE;
      } else {
        pauseAtBoundary(audioMs, 'BOUNDARY');
      }
      publish({ force: true });
      return state;
    }

    // Still inside the line: keep the live progress fresh at a human cadence.
    publish();
    return state;
  }

  /**
   * Native input → NFC → compare. Never called with `event.key`.
   * Returns { completedLine, resumed } so the UI can play the right feedback.
   */
  function applyInput(rawValue, { composing = false } = {}) {
    if (state !== AUDIO_STATE.PLAYING_LINE && state !== AUDIO_STATE.WAITING_AT_BOUNDARY && state !== AUDIO_STATE.LINE_READY) {
      return { accepted: false, completedLine: false, resumed: false };
    }
    const line = lines[lineIndex];
    const session = sessions[lineIndex];
    const snap = session.applyValue(rawValue, { composing });
    if (snap.composing) {
      publish({ force: true });
      return { accepted: true, composing: true, completedLine: false, resumed: false };
    }

    lineStats[lineIndex].typedChars = snap.charCount;
    lineStats[lineIndex].errorCount = snap.errorCount;

    const lineComplete = snap.charCount === line.chars.length && snap.errorCount === 0;
    let completedLine = false;
    let resumed = false;

    if (!lineComplete && lineStats[lineIndex].completed) {
      // The player deleted back into the line after it was already complete.
      // The boundary must be re-earned, so the line returns to active.
      lineStats[lineIndex].completed = false;
      lineStates[lineIndex] = LINE_STATE.ACTIVE;
      if (state === AUDIO_STATE.LINE_READY) state = AUDIO_STATE.PLAYING_LINE;
    }

    if (lineComplete && !lineStats[lineIndex].completed) {
      const atBoundary = state === AUDIO_STATE.WAITING_AT_BOUNDARY;
      completeLine(lineIndex, atBoundary ? line.endMs : null);
      completedLine = true;
      if (atBoundary) {
        resumed = resumeFromBoundary(line.endMs);
      } else {
        state = AUDIO_STATE.LINE_READY;
        emit('line:ready', { index: lineIndex });
      }
    }

    publish({ force: true });
    return { accepted: true, completedLine, resumed, snapshot };
  }

  /**
   * Pause the run when the tab/window loses the player.
   *
   * Counted as a stop (fair: you cannot play a song you are not watching).
   * If the current line is already finished, the playhead is moved to the next
   * line first — otherwise the run would come back with a completed line sitting
   * in WAITING_CORRECTION and no way to resume it.
   */
  function pauseForVisibility() {
    if (state !== AUDIO_STATE.PLAYING_LINE && state !== AUDIO_STATE.LINE_READY) return false;
    const line = lines[lineIndex];
    const snap = sessions[lineIndex].getSnapshot();
    const lineComplete = snap.charCount === line.chars.length && snap.errorCount === 0;

    if (lineComplete) {
      // Last line: only the outro is left, let it play out untouched.
      if (linesExhausted || lineIndex >= totalLines - 1) return false;
      completeLine(lineIndex, line.endMs);
      advanceLine();
      adapter.pause();
      adapter.seek(lines[lineIndex].startMs);
      pauseAtBoundary(lines[lineIndex].startMs, 'TAB_HIDDEN');
      return true;
    }

    const audioMs = Math.max(0, Number(adapter.getCurrentTime?.() || 0));
    pauseAtBoundary(audioMs, 'TAB_HIDDEN');
    return true;
  }

  function notifyEnded() {
    finish('SONG_END');
  }

  function getSnapshot() {
    if (!snapshot) snapshot = buildSnapshot();
    return snapshot;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function getEvidence() {
    const aggregate = totals();
    // The lyric text exactly as typed, line by line: completed lines are whole,
    // the active line is whatever the player has so far. The server rebuilds
    // completed-line count from this instead of trusting a client counter.
    const typedParts = [];
    for (let i = 0; i <= lineIndex && i < totalLines; i += 1) {
      typedParts.push(i < lineIndex ? lines[i].text : sessions[i].getDisplayValue());
    }
    return {
      songId: song.id,
      timedLyricsVersion: Number(song.timedLyricsVersion) || 1,
      typedText: typedParts.join('\n'),
      linesCompleted: aggregate.completedLines,
      totalLines,
      pauseCount,
      bestNoPauseStreak,
      flowPct: aggregate.flowPct,
      accuracy: aggregate.accuracy,
      score: aggregate.score,
      elapsedMs: aggregate.elapsedMs ? Math.round(aggregate.elapsedMs) : 0,
      pauses: pauses.map((p) => ({ lineIndex: p.lineIndex, atMs: p.atMs, durationMs: Math.max(0, Number(p.durationMs) || 0), reason: p.reason })),
      lineEvents: lineStats.map((stat, index) => ({ index, completed: stat.completed, paused: stat.paused, completedAtMs: stat.completedAtMs })),
    };
  }

  function destroy() {
    disposed = true;
    listeners.clear();
    try { adapter.destroy?.(); } catch { /* already gone */ }
  }

  return {
    prepare,
    start,
    tick,
    applyInput,
    pauseForVisibility,
    notifyEnded,
    getSnapshot,
    getEvidence,
    subscribe,
    destroy,
    getState: () => state,
    getLineIndex: () => lineIndex,
  };
}
