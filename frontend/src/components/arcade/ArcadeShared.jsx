import React, { memo, useEffect, useRef, useSyncExternalStore } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { AnimatedNumber } from '../ui';
import { arcadeSound } from '../../utils/arcadeSound';
import { PlayerAvatar2D } from './ArcadeArt';
import './arcade-system.css';
import './gameplay-polish.css';

export function ArcadeComplete({score,rank,pending=false}) {
  return <section className="arcade-complete-beat" role="status" data-testid="game-complete"><span>✓ HOÀN THÀNH VÁN</span><strong>{score??'—'}</strong><small>{pending?'Đang chốt thành tích…':rank?`Về đích #${rank} · Đã lưu kết quả`:'Đã lưu điểm · Chờ hạng cuối'}</small></section>;
}

export const ArcadeHUD = memo(function ArcadeHUD({ time, score, combo = 0, rank, count, scoreLabel = 'ĐIỂM CỦA BẠN', comboLabel = 'CHUỖI', animateScore = true }) {
  return <header className="arcade-hud" data-pressure={time<=10} aria-label="Trạng thái ván chơi"><div><span>CÒN LẠI</span><strong role="timer">{time}<small>s</small></strong></div><span className="arcade-world-label"><b>{count > 1 ? `#${rank || '—'}/${count}` : `x${combo}`}</b><small>{count > 1 ? `x${combo} · ` : ''}{comboLabel}</small></span><div><span>{scoreLabel}</span><strong>{animateScore ? <AnimatedNumber value={score} duration={180} /> : score.toLocaleString('vi-VN')}</strong></div></header>;
});
export function ArcadeSoundControl() {
  const muted = useSyncExternalStore(arcadeSound.subscribe, arcadeSound.isMuted, () => true);
  return <button className="arcade-sound-toggle" type="button" aria-label={muted ? 'Bật âm thanh Arcade' : 'Tắt âm thanh Arcade'} aria-pressed={!muted} onClick={() => arcadeSound.setMuted(!muted)}>{muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>;
}
export function ArcadeCountdown({ value, instruction, hint }) {
  const previous = useRef(null);
  useEffect(() => { if (value != null && value !== previous.current) { previous.current = value; arcadeSound.play(value === 0 ? 'start' : 'countdown'); } }, [value]);
  if (value == null) return null;
  return <div className={value === 0 ? 'arcade-go' : 'arcade-countdown'} role="status"><span key={value}>{value === 0 ? 'BẮT ĐẦU!' : value}</span>{value > 0 && <><strong>{instruction}</strong><small>{hint || 'Sẵn sàng…'}</small></>}</div>;
}
export const ArcadePodium = memo(function ArcadePodium({ players }) {
  return <div className="arcade-podium">{players.map((p, i) => <div key={p.id || p.userId} className={`arcade-podium-place place-${i + 1}`}><span className="arcade-medal">{['🥇', '🥈', '🥉'][i] || `#${i + 1}`}</span><PlayerAvatar2D player={p} state={i === 0 ? 'win' : 'lose'} /><div className="arcade-podium-block"><b>{p.score}</b><small>#{i + 1}{p.unit ? ` · ${p.unit}` : ''}</small></div></div>)}</div>;
});
