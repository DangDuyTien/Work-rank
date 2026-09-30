import React from 'react';
import { Crown } from 'lucide-react';
import QuizAvatar from './QuizAvatar';

export default function QuizPlayerStrip({
  players = [],
  currentUserId = null,
  recentActivity = [],
}) {
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        width: '100%',
        padding: '8px 24px 16px',
        gap: 20,
        zIndex: 40,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Left Side: Live Activity / Chat Feed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          maxWidth: 280,
          minWidth: 180,
          maxHeight: 110,
          overflowY: 'hidden',
        }}
      >
        {recentActivity.slice(-3).map((act, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 1px 2px rgba(0,0,0,0.8)',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {act.avatar && (
              <QuizAvatar user={{ avatarUrl: act.avatar, name: act.name }} size="xs" />
            )}
            <span style={{ color: act.color || '#38bdf8' }}>{act.name}:</span>
            <span style={{ opacity: 0.9 }}>{act.text}</span>
          </div>
        ))}

        {recentActivity.length === 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', fontStyle: 'italic' }}>
            Trận đấu đang diễn ra...
          </div>
        )}
      </div>

      {/* Right / Center: Player Avatar Tokens Dock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
        }}
      >
        {sortedPlayers.map((player, idx) => {
          const isMe = Number(player.userId) === Number(currentUserId);
          const rank = idx + 1;
          const name = player.user?.name || `User ${player.userId}`;
          const shortName = name.split(' ').slice(-2).join(' ');

          const borderColor = isMe
            ? '#38bdf8'
            : rank === 1
            ? '#f59e0b'
            : 'rgba(255,255,255,0.4)';

          return (
            <div
              key={player.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 64,
                position: 'relative',
              }}
            >
              {/* Player Name Pill */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 900,
                  color: isMe ? '#38bdf8' : '#ffffff',
                  background: 'rgba(0,0,0,0.75)',
                  padding: '1px 6px',
                  borderRadius: 10,
                  border: isMe ? '1px solid #38bdf8' : '1px solid rgba(255,255,255,0.2)',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                  maxWidth: 72,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                  textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                }}
              >
                {shortName}
              </div>

              {/* Avatar Token with Thick Border */}
              <div style={{ position: 'relative' }}>
                <QuizAvatar
                  user={player.user || { id: player.userId }}
                  userId={player.userId}
                  size="lg"
                  border={`3.5px solid ${borderColor}`}
                  style={{
                    boxShadow: isMe
                      ? '0 0 14px rgba(56,189,248,0.7), 0 4px 10px rgba(0,0,0,0.4)'
                      : rank === 1
                      ? '0 0 14px rgba(245,158,11,0.7), 0 4px 10px rgba(0,0,0,0.4)'
                      : '0 4px 10px rgba(0,0,0,0.35)',
                  }}
                />

                {rank === 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: -4,
                      background: '#f59e0b',
                      color: '#ffffff',
                      borderRadius: '50%',
                      padding: 3,
                      border: '1.5px solid #000000',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      zIndex: 2,
                    }}
                  >
                    <Crown size={11} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Big Bold Score Underneath Avatar */}
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 13,
                  fontWeight: 900,
                  color: '#ffffff',
                  marginTop: 3,
                  letterSpacing: '-0.3px',
                  textShadow: `
                    -1.5px -1.5px 0 #000,
                     1.5px -1.5px 0 #000,
                    -1.5px  1.5px 0 #000,
                     1.5px  1.5px 0 #000,
                     0 2px 4px rgba(0,0,0,0.8)
                  `,
                }}
              >
                {Number(player.score || 0).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
