import React, { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';

/**
 * PRIVATE MEDIA — VOLUME
 *
 * A real level control for the page: icon (click = mute) + slider + percentage.
 * The two volume buttons in the floating window are fine for a ±10 nudge, but
 * they cannot show a level — and a speaker icon alone reads as "mute", which is
 * exactly how the owner described it.
 *
 * Drag commits once on release; the thumb follows the finger meanwhile so the
 * 2-second session heartbeat cannot yank it back mid-drag.
 */
export default function VolumeBar({ volume, canControl, onVolume }) {
  const current = Math.min(100, Math.max(0, Math.round(Number(volume ?? 100))));
  const [dragging, setDragging] = useState(false);
  const [draft, setDraft] = useState(current);
  // What to restore when un-muting — never restore 0, that would be a no-op.
  const lastAudibleRef = useRef(current > 0 ? current : 70);

  useEffect(() => {
    if (!dragging) setDraft(current);
    if (current > 0) lastAudibleRef.current = current;
  }, [current, dragging]);

  useEffect(() => {
    if (!dragging) return undefined;
    const commit = () => {
      setDragging(false);
      onVolume(draft);
    };
    window.addEventListener('pointerup', commit, { once: true });
    window.addEventListener('pointercancel', commit, { once: true });
    return () => {
      window.removeEventListener('pointerup', commit);
      window.removeEventListener('pointercancel', commit);
    };
  }, [dragging, draft, onVolume]);

  const shown = dragging ? draft : current;
  const muted = shown === 0;
  const Icon = muted ? VolumeX : (shown < 50 ? Volume1 : Volume2);

  return (
    <div className={`pm-vol${canControl ? '' : ' is-disabled'}`}>
      <button
        type="button"
        className="pm-vol__btn"
        onClick={() => onVolume(muted ? lastAudibleRef.current : 0)}
        disabled={!canControl}
        aria-label={muted ? 'Bật tiếng' : 'Tắt tiếng'}
        title={muted ? 'Bật tiếng' : 'Tắt tiếng'}
      >
        <Icon size={14} aria-hidden="true" />
      </button>
      <input
        type="range"
        className="pm-vol__range"
        min="0"
        max="100"
        step="5"
        value={shown}
        disabled={!canControl}
        aria-label="Âm lượng"
        onPointerDown={() => { if (canControl) setDragging(true); }}
        onChange={(event) => {
          const next = Number(event.target.value);
          setDraft(next);
          // Keyboard / assistive tech: no pointer sequence, commit immediately.
          if (!dragging) onVolume(next);
        }}
      />
      <span className="pm-vol__value">{shown}%</span>
    </div>
  );
}
