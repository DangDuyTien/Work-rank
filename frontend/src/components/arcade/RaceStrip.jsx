import React, { memo, useEffect, useRef, useState } from 'react';
import { PlayerAvatar2D } from './ArcadeArt';
import { FlipList } from '../ui';

export const RivalAvatar = memo(function RivalAvatar({ player }) {
  const previous = useRef(player.metrics?.attempts || 0);
  const [state, setState] = useState('idle');
  useEffect(() => {
    if ((player.metrics?.attempts || 0) <= previous.current) return;
    previous.current = player.metrics.attempts;
    setState(player.metrics.lastCorrect === false ? 'wrong' : 'correct');
    const timer = setTimeout(() => setState('idle'), 260);
    return () => clearTimeout(timer);
  }, [player.metrics?.attempts]);
  return <PlayerAvatar2D player={player} state={player.finishedAt ? 'win' : state} feedbackId={player.revision} />;
});

export default memo(function RaceStrip({ players, userId, localMetrics, gameType }) {
  const ranked = players.map((p) => ({ ...p, live: String(p.userId) === String(userId) ? localMetrics : p.metrics })).sort((a, b) => b.live.score - a.live.score || a.position - b.position);
  const mine = ranked.findIndex((p) => String(p.userId) === String(userId));
  const lead = ranked[0]?.live.score||0;
  const previousRank=useRef(null),[overtake,setOvertake]=useState(null);
  useEffect(()=>{
    const old=previousRank.current;previousRank.current=mine;
    if(old===null||old===mine||mine<0)return;
    const passed=ranked[mine<old?mine+1:mine-1];
    setOvertake({direction:mine<old?'up':'down',text:mine<old?`↑ Vượt ${passed?.name||'đối thủ'}`:`↓ ${passed?.name||'Đối thủ'} vừa vượt`});
    const timer=setTimeout(()=>setOvertake(null),1000);return()=>clearTimeout(timer);
  },[mine]);
  if(players.length<2)return null;
  return <div className="arcade-race" aria-label="Cuộc đua trực tiếp">
    {ranked.length > 1 && <p className="arcade-race-status" data-overtake={overtake?.direction||'idle'} aria-live="polite"><b>#{mine + 1}</b> {overtake?overtake.text:mine === 0 ? lead === 0 ? 'Xuất phát cùng nhau!' : 'Bạn đang dẫn đầu!' : `Còn ${lead - ranked[mine].live.score + 1} điểm để dẫn đầu`}<span>Cùng sân · cùng thử thách</span></p>}
    <FlipList className="arcade-race-track" duration={260} easing="var(--ease-ranking)">{ranked.map((p, i) => <div className={`arcade-racer ${String(p.userId) === String(userId) ? 'is-me' : ''}`} key={p.id} data-flip-id={p.id} data-finished={!!p.finishedAt}>
      <span className="arcade-racer-position">{ranked.length > 1 ? `#${i + 1}` : '✦'}</span><span className="arcade-racer-name"><b>P{p.position} · {p.name}</b><small>{p.finishedAt ? '✓ ĐÃ VỀ ĐÍCH' : `${p.live.correct} ${gameType === 'computer_rush' ? 'từ' : gameType === 'memory_flash' ? 'vòng' : 'hướng'} đúng · x${p.live.combo}`}</small></span><strong>{p.live.score.toLocaleString('vi-VN')}</strong><span className="arcade-racer-progress"><i style={{ transform: `scaleX(${lead ? Math.max(.03, p.live.score / lead) : .03})` }} /></span>
    </div>)}</FlipList>
  </div>;
});
