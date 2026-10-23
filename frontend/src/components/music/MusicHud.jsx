import React, { memo } from 'react';

/**
 * Numbers a player actually uses while singing: score, how much of the song
 * kept playing, how far behind the current line they are, and the streak.
 * The "behind" meter is deliberately not a timer — it is a feel.
 */
function MusicHud({ score = 0, flowPct = 100, streak = 0, behindChars = 0, lineChars = 1, lineProgress = 0, pauseCount = 0, paused = false }) {
  const span = Math.max(6, lineChars);
  const ratio = Math.max(0, Math.min(1, 0.5 - behindChars / (span * 2)));
  const late = behindChars > 0;

  return (
    <div className="music-hud" data-late={late} data-paused={paused}>
      <div className="music-hud-block music-hud-score">
        <span>ĐIỂM</span>
        <b>{Number(score).toLocaleString('vi-VN')}</b>
      </div>

      <div className="music-hud-block music-hud-flow">
        <span>ĐỘ LIỀN MẠCH</span>
        <div className="music-hud-flow-row">
          <b>{flowPct}%</b>
          <i className="music-hud-flow-track"><i style={{ transform: `scaleX(${Math.max(0, Math.min(1, flowPct / 100))})` }} /></i>
        </div>
      </div>

      <div className="music-hud-block music-behind">
        <div className="music-behind-labels">
          <span>THEO KỊP</span>
          <span>CHẬM</span>
        </div>
        <div className="music-behind-track">
          <i className="music-behind-fill" style={{ transform: `scaleX(${ratio})` }} />
          <i className="music-behind-dot" style={{ left: `${ratio * 100}%` }} />
        </div>
        <small>{late ? `đang chậm ${behindChars} ký tự` : 'đang bám nhịp'}</small>
      </div>

      <div className="music-hud-block music-hud-side">
        <span>CHUỖI GIỮ NHỊP</span>
        <b>{streak > 0 ? `x${streak}` : '—'}</b>
        <small>{pauseCount > 0 ? `nhạc dừng ${pauseCount} lần` : 'nhạc chưa dừng lần nào'}</small>
      </div>

      <div className="music-line-progress" aria-hidden="true">
        <i style={{ transform: `scaleX(${Math.max(0, Math.min(1, lineProgress))})` }} />
      </div>
    </div>
  );
}

export default memo(MusicHud);
