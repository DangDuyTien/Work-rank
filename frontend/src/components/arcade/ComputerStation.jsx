import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  graphemes,
  minimumTypingMs,
  normalizeTypingDisplay,
  normalizeTypingKey,
  typingState,
} from '../../../../shared/arcade/typingText.mjs';
import { PlayerAvatar2D } from './ArcadeArt';

/**
 * GÕ NHANH — input pipeline.
 *
 * Nguồn sự thật DUY NHẤT là `input.value` do browser/UniKey/IME tạo ra.
 * Component không dựng chữ từ `keydown`, không đoán Telex, không bỏ dấu.
 *
 * Luồng:
 *   native value → normalizeTypingDisplay (NFC) → typingState (prefix/mismatch)
 *   → finalize khi normalizeTypingKey(typed) === normalizeTypingKey(target)
 *
 * Hai lỗi thực tế được xử lý ở đây:
 * 1. UniKey trên Windows là keyboard hook, không phát composition event. Nó gõ
 *    nguyên âm gốc trước ("KY") rồi mới thay bằng chữ có dấu ("KỶ"). Trạng thái
 *    trung gian đó KHÔNG phải lỗi — chỉ báo đỏ sau MISMATCH_GRACE_MS nếu vẫn
 *    lệch, và chỉ tính 1 lỗi cho cả từ.
 * 2. `compositionend` có thể không bao giờ tới (IME đổi, blur, hook can thiệp).
 *    Watchdog đóng composition và finalize để từ không bị kẹt.
 */

const MISMATCH_GRACE_MS = 450;
const COMPOSITION_WATCHDOG_MS = 1200;
const SUBMIT_RETRY_MS = 40;
const SUBMIT_MAX_RETRY = 4;

/** Bật log chẩn đoán bằng localStorage.setItem('wr:typing:debug','1'). */
function typingDebugEnabled() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('wr:typing:debug') === '1';
  } catch {
    return false;
  }
}

