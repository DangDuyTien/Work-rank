import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Music, Volume2, AlertCircle } from 'lucide-react';

/**
 * Modern Quiz Audio Player for Music Guessing Mode
 * Clean, lightweight, professional UI
 */
export default function QuizAudioPlayer({
  audioUrl,
  isPlayingMode = true,
  autoPlay = true,
  disabled = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);

  // Initialize and auto-play
  useEffect(() => {
    if (!audioUrl || disabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      return;
    }

    setError(false);
    setProgress(0);
    setCurrentTime(0);

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 15);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(100);
      setCurrentTime(audio.duration || 0);
    };

    const handleError = () => {
      console.warn('Audio URL failed to load');
      setError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    if (autoPlay && !disabled) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          setIsPlaying(false);
        });
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl, autoPlay, disabled]);

  // Stop immediately if round ends / disabled
  useEffect(() => {
    if (disabled && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [disabled]);

  const togglePlay = () => {
    if (disabled || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 520,
        margin: '0 auto',
        padding: '20px 24px',
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid rgba(15,23,42,0.1)',
        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
      }}
    >
      {/* Header Info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          marginBottom: 16,
          paddingBottom: 10,
          borderBottom: '1px solid rgba(15,23,42,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
          <Music size={16} color="#0284c7" />
          <span>Đoạn Nhạc Thử Thách</span>
        </div>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 12,
            fontWeight: 700,
            color: '#64748b',
          }}
        >
          {formatTime(currentTime)} / {formatTime(duration || 15)}
        </div>
      </div>

      {/* Waveform Equalizer Display */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          height: 52,
          width: '100%',
          marginBottom: 16,
          padding: '0 12px',
          background: 'rgba(15,23,42,0.02)',
          borderRadius: 8,
        }}
      >
        {[0.3, 0.6, 0.85, 0.45, 1, 0.7, 0.9, 0.5, 0.8, 0.6, 0.95, 0.4, 0.75, 0.55, 0.35].map((h, idx) => {
          const isActive = progress > (idx / 15) * 100;
          return (
            <div
              key={idx}
              style={{
                flex: 1,
                maxWidth: 6,
                height: isPlaying ? `${Math.max(10, h * 42)}px` : '10px',
                borderRadius: 3,
                background: isPlaying
                  ? isActive
                    ? '#0284c7'
                    : '#94a3b8'
                  : 'rgba(15,23,42,0.15)',
                transition: isPlaying ? 'height 0.12s ease' : 'height 0.3s ease',
              }}
            />
          );
        })}
      </div>

      {/* Play Controls & Progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
        <button
          type="button"
          onClick={togglePlay}
          disabled={disabled}
          title={isPlaying ? 'Tạm dừng nhạc' : 'Phát lại nhạc'}
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: isPlaying ? '#0f172a' : '#0284c7',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
            flexShrink: 0,
            transition: 'transform 0.1s ease, background-color 0.2s ease',
          }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Progress Bar */}
          <div
            style={{
              width: '100%',
              height: 5,
              background: 'rgba(15,23,42,0.08)',
              borderRadius: 3,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                background: '#0284c7',
                transition: 'width 0.1s linear',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {isPlaying ? 'Đang phát âm thanh...' : disabled ? 'Đã khóa đoạn nhạc' : 'Nhấn nút để nghe lại'}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#0284c7', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Volume2 size={12} />
              <span>Audio</span>
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b45309', marginTop: 12 }}>
          <AlertCircle size={14} />
          <span>Không thể tải file âm thanh hoặc trình duyệt chặn tự động phát.</span>
        </div>
      )}
    </div>
  );
}
