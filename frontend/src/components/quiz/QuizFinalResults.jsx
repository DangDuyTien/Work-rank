import React from 'react';
import { Trophy, Medal, Sparkles, Zap, CheckCircle2, RotateCcw, Home, Crown } from 'lucide-react';
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
        width: '100%',
        maxWidth: 860,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}
    >
      {/* Top Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          borderRadius: 16,
          padding: '28px 24px',
          color: '#ffffff',
          textAlign: 'center',
          boxShadow: '0 8px 32px rgba(15,23,42,0.15)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(245,158,11,0.2)',
            color: '#f59e0b',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 12,
          }}
        >
          <Trophy size={15} />
          <span>KẾT QUẢ CHUNG CUỘC</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 900,
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <span>{winner ? `Chúc mừng ${winner.user?.name || 'Quán Quân'}!` : 'Trận Đấu Hoàn Tất!'}</span>
          <Sparkles size={24} color="#f59e0b" />
        </h1>

        <p style={{ margin: '8px 0 0', fontSize: 14, color: '#94a3b8' }}>
          Đã hoàn thành tất cả {room?.totalQuestions || 10} câu hỏi thử thách tốc độ
        </p>
      </div>

      {/* Podium Top 3 */}
      {sortedPlayers.length > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            gap: 16,
            padding: '20px 0 10px',
          }}
        >
          {/* 2nd Place (Silver) */}
          {secondPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 140,
              }}
            >
              <img
                src={secondPlace.user?.avatarUrl || getUserAvatar(secondPlace.userId)}
                alt={secondPlace.user?.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: '3px solid #94a3b8',
                  objectFit: 'cover',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                {secondPlace.user?.name || 'Hạng 2'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                {Number(secondPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  width: '100%',
                  height: 80,
                  background: 'linear-gradient(to top, #94a3b8, #cbd5e1)',
                  borderRadius: '10px 10px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  marginTop: 10,
                  boxShadow: '0 4px 12px rgba(100,116,139,0.2)',
                  gap: 2,
                }}
              >
                <Medal size={28} />
                <span style={{ fontSize: 13, fontWeight: 900 }}>HẠNG 2</span>
              </div>
            </div>
          )}

          {/* 1st Place (Gold / Champion) */}
          {firstPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 160,
              }}
            >
              <div style={{ position: 'relative' }}>
                <img
                  src={firstPlace.user?.avatarUrl || getUserAvatar(firstPlace.userId)}
                  alt={firstPlace.user?.name}
                  style={{
                    width: 68,
                    height: 68,
                    borderRadius: '50%',
                    border: '4px solid #f59e0b',
                    objectFit: 'cover',
                    marginBottom: 8,
                    boxShadow: '0 0 20px rgba(245,158,11,0.5)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: -14,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#f59e0b',
                    color: '#ffffff',
                    borderRadius: '50%',
                    padding: 4,
                    boxShadow: '0 2px 8px rgba(245,158,11,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Crown size={16} strokeWidth={2.5} />
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0f172a', textAlign: 'center' }}>
                {firstPlace.user?.name || 'Quán Quân'}
              </div>
              <div style={{ fontSize: 13, fontWeight: 900, color: '#d97706', fontFamily: 'JetBrains Mono, monospace' }}>
                {Number(firstPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  width: '100%',
                  height: 120,
                  background: 'linear-gradient(to top, #d97706, #f59e0b)',
                  borderRadius: '12px 12px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  marginTop: 10,
                  boxShadow: '0 6px 20px rgba(217,119,6,0.3)',
                  gap: 4,
                }}
              >
                <Trophy size={34} strokeWidth={2.5} />
                <span style={{ fontSize: 14, fontWeight: 900, letterSpacing: '0.5px' }}>QUÁN QUÂN</span>
              </div>
            </div>
          )}

          {/* 3rd Place (Bronze) */}
          {thirdPlace && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 140,
              }}
            >
              <img
                src={thirdPlace.user?.avatarUrl || getUserAvatar(thirdPlace.userId)}
                alt={thirdPlace.user?.name}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  border: '3px solid #d97706',
                  objectFit: 'cover',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a', textAlign: 'center' }}>
                {thirdPlace.user?.name || 'Hạng 3'}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', fontFamily: 'JetBrains Mono, monospace' }}>
                {Number(thirdPlace.score || 0).toLocaleString()} pts
              </div>
              <div
                style={{
                  width: '100%',
                  height: 64,
                  background: 'linear-gradient(to top, #b45309, #d97706)',
                  borderRadius: '10px 10px 0 0',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  marginTop: 10,
                  boxShadow: '0 4px 12px rgba(180,83,9,0.2)',
                  gap: 2,
                }}
              >
                <Medal size={24} />
                <span style={{ fontSize: 12, fontWeight: 900 }}>HẠNG 3</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal Match Stat Card */}
      {myPlayer && (
        <div
          style={{
            background: '#ffffff',
            border: '1.5px solid #38bdf8',
            borderRadius: 14,
            padding: '16px 20px',
            boxShadow: '0 4px 16px rgba(56,189,248,0.1)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: 14,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Vị trí của bạn
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
              Hạng #{myPlayer.rank}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tổng điểm
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myPlayer.score || 0).toLocaleString()}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Số câu đúng
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
              {myPlayer.correctAnswers || 0} / {room?.totalQuestions || 10}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tốc độ trung bình
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {myPlayer.avgResponseTimeMs ? `${(myPlayer.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 8 }}>
        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '12px 24px',
            background: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(15,23,42,0.2)',
          }}
        >
          <Home size={16} />
          <span>Về Sảnh Chờ</span>
        </button>
      </div>
    </div>
  );
}
