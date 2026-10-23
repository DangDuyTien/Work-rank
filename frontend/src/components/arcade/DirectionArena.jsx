import React, { memo, useEffect, useRef, useState } from 'react';
import { ARROWS, directionForKey, directionForSwipe, DIRECTION_MIN_RESPONSE_MS } from '../../../../shared/arcade/engine.mjs';
import { PlayerAvatar2D } from './ArcadeArt';
import { RivalAvatar } from './RaceStrip';
import { FlipList } from '../ui';
import './direction-queue.css';

// Logical input advances immediately; keyed faces keep their DOM identity while
// moving through depth. The wrong cue stays foreground throughout the penalty.
const DirectionStack = memo(function DirectionStack({ current, index, upcoming, feedback, frozen, tempo }) {
  const cues=frozen
    ? [{...feedback.challenge,index:index-1}, {...current,index}, ...upcoming.slice(0,2)]
    : [{...current,index}, ...upcoming];
  const exiting=!frozen&&feedback&&feedback.state!=='wrong'?{...feedback.challenge,index:index-1}:null;
  const items=[...(exiting?[{...exiting,depth:-1}]:[]),...cues.map((cue,depth)=>({...cue,depth}))];
  return <div className="direction-stack" data-frozen={frozen} data-tempo={tempo} data-visible-index={cues[0].index} role="group" aria-label="Chồng hướng: hướng hiện tại ở phía trước">
    <span className="direction-stack-caption">{frozen?'KHỰNG · x0':'BÂY GIỜ'}{!frozen&&<em> · TIẾP THEO Ở SAU</em>}</span>
    <FlipList className="direction-stack-track" enabled={false}>{items.map(cue=><div key={cue.index} data-flip-id={cue.index} className="direction-stack-card" data-depth={cue.depth} style={{zIndex:cue.depth<0?5:4-cue.depth}}>
      <div className="direction-stack-face" data-color={cue.depth===0?cue.color||0:0} data-wrong={frozen&&cue.depth===0}>
        {cue.depth===0?<strong data-testid="challenge-direction" data-direction={cue.direction} data-expected={cue.expected||cue.direction} role="img" aria-label={`Hướng ${cue.direction}`}>{ARROWS[cue.direction]}</strong>
          :<span aria-hidden="true" className="direction-stack-hint" data-testid={cue.depth>0?'queued-direction':undefined} data-direction={cue.depth>0?cue.direction:undefined} data-queue-index={cue.index}>{cue.depth===3?'◇':ARROWS[cue.direction]}</span>}
      </div>
    </div>)}</FlipList>
  </div>;
});

