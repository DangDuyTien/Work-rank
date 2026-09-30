import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Music, Play, Pause, Volume2, Disc3 } from 'lucide-react';

export default function QuizMediaBox({
  question,
  isLocked = false,
}) {
  if (!question) return null;

  const isMusic = question.type === 'MUSIC';
  const isVideo = question.type === 'VIDEO' || Boolean(question.videoUrl || question.video_url);
  const mediaUrl = question.imageUrl || question.image_url;
  const audioUrl = question.audioUrl || question.audio_url;
  const videoUrl = question.videoUrl || question.video_url;

  // Audio state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef(null);

  // Auto-play audio when question is MUSIC
  useEffect(() => {
    if (!isMusic || !audioUrl || isLocked) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
      return;
    }

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

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    if (!isLocked) {
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    }

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.pause();
      audioRef.current = null;
    };
  }, [isMusic, audioUrl, isLocked]);

  useEffect(() => {
    if (isLocked && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isLocked]);

  const toggleAudio = () => {
    if (isLocked || !audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
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
        width: '100%',
        height: '100%',
        minHeight: 320,
        background: '#0f172a',
        border: '3px solid #000000',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* 1. MUSIC VISUALIZER STAGE */}
      {isMusic ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '28px 32px',
            background: 'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
            position: 'relative',
            color: '#ffffff',
          }}
        >
          {/* Vinyl Record / Speaker Icon with Rotation */}
          <div
            style={{
              position: 'relative',
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: 'radial-gradient(circle, #334155 30%, #0f172a 70%, #0284c7 100%)',
              border: '4px solid #000000',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPlaying ? '0 0 30px rgba(56,189,248,0.5)' : '0 4px 16px rgba(0,0,0,0.5)',
              marginBottom: 20,
              animation: isPlaying ? 'spin 6s linear infinite' : 'none',
            }}
          >
            <Disc3 size={48} color="#38bdf8" />
            <div
              style={{
                position: 'absolute',
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#ffffff',
                border: '3px solid #000000',
              }}
            />
          </div>

          {/* Song hint title */}
          <div
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: '#ffffff',
              textAlign: 'center',
              marginBottom: 4,
              letterSpacing: '0.3px',
              textShadow: '0 2px 4px rgba(0,0,0,0.6)',
            }}
          >
            GIAI ĐIỆU BÀI HÁT
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20 }}>
            Lắng nghe và chọn đáp án chính xác
          </div>

          {/* Equalizer Waveform */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              height: 48,
              width: '100%',
              maxWidth: 360,
              marginBottom: 20,
            }}
          >
            {[0.3, 0.7, 1, 0.5, 0.85, 0.4, 0.95, 0.6, 0.8, 0.5, 0.9, 0.35, 0.75, 0.6, 0.4].map((h, idx) => {
              const active = progress > (idx / 15) * 100;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    maxWidth: 7,
                    height: isPlaying ? `${Math.max(10, h * 44)}px` : '8px',
                    borderRadius: 4,
                    background: isPlaying ? (active ? '#38bdf8' : 'rgba(255,255,255,0.4)') : 'rgba(255,255,255,0.2)',
                    transition: isPlaying ? 'height 0.12s ease' : 'height 0.3s ease',
                  }}
                />
              );
            })}
          </div>

          {/* Play/Pause Control & Track Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 360 }}>
            <button
              type="button"
              onClick={toggleAudio}
              disabled={isLocked}
              title={isPlaying ? 'Tạm dừng' : 'Phát lại'}
              style={{
                width: 42,
                height: 42,
                borderRadius: '50%',
                background: isPlaying ? '#ef4444' : '#0284c7',
                color: '#ffffff',
                border: '2px solid #000000',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              }}
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
            </button>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: 'rgba(255,255,255,0.2)',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 6,
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

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  color: '#94a3b8',
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || 15)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : isVideo && videoUrl ? (
        /* 2. VIDEO STAGE */
        <div style={{ width: '100%', height: '100%' }}>
          {videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be') ? (
            <iframe
              src={videoUrl.includes('embed') ? videoUrl : `https://www.youtube.com/embed/${videoUrl.split('v=')[1] || videoUrl.split('/').pop()}?autoplay=1&mute=0`}
              title="Quiz Video"
              style={{ width: '100%', height: '100%', border: 'none' }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : (
            <video
              src={videoUrl}
              autoPlay
              controls
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          )}
        </div>
      ) : (
        /* 3. IMAGE STAGE */
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Quiz visual prompt"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
              loading="eager"
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                gap: 8,
              }}
            >
              <ImageIcon size={48} />
              <span style={{ fontSize: 14, fontWeight: 700 }}>Hình ảnh câu hỏi</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
