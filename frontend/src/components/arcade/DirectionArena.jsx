import React, { useEffect, useRef } from 'react';
import { ARROWS, directionForKey, directionForSwipe } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';
import { RivalAvatar } from './RaceStrip';

export default function DirectionArena({ current, index, elapsed, durationMs, elapsedNow, previousAt, canPlay, submit, players, me, feedback }) {
  const arena = useRef(null), pointer = useRef(null);
  const revealMs = current.revealMs || 0;
  const readyAt = previousAt + revealMs;
  const entering = revealMs > 0 && elapsed < readyAt;
  useEffect(() => { arena.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (canPlay() && elapsed - readyAt >= current.windowMs) submit({ direction: null }, readyAt + current.windowMs, index);
  }, [elapsed, readyAt, current.windowMs, index]);
  const send = (direction) => {
    if (!canPlay() || elapsedNow() < readyAt) return;
    if (elapsedNow() - readyAt >= current.windowMs) submit({ direction: null }, readyAt + current.windowMs, index);
    else submit({ direction }, readyAt + 80, index);
  };
  const rule = current.opposite ? 'ĐẢO CHIỀU!' : current.stage === 'normal' ? 'NHÌN HƯỚNG · BẤM THEO' : 'NHÌN HƯỚNG · BỎ QUA VỊ TRÍ & MÀU';
  const warning = !current.opposite && elapsed >= durationMs * 37 / 60 && elapsed < durationMs * 40 / 60;
  const count = Math.max(1, Math.ceil((durationMs * 40 / 60 - elapsed) / (durationMs / 60)));
  return <div ref={arena} tabIndex={0} role="group" aria-label="Sân phản xạ — phím mũi tên hoặc WASD" className={`arcade-direction-arena ${current.opposite ? 'is-opposite' : ''}`} data-stage={current.stage} data-feedback={feedback?.state || 'idle'}
    onKeyDown={(e) => { const direction = directionForKey(e.key); if (!direction || !canPlay()) return; e.preventDefault(); if (!e.repeat) send(direction); }}
    onPointerDown={(e) => { if (!canPlay() || e.target.closest('button')) return; pointer.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerCancel={() => { pointer.current = null; }}
    onPointerUp={(e) => { if (!pointer.current || pointer.current.id !== e.pointerId) return; const d = directionForSwipe(e.clientX - pointer.current.x, e.clientY - pointer.current.y); pointer.current = null; if (d) send(d); }}>
    <div className="arcade-direction-rule"><strong>{current.opposite ? '⇄ ' : '➜ '}{rule}</strong><span className={warning ? 'arcade-trick-anticipation' : ''}>{warning ? `SẮP ĐẢO CHIỀU · ${count} · Chờ biển cam!` : current.opposite ? '↑ bấm ↓ · ← bấm →' : current.stage === 'entrance' ? 'Chờ mũi tên dừng rồi bấm' : current.stage === 'normal' ? 'Mũi tên / WASD / vuốt' : 'Chỉ hướng của mũi tên là đáp án'}</span></div>
    <div className="arcade-stimulus-zone">
      <div className="arcade-arrow-position" style={{ '--arrow-slot': current.slot || 0 }}><div key={index} className={`arcade-arrow-object ${entering ? 'is-entering' : ''}`} data-color={current.color || 0} data-feedback={feedback?.state || 'idle'}><strong data-testid="challenge-direction" data-direction={current.direction} data-expected={current.expected || current.direction} aria-label={`Hướng ${current.direction}`}>{ARROWS[current.direction]}</strong><span className="arcade-arrow-particles" aria-hidden="true">✦ · ✧</span></div></div>
      <span className="arcade-response-track"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, 1 - (elapsed - readyAt) / current.windowMs))})` }} /></span>
      <div className={`arcade-direction-feedback ${feedback ? 'is-visible' : ''}`} role="status" key={feedback?.id}>
        {feedback ? <><b>{feedback.state === 'wrong' ? '✕ VỪA RỒI: ' : '✓ '}{feedback.text}</b>{feedback.state === 'wrong' ? <span>CẦN <strong>{ARROWS[feedback.expected]}</strong> <small>BẠN {feedback.direction ? 'BẤM' : 'HẾT GIỜ'}</small> <strong>{ARROWS[feedback.direction] || '—'}</strong><em>{feedback.lostCombo ? `x${feedback.lostCombo} → x0` : 'Thử hướng tiếp theo!'}</em></span> : <span><strong>+{feedback.delta}</strong> <small>Giữ nhịp nào!</small></span>}</> : <><b>{entering ? 'CHỜ MŨI TÊN DỪNG…' : 'BẤM ĐÚNG HƯỚNG!'}</b><span>{current.opposite ? 'Bấm hướng ngược lại' : 'Phản xạ nhanh · giữ combo'}</span></>}
      </div>
    </div>
    <div className="arcade-lanes">{players.map((p) => <div className={`arcade-lane ${p.id === me.id ? 'my-lane' : ''}`} key={p.id}><span className="arcade-lane-line" /><span className="arcade-lane-ring" />{p.id === me.id ? <PlayerAvatar2D player={p} state={feedback?.state} direction={feedback?.direction} feedbackId={feedback?.id} /> : <RivalAvatar player={p} />}</div>)}</div>
    <div className="arcade-direction-controls" aria-label="Điều khiển bốn hướng">{['UP', 'LEFT', 'DOWN', 'RIGHT'].map((d) => <button key={d} type="button" aria-label={`Đi ${d}`} disabled={entering} data-pressed={feedback?.direction === d} onClick={() => send(d)}>{ARROWS[d]}<small>{({ UP: 'W', LEFT: 'A', DOWN: 'S', RIGHT: 'D' })[d]}</small></button>)}</div>
  </div>;
}
