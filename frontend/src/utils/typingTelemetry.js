/**
 * Tiny external store for live typing telemetry.
 *
 * Keystrokes update this store synchronously without re-rendering the page
 * component. Only the small HUD / visual-keyboard components subscribe through
 * `useSyncExternalStore`.
 */
export function createTypingTelemetry(initial = {}) {
  let state = {
    wpm: 0,
    accuracy: 0,
    errorCount: 0,
    charCount: 0,
    targetLength: 0,
    timeElapsed: 0,
    timeRemaining: 0,
    currentChar: '',
    keyFeedback: null,
    ...initial,
  };
  const listeners = new Set();

  function emit() {
    for (const listener of listeners) {
      try { listener(); } catch { /* subscriber errors must not break typing */ }
    }
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getState() {
      return state;
    },
    patch(partial) {
      let changed = false;
      for (const key of Object.keys(partial)) {
        if (state[key] !== partial[key]) { changed = true; break; }
      }
      if (!changed) return state;
      state = { ...state, ...partial };
      emit();
      return state;
    },
    reset(partial = {}) {
      state = {
        wpm: 0,
        accuracy: 0,
        errorCount: 0,
        charCount: 0,
        targetLength: 0,
        timeElapsed: 0,
        timeRemaining: 0,
        currentChar: '',
        keyFeedback: null,
        ...partial,
      };
      emit();
      return state;
    },
  };
}
