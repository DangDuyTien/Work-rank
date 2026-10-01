import React, { useState, useEffect, useRef } from 'react';
import { Crown, Zap, CheckCircle2 } from 'lucide-react';
import QuizAvatar from './QuizAvatar';
import quizSound from './quizSound';

/**
 * AnimatedScore - Smooth rolling number counter for score increases
 */
function AnimatedScore({ targetScore = 0 }) {
  const [displayScore, setDisplayScore] = useState(targetScore);
  const prevScoreRef = useRef(targetScore);

  useEffect(() => {
    if (targetScore === prevScoreRef.current) return;

    const start = prevScoreRef.current;
    const end = targetScore;
    const diff = end - start;
    const duration = 600; // ms
    const startTime = Date.now();

    const animate = () => {
      const now = Date.now();
      const progress = Math.min(1, (now - startTime) / duration);
      // easeOutExpo curve
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = Math.round(start + diff * eased);

      setDisplayScore(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        prevScoreRef.current = end;
      }
    };

    requestAnimationFrame(animate);
    prevScoreRef.current = targetScore;
  }, [targetScore]);

  return <span>{displayScore.toLocaleString()}</span>;
}

/**
 * QuizPlayerStrip - Bottom Dock containing:
 * 1. Answered Strip (avatars of users who answered this round)
 * 2. Activity Feed
 * 3. Player Standings with live rolling scores
 */
export default function QuizPlayerStrip({
  players = [],
  currentUserId = null,
  answeredUserIds = [],
  recentActivity = [],
  roundResult = null,
}) {
  const sortedPlayers = [...players].sort((a, b) => (b.score || 0) - (a.score || 0));

  // Determine answered player objects
  const answeredSet = new Set((answeredUserIds || []).map((id) => Number(id)));

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        padding: '10px 24px 14px',
        gap: 16,
        zIndex: 40,
        flexShrink: 0,
        userSelect: 'none',
        boxSizing: 'border-box',
        background: '#ffffff',
        borderTop: '1px solid rgba(0, 0, 0, 0.08)',
      }}
    >
      {/* ── LEFT: Activity Feed or Status ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 240,
          minWidth: 140,
          maxHeight: 60,
          overflowY: 'hidden',
          flexShrink: 0,
        }}
      >
        {recentActivity.slice(-2).map((act, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 500,
              color: '#141414',
            }}
          >
            <span style={{ fontWeight: 700, color: act.color || '#b45309' }}>
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

      {/* ── CENTER: ANSWERED STRIP (Who answered this question) ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 12px',
          background: '#f8f7f4',
          borderRadius: 8,
          border: '1px solid rgba(0, 0, 0, 0.06)',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: '#666666', textTransform: 'uppercase', letterSpacing: '0.2px' }}>
          Đã trả lời ({answeredSet.size}/{players.length}):
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 28 }}>
          {players.map((p) => {
            const hasAnswered = answeredSet.has(Number(p.userId));
            if (!hasAnswered) return null;

            return (
              <div
                key={p.userId}
                title={`${p.user?.name || `User ${p.userId}`} đã trả lời`}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <QuizAvatar
                  user={p.user || { id: p.userId }}
                  userId={p.userId}
                  size="xs"
                  border="1.5px solid #16a34a"
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    right: -2,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: '#16a34a',
                    border: '1px solid #ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <CheckCircle2 size={8} color="#ffffff" />
                </div>
              </div>
            );
          })}

          {answeredSet.size === 0 && (
            <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
              Chưa ai chọn...
            </span>
          )}
        </div>
      </div>

      {/* ── RIGHT: PLAYERS STANDINGS DOCK ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 10,
          overflowX: 'auto',
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

              {/* Score Underneath Avatar with Rolling Counter */}
              <div
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 11,
                  fontWeight: 700,
                  color: isMe ? '#b45309' : '#141414',
                  marginTop: 2,
                  letterSpacing: '-0.2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                }}
              >
                <AnimatedScore targetScore={player.score || 0} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
