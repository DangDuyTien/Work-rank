import React, { memo, useEffect, useRef, useState } from 'react';
import { normalizeWord } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';

export default memo(function ComputerStation({ current, index, player, canPlay, submit, previousAt, elapsedNow, feedback }) {
  const [value, setValue] = useState('');
  const [composing, setComposing] = useState(false);
  const input = useRef(null), composition = useRef(false), errors = useRef(0), previous = useRef(''), pending = useRef(null);
  const latest = useRef(null);
  latest.current = { current, index, previousAt };
  const draft = value.normalize('NFC').trimStart().toLocaleUpperCase('vi');
  const completed = feedback?.state !== 'wrong' && feedback?.word && !value;
  const target = (completed ? feedback.word : current.word).normalize('NFC');
  const wrong = !composing && !target.startsWith(draft.trimStart());
  useEffect(() => { setValue(''); errors.current = 0; previous.current = ''; clearTimeout(pending.current); if (input.current) input.current.value = ''; }, [index]);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    let frame;
    const visible = () => { cancelAnimationFrame(frame); if (window.innerWidth < 768 && document.activeElement === input.current) frame = requestAnimationFrame(() => input.current?.scrollIntoView({ block: 'center', behavior: 'instant' })); };
    window.visualViewport?.addEventListener('resize', visible);
    return () => { clearTimeout(pending.current); cancelAnimationFrame(frame); window.visualViewport?.removeEventListener('resize', visible); };
  }, []);
  const complete = (text, force = false) => {
    if (!canPlay() || composition.current) return;
    const item = latest.current;
    const matches = normalizeWord(text) === normalizeWord(item.current.word);
    if (!force && !matches) return;
    const minimum = item.previousAt + Math.max(140, Array.from(matches ? item.current.word : 'x').length * 35);
    const wait = minimum - elapsedNow();
    clearTimeout(pending.current);
    if (wait > 0) { pending.current = setTimeout(() => { if (latest.current.index === item.index) complete(text, force); }, wait + 2); return; }
    if (submit({ value: text, errors: errors.current }, minimum, item.index)) {
      setValue(''); previous.current = ''; errors.current = 0;
      if (input.current) input.current.value = '';
    }
  };
  const change = (text) => {
    clearTimeout(pending.current);
    if (!canPlay()) { setValue(''); if (input.current) input.current.value = ''; return; }
    setValue(text);
    if (!composition.current) {
      const bad = !normalizeWord(latest.current.current.word).startsWith(normalizeWord(text));
      if (bad && text.length > previous.current.length) errors.current = Math.min(120, errors.current + 1);
      previous.current = text; complete(text);
    }
  };
  return <div className="arcade-workstation">
    <div className={`arcade-monitor ${wrong ? 'typing-error' : ''} ${feedback?.state === 'wrong' ? 'bump' : ''}`} data-feedback={feedback?.state || 'idle'}>
      <div className="arcade-monitor-top"><i /><i /><i /><span>GÕ TỪ NÀY · {index + 1}</span></div>
      <div className={`arcade-word-wrap ${completed ? 'is-success' : 'is-next'}`} data-transition={completed ? 'complete' : 'ready'}><span className={`arcade-word ${target.length > 13 ? 'long-word' : ''}`} data-testid="challenge-word" aria-label={target}>{Array.from(target).map((char, i) => <span key={i} aria-hidden="true" data-char-state={completed ? 'correct' : i < draft.length ? composing ? 'composing' : char === Array.from(draft)[i] ? 'correct' : 'wrong' : i === draft.length ? 'cursor' : 'pending'}>{char}</span>)}</span></div>
      <div className="arcade-computer-input">
        <label htmlFor="arcade-word-input">{composing ? 'Đang đặt dấu…' : wrong ? 'Sửa ký tự được tô đỏ' : 'Gõ ngay bên dưới'}<span>Aa = aa · có dấu</span></label>
        <input ref={input} id="arcade-word-input" value={value} className={wrong ? 'is-wrong' : ''} aria-invalid={wrong} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Gõ để bắt đầu combo…"
          onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} onChange={(e) => change(e.target.value)}
          onCompositionStart={() => { composition.current = true; setComposing(true); }}
          onCompositionEnd={(e) => { composition.current = false; setComposing(false); change(e.currentTarget.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing && !composition.current) { e.preventDefault(); complete(e.currentTarget.value, true); } }} />
        <small>{wrong ? 'Backspace để sửa · Enter để bỏ qua' : 'Đúng từ → tự chuyển · giữ nhịp, nối combo!'}</small>
      </div>
      <div className={`arcade-word-receipt ${feedback ? 'visible' : ''}`} role="status" key={feedback?.id}>{feedback ? <><b>{feedback.state === 'wrong' ? '✕ CHƯA ĐÚNG' : `✓ ${feedback.text}`}</b><span>{feedback.word}</span><strong>{feedback.delta > 0 ? `+${feedback.delta}` : 'Combo bắt đầu lại'}</strong></> : <span>{current.category === 'vietnamese' ? 'TIẾNG VIỆT' : 'ENGLISH'} · TẬP TRUNG VÀO TỪ</span>}</div>
    </div>
    <div className="arcade-monitor-neck" /><div className="arcade-desk"><span>▰ ▰ ▰ ▰ ▰ ▰</span></div>
    <div className="arcade-main-character"><PlayerAvatar2D player={player} state={feedback?.state || (value ? 'action' : 'idle')} feedbackId={feedback?.id} /></div>
  </div>;
});
