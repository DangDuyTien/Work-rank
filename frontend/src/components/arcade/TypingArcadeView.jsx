import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button, TabTransition } from '../ui';
import { ArcadeHUD, ArcadeCountdown, ArcadePodium, ArcadeSoundControl, ArcadeComplete } from './ArcadeShared';
import { PlayerAvatar2D } from './ArcadeArt';
import TypingRaceTracks from './TypingRaceTracks';
import SavedGameHistory from './SavedGameHistory';
import { modeLabelVi } from '../../games/arcade/catalog';
import '../arcade/arcade.css';
import '../arcade/arcade-polish.css';
import './typing-race.css';

function TypingPulse({ telemetry }) {
  const data = useSyncExternalStore(telemetry.subscribe, telemetry.getState, telemetry.getState);
  return <div className="typing-pulse" data-feedback={data.keyFeedback || 'idle'}><span>{data.reaction === 'wrong' ? 'Sửa ký tự đỏ · giữ bình tĩnh nhé' : data.reaction === 'combo' ? '✦ Giữ nhịp đẹp lắm!' : data.combo > 0 ? '✓ Đúng từ · tiếp tục nào!' : 'Gõ đúng từng chữ · Backspace để sửa'}</span><b>x{data.combo || 0} CHUỖI</b></div>;
}
function TypingFinish({ players, result, practiceResult, user, best, combo, time, onReplay, host, busy, onBoard }) {
  const source = result?.results || [];
  const ranked = source.length ? [...source].sort((a,b) => (a.individualRank || 999)-(b.individualRank || 999)) : [{ ...practiceResult, userId: user.id, user, individualRank: 1 }];
  const mine = ranked.find(p => String(p.userId) === String(user.id)) || {};
  const podium = ranked.slice(0,3).map((p,i) => ({ ...p, name: p.user?.name || players.find(x => String(x.userId)===String(p.userId))?.user?.name || user.name, position: i+1, score: p.wpm || 0, unit: 'WPM' }));
  const record = best > 0 && mine.eligible !== false && mine.wpm > best && (result || practiceResult?.recorded);
  return <section className="arcade-result arcade-result-polished typing-finish"><p className="arcade-kicker">VĂN BẢN CỔ ĐIỂN · ĐÃ VỀ ĐÍCH</p><h2>{record ? 'KỶ LỤC MỚI!' : ranked.length>1 ? `Bạn về đích #${mine.individualRank || '—'}` : 'Đường đua đã có dấu chân bạn!'}</h2>
    <ArcadePodium players={podium} />
    <p className="arcade-result-saved">✓ Kết quả đã lưu trên hệ thống · Hạng #{mine.individualRank || 1} · {mine.performanceScore || 0} điểm thành tích · {mine.awardedXp ?? mine.scoreDelta ?? 0} XP</p>
    <dl className="arcade-result-highlights">{[['Tốc độ',`${mine.wpm || 0} WPM`],['Chính xác',`${mine.accuracy || 0}%`],['Thời gian',`${Math.round((mine.completionTimeMs || time*1000)/1000)} giây`],['Chuỗi tốt nhất',`x${combo || 0}`]].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    <p>{best > 0 ? record ? `Vượt mốc ${best} WPM thêm ${Math.round((mine.wpm-best)*10)/10} WPM!` : `Kỷ lục đã xác minh: ${best} WPM · Thêm ${Math.max(0,Math.round((best-(mine.wpm||0)+.1)*10)/10)} WPM để vượt mốc.` : practiceResult && !practiceResult.recorded ? 'Khởi động nhanh · lượt từ 2 phút đủ điều kiện sẽ được ghi bảng xếp hạng.' : 'Thành tích được máy chủ đối chiếu với nội dung đã gõ.'}</p>
    <div className="arcade-actions"><Button onClick={onReplay} disabled={!host || busy}>{busy?'Đang mở ván…':players.length>1?'Chơi lại cùng nhóm':'Chơi lại'}</Button><Button variant="secondary" onClick={onBoard}><Trophy size={16}/> BXH</Button><Link to="/games">Trung tâm trò chơi</Link></div>{!host&&<p>Chờ chủ phòng mở ván tiếp theo · bạn vẫn ở cùng nhóm.</p>}
  </section>;
}
export default function TypingArcadeView({ user, room, players, isSpectator, roomError, loading, practiceLoading, practiceError, activeTab, setActiveTab, selectedDuration, setDuration, roomList, leaderboard, myStats, input, passage, telemetry, timeRemaining, liveWpm, liveAccuracy, combo, bestCombo, finished, result, practiceResult, countdown, onRestart, onLeave, onReady, onReset, onCreate, onJoin, onRetry, onSwitchTeam, onBoard }) {
  const [mode,setMode]=useState('1V1'), [creating,setCreating]=useState(false);
  const previousBest=useRef(myStats?.bestWpm || 0);
  useEffect(()=>{ if(!finished)previousBest.current=myStats?.bestWpm || 0; },[finished,myStats?.bestWpm]);
  const target=useRef(null), root=useRef(null);
  useEffect(()=>{
    let frame;
    const visible=()=>{
      cancelAnimationFrame(frame);
      frame=requestAnimationFrame(()=>{
        const viewportHeight=window.visualViewport?.height || window.innerHeight;
        const compact=window.innerWidth<768 && viewportHeight<550;
        root.current?.classList.toggle('typing-keyboard-compact',compact);
        // Scroll the page's real scroll container, never the clipped race scene.
        const consoleEl=target.current, main=consoleEl?.closest('.app-main');
        const scene=consoleEl?.closest('.arcade-scene');
        if(scene)scene.scrollTop=0;
        if(!compact || !main || document.activeElement?.tagName!=='INPUT')return;
        const rect=consoleEl.getBoundingClientRect(), mainRect=main.getBoundingClientRect();
        const top=Math.max(64,mainRect.top), bottom=Math.min(viewportHeight,mainRect.bottom);
        if(rect.top<top || rect.bottom>bottom){
          const world=consoleEl.closest('.typing-race-world').getBoundingClientRect();
          main.scrollBy({top:world.top-top,behavior:'instant'});
        }
      });
    };
    visible();
    window.visualViewport?.addEventListener('resize',visible);
    window.addEventListener('resize',visible);
    return()=>{cancelAnimationFrame(frame);window.visualViewport?.removeEventListener('resize',visible);window.removeEventListener('resize',visible);};
  },[]);
  const me=players.find(p=>String(p.userId)===String(user.id));
  const waiting=room&&['WAITING','STARTING'].includes(room.status), host=!room||String(room.hostUserId)===String(user.id);
  const readyResult=room?.status==='FINISHED'&&result?.results?.length>0||!room&&finished&&practiceResult;
  const [resultVisible,setResultVisible]=useState(false);
  useEffect(()=>{setResultVisible(false);if(!readyResult)return;const timer=setTimeout(()=>setResultVisible(true),340);return()=>clearTimeout(timer);},[Boolean(readyResult)]);
  const done=readyResult&&resultVisible;
  const create=async()=>{setCreating(true);await onCreate(mode,selectedDuration);setCreating(false);};
  return <div ref={root} className="arcade-page typing_battle typing-page"><header className="arcade-topbar"><button type="button" onClick={onLeave}><ArrowLeft size={17}/>{room?'Rời phòng':'Đổi chế độ gõ'}</button><span className="arcade-brand">WORK RANK <b>ARCADE</b></span><ArcadeSoundControl/></header>
    <div className="typing-arcade-heading"><div><p className="arcade-kicker">VĂN BẢN CỔ ĐIỂN</p><h1>ĐUA GÕ CHỮ</h1><p>Chế độ gốc · Gõ cả đoạn văn · Tính WPM</p></div>{!room&&<span className="arcade-best-chip">★ Kỷ lục: {myStats?.bestWpm ? `${myStats.bestWpm} WPM` : 'chưa có'}</span>}</div>
    {(roomError||practiceError)&&<div className="arcade-notice" role="alert">{roomError||practiceError}<Button variant="secondary" onClick={onRetry}>Thử lại</Button></div>}
    {!room&&<div className="typing-arcade-tabs">{[['practice','Một mình · Luyện nhịp'],['arena','Đấu nhóm'],['leaderboard','BXH'],['history','Lịch sử']].map(([k,l])=><button type="button" key={k} aria-pressed={activeTab===k} onClick={()=>setActiveTab(k)}>{l}</button>)}</div>}
    <TabTransition key={room?'room':activeTab} minHeight={500}>
      {done?<TypingFinish players={players} result={result} practiceResult={practiceResult} user={user} best={previousBest.current} combo={bestCombo} time={selectedDuration} host={host} busy={loading} onReplay={room?onReset:onRestart} onBoard={onBoard}/>
      :readyResult?<ArcadeComplete score={(result?.results||[]).find(p=>String(p.userId)===String(user.id))?.wpm??practiceResult?.wpm} rank={(result?.results||[]).find(p=>String(p.userId)===String(user.id))?.individualRank??1}/>:waiting?<section className="arcade-lobby"><p className="arcade-kicker">{modeLabelVi(room.mode)} · CÙNG SÂN, CÙNG ĐÍCH</p><h2>{room.title}</h2><div className="arcade-lobby-stage">{players.map((p,i)=><div key={p.userId}><PlayerAvatar2D player={{...p,name:p.user?.name,position:i%3+1}} state={p.isReady?'ready':'idle'}/><span className="arcade-ready-label">{p.isReady?'✓ Sẵn sàng':'Đang chuẩn bị'}</span></div>)}</div><p>Gõ đoạn văn xuất hiện · Backspace để sửa · Avatar tiến theo số chữ đã gõ.</p>{room.status==='WAITING'?<><Button onClick={onReady}>{room.mode==='SOLO'?'Bắt đầu đường đua':me?.isReady?'Hủy sẵn sàng':'Tôi đã sẵn sàng'}</Button><p>{players.length}/{room.maxPlayers} người · Tất cả sẵn sàng → đếm ngược 3 giây</p>{['2V2','3V3'].includes(room.mode)&&<div className="arcade-actions"><Button variant="secondary" onClick={()=>onSwitchTeam('A')}>Đội xanh</Button><Button variant="secondary" onClick={()=>onSwitchTeam('B')}>Đội cam</Button></div>}</>:<div className="typing-lobby-count"><ArcadeCountdown value={countdown ?? 3} instruction="Nhìn chữ · giữ nhịp cùng nhau"/></div>}</section>
      :!room&&activeTab==='history'?<SavedGameHistory kind="typing"/>:!room&&activeTab==='arena'?<section className="arcade-menu"><h2>Chọn bạn cùng đua</h2><div className="arcade-mode-select">{[['SOLO','Một mình · phá kỷ lục'],['1V1','Hai người · 1 chọi 1'],['TRIO','Ba người · tranh hạng']].map(([k,l])=><button key={k} aria-pressed={mode===k} onClick={()=>setMode(k)}><b>{modeLabelVi(k)}</b><small>{l}</small></button>)}</div><div className="arcade-start-row"><select aria-label="Thời lượng đường đua" value={selectedDuration} onChange={e=>setDuration(Number(e.target.value))}>{[30,60,120,300].map(n=><option key={n} value={n}>{n} giây</option>)}</select><Button onClick={create} disabled={creating}>{creating?'Đang mở…':'Mở đường đua'}</Button></div><div className="arcade-room-list"><h3>Phòng chờ · vào cùng bạn bè</h3>{roomList.filter(r=>(r.playerCount??r.players?.length??0)>0).map(r=><button key={r.id} onClick={()=>onJoin(r.id)}><span><b>{r.title}</b><small>{modeLabelVi(r.mode)} · {r.playerCount??r.players?.length}/{r.maxPlayers}</small></span><strong>Vào đua →</strong></button>)}{!roomList.length&&<p className="arcade-empty">Đường đua đang đợi bạn. Mở phòng để mời bạn bè!</p>}</div></section>
      :!room&&activeTab==='leaderboard'?<section className="arcade-leaderboard"><h2>Kỷ lục đường đua</h2><p>Thành tích do máy chủ xác minh · {myStats?.bestWpm || 0} WPM tốt nhất của bạn</p><div className="arcade-table-scroll"><table><thead><tr><th>Hạng</th><th>Tay đua</th><th>WPM</th><th>Chính xác</th></tr></thead><tbody>{leaderboard.map((p,i)=><tr key={p.userId||i}><td>{p.rank||i+1}</td><td>{p.user?.name||p.name}</td><td>{p.wpm||p.bestWpm}</td><td>{p.accuracy||p.bestAccuracy}%</td></tr>)}</tbody></table></div></section>
      :<><div className="arcade-world arcade-polished typing-race-world"><ArcadeHUD time={timeRemaining} score={Math.round(liveWpm)} combo={combo} rank={me?.liveRank} count={players.length} scoreLabel="TỐC ĐỘ · WPM" animateScore={false}/><div className="arcade-scene typing-race-scene"><div className="arcade-cloud cloud-one"/><div className="arcade-cloud cloud-two"/><TypingRaceTracks players={players} user={user} telemetry={telemetry} duration={room?.durationLimitSeconds || selectedDuration}/><div ref={target} className="typing-race-console"><div className="typing-console-label"><b>{isSpectator?'ĐANG XEM ĐƯỜNG ĐUA':'GÕ ĐOẠN NÀY'}</b><span>{liveAccuracy}% chính xác</span></div>{passage}{!isSpectator&&input}<TypingPulse telemetry={telemetry}/></div>{finished&&!done&&<p role="status">✓ Bạn đã về đích · Đang chờ thành tích chung…</p>}{practiceLoading&&<p role="status">Đang chuẩn bị đường đua…</p>}</div></div>{!room&&<div className="typing-practice-options"><span>Gõ chữ đầu để bắt đầu đồng hồ</span><select aria-label="Thời lượng chơi một mình" value={selectedDuration} onChange={e=>setDuration(Number(e.target.value))}>{[30,60,120,300].map(n=><option key={n} value={n}>{n} giây{n===120?' · Ghi kỷ lục':''}</option>)}</select><Button variant="secondary" onClick={onRestart}>Bài mới</Button></div>}</>}
    </TabTransition>
  </div>;
}
