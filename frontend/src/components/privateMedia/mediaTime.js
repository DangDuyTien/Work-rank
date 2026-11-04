/** Shared time helpers for the private media player. */

/**
 * Where the playhead should be right now, derived from the server snapshot.
 *
 * The server sends `currentTime` plus the moment it was serialized; while the
 * session is PLAYING the position keeps advancing locally between snapshots.
 */
export function expectedPosition(session, now = Date.now()) {
  if (!session) return 0;
  const elapsed = session.status === 'PLAYING'
    ? Math.max(0, (now - (session.receivedAt || now)) / 1000)
    : 0;
  const duration = Number(session?.video?.durationSeconds) || 86400;
  return Math.min(duration, Number(session.currentTime || 0) + elapsed);
}

export function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h > 0 ? `${h}:${String(m).padStart(2, '0')}` : m}:${String(s).padStart(2, '0')}`;
}
