import React, { useEffect, useRef, useState } from 'react';
import { AnimatedNumber } from '../ui';
import { PlayerAvatar2D } from './ArcadeArt';
import { challenge, emptyMetrics, normalizeWord, replay } from '../../../../shared/arcade/engine.mjs';
import { ARCADE_GAMES } from '../../games/arcade/catalog';
import DirectionArena from './DirectionArena';
import MemoryBoard from './MemoryBoard';

function ComputerInput({ word, canPlay, submit, minimumAt }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const composing = useRef(false), errors = useRef(0), previous = useRef(''), native = useRef(null), pending = useRef(null);
  const wordRef = useRef(word); wordRef.current = word;
  useEffect(() => { setValue(''); setWrong(false); errors.current = 0; previous.current = ''; if (native.current) native.current.value = ''; }, [word]);
  useEffect(() => { native.current?.focus({ preventScroll: true }); return () => clearTimeout(pending.current); }, []);
  useEffect(() => {
    const keepVisible = () => { if (window.innerWidth < 768 && document.activeElement === native.current) native.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' }); };
    window.visualViewport?.addEventListener('resize', keepVisible);
    return () => window.visualViewport?.removeEventListener('resize', keepVisible);
  }, []);
  const complete = (text, force = false) => {
    if (!canPlay() || composing.current) return;
    if (!force && normalizeWord(text) !== normalizeWord(wordRef.current)) return;
    // Prevent duplicate compositionend/input/Enter completions for the same challenge.
    if (submit({ value: text, errors: errors.current }, minimumAt())) {
      setValue(''); setWrong(false); previous.current = ''; errors.current = 0;
      if (native.current) native.current.value = '';
    }
  };
  const change = (text) => {
    if (!canPlay()) { setValue(''); if (native.current) native.current.value = ''; return; }
    setValue(text);
    if (!composing.current) {
      const bad = !normalizeWord(wordRef.current).startsWith(normalizeWord(text));
      setWrong(bad);
      if (bad && text.length > previous.current.length) errors.current = Math.min(120, errors.current + 1);
      previous.current = text;
      complete(text);
    }
  };
  return <div className="arcade-computer-input">
    <label htmlFor="arcade-word-input">Bàn phím của bạn <span>Không phân biệt hoa/thường · có dấu</span></label>
    <input id="arcade-word-input" ref={native} value={value} className={wrong ? 'is-wrong' : ''} aria-invalid={wrong} autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="go" placeholder="Gõ từ trên màn hình…"
      onPaste={(e) => e.preventDefault()} onDrop={(e) => e.preventDefault()}
      onChange={(e) => change(e.target.value)}
      onCompositionStart={() => { composing.current = true; }}
      onCompositionEnd={(e) => { composing.current = false; const text = e.currentTarget.value; clearTimeout(pending.current); pending.current = setTimeout(() => change(text), 0); }}
      onKeyDown={(e) => { if (e.key === 'Enter' && !e.repeat && !e.nativeEvent.isComposing && !composing.current) { e.preventDefault(); complete(e.currentTarget.value, true); } }} />
    <small aria-live="polite">{wrong ? 'Chưa đúng — Backspace để sửa, hoặc Enter để bỏ qua.' : 'Gõ đúng để nhận sao và nối combo!'} </small>
  </div>;
}

export default function ArcadePlay({ snapshot, userId, eventsRef, record, offsetRef }) {
  const { room } = snapshot;
  const mine = snapshot.players.find((p) => String(p.userId) === String(userId));
  const elapsedNow = () => Date.now() + offsetRef.current - new Date(room.startedAt).getTime();
  const [elapsed, setElapsed] = useState(elapsedNow);
  const [metrics, setMetrics] = useState(() => eventsRef.current.length ? replay(room.gameType, room.seed, eventsRef.current, { difficulty: room.difficulty, durationMs: room.durationSeconds * 1000 }) : emptyMetrics());
  const [feedback, setFeedback] = useState(null);
  const feedbackTimer = useRef(null);
  const lastRef = useRef(eventsRef.current.at(-1)?.at || 0);
  const duration = room.durationSeconds * 1000;
  const index = eventsRef.current.length;
  const current = challenge(room.gameType, room.seed, index, room.difficulty);
  const canPlay = () => !mine.finishedAt && elapsedNow() >= 0 && elapsedNow() < duration;
  const submit = (e, earliestAt = 0) => {
    if (!canPlay()) return false;
    const at = Math.round(elapsedNow());
    if (at < earliestAt) return false;
    const next = [...eventsRef.current, { index: eventsRef.current.length, at, ...e }];
    let result;
    try { result = replay(room.gameType, room.seed, next, { durationMs: duration, difficulty: room.difficulty }); } catch { return false; }
    const correct = result.correct > metrics.correct;
    record(next); lastRef.current = at; setMetrics(result);
    setFeedback({ state: correct ? result.combo >= 3 ? 'combo' : 'correct' : 'wrong', id: next.length, direction: e.direction, text: correct ? room.gameType === 'direction_rush' ? 'PERFECT!' : 'CHÍNH XÁC!' : 'THỬ TIẾP NÀO!' });
    clearTimeout(feedbackTimer.current); feedbackTimer.current = setTimeout(() => setFeedback(null), 420);
    return true;
  };
  useEffect(() => {
    const timer = setInterval(() => setElapsed(elapsedNow()), 50);
    return () => { clearInterval(timer); clearTimeout(feedbackTimer.current); };
  }, [room.startedAt]);

  return <div className={`arcade-world ${room.gameType}`}>
    <header className="arcade-hud"><div><span>THỜI GIAN</span><strong role="timer">{Math.ceil(Math.max(0, duration - Math.max(0, elapsed)) / 1000)}<small>s</small></strong></div><span className="arcade-world-label">{ARCADE_GAMES[room.gameType].place}</span><div><span>ĐIỂM</span><strong><AnimatedNumber value={metrics.score} duration={180} /></strong></div></header>
    <div className="arcade-scene">
      <div className="arcade-cloud cloud-one" aria-hidden="true" /><div className="arcade-cloud cloud-two" aria-hidden="true" />
      <span className="arcade-decor-star" aria-hidden="true">✦</span>
      <div className="arcade-scene-title">{ARCADE_GAMES[room.gameType].subtitle}</div>
      {room.gameType === 'computer_rush' && <>
        <div className={`arcade-monitor ${feedback?.state === 'wrong' ? 'bump' : ''}`}><div className="arcade-monitor-top"><i /><i /><i /><span>WORK RANK OS</span></div><span className="arcade-word" data-testid="challenge-word">{current.word}</span><span className="arcade-monitor-hint">{current.category === 'vietnamese' ? 'TIẾNG VIỆT' : 'ENGLISH'} · TỪ {index + 1}</span></div>
        <div className="arcade-monitor-neck" /><div className="arcade-desk"><span>▰ ▰ ▰ ▰ ▰ ▰</span></div>
        <div className="arcade-main-character"><PlayerAvatar2D player={mine} state={feedback?.state} feedbackId={feedback?.id} /></div>
        {snapshot.players.length > 1 && <div className="arcade-rivals">{snapshot.players.filter((p) => p.id !== mine.id).map((p) => <div key={p.id}><span className="arcade-rival-monitor">⌨ {p.metrics.correct}</span><PlayerAvatar2D player={p} state={p.metrics.combo ? 'correct' : 'idle'} feedbackId={p.revision} /></div>)}</div>}
      </>}
      {room.gameType === 'direction_rush' && <DirectionArena current={current} elapsed={elapsed} previousAt={lastRef.current} canPlay={canPlay} submit={submit} players={snapshot.players} me={mine} feedback={feedback} />}
      {room.gameType === 'memory_flash' && <MemoryBoard current={current} index={index} elapsed={elapsed} previousAt={lastRef.current} canPlay={canPlay} submit={submit} players={snapshot.players} me={mine} feedback={feedback} />}
      <div className="arcade-feedback" aria-live="polite" key={feedback?.id}>{feedback?.text || (elapsed >= duration ? 'HẾT GIỜ! ĐANG CHỐT ĐIỂM…' : 'Sẵn sàng tạo kỷ lục mới?')}</div>
      <div className={`arcade-combo ${metrics.combo >= 3 ? 'hot' : ''}`}><span>✦</span> x{metrics.combo} <small>COMBO</small></div>
      {elapsed < 0 && <div className="arcade-countdown" role="status"><span>{Math.min(3, Math.ceil(-elapsed / 1000))}</span><small>Chuẩn bị…</small></div>}
      {elapsed >= 0 && elapsed < 450 && <div className="arcade-go" aria-live="assertive">GO!</div>}
    </div>
    {room.gameType === 'computer_rush' && <ComputerInput word={current.word} canPlay={canPlay} submit={submit} minimumAt={() => lastRef.current + Math.max(140, Array.from(current.word).length * 35)} />}
    <footer className="arcade-player-strip">{snapshot.players.map((p) => <div key={p.id} className={p.id === mine.id ? 'is-me' : ''}><b>P{p.position}</b><span>{p.name}{p.id === mine.id ? ' (bạn)' : ''}</span><strong>{p.id === mine.id ? metrics.score : p.metrics.score}</strong><small>{p.id === mine.id ? metrics.correct : p.metrics.correct} đúng</small></div>)}</footer>
  </div>;
}
