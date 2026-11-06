/**
 * PRIVATE MEDIA — PLAYER SYNC DECISIONS (pure)
 *
 * The YouTube player is deliberately dumb: the server owns intent (which video,
 * playing/paused, where the playhead is) and the player only reports facts.
 * This module turns "server intent + player facts" into ONE decision, so the
 * behaviour is testable without a browser and impossible to duplicate in two
 * places.
 *
 * ── Why this exists (root cause of the "last second replays" bug) ───────────
 * The old inline logic did two things after a track ended:
 *
 *   1. `if (status === PLAYING && playerState !== 1) player.playVideo()`
 *      → YouTube restarts an ENDED video from 0.
 *   2. the drift corrector then compared the restarted player (t≈0) with the
 *      server target (t≈duration) and called `seekTo(duration)`.
 *      → the player jumped back to the last frame and played the final second.
 *
 * That pair repeated for as long as the server snapshot still described the
 * finished track (socket latency, a rejected ENDED, a background tab, …), which
 * is exactly the "loops about one second at the end" symptom.
 *
 * The rule now: an item that has reported ENDED is untouchable until the server
 * swaps in the next queue item. No play, no seek, no pause.
 */

import { expectedPosition } from './mediaTime.js';

/** YouTube IFrame API player states. */
export const YT_STATE = Object.freeze({
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
});

/** Minimum age of a fresh load before drift correction may fire. */
export const DRIFT_MIN_AGE_MS = 3000;
/** Minimum gap between two drift corrections. */
export const DRIFT_MIN_GAP_MS = 4000;
/** Ignore differences smaller than this: normal decode/buffer jitter. */
export const DRIFT_TOLERANCE_S = 2.5;
/**
 * Never seek into the last seconds of a track. A seek to `duration` makes the
 * player fire ENDED immediately, and a seek from ~0 back to `duration` is what
 * produced the one-second loop.
 */
export const END_SAFE_MARGIN_S = 3;
/** How long to wait for the server before telling the user it stalled. */
export const ADVANCE_STALL_MS = 9000;

/**
 * @typedef {object} SyncInput
 * @property {object|null} session          server snapshot (may be null)
 * @property {number} now                   Date.now()
 * @property {string|null} loadedItemId     queue item currently in the player
 * @property {number} loadedAt              when that item was loaded
 * @property {number} lastSeekAt            last programmatic seek
 * @property {number|null} playerState      YT player state (null = not ready)
 * @property {number} playerTime            player.getCurrentTime()
 * @property {string|null} endedItemId      item that already reported ENDED
 * @property {boolean} blocked              autoplay was refused by the browser
 */

/**
 * One decision per tick. Never returns two actions, so a single tick can no
 * longer both restart a finished video and seek it to the end.
 *
 * @param {SyncInput} input
 * @returns {{type:string, reason:string, itemId?:string, videoId?:string, position?:number}}
 */
export function decidePlayerAction(input) {
  const {
    session = null,
    now = Date.now(),
    loadedItemId = null,
    loadedAt = 0,
    lastSeekAt = 0,
    playerState = null,
    playerTime = 0,
    endedItemId = null,
    blocked = false,
  } = input || {};

  if (!session?.video) {
    return loadedItemId ? { type: 'stop', reason: 'NO_MEDIA' } : { type: 'none', reason: 'IDLE' };
  }

  const itemId = session.currentQueueItemId || null;
  const duration = Number(session.video.durationSeconds) || 0;
  const target = expectedPosition(session, now);

  // A different queue item than the one in the player: load it, once.
  if (loadedItemId !== itemId) {
    return {
      type: session.status === 'PLAYING' ? 'load' : 'cue',
      reason: 'NEW_ITEM',
      itemId,
      videoId: session.video.videoId,
      position: target,
    };
  }

  // Already reported the end of THIS item: hands off until the server moves on.
  if (endedItemId && endedItemId === itemId) {
    return { type: 'wait', reason: 'ENDED_AWAITING_SERVER' };
  }

  // The player itself says the media is over but nobody reported it yet (missed
  // event, throttled background tab). Report it; never replay it.
  if (playerState === YT_STATE.ENDED) {
    return { type: 'report-ended', reason: 'PLAYER_ENDED', itemId };
  }

  if (session.status === 'PLAYING') {
    if (playerState === YT_STATE.BUFFERING) return { type: 'none', reason: 'BUFFERING' };
    if (playerState === YT_STATE.PLAYING) {
      const nearEnd = duration > 0 && (target >= duration - END_SAFE_MARGIN_S || playerTime >= duration - END_SAFE_MARGIN_S);
      const oldEnough = now - loadedAt > DRIFT_MIN_AGE_MS;
      const calm = now - lastSeekAt > DRIFT_MIN_GAP_MS;
      const off = Math.abs(Number(playerTime || 0) - target) > DRIFT_TOLERANCE_S;
      if (!nearEnd && oldEnough && calm && off) {
        return { type: 'seek', reason: 'DRIFT', position: target };
      }
      return { type: 'none', reason: nearEnd ? 'NEAR_END' : 'IN_SYNC' };
    }
    if (blocked) return { type: 'none', reason: 'AUTOPLAY_BLOCKED' };
    return { type: 'play', reason: 'NOT_PLAYING' };
  }

  if (session.status === 'PAUSED' && playerState !== YT_STATE.PAUSED && playerState !== YT_STATE.CUED) {
    return { type: 'pause', reason: 'SERVER_PAUSED' };
  }
  if (session.status === 'STOPPED' && playerState !== YT_STATE.ENDED) {
    return { type: 'stop', reason: 'SERVER_STOPPED' };
  }
  return { type: 'none', reason: 'SETTLED' };
}

/**
 * Should this ENDED report be (re)sent?
 *
 * Exactly one report per queue item is the goal; a single retry is allowed
 * because the first one can be lost while a socket reconnects. The server is
 * idempotent per queue item, so even a duplicate retry cannot advance twice.
 */
export function shouldReportEnded({
  itemId, lastReport = null, now = Date.now(), retryAfterMs = 4000, maxAttempts = 2,
}) {
  if (!itemId) return false;
  if (!lastReport || lastReport.itemId !== itemId) return true;
  if (lastReport.attempts >= maxAttempts) return false;
  return now - lastReport.at >= retryAfterMs;
}
