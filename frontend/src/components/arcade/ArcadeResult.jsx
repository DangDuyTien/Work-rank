import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Trophy, RotateCcw } from 'lucide-react';
import { AnimatedNumber, Button } from '../ui';
import { PlayerAvatar2D } from './ArcadeArt';
import { compareResults } from '../../../../shared/arcade/engine.mjs';
import { ArcadePodium } from './ArcadeShared';
import { arcadeSound } from '../../utils/arcadeSound';

export default function ArcadeResult({ snapshot, userId, onReplay, onBoard, busy }) {
  useEffect(() => { const frame = requestAnimationFrame(() => arcadeSound.play('finish')); return () => cancelAnimationFrame(frame); }, []);
  const allDone = snapshot.room.status === 'FINISHED';
  const ranked = snapshot.players.map((p) => ({ ...p, ...(p.result || p.metrics) })).sort(compareResults);
  const ownIndex = ranked.findIndex((p) => String(p.userId) === String(userId));
  const own = ranked[ownIndex];
  const solo = snapshot.room.mode === 'SOLO';
  const type = snapshot.room.gameType;
  const isRecord = own.isPersonalBest;
  const label = type === 'computer_rush' ? 'Từ đúng' : type === 'memory_flash' ? 'Vòng đúng' : 'PERFECT';
  const stats = [{ name: label, value: type === 'direction_rush' ? own.perfectCount || 0 : own.correct }, { name: 'Chính xác', value: `${own.accuracy}%` }, { name: type === 'memory_flash' ? 'Chuỗi tốt nhất' : 'Combo tốt nhất', value: `x${own.bestCombo}` }, { name: type === 'direction_rush' ? 'Phản xạ TB' : 'Phản hồi TB', value: `${own.avgResponseMs}ms` }];
  const title = !allDone ? 'Bạn đã về đích!' : isRecord ? 'KỶ LỤC MỚI!' : solo ? 'Thêm một ván nữa nhé?' : ownIndex === 0 ? 'BẠN CHIẾN THẮNG!' : `${ranked[0].name} chiến thắng!`;
  return <section className={`arcade-result arcade-result-polished ${isRecord ? 'is-record' : ''}`}>
    <div className="arcade-result-cup" aria-hidden="true">{isRecord ? '✦' : ownIndex === 0 ? '🏆' : ['🥇', '🥈', '🥉'][ownIndex] || '✦'}</div>
    <p className="arcade-kicker">{allDone ? solo ? 'VÁN CHƠI CỦA BẠN' : `BẠN VỀ ĐÍCH #${ownIndex + 1} · ${snapshot.room.mode}` : 'ĐIỂM CỦA BẠN ĐÃ ĐƯỢC GHI NHẬN'}</p>
    <h2>{title}</h2>
    <p className="arcade-result-message">{!allDone ? 'Bạn cùng sân đang hoàn thành. Ván sau sẽ mở khi tất cả đã về đích.' : own.forfeited ? 'Nghỉ một nhịp rồi trở lại nhé.' : isRecord ? own.previousBestScore ? `Vượt mốc cũ ${own.previousBestScore.toLocaleString('vi-VN')} thêm ${own.improvement.toLocaleString('vi-VN')} điểm!` : 'Thành tích đầu tiên đã có tên bạn. Giờ hãy thử vượt chính mình!' : own.previousBestScore ? `Chỉ còn ${Math.max(1, own.previousBestScore - own.score + 1).toLocaleString('vi-VN')} điểm nữa để phá kỷ lục ${own.previousBestScore.toLocaleString('vi-VN')}.` : 'Giữ nhịp thêm một chút, chuỗi tiếp theo có thể sẽ là kỷ lục.'}</p>
    {solo ? <div className="arcade-solo-finish"><PlayerAvatar2D player={own} state={own.forfeited ? 'idle' : 'win'} /><div className="arcade-final-score"><span>ĐIỂM CỦA BẠN</span><strong><AnimatedNumber value={own.score || 0} duration={420} /></strong><small>{own.awardedXp ? `+${own.awardedXp} XP · Đã ghi nhận` : 'Một bước gần hơn tới kỷ lục'}</small></div></div>
      : allDone ? <ArcadePodium players={ranked} /> : <div className="arcade-solo-finish"><PlayerAvatar2D player={own} state="finish" /></div>}
    <dl className="arcade-result-highlights">{stats.map((s) => <div key={s.name}><dt>{s.name}</dt><dd>{s.value}</dd></div>)}</dl>
    {type === 'direction_rush' && <p className="arcade-result-detail">{own.correct} hướng đúng · {own.wrongCount || 0} lần lỡ nhịp{own.timeoutCount ? ` (hết giờ ${own.timeoutCount})` : ''}</p>}
    <div className="arcade-actions"><Button onClick={onReplay} disabled={!allDone || busy}><RotateCcw size={18} />{busy ? 'Đang mở ván mới…' : snapshot.room.rematchId ? 'Vào ván tiếp theo' : 'Chơi lại'}</Button><Button variant="secondary" onClick={onBoard}><Trophy size={17} /> BXH</Button><Link to="/games">Game Center</Link></div>
    {allDone && <p className="arcade-replay-hint">{solo ? 'Một chạm · giữ chế độ · thử thách mới' : 'Giữ nhóm cùng sân · vào phòng ván mới, sẵn sàng và chơi'}</p>}
  </section>;
}
