import React, { useEffect, useRef, useState } from 'react';
import { memoryPhase, memorySelectAt, toggleCell } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';

export default function MemoryBoard({ current, index, elapsed, previousAt, canPlay, submit, players, me, feedback }) {
  const [selected, setSelected] = useState([]);
  const selectedRef = useRef([]), pending = useRef(null);
  const phase = memoryPhase(elapsed, previousAt, index, current);
  useEffect(() => { setSelected([]); selectedRef.current = []; clearTimeout(pending.current); }, [index]);
  useEffect(() => () => clearTimeout(pending.current), []);
  const choose = (cell) => {
    if (!canPlay() || phase !== 'SELECT') return;
    const next = toggleCell(selectedRef.current, cell, current.targets);
    selectedRef.current = next; setSelected(next);
    clearTimeout(pending.current);
    if (next.length === current.targets) pending.current = setTimeout(() => { submit({ cells: next }, memorySelectAt(previousAt, index, current) + 120); }, 220);
  };
  return <div className="arcade-memory-room">
    <div className="arcade-memory-heading"><span>✦ NẤC {current.level} · {current.size} × {current.size}</span><strong role="status">{phase === 'PREPARE' ? 'Sẵn sàng ghi nhớ…' : phase === 'FLASH' ? `Nhớ ${current.targets} ô sao!` : phase === 'HIDE' ? 'Ánh sáng đang tắt…' : `Tìm lại ${current.targets} ô sao`}</strong><small>{phase === 'SELECT' ? `Đã chọn ${selected.length}/${current.targets} · bấm lại để bỏ chọn` : `Nhìn kỹ nhé · ${(current.revealMs / 1000).toFixed(1)} giây`}</small></div>
    <div className={`arcade-memory-board phase-${phase.toLowerCase()}`} role="group" aria-label={`Bảng trí nhớ ${current.size} nhân ${current.size}`} data-phase={phase} style={{ gridTemplateColumns: `repeat(${current.size}, 1fr)` }}>
      {Array.from({ length: current.size ** 2 }, (_, cell) => {
        const lit = phase === 'FLASH' && current.cells.includes(cell);
        const pressed = selected.includes(cell);
        return <button key={cell} type="button" data-cell={cell} className={`arcade-memory-tile ${lit ? 'is-lit' : ''} ${pressed ? 'is-selected' : ''}`} aria-label={`Ô hàng ${Math.floor(cell / current.size) + 1}, cột ${cell % current.size + 1}${lit ? ', sao sáng' : ''}`} aria-pressed={pressed} disabled={phase !== 'SELECT' || !canPlay()} onClick={() => choose(cell)}><span aria-hidden="true">{lit ? '✦' : pressed ? '✓' : '·'}</span></button>;
      })}
    </div>
    <div className="arcade-memory-players">{players.map((p) => <div key={p.id}><PlayerAvatar2D player={p} state={p.id === me.id ? feedback?.state : 'idle'} feedbackId={p.id === me.id ? feedback?.id : p.revision} /><small>{p.id === me.id ? `Vòng ${index + 1}` : `Vòng ${p.metrics.attempts + 1}`}</small></div>)}</div>
  </div>;
}
