import React from 'react';
import { Trophy, Crown, Sparkles, Home, RotateCcw } from 'lucide-react';
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
        maxWidth: 900,
        margin: '0 auto',
        padding: '24px 20px',
        color: '#ffffff',
        gap: 20,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 60px)',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          textAlign: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(12px)',
          padding: '18px 36px',
          borderRadius: 20,
          border: '1px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.45)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(245, 158, 11, 0.2)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            color: '#f59e0b',
            padding: '4px 14px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 900,
            marginBottom: 8,
            letterSpacing: '0.4px',
          }}
        >
          <Trophy size={13} />
          <span>KẾT QUẢ CHUNG CUỘC</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 900,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            letterSpacing: '-0.3px',
          }}
        >
          <span>{winner ? `Chúc mừng ${winner.user?.name || 'Quán Quân'}!` : 'Trận Đấu Hoàn Tất!'}</span>
          <Sparkles size={24} color="#f59e0b" />
        </h1>
      </div>

      {/* Podium Top 3 */}
      {sortedPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 16,
            width: '100%',
            maxWidth: 620,
            padding: '12px 0',
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
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                border: '2px solid #94a3b8',
                padding: '16px 12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              }}
            >
              <QuizAvatar
                user={secondPlace.user || { id: secondPlace.userId }}
                userId={secondPlace.userId}
                size="lg"
                border="3px solid #94a3b8"
                style={{ marginBottom: 8 }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  textAlign: 'center',
                  color: '#ffffff',
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {secondPlace.user?.name || 'Hạng 2'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
                {Number(secondPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'rgba(148, 163, 184, 0.25)',
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  padding: '2px 10px',
                  borderRadius: 20,
                  color: '#e2e8f0',
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
                background: 'rgba(15, 23, 42, 0.9)',
                backdropFilter: 'blur(12px)',
                borderRadius: 18,
                border: '3px solid #f59e0b',
                padding: '20px 14px',
                boxShadow: '0 0 30px rgba(245, 158, 11, 0.35), 0 12px 32px rgba(0, 0, 0, 0.5)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <QuizAvatar
                  user={firstPlace.user || { id: firstPlace.userId }}
                  userId={firstPlace.userId}
                  size="xl"
                  border="3.5px solid #f59e0b"
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -6,
                    background: '#f59e0b',
                    color: '#ffffff',
                    borderRadius: '50%',
                    padding: 4,
                    border: '2px solid #000000',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  }}
                >
                  <Crown size={14} strokeWidth={3} />
                </div>
              </div>

              <div
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                  textAlign: 'center',
                  color: '#ffffff',
                  maxWidth: 150,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {firstPlace.user?.name || 'Quán Quân'}
              </div>
              <div style={{ fontSize: 17, fontWeight: 900, color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
                {Number(firstPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 900,
                  background: '#f59e0b',
                  color: '#0f172a',
                  padding: '3px 12px',
                  borderRadius: 20,
                  boxShadow: '0 2px 8px rgba(245,158,11,0.4)',
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
                background: 'rgba(15, 23, 42, 0.75)',
                backdropFilter: 'blur(10px)',
                borderRadius: 16,
                border: '2px solid #d97706',
                padding: '16px 12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              }}
            >
              <QuizAvatar
                user={thirdPlace.user || { id: thirdPlace.userId }}
                userId={thirdPlace.userId}
                size="lg"
                border="3px solid #d97706"
                style={{ marginBottom: 8 }}
              />
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 900,
                  textAlign: 'center',
                  color: '#ffffff',
                  maxWidth: 130,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {thirdPlace.user?.name || 'Hạng 3'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#fbbf24', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
                {Number(thirdPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'rgba(217, 119, 6, 0.25)',
                  border: '1px solid rgba(217, 119, 6, 0.4)',
                  padding: '2px 10px',
                  borderRadius: 20,
                  color: '#fde68a',
                }}
              >
                HẠNG 3
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal Match Stats Card */}
      {myPlayer && (
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: 16,
            padding: '16px 24px',
            width: '100%',
            maxWidth: 620,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 12,
            textAlign: 'center',
            boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>THỨ HẠNG</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#38bdf8', marginTop: 3 }}>
              #{sortedPlayers.findIndex((p) => Number(p.userId) === Number(currentUserId)) + 1}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>TỔNG ĐIỂM</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
              {Number(myPlayer.score || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>SỐ CÂU ĐÚNG</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#34d399', marginTop: 3 }}>
              {myPlayer.correctAnswers || 0}/{room?.totalQuestions || 10}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 800 }}>TỐC ĐỘ TB</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#c084fc', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
              {myPlayer.avgResponseTimeMs ? `${(myPlayer.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 26px',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: 30,
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
          }}
        >
          <Home size={16} />
          <span>Về Sảnh Chờ</span>
        </button>
      </div>
    </div>
  );
}
