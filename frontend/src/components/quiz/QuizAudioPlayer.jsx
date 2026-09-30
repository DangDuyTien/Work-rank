import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Music, AlertCircle } from 'lucide-react';

/**
 * Quiz Audio Player Component for Music Guessing Mode
 */
export default function QuizAudioPlayer({
  audioUrl,
  isPlayingMode = true,
  autoPlay = true,
  disabled = false,
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const audioRef = useRef(null);
  const animFrameRef = useRef(null);

  // Initialize and auto-play
  useEffect(() => {
    if (!audioUrl || disabled) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setProgress(0);
      return;
    }

    setError(false);
    setProgress(0);

    const audio = new Audio(audioUrl);
    audio.preload = 'auto';
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.duration) {
        setProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setProgress(100);
    };

    const handleError = () => {
      console.warn('Audio URL failed to load, falling back to simulated track');
      setError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    if (autoPlay && !disabled) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay policy prevented playback, user can tap play button
          setIsPlaying(false);
        });
    }

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.pause();
      audioRef.current = null;
    };
  }, [audioUrl, autoPlay, disabled]);

  // Stop immediately if round ends
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
        padding: '18px 24px',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(15,23,42,0.3)',
        color: '#ffffff',
      }}
    >
      {/* Visual Equalizer Waves */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          height: 48,
          marginBottom: 16,
        }}
      >
        {[0.4, 0.8, 0.6, 1, 0.7, 0.9, 0.5, 0.85, 0.65, 0.45].map((h, idx) => (
          <div
            key={idx}
            style={{
              width: 5,
              height: isPlaying ? `${Math.max(12, h * 44)}px` : '8px',
              borderRadius: 3,
              background: isPlaying ? '#38bdf8' : 'rgba(255,255,255,0.2)',
              transition: isPlaying ? 'height 0.15s ease' : 'height 0.3s ease',
              animation: isPlaying ? `equalizer ${0.4 + (idx % 4) * 0.15}s ease-in-out infinite alternate` : 'none',
            }}
          />
        ))}
      </div>

      {/* Main Play Button & Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button
          type="button"
          onClick={togglePlay}
          disabled={disabled}
          title={isPlaying ? 'Tạm dừng nhạc' : 'Phát đoạn nhạc'}
          style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: isPlaying ? '#ef4444' : '#38bdf8',
            color: '#ffffff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled ? 'not-allowed' : 'pointer',
            boxShadow: isPlaying ? '0 0 20px rgba(239,68,68,0.5)' : '0 0 20px rgba(56,189,248,0.5)',
            transition: 'transform 0.1s ease, box-shadow 0.2s ease',
          }}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} style={{ marginLeft: 3 }} />}
        </button>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700 }}>
            <Music size={16} color="#38bdf8" />
            <span>{isPlaying ? 'Đang phát đoạn nhạc...' : disabled ? 'Đã khóa âm thanh' : 'Nhấn để nghe nhạc'}</span>
          </div>
          <span style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
            Nghe kỹ đoạn giai điệu và chọn tên bài hát đúng
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div
        style={{
          width: '100%',
          height: 4,
          background: 'rgba(255,255,255,0.15)',
          borderRadius: 2,
          marginTop: 16,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progress}%`,
            background: '#38bdf8',
            transition: 'width 0.1s linear',
          }}
        />
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#f59e0b', marginTop: 8 }}>
          <AlertCircle size={12} />
          <span>Đoạn audio dự phòng đang được kích hoạt</span>
        </div>
      )}
    </div>
  );
}
