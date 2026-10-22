import React, { useEffect, useRef, useState } from 'react';
import { memoryPhase, memorySelectAt, toggleCell } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';
import { RivalAvatar } from './RaceStrip';

export default function MemoryBoard({ current, index, elapsed, elapsedNow, previousAt, canPlay, submit, players, me, feedback }) {
  const [selected, setSelected] = useState([]);
  const selectedRef = useRef([]), pending = useRef(null);
  const grid=useRef(null),keyboard=useRef(false);
  const [focusCell,setFocusCell]=useState(0);
  const lastSize = useRef(current.size);
  const [levelUp, setLevelUp] = useState(false);
  const review = feedback?.challenge && elapsed - feedback.at < current.restMs;
  const board = review ? feedback.challenge : current;
  useEffect(() => {
    if (lastSize.current === board.size) return;
    lastSize.current = board.size; setLevelUp(true);
    const timer = setTimeout(() => setLevelUp(false), 420);
    return () => clearTimeout(timer);
  }, [board.size]);
  const phase = review ? 'REVIEW' : memoryPhase(elapsed, previousAt, index, current);
  const selectAt = memorySelectAt(previousAt, index, current);
  const remaining = Math.max(0, (current.selectMs || 12000) - (elapsed - selectAt));
  const revealStart=previousAt+(index?current.restMs:0)+current.prepareMs;
  const revealFraction=Math.max(0,Math.min(1,1-(elapsed-revealStart)/current.revealMs));
  useEffect(() => { setSelected([]); selectedRef.current = []; setFocusCell(0); clearTimeout(pending.current); }, [index]);
  useEffect(() => () => clearTimeout(pending.current), []);
  useEffect(()=>{
    if(phase!=='SELECT'||!keyboard.current)return;
    if(document.activeElement!==document.body&&!grid.current?.contains(document.activeElement))return;
    const frame=requestAnimationFrame(()=>grid.current?.querySelector('[data-cell="0"]')?.focus({preventScroll:true}));
    return()=>cancelAnimationFrame(frame);
  },[phase]);
  useEffect(() => {
    if (phase === 'SELECT' && current.selectMs && canPlay() && remaining <= 0) { clearTimeout(pending.current); submit({ cells: selectedRef.current, timeout: true }, selectAt + current.selectMs, index); }
  }, [phase, remaining, current.selectMs, index]);
  const choose = (cell) => {
    if (!canPlay() || memoryPhase(elapsedNow(), previousAt, index, current) !== 'SELECT' || review) return;
    const next = toggleCell(selectedRef.current, cell, current.targets);
    selectedRef.current = next; setSelected(next); clearTimeout(pending.current);
    if (next.length === current.targets) pending.current = setTimeout(() => submit({ cells: next }, selectAt + 120, index), 220);
  };
  const moveFocus=(event,cell)=>{
    keyboard.current=true;
    const step={ArrowRight:1,ArrowLeft:-1,ArrowDown:board.size,ArrowUp:-board.size}[event.key];
    if(step===undefined&&event.key!=='Home'&&event.key!=='End')return;
    event.preventDefault();
    const next=event.key==='Home'?0:event.key==='End'?board.size**2-1:Math.max(0,Math.min(board.size**2-1,cell+step));
    setFocusCell(next);grid.current?.querySelector(`[data-cell="${next}"]`)?.focus({preventScroll:true});
  };
  const title = ({ PREPARE: 'Sẵn sàng…', FLASH: 'GHI NHỚ Ô SAO!', HIDE: 'Đợi bảng tắt…', SELECT: `CHỌN ${current.targets} Ô ĐÃ SÁNG`, REVIEW: feedback?.state === 'wrong' ? 'XEM LẠI MỘT CHÚT' : 'NHỚ CHUẨN RỒI!' })[phase];
  return <div className="arcade-memory-room" data-phase={phase}>
    <div className="arcade-memory-heading"><span className={levelUp && !review ? 'arcade-level-label' : ''}>{levelUp && !review ? `✦ LEVEL UP · ${current.size} × ${current.size}` : `VÒNG ${index + (review ? 0 : 1)} · NẤC ${board.level} · ${board.size} × ${board.size}`}</span><strong role="status">{title}</strong><small>{review?'Kết quả vòng vừa rồi':phase === 'SELECT' ? `${selected.length}/${current.targets} ô · bấm lại để bỏ chọn` : phase === 'FLASH' ? `${current.targets} ô sao · ${(current.revealMs / 1000).toFixed(1)} giây để nhớ` : 'Nhớ vị trí · chờ tắt · chọn lại'}</small></div>
    <div className="memory-round-summary" role="status">
      <div className="memory-round-result" aria-hidden={!review} style={{visibility:review?'visible':'hidden'}}><span>✓ <b>{review?feedback.cells.filter(x=>board.cells.includes(x)).length:0}</b> đúng</span><span>× <b>{review?feedback.cells.filter(x=>!board.cells.includes(x)).length:0}</b> nhầm</span><span>◇ <b>{review?board.cells.filter(x=>!feedback.cells.includes(x)).length:0}</b> sót</span><strong>{review?`${feedback.delta>0?'+':''}${feedback.delta} · x${feedback.combo??0}`:''}</strong></div>
      {['FLASH','SELECT','PREPARE'].map(step=><span className="memory-round-hint" key={step} aria-hidden={review||(phase==='FLASH'||phase==='SELECT'?phase: 'PREPARE')!==step} style={{visibility:!review&&(phase==='FLASH'||phase==='SELECT'?phase:'PREPARE')===step?'visible':'hidden'}}>{step==='FLASH'?'Nhìn các ô sao':step==='SELECT'?'Chọn ô · Space / Enter hoặc chạm':'Chuẩn bị nhịp tiếp theo'}</span>)}
    </div>
    <div className="arcade-memory-tableau">
    <div className="arcade-memory-companion"><PlayerAvatar2D player={me} state={feedback?.state} feedbackId={feedback?.id} /><small>{phase === 'SELECT' ? 'Đến lượt bạn!' : phase === 'FLASH' ? 'Nhìn kỹ nào!' : 'Bạn làm được mà!'}</small></div>
    <div ref={grid} key={board.size} className={`arcade-memory-board phase-${phase.toLowerCase()}`} role="group" aria-label={`Bảng trí nhớ ${board.size} nhân ${board.size}`} data-phase={phase} data-feedback={review ? feedback.state : 'idle'} style={{ gridTemplateColumns: `repeat(${board.size}, 1fr)`, '--memory-size': board.size }}>
      {Array.from({ length: board.size ** 2 }, (_, cell) => {
        const lit = phase === 'FLASH' && board.cells.includes(cell);
        const pressed = !review && selected.includes(cell);
        const correct = review && feedback.cells.includes(cell) && board.cells.includes(cell);
        const missed = review && !feedback.cells.includes(cell) && board.cells.includes(cell);
        const incorrect = review && feedback.cells.includes(cell) && !board.cells.includes(cell);
        const state = correct ? 'correct' : missed ? 'missed' : incorrect ? 'incorrect' : lit ? 'lit' : pressed ? 'selected' : 'hidden';
        return <button key={cell} type="button" data-cell={cell} data-cell-state={state} className={`arcade-memory-tile ${lit ? 'is-lit' : ''} ${pressed ? 'is-selected' : ''}`} aria-label={`Ô hàng ${Math.floor(cell / board.size) + 1}, cột ${cell % board.size + 1}${lit ? ', sao sáng' : correct ? ', chọn đúng' : missed ? ', bỏ sót' : incorrect ? ', chọn nhầm' : ''}`} aria-pressed={pressed} tabIndex={cell===focusCell?0:-1} disabled={phase !== 'SELECT' || !canPlay()} onKeyDown={e=>moveFocus(e,cell)} onPointerDown={()=>{keyboard.current=false;setFocusCell(cell);}} onClick={() => choose(cell)}><span aria-hidden="true">{correct ? '✓' : incorrect ? '×' : missed ? '◇' : lit ? '✦' : pressed ? '✓' : '·'}</span></button>;
      })}
    </div>
    <div className="arcade-memory-rivals">{players.filter((p) => p.id !== me.id).map((p) => <div key={p.id}><RivalAvatar player={p} /><small>{p.finishedAt ? 'Đã về đích' : `Vòng ${p.metrics.attempts + 1} · x${p.metrics.combo}`}</small></div>)}</div>
    </div>
    <div className="arcade-memory-phase-track" aria-hidden="true"><span className={phase === 'FLASH' ? 'active' : ''}>① Ghi nhớ</span><i /><span className={phase === 'SELECT' ? 'active' : ''}>② Chọn lại</span><i /><span className={review ? 'active' : ''}>③ So kết quả</span></div>
    <div className="memory-reveal-meter" role="progressbar" aria-label="Thời gian ghi nhớ" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(revealFraction*100)} aria-hidden={phase!=='FLASH'} style={{visibility:phase==='FLASH'?'visible':'hidden'}}><i style={{transform:`scaleX(${revealFraction})`}}/></div>
    {current.selectMs && <div className="arcade-memory-selection-time" style={{ visibility: phase === 'SELECT' ? 'visible' : 'hidden' }} aria-hidden={phase !== 'SELECT'}><span>Còn {Math.ceil(remaining / 1000)}s để chọn</span><i style={{ transform: `scaleX(${Math.min(1, remaining / current.selectMs)})` }} /></div>}

  </div>;
}
