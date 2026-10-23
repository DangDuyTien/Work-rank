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
  const target = current.word.normalize('NFC');
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
      <div className="arcade-monitor-top"><i /><i /><i /><span>LƯỢT {index + 1}</span><small>{current.language === 'vi' ? 'TIẾNG VIỆT' : 'TIẾNG ANH'}</small></div>
      <div className={`arcade-word-wrap is-next`} data-transition="ready" key={`word-${index}`}><span className={`arcade-word ${target.length > 13 ? 'long-word' : ''} ${target.length > 22 ? 'wrap-word' : ''}`} data-testid="challenge-word" role="img" aria-label={target}>{Array.from(target).map((char, i) => <span key={i} aria-hidden="true" data-char-state={i < draft.length ? composing ? 'composing' : char === Array.from(draft)[i] ? 'correct' : 'wrong' : i === draft.length ? 'cursor' : 'pending'}>{char}</span>)}</span></div>
      <div className="computer-word-progress" role="progressbar" aria-label="Ký tự đã gõ" aria-valuemin={0} aria-valuemax={Array.from(target).length} aria-valuenow={Math.min(Array.from(draft).length,Array.from(target).length)}><i style={{transform:`scaleX(${Math.min(1,Array.from(draft).length/Array.from(target).length)})`}}/></div>
      <div className="arcade-computer-input">
        <label htmlFor="arcade-word-input">{composing ? 'Đang đặt dấu…' : wrong ? 'Sửa ký tự được tô đỏ' : 'Gõ ngay bên dưới'}<span>Aa = aa · có dấu</span></label>
        <input ref={input} id="arcade-word-input" value={value} className={wrong ? 'is-wrong' : ''} aria-invalid={wrong} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Gõ để bắt đầu chuỗi…"
          onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()} onChange={(e) => change(e.target.value)}
          onCompositionStart={() => { composition.current = true; setComposing(true); }}
          onCompositionEnd={(e) => { composition.current = false; setComposing(false); change(e.currentTarget.value); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing && !composition.current) { e.preventDefault(); complete(e.currentTarget.value, true); } }} />
        <small>{wrong ? '⌫ Sửa · Enter bỏ qua' : '✓ Đúng từ → tự chuyển'}</small>
      </div>
      <div className={`arcade-word-receipt ${feedback ? 'visible' : ''}`} role="status" key={`receipt-${feedback?.id??'idle'}`}>{feedback ? <><b>{feedback.state === 'wrong' ? '✕ CHƯA ĐÚNG' : `✓ ${feedback.text}`}</b><span>{feedback.word}</span><strong>{feedback.delta > 0 ? `+${feedback.delta}` : 'Chuỗi bắt đầu lại'}</strong></> : <span>{current.language === 'vi' ? 'TIẾNG VIỆT' : 'TIẾNG ANH'} · TẬP TRUNG VÀO TỪ</span>}</div>
    </div>
    <div className="arcade-monitor-neck" /><div className="arcade-desk"><span aria-hidden="true">⌨</span></div>
    <div className="arcade-main-character"><PlayerAvatar2D player={player} state={feedback?.state || (value ? 'action' : 'idle')} feedbackId={feedback?.id} /></div>
  </div>;
});
