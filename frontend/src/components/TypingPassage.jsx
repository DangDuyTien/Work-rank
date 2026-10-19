import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { graphemes, normalizeText, sameCharacter } from '../utils/typingText';
import './TypingPassage.css';

const Word = memo(function Word({ chars, offset, typed, current }) {
  const typedChars = useMemo(() => graphemes(typed), [typed]);
  return <span className={`typing-word${current >= offset && current < offset + chars.length ? ' is-current-word' : ''}`} data-word-start={offset}>
    {chars.map((char, i) => {
      const index = offset + i;
      const state = i < typedChars.length ? (sameCharacter(typedChars[i], char) ? 'correct' : 'incorrect') : index === current ? 'current' : 'remaining';
      return <span key={i} data-char-index={index} data-state={state} aria-current={state === 'current' ? 'location' : undefined} className={`typing-character is-${state}`}>{char}</span>;
    })}
  </span>;
});

// A long passage can contain thousands of words. Reconcile only the edited
// block on each key, while the other blocks retain their React subtree.
const Block = memo(function Block({ tokens, offset, input, current }) {
  return <span>{tokens.map((token) => <Word key={token.offset} chars={token.chars} offset={token.offset} typed={input.slice(token.offset - offset, token.offset - offset + token.length)} current={current >= token.offset && current < token.offset + token.length ? current : -1} />)}</span>;
});

export default memo(function TypingPassage({ challenge, typedText, inputChars, focused, finished, onFocusInput }) {
  const viewport = useRef(null);
  const [line, setLine] = useState(1);
  const target = useMemo(() => normalizeText(challenge), [challenge]);
  const targetChars = useMemo(() => graphemes(target), [target]);
  // Local-first: the session already owns the segmented input. Fall back to
  // segmenting the raw string only when no precomputed graphemes are provided.
  const input = useMemo(
    () => (Array.isArray(inputChars) ? inputChars : graphemes(typedText || '')),
    [inputChars, typedText]
  );
  const tokens = useMemo(() => {
    let offset = 0;
    return (target.match(/\S+\s*|\s+/gu) || []).map((text) => {
      const chars = graphemes(text);
      const token = { text, chars, offset, length: chars.length };
      offset += token.length;
      return token;
    });
  }, [target]);
  const blocks = useMemo(() => {
    const result = [];
    for (let i = 0; i < tokens.length; i += 32) {
      const block = tokens.slice(i, i + 32);
      const last = block[block.length - 1];
      result.push({ tokens: block, offset: block[0].offset, end: last.offset + last.length });
    }
    return result;
  }, [tokens]);
  const current = Math.min(input.length, targetChars.length);
  const wordIndex = Math.max(0, tokens.findIndex((token) => current < token.offset + token.length));
  useLayoutEffect(() => {
    const box = viewport.current;
    if (!box) return undefined;
    let frame = 0;
    const track = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const marker = box.querySelector('[data-state="current"]') || box.querySelector('.typing-end');
        if (!marker) return;
        const boxRect = box.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();
        const style = window.getComputedStyle(box);
        const lineHeight = parseFloat(style.lineHeight) || parseFloat(style.fontSize) || 40;
        const paddingTop = parseFloat(style.paddingTop) || 0;
        const top = markerRect.top - boxRect.top + box.scrollTop;
        const nextLine = Math.max(1, Math.floor((top - paddingTop) / lineHeight) + 1);
        setLine((previous) => previous === nextLine ? previous : nextLine);

        const topInset = Math.min(12, lineHeight / 3);
        const bottomInset = Math.min(lineHeight, box.clientHeight / 3);
        if (markerRect.bottom > boxRect.bottom - bottomInset || markerRect.top < boxRect.top + topInset) {
          const desired = Math.max(0, top - lineHeight);
          if (Math.abs(box.scrollTop - desired) > 1) box.scrollTop = desired;
        }
      });
    };
    track();
    const resize = new ResizeObserver(track);
    resize.observe(box);
    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
    };
  }, [current, target]);
  return <div className="typing-passage" onClick={onFocusInput}>
    <div className="typing-position" aria-live="off" data-testid="typing-position">
      <strong>{finished ? 'Đã kết thúc' : `Ký tự ${Math.min(current + 1, targetChars.length)} / ${targetChars.length}`}</strong>
      <span>Từ {wordIndex + 1} · Dòng {line}</span>
      {!focused && !finished && <span>Bấm vào đoạn văn để tiếp tục gõ</span>}
    </div>
    <div ref={viewport} className={`workrank-typing-text-arena typing-passage-viewport${focused ? ' is-focused' : ''}`} role="region" aria-label="Đoạn văn luyện gõ" tabIndex={-1}>
      {blocks.map((block) => <Block key={block.offset} tokens={block.tokens} offset={block.offset} input={input.slice(block.offset, block.end).join('')} current={current >= block.offset && current < block.end ? current : -1} />)}
      <span className="typing-end" aria-hidden="true">{current >= targetChars.length ? ' ✓' : ''}</span>
    </div>
  </div>;
});

export const TypingLiveStandings = memo(function TypingLiveStandings({ players, userId }) {
  return <div className="typing-live-standings" aria-label="Bảng xếp hạng tạm thời">
    <strong>Xếp hạng tạm thời · Máy chủ xác minh</strong>
    <table><thead><tr><th>Hạng</th><th>Người chơi</th><th>WPM hiệu dụng</th><th>Đúng</th><th>Tiến độ</th></tr></thead><tbody>
      {[...players].sort((a, b) => (a.liveRank ?? 999) - (b.liveRank ?? 999)).map((p) => <tr key={p.userId} data-live-user={p.userId} data-live-rank={p.liveRank ?? ''} className={Number(p.userId) === Number(userId) ? 'is-me' : ''}><td>{p.liveRank ?? '—'}</td><td>{p.user?.name || p.name || 'Người chơi'}{Number(p.userId) === Number(userId) ? ' (Bạn)' : ''}</td><td>{p.wpm || 0}</td><td>{p.accuracy ?? 0}%</td><td>{Math.round(p.progressPct || 0)}%</td></tr>)}
    </tbody></table>
  </div>;
});
