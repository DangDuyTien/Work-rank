import React, { memo, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './TypingPassage.css';

const Word = memo(function Word({ text, offset, input, current }) {
  const target = Array.from(text);
  const typed = Array.from(input);
  return <span className={`typing-word${current >= offset && current < offset + target.length ? ' is-current-word' : ''}`} data-word-start={offset}>
    {target.map((char, i) => {
      const index = offset + i;
      const state = i < typed.length ? (typed[i].toLocaleLowerCase() === char.toLocaleLowerCase() ? 'correct' : 'incorrect') : index === current ? 'current' : 'remaining';
      return <span key={i} data-char-index={index} data-state={state} aria-current={state === 'current' ? 'location' : undefined} className={`typing-character is-${state}`}>{char}</span>;
    })}
  </span>;
});

// A long passage can contain thousands of words. Reconcile only the edited
// block on each key, while the other blocks retain their React subtree.
const Block = memo(function Block({ tokens, offset, input, current }) {
  const typed = Array.from(input);
  return <span>{tokens.map((token) => <Word key={token.offset} text={token.text} offset={token.offset} input={typed.slice(token.offset - offset, token.offset - offset + token.length).join('')} current={current >= token.offset && current < token.offset + token.length ? current : -1} />)}</span>;
});

export default memo(function TypingPassage({ challenge, typedText, focused, finished, onFocusInput }) {
  const viewport = useRef(null);
  const [line, setLine] = useState(1);
  const target = useMemo(() => String(challenge || '').normalize('NFC'), [challenge]);
  const input = useMemo(() => Array.from(String(typedText || '').normalize('NFC')), [typedText]);
  const tokens = useMemo(() => {
    let offset = 0;
    return (target.match(/\S+\s*|\s+/gu) || []).map((text) => {
      const token = { text, offset, length: Array.from(text).length };
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
  const current = Math.min(input.length, Array.from(target).length);
  const wordIndex = Math.max(0, tokens.findIndex((token) => current < token.offset + token.length));
  useLayoutEffect(() => {
    const box = viewport.current;
    if (!box) return;
    const track = () => {
      const marker = box.querySelector('[data-state="current"]') || box.querySelector('.typing-end');
      if (!marker) return;
      const boxRect = box.getBoundingClientRect();
      const markerRect = marker.getBoundingClientRect();
      const top = markerRect.top - boxRect.top + box.scrollTop;
      setLine(Math.max(1, Math.floor((top - 16) / 40) + 1));
      const desired = Math.max(0, top - 56);
      if (markerRect.bottom > boxRect.bottom - 40 || markerRect.top < boxRect.top + 12) box.scrollTop = desired;
    };
    track();
    const resize = new ResizeObserver(track);
    resize.observe(box);
    return () => resize.disconnect();
  }, [current, target]);
  return <div className="typing-passage" onClick={onFocusInput}>
    <div className="typing-position" aria-live="off" data-testid="typing-position">
      <strong>{finished ? 'Đã kết thúc' : `Ký tự ${Math.min(current + 1, Array.from(target).length)} / ${Array.from(target).length}`}</strong>
      <span>Từ {wordIndex + 1} · Dòng {line}</span>
      {!focused && !finished && <span>Bấm vào đoạn văn để tiếp tục gõ</span>}
    </div>
    <div ref={viewport} className={`workrank-typing-text-arena typing-passage-viewport${focused ? ' is-focused' : ''}`} role="region" aria-label="Đoạn văn luyện gõ" tabIndex={-1}>
      {blocks.map((block) => <Block key={block.offset} tokens={block.tokens} offset={block.offset} input={input.slice(block.offset, block.end).join('')} current={current >= block.offset && current < block.end ? current : -1} />)}
      <span className="typing-end" aria-hidden="true">{current >= Array.from(target).length ? ' ✓' : ''}</span>
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
