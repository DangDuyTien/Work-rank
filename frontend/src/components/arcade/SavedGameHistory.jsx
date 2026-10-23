import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { arcadeApi } from '../../games/arcade/useArcadeSession';
import { typingGameApi } from '../../services/api';
import { gameMenuName, modeShortVi } from '../../games/arcade/catalog';
import { Button, PageState } from '../ui';
import './saved-game-history.css';

export default function SavedGameHistory({ kind, gameType, onOpen }) {
  const [rows,setRows]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
  useEffect(()=>{let alive=true;setError('');
    const request=kind==='typing'?typingGameApi.getHistory():arcadeApi(`/history?gameType=${gameType}`);
    request.then(data=>{if(alive)setRows(data.attempts);}).catch(()=>{if(alive)setError('Không đọc được lịch sử đã lưu. Vui lòng thử lại.');});
    return()=>{alive=false;};
  },[kind,gameType,retry]);
  return <section className="saved-game-history"><p className="arcade-kicker">THÀNH TÍCH CỦA BẠN</p><h2>Lịch sử đã lưu</h2><p>20 lượt gần nhất từ hệ thống · giữ cả ván theo luật cũ.</p>
    {error?<div role="alert">{error}<Button variant="secondary" onClick={()=>setRetry(x=>x+1)}>Thử lại</Button></div>:!rows?<PageState type="loading" message="Đang đọc thành tích…"/>:!rows.length?<p>Chưa có lượt hoàn thành. Cùng tạo dấu mốc đầu tiên nhé!</p>:<div className="saved-history-list" role="list">{rows.map(r=>{
      const typing=kind==='typing',label=typing?'Đua Gõ Chữ':gameMenuName(r.gameType);
      const stats=typing?[['WPM',r.wpm],['Chính xác',`${r.accuracy}%`],['Hạng',r.individualRank?`#${r.individualRank}`:'Một mình'],['Điểm thành tích',r.performanceScore??0],['XP đã ghi',r.scoreDelta??r.awardedXp??0],['Thời gian',`${Math.round((r.completionTimeMs||r.durationSeconds*1000||0)/1000)} giây`]]:[['Điểm',r.score],['Hạng',`#${r.rank}`],['Chính xác',`${r.accuracy}%`],['Đúng',r.correct],['Chuỗi tốt nhất',`x${r.bestCombo}`],['XP đã ghi',r.awardedXp||0]];
      return <article role="listitem" key={r.attemptId}><header><b>{label} · {modeShortVi(r.mode)}</b><time dateTime={r.finishedAt}>{new Date(r.finishedAt).toLocaleString('vi-VN')}</time></header><dl>{stats.map(([name,value])=><div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl><footer><span>{r.forfeited?'Đã rời ván':r.kind==='practice'&&!r.recorded?'Khởi động · không ghi bảng xếp hạng':'✓ Đã lưu trên hệ thống'}</span>{!typing&&<Link to={`/games/arcade/${r.gameType}/room/${r.roomId}`} onClick={onOpen}>Xem kết quả →</Link>}</footer></article>;
    })}</div>}
  </section>;
}
