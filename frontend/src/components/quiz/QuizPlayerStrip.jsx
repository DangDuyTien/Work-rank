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
        padding: '8px 24px 14px',
        gap: 16,
        zIndex: 40,
        flexShrink: 0,
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Left Side: Live Activity / Chat Feed */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 280,
          minWidth: 160,
          maxHeight: 90,
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
              fontSize: 11,
              fontWeight: 500,
              color: '#141414',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            {act.avatar && (
              <QuizAvatar user={{ avatarUrl: act.avatar, name: act.name }} size="xs" />
            )}
            <span style={{ fontWeight: 700, color: act.color === '#f59e0b' ? '#b45309' : act.color === '#34d399' ? '#15803d' : '#141414' }}>
              {act.name}:
            </span>
            <span style={{ color: '#666666' }}>{act.text}</span>
          </div>
        ))}

        {recentActivity.length === 0 && (
          <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
            Trận đấu đang diễn ra...
          </div>
        )}
      </div>

      {/* Right / Center: Player Avatar Tokens Dock */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 2,
          scrollbarWidth: 'none',
        }}
      >
        {sortedPlayers.map((player, idx) => {
          const isMe = Number(player.userId) === Number(currentUserId);
          const rank = idx + 1;
          const name = player.user?.name || `User ${player.userId}`;
          const shortName = name.split(' ').slice(-2).join(' ');

          const borderColor = isMe
            ? '#b45309'
            : rank === 1
            ? '#b45309'
            : 'rgba(0, 0, 0, 0.12)';

          return (
            <div
              key={player.id || idx}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 54,
                position: 'relative',
              }}
            >
              {/* Player Name Tag */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isMe ? '#b45309' : '#141414',
                  background: isMe ? '#fffbeb' : '#ffffff',
                  padding: '1px 5px',
                  borderRadius: 4,
                  border: isMe ? '1px solid rgba(180, 83, 9, 0.3)' : '1px solid rgba(0, 0, 0, 0.08)',
                  marginBottom: 3,
                  whiteSpace: 'nowrap',
                  maxWidth: 68,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  textAlign: 'center',
                }}
              >
                {shortName}
              </div>

              {/* Avatar Token */}
              <div style={{ position: 'relative' }}>
                <QuizAvatar
                  user={player.user || { id: player.userId }}
                  userId={player.userId}
                  size="md"
                  border={`2px solid ${borderColor}`}
                  style={{
                    boxShadow: isMe || rank === 1
                      ? '0 1px 4px rgba(180, 83, 9, 0.2)'
                      : '0 1px 3px rgba(0, 0, 0, 0.06)',
                  }}
                />

                {rank === 1 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -3,
                      background: '#b45309',
                      color: '#ffffff',
                      borderRadius: '50%',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2,
                    }}
                  >
                    <Crown size={9} strokeWidth={3} />
                  </div>
                )}
              </div>

              {/* Score Underneath Avatar */}
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isMe ? '#b45309' : '#141414',
                  marginTop: 2,
                  letterSpacing: '-0.2px',
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
