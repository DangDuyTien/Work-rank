import React from 'react';
import { Trophy, Medal, Crown, Sparkles, Home, RotateCcw, CheckCircle2, Clock, Zap } from 'lucide-react';
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
      {/* Top Header Card */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          padding: '24px 28px',
          border: '1px solid rgba(15,23,42,0.1)',
          boxShadow: '0 4px 20px rgba(15,23,42,0.04)',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(2,132,199,0.08)',
            color: '#0284c7',
            padding: '4px 12px',
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 800,
            marginBottom: 10,
          }}
        >
          <Trophy size={14} color="#d97706" />
          <span>TỔNG KẾT TRẬN ĐẤU</span>
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 24,
            fontWeight: 900,
            color: '#0f172a',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{winner ? `Chúc mừng ${winner.user?.name || 'Quán Quân'}!` : 'Trận Đấu Hoàn Tất!'}</span>
          <Sparkles size={22} color="#f59e0b" />
        </h1>

        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#64748b' }}>
          Đã hoàn thành tất cả {room?.totalQuestions || 10} câu hỏi trắc nghiệm
        </p>
      </div>

      {/* Podium Top 3 Cards */}
      {sortedPlayers.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: sortedPlayers.length >= 3 ? 'repeat(3, 1fr)' : `repeat(${sortedPlayers.length}, 1fr)`,
            gap: 14,
            alignItems: 'stretch',
          }}
        >
          {/* 2nd Place */}
          {secondPlace && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.1)',
                borderRadius: 14,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
                order: 1,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(100,116,139,0.1)',
                  color: '#475569',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                <Medal size={13} />
                <span>HẠNG 2</span>
              </div>

              <img
                src={secondPlace.user?.avatarUrl || getUserAvatar(secondPlace.userId)}
                alt={secondPlace.user?.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: '2px solid #cbd5e1',
                  objectFit: 'cover',
                  marginBottom: 8,
                }}
              />

              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                {secondPlace.user?.name || 'Hạng 2'}
              </div>

              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#475569',
                  marginTop: 4,
                }}
              >
                {Number(secondPlace.score || 0).toLocaleString()} pts
              </div>
            </div>
          )}

          {/* 1st Place (Champion) */}
          {firstPlace && (
            <div
              style={{
                background: '#ffffff',
                border: '2px solid #f59e0b',
                borderRadius: 14,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(245,158,11,0.12)',
                order: sortedPlayers.length >= 2 ? 2 : 1,
                position: 'relative',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(245,158,11,0.15)',
                  color: '#b45309',
                  padding: '3px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 900,
                  marginBottom: 12,
                }}
              >
                <Crown size={14} strokeWidth={2.5} />
                <span>QUÁN QUÂN</span>
              </div>

              <div style={{ position: 'relative' }}>
                <img
                  src={firstPlace.user?.avatarUrl || getUserAvatar(firstPlace.userId)}
                  alt={firstPlace.user?.name}
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    border: '3px solid #f59e0b',
                    objectFit: 'cover',
                    marginBottom: 8,
                  }}
                />
              </div>

              <div style={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }}>
                {firstPlace.user?.name || 'Quán Quân'}
              </div>

              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18,
                  fontWeight: 900,
                  color: '#d97706',
                  marginTop: 4,
                }}
              >
                {Number(firstPlace.score || 0).toLocaleString()} pts
              </div>
            </div>
          )}

          {/* 3rd Place */}
          {thirdPlace && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid rgba(15,23,42,0.1)',
                borderRadius: 14,
                padding: '20px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
                order: 3,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'rgba(217,119,6,0.1)',
                  color: '#b45309',
                  padding: '2px 8px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 800,
                  marginBottom: 12,
                }}
              >
                <Medal size={13} />
                <span>HẠNG 3</span>
              </div>

              <img
                src={thirdPlace.user?.avatarUrl || getUserAvatar(thirdPlace.userId)}
                alt={thirdPlace.user?.name}
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  border: '2px solid #fed7aa',
                  objectFit: 'cover',
                  marginBottom: 8,
                }}
              />

              <div style={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
                {thirdPlace.user?.name || 'Hạng 3'}
              </div>

              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 16,
                  fontWeight: 900,
                  color: '#b45309',
                  marginTop: 4,
                }}
              >
                {Number(thirdPlace.score || 0).toLocaleString()} pts
              </div>
            </div>
          )}
        </div>
      )}

      {/* Personal Match Performance Stats */}
      {myPlayer && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid rgba(2,132,199,0.25)',
            borderRadius: 14,
            padding: '18px 22px',
            boxShadow: '0 2px 12px rgba(2,132,199,0.05)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: 16,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Vị trí của bạn
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0284c7', marginTop: 2 }}>
              Hạng #{myPlayer.rank || sortedPlayers.findIndex((p) => Number(p.userId) === Number(currentUserId)) + 1}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tổng điểm đạt được
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {Number(myPlayer.score || 0).toLocaleString()} pts
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Số câu đúng
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#16a34a', marginTop: 2 }}>
              {myPlayer.correctAnswers || 0} / {room?.totalQuestions || 10}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
              Tốc độ trung bình
            </div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#7c3aed', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
              {myPlayer.avgResponseTimeMs ? `${(myPlayer.avgResponseTimeMs / 1000).toFixed(1)}s` : 'N/A'}
            </div>
          </div>
        </div>
      )}

      {/* Full Scoreboard Table */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          border: '1px solid rgba(15,23,42,0.1)',
          overflow: 'hidden',
          boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
        }}
      >
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>
            Bảng Xếp Hạng Trận Đấu
          </h3>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(15,23,42,0.02)', borderBottom: '1px solid rgba(15,23,42,0.08)' }}>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b' }}>Hạng</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b' }}>Người chơi</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b', textAlign: 'right' }}>Tổng điểm</th>
                <th style={{ padding: '10px 16px', fontWeight: 800, color: '#64748b', textAlign: 'right' }}>Số câu đúng</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, idx) => {
                const isMe = Number(player.userId) === Number(currentUserId);
                const avatarUrl = player.user?.avatarUrl || getUserAvatar(player.userId);
                const rank = idx + 1;

                return (
                  <tr
                    key={player.id || idx}
                    style={{
                      borderBottom: '1px solid rgba(15,23,42,0.05)',
                      background: isMe ? 'rgba(2,132,199,0.04)' : idx === 0 ? 'rgba(245,158,11,0.03)' : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        {rank === 1 ? (
                          <Crown size={14} color="#d97706" />
                        ) : rank === 2 ? (
                          <Medal size={14} color="#64748b" />
                        ) : rank === 3 ? (
                          <Medal size={14} color="#b45309" />
                        ) : null}
                        <span>#{rank}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={avatarUrl} alt="" style={{ width: 26, height: 26, borderRadius: '50%' }} />
                        <span style={{ fontWeight: isMe ? 800 : 600, color: isMe ? '#0284c7' : '#0f172a' }}>
                          {player.user?.name || `Người chơi ${player.userId}`}
                          {isMe && ' (Bạn)'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 900, fontFamily: 'JetBrains Mono, monospace', color: '#0284c7' }}>
                      {Number(player.score || 0).toLocaleString()} pts
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                      {player.correctAnswers || 0} / {room?.totalQuestions || 10}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 4 }}>
        <button
          type="button"
          onClick={onBackToLobby}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 20px',
            background: '#0f172a',
            color: '#ffffff',
            border: 'none',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
          }}
        >
          <Home size={16} />
          <span>Về Sảnh Chờ</span>
        </button>
      </div>
    </div>
  );
}
