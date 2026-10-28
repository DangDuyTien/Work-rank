import { graphemes, normalizeText, foldCase } from './typingText';

const isHighSurrogate = (code) => code >= 0xd800 && code <= 0xdbff;

/**
 * Local-first typing session.
 *
 * The native input value is the single source of truth. This session keeps a
 * cached NFC target (segmented once), a cached grapheme array of the committed
 * input and an incremental error map, so a normal keystroke only scores the
 * appended tail instead of re-segmenting and re-comparing the whole passage.
 *
 * It performs no network, storage, timers or React work.
 */
export function createTypingSession(target) {
  const targetText = normalizeText(target);
  const targetChars = graphemes(targetText);
  const foldedTarget = targetChars.map((char) => foldCase(char));
  const targetLength = targetChars.length;

  let committed = '';
  let chars = [];
  let offsets = [0];
  let wrong = new Uint8Array(0);
  let errorCount = 0;
  let displayValue = null;
  let displayChars = null;
  let lastDelta = { kind: 'none', appendedCount: 0, removedCount: 0, lastKeyCorrect: null };

  function ensureCapacity(size) {
    if (wrong.length >= size) return;
    const next = new Uint8Array(Math.max(size, wrong.length * 2, 64));
    next.set(wrong);
    wrong = next;
  }

  function rebuildOffsetsFrom(startIndex) {
    if (offsets.length < startIndex + 1) offsets.length = startIndex + 1;
    let total = offsets[startIndex] || 0;
    for (let i = startIndex; i < chars.length; i += 1) {
      total += chars[i].length;
      offsets[i + 1] = total;
    }
    offsets.length = chars.length + 1;
  }

  function measureFrom(fromIndex, previousCharsLength) {
    const oldLimit = Math.min(previousCharsLength, targetLength);
    const newLimit = Math.min(chars.length, targetLength);
    for (let i = fromIndex; i < oldLimit; i += 1) {
      if (wrong[i]) errorCount -= 1;
    }
    ensureCapacity(newLimit);
    for (let i = fromIndex; i < newLimit; i += 1) {
      const isWrong = foldCase(chars[i]) !== foldedTarget[i];
      wrong[i] = isWrong ? 1 : 0;
      if (isWrong) errorCount += 1;
    }
  }

  function snapshot(delta) {
    const charCount = chars.length;
    const currentIndex = Math.min(charCount, targetLength);
    if (delta) lastDelta = delta;
    return {
      value: committed,
      charCount,
      errorCount,
      currentIndex,
      currentChar: targetChars[currentIndex] || '',
      targetLength,
      progressPct: targetLength > 0 ? Math.min(100, Math.round((charCount / targetLength) * 1000) / 10) : 0,
      delta: lastDelta,
    };
  }

  function reset(value) {
    committed = normalizeText(value ?? '');
    chars = graphemes(committed);
    offsets = [0];
    rebuildOffsetsFrom(0);
    errorCount = 0;
    wrong = new Uint8Array(Math.max(chars.length, 64));
    displayValue = null;
    displayChars = null;
    measureFrom(0, 0);
    return snapshot({ kind: 'reset', appendedCount: chars.length, removedCount: 0, lastKeyCorrect: null });
  }

  function applyCommitted(nextValue) {
    const next = normalizeText(nextValue);
    if (next === committed) return snapshot({ kind: 'none', appendedCount: 0, removedCount: 0, lastKeyCorrect: null });

    const previousCharsLength = chars.length;
    let fromIndex = 0;
    let kind;
    let appendedCount = 0;
    let removedCount = 0;
    let lastKeyCorrect = null;

    if (next.startsWith(committed)) {
      kind = 'append';
      const tailChars = graphemes(next.slice(committed.length));
      chars = previousCharsLength === 0 ? tailChars : chars.concat(tailChars);
      rebuildOffsetsFrom(previousCharsLength);
      fromIndex = previousCharsLength;
      appendedCount = tailChars.length;
      if (appendedCount > 0) {
        const index = chars.length - 1;
        lastKeyCorrect = index < targetLength ? foldCase(chars[index]) === foldedTarget[index] : null;
      }
    } else if (committed.startsWith(next)) {
      kind = 'delete';
      removedCount = graphemes(committed.slice(next.length)).length;
      const keep = Math.max(0, previousCharsLength - removedCount);
      chars = chars.slice(0, keep);
      offsets.length = keep + 1;
      fromIndex = keep;
    } else {
      // In-place replacement: an IME rewrote a suffix (tone mark, vowel transform)
      // or a middle edit slipped through. Keep the identical grapheme prefix.
      kind = 'replace';
      let common = 0;
      const max = Math.min(committed.length, next.length);
      while (common < max && committed.charCodeAt(common) === next.charCodeAt(common)) common += 1;
      if (common > 0 && isHighSurrogate(committed.charCodeAt(common - 1))) common -= 1;
      let low = 0;
      let high = previousCharsLength;
      while (low < high) {
        const mid = (low + high + 1) >> 1;
        if (offsets[mid] <= common) low = mid;
        else high = mid - 1;
      }
      fromIndex = low;
      const nextChars = graphemes(next);
      appendedCount = Math.max(0, nextChars.length - previousCharsLength);
      removedCount = Math.max(0, previousCharsLength - nextChars.length);
      chars = nextChars;
      offsets = [0];
      rebuildOffsetsFrom(0);
      if (nextChars.length > fromIndex) {
        const index = nextChars.length - 1;
        lastKeyCorrect = index < targetLength ? foldCase(nextChars[index]) === foldedTarget[index] : null;
      }
    }

    measureFrom(fromIndex, previousCharsLength);
    committed = next;
    displayValue = null;
    displayChars = null;
    return snapshot({ kind, appendedCount, removedCount, lastKeyCorrect });
  }

  function applyValue(rawValue, options = {}) {
    if (options.composing) {
      const next = normalizeText(rawValue);
      displayValue = next;
      displayChars = graphemes(next);
      return {
        ...snapshot({ kind: 'composition', appendedCount: 0, removedCount: 0, lastKeyCorrect: null }),
        value: next,
        charCount: displayChars.length,
        composing: true,
      };
    }
    return applyCommitted(rawValue);
  }

  function getDisplayChars() {
    return displayChars || chars;
  }

  function getDisplayValue() {
    return displayValue ?? committed;
  }

  function getTargetChars() {
    return targetChars;
  }

  return {
    applyValue,
    reset,
    getDisplayChars,
    getDisplayValue,
    getTargetChars,
    getSnapshot: () => snapshot(),
    targetLength,
  };
}
