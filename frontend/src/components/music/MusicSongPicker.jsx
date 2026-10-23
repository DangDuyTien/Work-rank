import React, { useMemo, useState } from 'react';
import { Music2, Search, Timer, Gauge, Play } from 'lucide-react';
import { searchSongs, MUSIC_SONGS } from '../../games/music/catalog';

const formatDuration = (ms) => {
  const total = Math.round((Number(ms) || 0) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

function SongCard({ song, onSelect, busy, best }) {
  return (
    <button type="button" className="music-song-card" data-difficulty={song.difficulty} onClick={() => onSelect(song)} disabled={busy}>
      <span className="music-song-art" aria-hidden="true">
        <Music2 size={20} />
      </span>
      <span className="music-song-main">
        <span className="music-song-title">{song.title}</span>
        <span className="music-song-artist">{song.artist}</span>
        <span className="music-song-meta">
          <span className="music-chip" data-difficulty={song.difficulty}>{song.difficultyLabel}</span>
          <span><Timer size={12} aria-hidden="true" />{formatDuration(song.durationMs)}</span>
          <span><Gauge size={12} aria-hidden="true" />{song.charsPerSecond} ký tự/giây</span>
        </span>
      </span>
      <span className="music-song-cta">
        {best ? <small>Kỷ lục {Number(best).toLocaleString('vi-VN')}</small> : null}
        <span className="music-song-play"><Play size={14} aria-hidden="true" />Hát</span>
      </span>
    </button>
  );
}

export default function MusicSongPicker({ onSelect, busy = false, bestBySong = {}, songs = MUSIC_SONGS }) {
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchSongs(query, songs), [query, songs]);

  return (
    <section className="music-picker">
      <div className="music-picker-head">
        <div>
          <p className="arcade-kicker">CHỌN BÀI HÁT</p>
          <h2>Bài nào cũng phải giữ nhạc liền mạch</h2>
        </div>
        <label className="music-search">
          <Search size={15} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Tìm bài hát…"
            aria-label="Tìm bài hát"
          />
        </label>
      </div>

      <div className="music-song-list">
        {results.map((song) => (
          <SongCard key={song.id} song={song} onSelect={onSelect} busy={busy} best={bestBySong[song.id]} />
        ))}
        {results.length === 0 && <p className="music-empty">Không có bài nào khớp “{query}”.</p>}
      </div>

      <p className="music-picker-note">
        {songs.length} bài · nhạc và lời do WorkRank sáng tác và sở hữu, phát từ máy chủ của WorkRank nên tạm dừng/tiếp tục chính xác tới từng câu.
        {' '}Độ khó tính theo mật độ lời, dấu tiếng Việt và độ dài câu — không chỉ BPM.
      </p>
    </section>
  );
}
