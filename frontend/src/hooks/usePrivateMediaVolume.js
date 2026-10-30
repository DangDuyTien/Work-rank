import { useCallback, useEffect, useState } from 'react';

export default function usePrivateMediaVolume(userId) {
  const key = `workrank:private-media:output:v1:${userId}`;
  const read = useCallback(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && Number.isFinite(saved.volume)) return { volume: Math.max(0, Math.min(100, saved.volume)), muted: Boolean(saved.muted), preferredVolume: Math.max(1, Math.min(100, Number(saved.preferredVolume) || saved.volume || 70)) };
    } catch { /* storage unavailable */ }
    return { volume: 70, muted: false, preferredVolume: 70 };
  }, [key]);
  const [output, setOutput] = useState(read);
  useEffect(() => { setOutput(read()); }, [read]);
  const update = useCallback((work) => {
    setOutput((previous) => {
      const next = work(previous);
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [key]);
  const setVolume = useCallback((value) => update((previous) => {
    const volume = Math.max(0, Math.min(100, Number(value) || 0));
    return { volume, muted: volume === 0, preferredVolume: volume > 0 ? volume : previous.preferredVolume };
  }), [update]);
  const toggleMute = useCallback(() => update((previous) => ({ ...previous, volume: previous.muted && previous.volume === 0 ? previous.preferredVolume : previous.volume, muted: !previous.muted })), [update]);
  return { ...output, setVolume, toggleMute };
}
