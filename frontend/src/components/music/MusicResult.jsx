import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, RotateCcw, Music2, Volume2 } from 'lucide-react';
import { Button } from '../ui';

function Achievement({ earned, title, detail }) {
  return (
    <li className="music-achievement" data-earned={earned ? 'true' : 'false'}>
      <b>{earned ? '★' : '☆'} {title}</b>
      <span>{detail}</span>
    </li>
  );
}

/**
 * Result screen. Every number here comes from the server when a verified
 * result exists; the local snapshot is only a fallback while it is saving.
 */
export default function MusicResult({ song, result, local, saving, error, onReplay, onBoard, onBack }) {
  const data = result || local || {};
  const accuracy = Number(data.accuracy) || 0;
  const flowPct = Number(data.flowPct ?? data.flow) || 0;
  const pauseCount = Number(data.pauseCount) || 0;
  const bestStreak = Number(data.bestNoPauseStreak ?? data.bestStreak) || 0;
  const score = Number(data.score ?? data.musicScore ?? data.performanceScore) || 0;
  const wpm = Number(data.wpm) || 0;
  const lines = Number(data.linesCompleted) || 0;
  const totalLines = Number(data.totalLines) || (song?.lines?.length ?? 0);
  const rank = Number(data.individualRank || data.rank) || null;

  return (
    <section className="music-result">
      <p className="arcade-kicker">ĐUA GÕ THEO NHẠC · HẾT BÀI</p>
      <h2>{flowPct >= 100 ? 'KHÔNG NGẮT NHỊP!' : rank && rank > 1 ? `Bạn về đích #${rank}` : 'Bài hát đã khép lại'}</h2>
      <p className="music-result-song"><Music2 size={15} aria-hidden="true" /> {song?.title} · {song?.artist}</p>

      <dl className="music-result-grid">
        <div><dt>Điểm</dt><dd>{score.toLocaleString('vi-VN')}</dd></div>
        <div><dt>Độ chính xác</dt><dd>{accuracy}%</dd></div>
        <div><dt>Tốc độ</dt><dd>{wpm} từ/phút</dd></div>
        <div><dt>Độ liền mạch</dt><dd>{flowPct}%</dd></div>
        <div><dt>Nhạc phải dừng</dt><dd>{pauseCount} lần</dd></div>
        <div><dt>Chuỗi giữ nhạc tốt nhất</dt><dd>{bestStreak} câu</dd></div>
        <div><dt>Câu hoàn thành</dt><dd>{lines}/{totalLines}</dd></div>
        <div><dt>Bài hát</dt><dd>{song?.difficultyLabel || '—'}</dd></div>
      </dl>

      <ul className="music-achievements">
        <Achievement earned={pauseCount === 0 && lines >= totalLines && totalLines > 0} title="KHÔNG NGẮT NHỊP" detail="Hoàn thành bài mà nhạc không dừng lần nào" />
        <Achievement earned={bestStreak >= 10} title="GIỮ NHỊP 10" detail="10 câu liên tiếp không bị dừng" />
        <Achievement earned={accuracy >= 98} title="CHÍNH XÁC" detail="Độ chính xác từ 98% trở lên" />
      </ul>

      <p className="music-result-note">
        {saving ? 'Đang gửi kết quả lên máy chủ để xác minh…' : error ? `Chưa lưu được kết quả: ${error}` : '✓ Máy chủ đã đối chiếu lời bài hát, số câu và số lần nhạc dừng.'}
      </p>

      <div className="arcade-actions">
        <Button onClick={onReplay} disabled={saving}><RotateCcw size={15} /> Hát lại</Button>
        <Button variant="secondary" onClick={onBoard}><Trophy size={15} /> BXH</Button>
        <Button variant="secondary" onClick={onBack}>Chọn bài khác</Button>
        <Link to="/games">Trung tâm trò chơi</Link>
      </div>

      <p className="music-result-licence">
        <Volume2 size={13} aria-hidden="true" /> Audio: {song?.audioSource?.licence || 'WorkRank Original'} · Lời: {song?.lyricsSource?.licence || 'WorkRank Original'}
      </p>
    </section>
  );
}
