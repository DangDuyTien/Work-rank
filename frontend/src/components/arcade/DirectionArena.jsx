import React, { useEffect, useRef } from 'react';
import { ARROWS, directionForKey, directionForSwipe } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';

export default function DirectionArena({ current, elapsed, previousAt, canPlay, submit, players, me, feedback }) {
  const arena = useRef(null), pointer = useRef(null);
  useEffect(() => { arena.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    if (canPlay() && elapsed - previousAt >= current.windowMs) submit({ direction: null });
  }, [elapsed, previousAt, current.windowMs]);
  const send = (direction) => {
    if (!canPlay()) return;
    if (elapsed - previousAt >= current.windowMs) submit({ direction: null });
    else submit({ direction }, previousAt + 80);
  };
  return <div ref={arena} tabIndex={0} role="group" aria-label="Sân phản xạ — phím mũi tên hoặc WASD" className="arcade-direction-arena"
    onKeyDown={(e) => { const direction = directionForKey(e.key); if (!direction || !canPlay()) return; e.preventDefault(); if (!e.repeat) send(direction); }}
    onPointerDown={(e) => { if (!canPlay() || e.target.closest('button')) return; pointer.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerCancel={() => { pointer.current = null; }}
    onPointerUp={(e) => { if (!pointer.current || pointer.current.id !== e.pointerId) return; const dir = directionForSwipe(e.clientX - pointer.current.x, e.clientY - pointer.current.y); pointer.current = null; if (dir) send(dir); }}>
    <div className="arcade-direction-prompt"><span className="arcade-prompt-label">LƯỚT THEO MŨI TÊN</span><strong data-testid="challenge-direction" data-direction={current.direction} aria-label={`Hướng ${current.direction}`}>{ARROWS[current.direction]}</strong><span className="arcade-pace">Nhịp {Math.floor((players.find((p) => p.id === me.id)?.revision || 0) / 8) + 1} · Cửa sổ {current.windowMs}ms</span></div>
    <div className="arcade-lanes">{players.map((p) => <div className={`arcade-lane ${p.id === me.id ? 'my-lane' : ''}`} key={p.id}><span className="arcade-lane-line" /><span className="arcade-lane-ring" /><PlayerAvatar2D player={p} state={p.id === me.id ? feedback?.state : 'idle'} direction={p.id === me.id ? feedback?.direction : null} feedbackId={p.id === me.id ? feedback?.id : p.revision} /></div>)}</div>
    <div className="arcade-direction-controls" aria-label="Điều khiển bốn hướng">{['UP', 'LEFT', 'DOWN', 'RIGHT'].map((d) => <button key={d} type="button" aria-label={`Đi ${d}`} onClick={() => send(d)}>{ARROWS[d]}<small>{({ UP: 'W', LEFT: 'A', DOWN: 'S', RIGHT: 'D' })[d]}</small></button>)}</div>
    <span className="arcade-direction-help">Mũi tên / WASD · hoặc vuốt trong sân</span>
  </div>;
}
