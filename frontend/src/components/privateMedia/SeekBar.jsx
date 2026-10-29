import React, { useEffect, useState } from 'react';

/**
 * PRIVATE MEDIA — SEEK BAR
 *
 * A small scrub bar for the page only. The floating window deliberately keeps
 * its 5 buttons and nothing else (it has to stay tiny and unnoticeable), so the
 * seek control lives here.
 *
 * While dragging, the thumb follows the finger instead of the server clock —
 * otherwise the 2-second heartbeat would yank it back mid-drag. The command is
 * sent once, on release (or on a keyboard step), never on every pixel.
 */
function formatTime(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function SeekBar({ currentTime, duration, canControl, onSeek }) {
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(0);

  const total = Math.max(0, Math.round(Number(duration) || 0));
  const position = Math.min(total, Math.max(0, Math.round(Number(currentTime) || 0)));
  const disabled = !canControl || total <= 0;

  // Follow the session while idle; freeze while the owner is dragging.
  useEffect(() => {
    if (!dragging) setDraft(position);
  }, [position, dragging]);

  // Commit on release anywhere — a pointerup outside the track would otherwise
  // leave the bar stuck in "dragging" state.
  useEffect(() => {
    if (!dragging) return undefined;
    const commit = () => {
      setDragging(false);
      onSeek(draft);
    };
    window.addEventListener('pointerup', commit, { once: true });
    window.addEventListener('pointercancel', commit, { once: true });
    return () => {
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', commit);
    };
  }, [dragging, draft, onSeek]);

  const shown = dragging ? draft : position;

  return (
    <div className={`pm-seek${disabled ? ' is-disabled' : ''}`}>
      <span className="pm-seek__time">{formatTime(shown)}</span>
      <input
        type="range"
        className="pm-seek__range"
        min="0"
        max={total || 1}
        step="1"
        value={shown}
        disabled={disabled}
        aria-label="Tua video"
        onPointerDown={() => { if (!disabled) setDragging(true); }}
        onChange={(event) => {
          const next = Number(event.target.value);
          setDraft(next);
          // Keyboard / assistive tech: no pointer sequence, commit immediately.
          if (!dragging) onSeek(next);
        }}
      />
      <span className="pm-seek__time">{formatTime(total)}</span>
    </div>
  );
}
