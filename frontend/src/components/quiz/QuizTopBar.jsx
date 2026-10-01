import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Users, Sparkles, Maximize, Minimize, ArrowLeft } from 'lucide-react';
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
        height: 52,
        padding: '0 20px',
        color: '#141414',
        fontSize: 13,
        fontWeight: 600,
        zIndex: 50,
        flexShrink: 0,
        background: '#ffffff',
        borderBottom: '1px solid rgba(0, 0, 0, 0.08)',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Left: Brand + Category + Room Meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        {onLeaveRoom && (
          <button
            type="button"
            onClick={onLeaveRoom}
            title={isLobby ? "Quay về WorkRank" : "Rời phòng chơi"}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '5px 10px',
              borderRadius: 6,
              background: '#f4f3ef',
              color: '#141414',
              border: '1px solid rgba(0, 0, 0, 0.1)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#eceae4'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#f4f3ef'; }}
          >
            <ArrowLeft size={13} />
            <span>{isLobby ? 'Bảng Điều Khiển' : 'Rời Phòng'}</span>
          </button>
        )}

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(180, 83, 9, 0.08)',
            border: '1px solid rgba(180, 83, 9, 0.2)',
            color: '#b45309',
            padding: '3px 8px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <Sparkles size={12} />
          <span>QUIZ LIVE</span>
        </div>

        {room && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
            <span
              style={{
                fontWeight: 700,
                color: '#141414',
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
                  fontWeight: 700,
                  background: '#f8f7f4',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  color: '#b45309',
                }}
              >
                #{room.code}
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'center', gap: 3, color: '#666666', fontSize: 12 }}>
              <Users size={12} />
              <span>{playerCount}</span>
            </span>
          </div>
        )}
      </div>

      {/* Right: Question Slide Progress + Sound + Fullscreen + User */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {!isLobby && room && (
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              fontWeight: 700,
              color: '#141414',
              background: '#f4f3ef',
              padding: '3px 10px',
              borderRadius: 4,
              border: '1px solid rgba(0, 0, 0, 0.08)',
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
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            background: isFullscreen ? '#f4f3ef' : '#ffffff',
            color: '#141414',
            border: '1px solid rgba(0, 0, 0, 0.12)',
            cursor: 'pointer',
            transition: 'background 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f4f3ef'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = isFullscreen ? '#f4f3ef' : '#ffffff'; }}
        >
          {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>

        {/* Sound Toggle */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 6,
            background: soundMuted ? '#fef2f2' : '#ffffff',
            color: soundMuted ? '#dc2626' : '#141414',
            border: soundMuted ? '1px solid rgba(220, 38, 38, 0.3)' : '1px solid rgba(0, 0, 0, 0.12)',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = soundMuted ? '#fee2e2' : '#f4f3ef';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = soundMuted ? '#fef2f2' : '#ffffff';
          }}
        >
          {soundMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>

        {/* Current User Pill */}
        {currentUser && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '2px 8px 2px 3px',
              borderRadius: 9999,
              background: '#f8f7f4',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <QuizAvatar user={currentUser} size="xs" />
            <span style={{ fontSize: 12, fontWeight: 600, color: '#141414', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser.name || 'Thành viên'}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}
