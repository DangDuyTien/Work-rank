import React from 'react';
import { Trophy, Medal, Flame } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

export default function QuizLiveLeaderboard({
  players = [],
  currentUserId = null,
  maxHeight = 360,
}) {
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 16,
        padding: '16px 18px',
        boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
          paddingBottom: 10,
          borderBottom: '1px solid rgba(15,23,42,0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
          <Trophy size={16} color="#f59e0b" />
          <span>Bảng Điểm Trực Tiếp</span>
        </div>

        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            background: 'rgba(15,23,42,0.06)',
            padding: '2px 8px',
            borderRadius: 10,
            color: '#64748b',
          }}
        >
          {players.length} người chơi
        </span>
      </div>

      {/* Players List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          maxHeight,
          overflowY: 'auto',
        }}
      >
        {sortedPlayers.map((player, idx) => {
          const isMe = Number(player.userId) === Number(currentUserId);
          const avatarUrl = player.user?.avatarUrl || getUserAvatar(player.userId);
          const rank = idx + 1;

          let rankBadgeBg = 'rgba(15,23,42,0.06)';
          let rankBadgeColor = '#475569';
          let RankIcon = null;

          if (rank === 1) {
            rankBadgeBg = 'linear-gradient(135deg, #fef3c7, #fde68a)';
            rankBadgeColor = '#b45309';
          } else if (rank === 2) {
            rankBadgeBg = 'linear-gradient(135deg, #f1f5f9, #e2e8f0)';
            rankBadgeColor = '#475569';
          } else if (rank === 3) {
            rankBadgeBg = 'linear-gradient(135deg, #ffedd5, #fed7aa)';
            rankBadgeColor = '#9a3412';
          }

          return (
            <div
              key={player.id || idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 10,
                background: isMe ? 'rgba(2,132,199,0.08)' : 'rgba(15,23,42,0.02)',
                border: isMe ? '1.5px solid #0284c7' : '1px solid rgba(15,23,42,0.06)',
                transition: 'transform 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* Rank Badge */}
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: rankBadgeBg,
                    color: rankBadgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 900,
                    fontFamily: 'JetBrains Mono, monospace',
                    flexShrink: 0,
                    border: rank <= 3 ? `1px solid ${rankBadgeColor}33` : 'none',
                  }}
                >
                  {rank === 1 ? (
                    <Trophy size={14} color="#d97706" />
                  ) : rank === 2 ? (
                    <Medal size={14} color="#64748b" />
                  ) : rank === 3 ? (
                    <Medal size={14} color="#b45309" />
                  ) : (
                    rank
                  )}
                </div>

                {/* Avatar */}
                <img
                  src={avatarUrl}
                  alt={player.user?.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                />

                {/* Name */}
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: isMe ? 800 : 600,
                    color: isMe ? '#0284c7' : '#0f172a',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {player.user?.name || `Người chơi ${player.userId}`}
                  {isMe && ' (Bạn)'}
                </span>
              </div>

              {/* Score */}
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 800,
                  color: '#0f172a',
                  marginLeft: 8,
                  flexShrink: 0,
                }}
              >
                {Number(player.score || 0).toLocaleString()} pts
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
