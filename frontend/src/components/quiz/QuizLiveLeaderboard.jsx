import React, { useState } from 'react';
import { Trophy, Medal, Crown, Users, ChevronUp, ChevronDown, CheckCircle2 } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

export default function QuizLiveLeaderboard({
  players = [],
  currentUserId = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  if (!players || players.length === 0) return null;

  return (
    <div
      style={{
        width: '100%',
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 14,
        boxShadow: '0 2px 10px rgba(15,23,42,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Dock Bar Header / Horizontal Player Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: 'rgba(15,23,42,0.02)',
          borderBottom: isExpanded ? '1px solid rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
          <Trophy size={14} color="#d97706" />
          <span>Điểm Số Trực Tiếp ({players.length})</span>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 6,
            background: 'transparent',
            border: '1px solid rgba(15,23,42,0.1)',
            color: '#475569',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          <span>{isExpanded ? 'Thu gọn' : 'Chi tiết'}</span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {/* Horizontal Avatar Strip (Reference style dock) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          overflowX: 'auto',
          scrollbarWidth: 'thin',
        }}
      >
        {sortedPlayers.map((player, idx) => {
          const isMe = Number(player.userId) === Number(currentUserId);
          const avatarUrl = player.user?.avatarUrl || getUserAvatar(player.userId);
          const rank = idx + 1;

          return (
            <div
              key={player.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 10,
                background: isMe ? 'rgba(2,132,199,0.08)' : 'transparent',
                border: isMe ? '1px solid rgba(2,132,199,0.3)' : '1px solid transparent',
                minWidth: 70,
                flexShrink: 0,
                position: 'relative',
              }}
            >
              {/* Avatar + Rank Pill */}
              <div style={{ position: 'relative' }}>
                <img
                  src={avatarUrl}
                  alt={player.user?.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: isMe
                      ? '2px solid #0284c7'
                      : rank === 1
                      ? '2px solid #f59e0b'
                      : '2px solid rgba(15,23,42,0.1)',
                  }}
                />
                {rank === 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -4,
                      background: '#f59e0b',
                      color: '#ffffff',
                      borderRadius: '50%',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }}
                  >
                    <Crown size={10} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Player Name */}
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isMe ? 800 : 600,
                  color: isMe ? '#0284c7' : '#0f172a',
                  maxWidth: 64,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                }}
              >
                {player.user?.name ? player.user.name.split(' ').pop() : `User ${player.userId}`}
                {isMe && ' (Bạn)'}
              </span>

              {/* Score Badge */}
              <span
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 800,
                  color: rank === 1 ? '#d97706' : '#475569',
                  background: rank === 1 ? 'rgba(245,158,11,0.1)' : 'rgba(15,23,42,0.05)',
                  padding: '1px 6px',
                  borderRadius: 4,
                }}
              >
                {Number(player.score || 0).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Expanded Leaderboard Drawer Table */}
      {isExpanded && (
        <div
          style={{
            padding: '8px 16px 14px',
            borderTop: '1px solid rgba(15,23,42,0.06)',
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {sortedPlayers.map((player, idx) => {
              const isMe = Number(player.userId) === Number(currentUserId);
              const avatarUrl = player.user?.avatarUrl || getUserAvatar(player.userId);
              const rank = idx + 1;

              return (
                <div
                  key={player.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: isMe ? 'rgba(2,132,199,0.08)' : 'rgba(15,23,42,0.02)',
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 800,
                        color: rank <= 3 ? '#d97706' : '#64748b',
                        width: 20,
                      }}
                    >
                      #{rank}
                    </span>
                    <img src={avatarUrl} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                    <span style={{ fontWeight: isMe ? 800 : 600, color: '#0f172a' }}>
                      {player.user?.name || `Người chơi ${player.userId}`}
                      {isMe && ' (Bạn)'}
                    </span>
                  </div>

                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#0284c7' }}>
                    {Number(player.score || 0).toLocaleString()} pts
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
