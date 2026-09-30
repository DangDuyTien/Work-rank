import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, LogOut, Users, Sparkles, Maximize, Minimize } from 'lucide-react';

export default function QuizTopBar({
  room,
  questionIndex = 0,
  totalQuestions = 10,
  playerCount = 0,
  soundMuted = false,
  onToggleSound,
  onLeaveRoom,
}) {
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleNativeFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 48,
        padding: '0 24px',
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 700,
        zIndex: 50,
        flexShrink: 0,
      }}
    >
      {/* Left: Brand + Category + Players */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: '#0f172a',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.5px',
            border: '1.5px solid rgba(255,255,255,0.2)',
          }}
        >
          <Sparkles size={13} color="#38bdf8" />
          <span>QUIZ.3WIN</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
          <span style={{ fontWeight: 800, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>
            {room?.title || 'Đoán Hình & Đoán Nhạc'}
          </span>
          {room?.code && (
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                background: 'rgba(0,0,0,0.35)',
                padding: '2px 6px',
                borderRadius: 4,
              }}
            >
              #{room.code}
            </span>
          )}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.8, fontSize: 12 }}>
            <Users size={13} />
            <span>{playerCount}</span>
          </span>
        </div>
      </div>

      {/* Right: Question Slide Progress + Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 13,
            fontWeight: 900,
            color: '#ffffff',
            background: 'rgba(0,0,0,0.35)',
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)',
          }}
        >
          Câu {questionIndex + 1} / {totalQuestions}
        </div>

        {/* Native Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleNativeFullscreen}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình (F11)'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            background: isFullscreen ? 'rgba(56,189,248,0.25)' : 'rgba(0,0,0,0.35)',
            color: '#ffffff',
            border: isFullscreen ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
          }}
        >
          {isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
        </button>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            background: soundMuted ? 'rgba(239,68,68,0.4)' : 'rgba(0,0,0,0.35)',
            color: '#ffffff',
            border: '1px solid rgba(255,255,255,0.2)',
            cursor: 'pointer',
          }}
        >
          {soundMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        {/* Leave Room Button */}
        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            title="Rời phòng"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 6,
              background: 'rgba(239,68,68,0.25)',
              color: '#ffffff',
              border: '1px solid rgba(239,68,68,0.5)',
              cursor: 'pointer',
            }}
          >
            <LogOut size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
