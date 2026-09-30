import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, LogOut, Users, Sparkles, Maximize, Minimize, ArrowLeft } from 'lucide-react';
import QuizAvatar from './QuizAvatar';

export default function QuizTopBar({
  room,
  questionIndex = 0,
  totalQuestions = 10,
  playerCount = 0,
  currentUser = null,
  soundMuted = false,
  onToggleSound,
  onLeaveRoom,
  isLobby = false,
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
    <header
      className="quiz-top-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        height: 56,
        padding: '0 20px',
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 700,
        zIndex: 50,
        flexShrink: 0,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        userSelect: 'none',
      }}
    >
      {/* Left: Brand + Category + Room Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            title={isLobby ? "Quay về WorkRank" : "Rời phòng chơi"}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 12px',
              borderRadius: 6,
              background: 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <ArrowLeft size={14} />
            <span>{isLobby ? 'Bảng Điều Khiển' : 'Rời Phòng'}</span>
          </button>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 900,
            letterSpacing: '0.5px',
            boxShadow: '0 2px 6px rgba(2,132,199,0.3)',
          }}
        >
          <Sparkles size={13} />
          <span>QUIZ LIVE</span>
        </div>

        {room && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                fontWeight: 800,
                textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 200,
              }}
            >
              {room.title || 'Đoán Hình & Đoán Nhạc'}
            </span>
            {room.code && (
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 900,
                  background: 'rgba(255,255,255,0.1)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(255,255,255,0.15)',
                  color: '#38bdf8',
                }}
              >
                #{room.code}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85, fontSize: 12 }}>
              <Users size={13} />
              <span>{playerCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* Right: Question Slide Progress + Sound + Fullscreen + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {!isLobby && room && (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 12,
              fontWeight: 900,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.4)',
              padding: '4px 12px',
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.15)',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
            }}
          >
            Câu {questionIndex + 1} / {totalQuestions}
          </div>
        )}

        {/* Native Fullscreen Toggle Button */}
        <button
          type="button"
          onClick={toggleNativeFullscreen}
          title={isFullscreen ? 'Thu nhỏ cửa sổ' : 'Toàn màn hình'}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 34,
            height: 34,
            borderRadius: 6,
            background: isFullscreen ? 'rgba(56,189,248,0.25)' : 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            border: isFullscreen ? '1px solid rgba(56,189,248,0.5)' : '1px solid rgba(255,255,255,0.15)',
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
            width: 34,
            height: 34,
            borderRadius: 6,
            background: soundMuted ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.08)',
            color: '#ffffff',
            border: soundMuted ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(255,255,255,0.15)',
            cursor: 'pointer',
          }}
        >
          {soundMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>

        {/* Current User Pill */}
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '3px 8px 3px 4px',
              borderRadius: 20,
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
            }}
          >
            <QuizAvatar user={currentUser} size="xs" />
            <span style={{ fontSize: 12, fontWeight: 800, color: '#ffffff', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.name || 'Thành viên'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
