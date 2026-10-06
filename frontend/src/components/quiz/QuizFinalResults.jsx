import React from 'react';
import { Trophy, Crown, Sparkles, Home, ArrowLeft, RotateCcw } from 'lucide-react';
import QuizAvatar from './QuizAvatar';

export default function QuizFinalResults({
  room,
  players = [],
  currentUserId,
  onPlayAgain,
  onBackToLobby,
}) {
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));
  const myPlayer = sortedPlayers.find((p) => Number(p.userId) === Number(currentUserId));
  const winner = sortedPlayers[0];

  const firstPlace = sortedPlayers[0];
  const secondPlace = sortedPlayers[1];
  const thirdPlace = sortedPlayers[2];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        maxWidth: 800,
        margin: '0 auto',
        padding: '16px 20px',
        color: 'var(--primary)',
        gap: 16,
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* ── TOP BANNER ── */}
      <div
        style={{
          textAlign: 'center',
          background: 'var(--surface)',
          padding: '16px 28px',
          borderRadius: 8,
          border: '1px solid rgba(0, 0, 0, 0.08)',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
          width: '100%',
          maxWidth: 580,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(180, 83, 9, 0.08)',
            border: '1px solid rgba(180, 83, 9, 0.2)',
            color: 'var(--accent)',
            padding: '3px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            marginBottom: 6,
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
          }}
        >
          <Trophy size={12} />
          <span>Kết Quả Chung Cuộc</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            letterSpacing: '-0.3px',
            lineHeight: 1.3,
          }}
        >
          <span>{winner ? `Chúc mừng ${winner.user?.name || 'Quán Quân'}!` : 'Trận Đấu Hoàn Tất!'}</span>
          <Sparkles size={18} color="var(--accent)" />
        </h1>
      </div>

      {/* ── PODIUM TOP 3 ── */}
      {sortedPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 12,
            width: '100%',
            maxWidth: 580,
            padding: '8px 0',
          }}
        >
          {/* 2nd Place */}
          {secondPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px solid var(--text-muted)',
                padding: '14px 10px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <QuizAvatar
                user={secondPlace.user || { id: secondPlace.userId }}
                userId={secondPlace.userId}
                size="md"
                border="2px solid var(--text-muted)"
                style={{ marginBottom: 6 }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  color: 'var(--primary)',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {secondPlace.user?.name || 'Hạng 2'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(secondPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-2)',
                  padding: '1px 8px',
                  borderRadius: 4,
                  color: 'var(--text-secondary)',
                }}
              >
                HẠNG 2
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {firstPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1.15,
                background: 'var(--surface)',
                borderRadius: 8,
                border: '2px solid var(--accent)',
                padding: '18px 12px',
                boxShadow: '0 2px 8px rgba(180, 83, 9, 0.15)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', marginBottom: 6 }}>
                <QuizAvatar
                  user={firstPlace.user || { id: firstPlace.userId }}
                  userId={firstPlace.userId}
                  size="lg"
                  border="2px solid var(--accent)"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -4,
                    background: 'var(--accent)',
                    color: 'var(--surface)',
                    borderRadius: '50%',
                    padding: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Crown size={11} strokeWidth={3} />
                </div>
              </div>

              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  color: 'var(--primary)',
                  maxWidth: 140,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {firstPlace.user?.name || 'Quán Quân'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(firstPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'var(--accent)',
                  color: 'var(--surface)',
                  padding: '2px 10px',
                  borderRadius: 4,
                }}
              >
                QUÁN QUÂN
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                flex: 1,
                background: 'var(--surface)',
                borderRadius: 8,
                border: '1px solid #d97706',
                padding: '14px 10px',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              }}
            >
              <QuizAvatar
                user={thirdPlace.user || { id: thirdPlace.userId }}
                userId={thirdPlace.userId}
                size="md"
                border="2px solid #d97706"
                style={{ marginBottom: 6 }}
              />
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: 'center',
                  color: 'var(--primary)',
                  maxWidth: 120,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {thirdPlace.user?.name || 'Hạng 3'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d97706', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(thirdPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  padding: '1px 8px',
                  borderRadius: 4,
                  color: 'var(--accent-hover)',
                }}
              >
                HẠNG 3
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PERSONAL MATCH STATS CARD ── */}
      {myPlayer && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid rgba(0, 0, 0, 0.08)',
            borderRadius: 8,
            padding: '14px 20px',
            width: '100%',
            maxWidth: 580,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
            boxSizing: 'border-box',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>THỨ HẠNG</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              #{sortedPlayers.findIndex((p) => Number(p.userId) === Number(currentUserId)) + 1}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>TỔNG ĐIỂM</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--primary)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myPlayer.score || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>SỐ CÂU ĐÚNG</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--success)', marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
              {myPlayer.correctAnswers || 0}/{room?.totalQuestions || 10}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>TỐC ĐỘ TB</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {myPlayer.avgResponseTimeMs ? `${(myPlayer.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTION BUTTONS ── */}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={onPlayAgain}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 20px',
            background: 'var(--accent)',
            color: 'var(--surface)',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(180, 83, 9, 0.2)',
            transition: 'background var(--motion-fast) var(--ease-standard)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--accent)'; }}
        >
          <RotateCcw size={14} />
          <span>Chơi Lại</span>
        </button>

        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 20px',
            background: 'var(--surface)',
            color: 'var(--primary)',
            border: '1px solid rgba(0, 0, 0, 0.15)',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
            transition: 'background var(--motion-fast) var(--ease-standard)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-muted)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface)'; }}
        >
          <Home size={14} />
          <span>Về Sảnh Chờ</span>
        </button>
      </div>
    </div>
  );
}