export default function DirectionArena({ current, index, elapsed, durationMs, elapsedNow, previousAt, canPlay, submit, players, me, feedback, rulesVersion, getDirectionState, upcoming, localMetrics }) {
  const arena=useRef(null),pointer=useRef(null),buffer=useRef(null),timer=useRef(null),latest=useRef(null);
  const [buffered,setBuffered]=useState(false);
  const modern=rulesVersion>=3;
  const readyAt=previousAt+(current.revealMs||0)+(current.stumbleMs||0);
  const entering=!modern && (current.revealMs||0)>0 && elapsed<readyAt;
  const stumbling=modern && elapsed<previousAt+(current.stumbleMs||0);
  latest.current={canPlay,elapsedNow,getDirectionState,submit,modern};
  useEffect(()=>{arena.current?.focus({preventScroll:true});return()=>clearTimeout(timer.current);},[]);
  useEffect(()=>{
    if(canPlay() && elapsed-readyAt>=current.windowMs)submit({direction:null},readyAt+current.windowMs,index);
  },[elapsed,readyAt,current.windowMs,index,canPlay,submit]);
  const send=(direction,fromBuffer=false)=>{
    const live=latest.current;if(!live.canPlay())return;
    const state=live.getDirectionState(),now=live.elapsedNow(),c=state.current;
    const start=state.previousAt+(c.stumbleMs||0)+(c.revealMs||0);
    // Stumble has no carry-over: do not turn key spam during the penalty into a free answer.
    if(now<state.previousAt+(c.stumbleMs||0) || (!live.modern && now<start))return;
    if(buffer.current && !fromBuffer)return;
    const earliest=start+(live.modern?DIRECTION_MIN_RESPONSE_MS:80);
    if(now<earliest){
      if(!live.modern || fromBuffer)return;
      buffer.current={direction,index:state.index};setBuffered(true);
      timer.current=setTimeout(()=>{
        const queued=buffer.current;buffer.current=null;setBuffered(false);
        if(queued && latest.current.getDirectionState().index===queued.index)send(queued.direction,true);
      },Math.ceil(earliest-now)+2);
      return;
    }
    if(now-start>=c.windowMs)live.submit({direction:null},start+c.windowMs,state.index);
    else live.submit({direction},earliest,state.index);
  };
  const shown=stumbling&&feedback?.state==='wrong'?feedback.challenge:current;
  const rule=shown.opposite?'ĐẢO CHIỀU!':shown.stage==='normal'?'NHÌN HƯỚNG · BẤM THEO':'NHÌN HƯỚNG · BỎ QUA VỊ TRÍ & MÀU';
  const warning=!current.opposite && elapsed>=durationMs*37/60 && elapsed<durationMs*40/60;
  const count=Math.max(1,Math.ceil((durationMs*40/60-elapsed)/(durationMs/60)));
  const leader=Math.max(1,...players.map(p=>p.id===me.id?localMetrics.score:p.metrics.score));
  return <div ref={arena} tabIndex={0} role="group" aria-label="Sân phản xạ — phím mũi tên hoặc WASD" className={`arcade-direction-arena ${shown.opposite?'is-opposite':''} ${modern?'has-direction-queue':''}`} data-stage={current.stage} data-feedback={feedback?.state||'idle'} data-stumbling={stumbling} data-buffered={buffered} data-current-index={index}
    onKeyDown={e=>{const direction=directionForKey(e.key);if(!direction)return;e.preventDefault();if(!e.repeat)send(direction);}}
    onPointerDown={e=>{if(!canPlay()||e.target.closest('button'))return;pointer.current={x:e.clientX,y:e.clientY,id:e.pointerId};e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerCancel={()=>{pointer.current=null;}}
    onPointerUp={e=>{if(!pointer.current||pointer.current.id!==e.pointerId)return;const d=directionForSwipe(e.clientX-pointer.current.x,e.clientY-pointer.current.y);pointer.current=null;if(d)send(d);}}>
    <div className="arcade-direction-rule"><strong>{shown.opposite?'⇄ ':'➜ '}{rule}</strong><span className={warning?'arcade-trick-anticipation':''}>{warning?`SẮP ĐẢO CHIỀU · ${count} · Chờ biển cam!`:buffered?'✓ Đã nhận phím kế tiếp':shown.opposite?'Bấm ngược hướng phía trước':modern?'Nhìn trước một nhịp · giữ nhịp tay':current.stage==='entrance'?'Chờ mũi tên dừng rồi bấm':'Mũi tên / WASD / vuốt'}</span></div>
    <div className="arcade-stimulus-zone">
      {modern?<div className="direction-stack-anchor" style={{'--arrow-slot':stumbling?shown.slot||0:current.slot||0}}><DirectionStack current={current} index={index} upcoming={upcoming} feedback={feedback} frozen={stumbling&&feedback?.state==='wrong'} tempo={elapsed>durationMs*.83?'fast':localMetrics.combo>=5?'flow':'steady'}/></div>
        :<div className="arcade-arrow-position" style={{'--arrow-slot':current.slot||0}}><div key={index} className={`arcade-arrow-object ${entering?'is-entering':''}`} data-color={current.color||0}><strong data-testid="challenge-direction" data-direction={current.direction} data-expected={current.expected||current.direction}>{ARROWS[current.direction]}</strong></div></div>}
      <span className="arcade-response-track"><i style={{transform:`scaleX(${Math.max(0,Math.min(1,1-(elapsed-readyAt)/current.windowMs))})`}}/></span>
      <div className={`arcade-direction-feedback ${feedback?'is-visible':''}`} role="status" key={feedback?.id}>
        {feedback?<><b>{stumbling?'KHỰNG!':feedback.state==='wrong'?'✕ LỠ NHỊP':`✓ ${feedback.text}`}</b>{feedback.state==='wrong'?<span>CẦN <strong>{ARROWS[feedback.expected]}</strong> <small>{feedback.direction?'BẠN BẤM':'HẾT GIỜ'}</small> <strong>{ARROWS[feedback.direction]||'—'}</strong><em>{stumbling?`x${feedback.lostCombo||0} → x0 · ${Math.max(0,(readyAt-elapsed)/1000).toFixed(1)}s`:feedback.lostCombo?`x${feedback.lostCombo} → x0`:'Thử hướng tiếp theo!'}</em></span>:<span><strong>+{feedback.delta}</strong><small>Giữ nhịp nào!</small></span>}</>:<><b>{entering?'CHỜ MŨI TÊN DỪNG…':'MŨI TÊN / WASD / VUỐT'}</b><span>{current.opposite?'⇄ Bấm ngược hướng':'Nhịp nhanh dần · giữ chuỗi'}</span></>}
      </div>
    </div>
    <div className="arcade-lanes">{players.map(p=>{const score=p.id===me.id?localMetrics.score:p.metrics.score;return <div className={`arcade-lane ${p.id===me.id?'my-lane':''}`} key={p.id}><span className="arcade-lane-line"/><span className="arcade-lane-ring"/>{modern&&<small className="direction-lane-rank">#{1+players.filter(x=>(x.id===me.id?localMetrics.score:x.metrics.score)>score).length}</small>}<div className="direction-runner-position" style={modern?{transform:`translateY(${-18*score/leader}px)`}:undefined}>{p.id===me.id?<PlayerAvatar2D player={p} state={stumbling?'wrong':feedback?.state} direction={feedback?.direction} feedbackId={feedback?.id}/>:<RivalAvatar player={p}/>}</div></div>;})}</div>
    <div className="arcade-direction-controls" role="group" aria-label="Điều khiển bốn hướng">{['UP','LEFT','DOWN','RIGHT'].map(d=><button key={d} type="button" aria-label={`Đi ${({UP:'lên',LEFT:'trái',DOWN:'xuống',RIGHT:'phải'})[d]}`} disabled={entering} aria-disabled={stumbling} data-pressed={feedback?.direction===d} onClick={()=>send(d)}>{ARROWS[d]}<small>{({UP:'W',LEFT:'A',DOWN:'S',RIGHT:'D'})[d]}</small></button>)}</div>
  </div>;
}
