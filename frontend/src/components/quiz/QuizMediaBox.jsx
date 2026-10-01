import React, { useState, useEffect, useRef } from 'react';
import { Image as ImageIcon, Music, Play, Pause, Disc3 } from 'lucide-react';

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
        minHeight: 300,
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      {/* ── 1. MUSIC VISUALIZER STAGE ── */}
      {isMusic ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 28px',
            background: '#f8f7f4',
            position: 'relative',
            color: '#141414',
            boxSizing: 'border-box',
          }}
        >
          {/* Vinyl Record Icon with Rotation */}
          <div
            style={{
              position: 'relative',
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: '#141414',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: isPlaying ? '0 0 16px rgba(180, 83, 9, 0.25)' : '0 2px 8px rgba(0, 0, 0, 0.1)',
              marginBottom: 16,
              animation: isPlaying ? 'spin 6s linear infinite' : 'none',
            }}
          >
            <Disc3 size={40} color="#b45309" />
            <div
              style={{
                position: 'absolute',
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#f4f3ef',
                border: '2px solid #141414',
              }}
            />
          </div>

          {/* Song hint title */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#141414',
              textAlign: 'center',
              marginBottom: 2,
              letterSpacing: '0.2px',
              textTransform: 'uppercase',
            }}
          >
            Giai Điệu Bài Hát
          </div>
          <div style={{ fontSize: 12, color: '#666666', marginBottom: 16 }}>
            Lắng nghe và chọn đáp án chính xác
          </div>

          {/* Equalizer Waveform */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              height: 38,
              width: '100%',
              maxWidth: 320,
              marginBottom: 16,
            }}
          >
            {[0.3, 0.7, 1, 0.5, 0.85, 0.4, 0.95, 0.6, 0.8, 0.5, 0.9, 0.35, 0.75, 0.6, 0.4].map((h, idx) => {
              const active = progress > (idx / 15) * 100;
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    maxWidth: 6,
                    height: isPlaying ? `${Math.max(8, h * 34)}px` : '6px',
                    borderRadius: 3,
                    background: isPlaying ? (active ? '#b45309' : '#d1d5db') : '#dedad0',
                    transition: isPlaying ? 'height 0.12s ease' : 'height 0.25s ease',
                  }}
                />
              );
            })}
          </div>

          {/* Play/Pause Control & Track Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 320 }}>
            <button
              type="button"
              onClick={toggleAudio}
              disabled={isLocked}
              title={isPlaying ? 'Tạm dừng' : 'Phát lại'}
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#141414',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                flexShrink: 0,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'background 0.15s ease',
              }}
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} style={{ marginLeft: 2 }} />}
            </button>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  width: '100%',
                  height: 5,
                  background: '#dedad0',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginBottom: 5,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: '#b45309',
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
                  color: '#666666',
                }}
              >
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration || 15)}</span>
              </div>
            </div>
          </div>
        </div>
      ) : isVideo && videoUrl ? (
        /* ── 2. VIDEO STAGE ── */
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
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
        </div>
      ) : (
        /* ── 3. IMAGE STAGE ── */
        <div style={{ width: '100%', height: '100%', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f7f4' }}>
          {mediaUrl ? (
            <img
              src={mediaUrl}
              alt="Quiz visual prompt"
              style={{
                width: '100%',
                height: '100%',
                maxHeight: 420,
                objectFit: 'contain',
                display: 'block',
              }}
              loading="eager"
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                gap: 8,
                padding: 24,
              }}
            >
              <ImageIcon size={40} />
              <span style={{ fontSize: 13, fontWeight: 600, color: '#666666' }}>Hình ảnh câu hỏi</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
