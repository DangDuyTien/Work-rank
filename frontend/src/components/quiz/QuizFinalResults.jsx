import React from 'react';
import { Trophy, Medal, Crown, Sparkles, Home, CheckCircle2, Clock } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

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
        maxWidth: 880,
        margin: '0 auto',
        padding: '24px 20px',
        color: '#ffffff',
        gap: 18,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 80px)',
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          textAlign: 'center',
          background: 'rgba(0,0,0,0.5)',
          padding: '16px 28px',
          borderRadius: 16,
          border: '2px solid #000000',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(245,158,11,0.2)',
            color: '#f59e0b',
            padding: '3px 12px',
            borderRadius: 20,
            fontSize: 11,
            fontWeight: 800,
            marginBottom: 6,
          }}
        >
          <Trophy size={13} />
          <span>KẾT QUẢ CHUNG CUỘC</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>{winner ? `Chúc mừng ${winner.user?.name || 'Quán Quân'}!` : 'Trận Đấu Hoàn Tất!'}</span>
          <Sparkles size={22} color="#f59e0b" />
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
            maxWidth: 580,
            padding: '10px 0',
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
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 14,
                border: '2px solid #94a3b8',
                padding: '14px 10px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src={secondPlace.user?.avatarUrl || getUserAvatar(secondPlace.userId)}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2.5px solid #94a3b8',
                  objectFit: 'cover',
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, textAlign: 'center', color: '#ffffff' }}>
                {secondPlace.user?.name || 'Hạng 2'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(secondPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'rgba(148,163,184,0.3)',
                  padding: '2px 8px',
                  borderRadius: 6,
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
                background: 'rgba(0,0,0,0.6)',
                borderRadius: 16,
                border: '3px solid #f59e0b',
                padding: '18px 12px',
                boxShadow: '0 0 24px rgba(245,158,11,0.4), 0 8px 24px rgba(0,0,0,0.5)',
                position: 'relative',
              }}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={firstPlace.user?.avatarUrl || getUserAvatar(firstPlace.userId)}
                  alt=""
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    border: '3px solid #f59e0b',
                    objectFit: 'cover',
                    marginBottom: 6,
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -10,
                    right: -6,
                    background: '#f59e0b',
                    color: '#ffffff',
                    borderRadius: '50%',
                    padding: 3,
                    border: '1.5px solid #000000',
                  }}
                >
                  <Crown size={12} strokeWidth={3} />
                </div>
              </div>

              <div style={{ fontSize: 14, fontWeight: 900, textAlign: 'center', color: '#ffffff' }}>
                {firstPlace.user?.name || 'Quán Quân'}
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: '#f59e0b', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(firstPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 11,
                  fontWeight: 900,
                  background: '#f59e0b',
                  color: '#000000',
                  padding: '2px 10px',
                  borderRadius: 6,
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
                background: 'rgba(0,0,0,0.4)',
                borderRadius: 14,
                border: '2px solid #d97706',
                padding: '14px 10px',
                boxShadow: '0 6px 16px rgba(0,0,0,0.3)',
              }}
            >
              <img
                src={thirdPlace.user?.avatarUrl || getUserAvatar(thirdPlace.userId)}
                alt=""
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '2.5px solid #d97706',
                  objectFit: 'cover',
                  marginBottom: 6,
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, textAlign: 'center', color: '#ffffff' }}>
                {thirdPlace.user?.name || 'Hạng 3'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                {Number(thirdPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  fontWeight: 900,
                  background: 'rgba(217,119,6,0.3)',
                  padding: '2px 8px',
                  borderRadius: 6,
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
            background: 'rgba(0,0,0,0.5)',
            border: '2px solid rgba(56,189,248,0.4)',
            borderRadius: 14,
            padding: '14px 20px',
            width: '100%',
            maxWidth: 580,
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 10,
            textAlign: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>THỨ HẠNG</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#38bdf8', marginTop: 2 }}>
              #{sortedPlayers.findIndex((p) => Number(p.userId) === Number(currentUserId)) + 1}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>TỔNG ĐIỂM</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#ffffff', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myPlayer.score || 0).toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>SỐ CÂU ĐÚNG</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#34d399', marginTop: 2 }}>
              {myPlayer.correctAnswers || 0}/{room?.totalQuestions || 10}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 800 }}>TỐC ĐỘ TB</div>
            <div style={{ fontSize: 17, fontWeight: 900, color: '#c084fc', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {myPlayer.avgResponseTimeMs ? `${(myPlayer.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 24px',
            background: '#0f172a',
            color: '#ffffff',
            border: '2px solid #000000',
            borderRadius: 30,
            fontSize: 14,
            fontWeight: 900,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <Home size={16} />
          <span>Về Sảnh Chờ</span>
        </button>
      </div>
    </div>
  );
}