export default memo(function ComputerStation({ current, index, player, canPlay, submit, previousAt, elapsedNow, feedback }) {
  const [value, setValue] = useState('');
  const [composing, setComposing] = useState(false);
  const [mismatch, setMismatch] = useState(false);
  const input = useRef(null);
  const composition = useRef(false);
  const compositionTimer = useRef(null);
  const mismatchTimer = useRef(null);
  const pending = useRef(null);
  const errors = useRef(0);
  const completed = useRef(-1);
  const retries = useRef(0);
  const latest = useRef(null);
  latest.current = { current, index, previousAt };

  const targetGraphemes = useMemo(() => graphemes(current.word.normalize('NFC')), [current.word]);
  const displayValue = normalizeTypingDisplay(value);
  const typedGraphemes = useMemo(() => graphemes(displayValue), [displayValue]);
  const state = typingState(value, current.word);
  const wrong = mismatch && state === 'mismatch';

  // Reset sạch theo challenge; input DOM không bị recreate (không đặt key theo index).
  useEffect(() => {
    setValue('');
    setMismatch(false);
    setComposing(false);
    composition.current = false;
    errors.current = 0;
    completed.current = -1;
    retries.current = 0;
    clearTimeout(pending.current);
    clearTimeout(mismatchTimer.current);
    clearTimeout(compositionTimer.current);
    if (input.current) input.current.value = '';
  }, [index]);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    let frame;
    const visible = () => {
      cancelAnimationFrame(frame);
      if (window.innerWidth < 768 && document.activeElement === input.current) {
        frame = requestAnimationFrame(() => input.current?.scrollIntoView({ block: 'center', behavior: 'instant' }));
      }
    };
    window.visualViewport?.addEventListener('resize', visible);
    return () => {
      clearTimeout(pending.current);
      clearTimeout(mismatchTimer.current);
      clearTimeout(compositionTimer.current);
      cancelAnimationFrame(frame);
      window.visualViewport?.removeEventListener('resize', visible);
    };
  }, []);

  /**
   * Finalize đúng một lần cho mỗi challenge. Nếu server từ chối vì đồng hồ
   * (event rơi vào cửa sổ chưa đủ thời gian), thử lại ngắn thay vì bỏ rơi từ.
   */
  const finalize = useCallback((text, { force = false, expectedIndex = latest.current.index } = {}) => {
    if (!canPlay()) return;
    const item = latest.current;
    if (expectedIndex !== item.index) return;
    if (completed.current === item.index) return;
    if (composition.current && !force) return;
    if (!force && normalizeTypingKey(text) !== normalizeTypingKey(item.current.word)) return;

    const earliest = item.previousAt + minimumTypingMs(item.current.word);
    clearTimeout(pending.current);
    retries.current = 0;

    const trySubmit = () => {
      if (latest.current.index !== item.index || completed.current === item.index) return;
      if (typingDebugEnabled()) {
        // Chỉ bật khi debug: đủ để đối chiếu client/server, không log ở production.
        console.debug('[go-nhanh]', {
          index: item.index,
          challengeId: item.current.challengeId,
          rawTarget: item.current.word,
          normalizedTarget: normalizeTypingKey(item.current.word),
          rawInput: text,
          normalizedInput: normalizeTypingKey(text),
          isComposing: composition.current,
          errors: errors.current,
        });
      }
      if (submit({ value: text, errors: errors.current }, earliest, item.index)) {
        completed.current = item.index;
        setValue('');
        setMismatch(false);
        errors.current = 0;
        if (input.current) input.current.value = '';
        return;
      }
      if (retries.current < SUBMIT_MAX_RETRY) {
        retries.current += 1;
        pending.current = setTimeout(trySubmit, SUBMIT_RETRY_MS);
      }
    };

    const wait = earliest - elapsedNow();
    if (wait > 0) {
      pending.current = setTimeout(trySubmit, Math.ceil(wait) + 4);
      return;
    }
    trySubmit();
  }, [canPlay, elapsedNow, submit]);

  /**
   * Chỉ báo lỗi khi trạng thái lệch ĐỨNG YÊN đủ lâu. Trong lúc UniKey thay
   * nguyên âm ("KY" → "KỶ") người chơi không bị tính lỗi.
   */
  const scheduleMismatch = useCallback((nextState) => {
    clearTimeout(mismatchTimer.current);
    if (nextState !== 'mismatch' || composition.current) {
      setMismatch(false);
      return;
    }
    mismatchTimer.current = setTimeout(() => {
      if (composition.current) return;
      setMismatch(true);
      if (!errors.current) errors.current = 1;
    }, MISMATCH_GRACE_MS);
  }, []);

  const applyValue = useCallback((text) => {
    clearTimeout(pending.current);
    retries.current = 0;
    if (!canPlay()) {
      setValue('');
      if (input.current) input.current.value = '';
      return;
    }
    setValue(text);
    const nextState = typingState(text, latest.current.current.word);
    scheduleMismatch(nextState);
    if (!composition.current) finalize(text);
  }, [canPlay, finalize, scheduleMismatch]);

  const armCompositionWatchdog = useCallback(() => {
    clearTimeout(compositionTimer.current);
    compositionTimer.current = setTimeout(() => {
      if (!composition.current) return;
      const native = input.current?.value || '';
      if (typingState(native, latest.current.current.word) !== 'complete') return;
      // IME giữ marked text quá lâu dù chữ đã đủ: đóng composition bằng blur,
      // để browser commit trước khi ta clear input (tránh chèn lặp ký tự).
      composition.current = false;
      setComposing(false);
      input.current?.blur();
      setTimeout(() => {
        if (input.current && document.activeElement !== input.current) input.current.focus({ preventScroll: true });
      }, 30);
    }, COMPOSITION_WATCHDOG_MS);
  }, []);

  return <div className="arcade-workstation">
    <div className={`arcade-monitor ${wrong ? 'typing-error' : ''} ${feedback?.state === 'wrong' ? 'bump' : ''}`} data-feedback={feedback?.state || 'idle'} data-composing={composing}>
      <div className="arcade-monitor-top"><i /><i /><i /><span>LƯỢT {index + 1}</span><small>{current.language === 'vi' ? 'TIẾNG VIỆT' : 'TIẾNG ANH'}</small></div>
      <div className="arcade-word-wrap is-next" data-transition="ready" key={`word-${index}`}>
        <span className={`arcade-word ${targetGraphemes.length > 13 ? 'long-word' : ''} ${targetGraphemes.length > 22 ? 'wrap-word' : ''}`} data-testid="challenge-word" role="img" aria-label={current.word}>
          {targetGraphemes.map((char, i) => {
            const typed = typedGraphemes[i];
            const charState = i < typedGraphemes.length
              ? typed === char ? 'correct' : wrong ? 'wrong' : 'typing'
              : i === typedGraphemes.length ? 'cursor' : 'pending';
            return <span key={`${i}-${char}`} aria-hidden="true" data-char-state={charState}>{char}</span>;
          })}
        </span>
      </div>
      <div className="computer-word-progress" role="progressbar" aria-label="Ký tự đã gõ" aria-valuemin={0} aria-valuemax={targetGraphemes.length} aria-valuenow={Math.min(typedGraphemes.length, targetGraphemes.length)}>
        <i style={{ transform: `scaleX(${Math.min(1, typedGraphemes.length / targetGraphemes.length)})` }} />
      </div>
      <div className="arcade-computer-input">
        <label htmlFor="arcade-word-input">{composing ? 'Đang đặt dấu…' : wrong ? 'Sửa ký tự được tô đỏ' : 'Gõ ngay bên dưới'}<span>Aa = aa · có dấu</span></label>
        <input
          ref={input}
          id="arcade-word-input"
          value={value}
          className={wrong ? 'is-wrong' : ''}
          aria-invalid={wrong}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Gõ để bắt đầu chuỗi…"
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
          onChange={(e) => applyValue(e.currentTarget.value)}
          onCompositionStart={() => {
            composition.current = true;
            setComposing(true);
            setMismatch(false);
            clearTimeout(mismatchTimer.current);
            armCompositionWatchdog();
          }}
          onCompositionUpdate={() => armCompositionWatchdog()}
          onCompositionEnd={(e) => {
            composition.current = false;
            setComposing(false);
            clearTimeout(compositionTimer.current);
            applyValue(e.currentTarget.value);
          }}
          onBlur={() => {
            composition.current = false;
            setComposing(false);
            clearTimeout(compositionTimer.current);
            const native = input.current?.value || '';
            if (native) finalize(native);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing && !composition.current) {
              e.preventDefault();
              if (typingState(e.currentTarget.value, latest.current.current.word) === 'mismatch') errors.current = Math.min(120, errors.current + 1);
              finalize(e.currentTarget.value, { force: true });
            }
          }}
        />
        <small>{wrong ? '⌫ Sửa · Enter bỏ qua' : '✓ Đúng từ → tự chuyển'}</small>
      </div>
      <div className={`arcade-word-receipt ${feedback ? 'visible' : ''}`} role="status" key={`receipt-${feedback?.id ?? 'idle'}`}>
        {feedback
          ? <><b>{feedback.state === 'wrong' ? '✕ CHƯA ĐÚNG' : `✓ ${feedback.text}`}</b><span>{feedback.word}</span><strong>{feedback.delta > 0 ? `+${feedback.delta}` : 'Chuỗi bắt đầu lại'}</strong></>
          : <span>{current.language === 'vi' ? 'TIẾNG VIỆT' : 'TIẾNG ANH'} · TẬP TRUNG VÀO TỪ</span>}
      </div>
    </div>
    <div className="arcade-monitor-neck" /><div className="arcade-desk"><span aria-hidden="true">⌨</span></div>
    <div className="arcade-main-character"><PlayerAvatar2D player={player} state={feedback?.state || (value ? 'action' : 'idle')} feedbackId={feedback?.id} /></div>
  </div>;
});
