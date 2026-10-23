/**
 * React binding for the music race engine.
 *
 * Two rules shape this file:
 * 1. Keystrokes stay local-first — the native input value is read once, handed
 *    to the engine and painted; nothing awaits the network.
 * 2. The audio clock never drives React at 60fps. The engine publishes at a
 *    human cadence (~11/s), and typing publishes immediately.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createHostedAudioAdapter } from './audioAdapter.js';
import { createMusicRaceEngine } from './engine.js';

export function useMusicRace({ song, active = true, restartKey = 0, onEvent }) {
  const [snapshot, setSnapshot] = useState(null);
  const [engine, setEngine] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  const engineRef = useRef(null);
  const inputRef = useRef(null);
  const compositionRef = useRef(null);
  const eventRef = useRef(onEvent);
  const lastLineRef = useRef(-1);
  const lastWrongSoundRef = useRef(0);

  useEffect(() => { eventRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!song || !active) return undefined;
    let cancelled = false;
    setError(null);
    setReady(false);
    setSnapshot(null);

    let adapter;
    try {
      adapter = createHostedAudioAdapter({ url: song.audioSource?.url });
    } catch (setupError) {
      // A song row without a usable audio URL must fail loudly here, not crash
      // the page inside the render tree.
      setError(setupError?.message || 'Bài hát thiếu audio hợp lệ.');
      return undefined;
    }
    const instance = createMusicRaceEngine({
      song,
      adapter,
      onEvent: (event) => { eventRef.current?.(event, instance); },
    });
    engineRef.current = instance;
    const unsubscribe = instance.subscribe((next) => { if (!cancelled) setSnapshot(next); });

    instance.prepare()
      .then(() => {
        if (cancelled) return;
        setReady(true);
        setEngine(instance);
        setSnapshot(instance.getSnapshot());
      })
      .catch((loadError) => {
        if (!cancelled) setError(loadError?.message || 'Không tải được bài hát.');
      });

    return () => {
      cancelled = true;
      unsubscribe();
      instance.destroy();
      engineRef.current = null;
    };
  }, [song?.id, active, restartKey]);

  // One rAF loop for the whole run. It reads the adapter's own clock, so a
  // dropped frame can never desync the gate from the audio.
  useEffect(() => {
    if (!engine) return undefined;
    let frame = 0;
    let running = true;
    const loop = () => {
      if (!running) return;
      engine.tick();
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(frame); };
  }, [engine]);

  // A hidden tab cannot be played. Pausing is honest: it counts as a stop.
  useEffect(() => {
    if (!engine) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') engine.pauseForVisibility();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [engine]);

  // The native input is uncontrolled on purpose: writing it on every keystroke
  // breaks Vietnamese IME caret handling. It is cleared only when the line
  // actually changes.
  useEffect(() => {
    const lineIndex = snapshot?.lineIndex ?? -1;
    if (lineIndex === lastLineRef.current) return;
    lastLineRef.current = lineIndex;
    const input = inputRef.current;
    if (input) {
      input.value = '';
      input.setSelectionRange?.(0, 0);
    }
    if (lineIndex >= 0) inputRef.current?.focus?.({ preventScroll: true });
  }, [snapshot?.lineIndex]);

  const start = useCallback(() => {
    const instance = engineRef.current;
    if (!instance) return false;
    const started = instance.start();
    if (started) {
      lastLineRef.current = 0;
      if (inputRef.current) inputRef.current.value = '';
      inputRef.current?.focus?.({ preventScroll: true });
    }
    return started;
  }, []);

  const handleInput = useCallback((event) => {
    const instance = engineRef.current;
    if (!instance) return;
    const composing = Boolean(compositionRef.current || event.nativeEvent?.isComposing);
    const result = instance.applyInput(event.target.value, { composing });
    if (result.composing || !result.accepted) return;
    const next = instance.getSnapshot();
    if (result.completedLine) eventRef.current?.({ type: 'line:complete', index: next.lineIndex }, instance);
  }, []);

  const handleCompositionStart = useCallback(() => {
    compositionRef.current = true;
  }, []);

  const handleCompositionEnd = useCallback((event) => {
    compositionRef.current = false;
    const input = event.currentTarget;
    // Let the browser commit the composition first; the following native input
    // event is the canonical source. RAF is only a fallback.
    requestAnimationFrame(() => {
      const instance = engineRef.current;
      if (!instance) return;
      const end = input.value.length;
      if (input.selectionStart !== end) input.setSelectionRange?.(end, end);
      instance.applyInput(input.value, { composing: false });
    });
  }, []);

  // Backspace at position 0 must not navigate back in history mid-run.
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Backspace' && !event.currentTarget.value) event.preventDefault();
  }, []);

  return {
    snapshot,
    ready,
    error,
    start,
    engine,
    inputRef,
    inputProps: {
      ref: inputRef,
      onChange: handleInput,
      onCompositionStart: handleCompositionStart,
      onCompositionEnd: handleCompositionEnd,
      onKeyDown: handleKeyDown,
      // Never let a paste or a drop skip the typing.
      onPaste: (event) => event.preventDefault(),
      onDrop: (event) => event.preventDefault(),
      onContextMenu: (event) => event.preventDefault(),
      autoComplete: 'off',
      autoCorrect: 'off',
      autoCapitalize: 'off',
      spellCheck: false,
      inputMode: 'text',
      'aria-label': 'Gõ lời bài hát đang phát',
    },
  };
}
