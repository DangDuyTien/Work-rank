import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Clock, Lightbulb, Sparkles, Trophy, Zap, Crown } from 'lucide-react';
import QuizAvatar from './QuizAvatar';
import quizSound from './quizSound';

/**
 * QuizRoundResultModal - 2-Stage Round Result Experience:
 * Stage 1 (0-1.8s): Answer Reveal + User Outcome & Animated Score Rollup
 * Stage 2 (1.8s-4.0s): Round Standings + "+pts" increments + Fastest Correct Badge
 */
export default function QuizRoundResultModal({
  correctOption,
  explanation,
  myAnswer = null,
  answers = [],
  leaderboard = [],
  fastestCorrectUserId = null,
  fastestResponseTimeMs = null,
  isLastQuestion = false,
  currentUserId = null,
}) {
  const isMyCorrect = Boolean(myAnswer?.isCorrect);
  const myScore = myAnswer?.score || 0;

  // Sub-phase: 'outcome' -> 'leaderboard'
  const [subPhase, setSubPhase] = useState('outcome');
  const [rollScore, setRollScore] = useState(0);
  const rafRef = useRef(null);

  // Auto transition to mini leaderboard after 1.8s
  useEffect(() => {
    setSubPhase('outcome');
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    if (isMyCorrect && myScore > 0) {
      // Animate score rolling from 0 to myScore
      const duration = 500;
      const startTime = Date.now();
      const step = () => {
        const now = Date.now();
        const progress = Math.min(1, (now - startTime) / duration);
        const current = Math.round(myScore * progress);
        setRollScore(current);
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          setRollScore(myScore);
        }
      };
      rafRef.current = requestAnimationFrame(step);
      quizSound.playScoreRoll();
    } else {
      setRollScore(0);
    }

    const timer = setTimeout(() => {
      setSubPhase('leaderboard');
    }, 1800);

    return () => {
      clearTimeout(timer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isMyCorrect, myScore]);

  // Sort leaderboard for round review
  const sortedPlayers = [...leaderboard].sort((a, b) => (b.score || 0) - (a.score || 0));

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 10,
        padding: '20px 24px',
        boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
        color: '#141414',
        width: '92%',
        maxWidth: 440,
        zIndex: 100,
        textAlign: 'center',
        animation: 'modal-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* ── STAGE 1: OUTCOME & USER SCORE ── */}
      {subPhase === 'outcome' ? (
        <div style={{ animation: 'tab-enter 0.26s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          {/* Status Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            {isMyCorrect ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#f0fdf4',
                  color: '#16a34a',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(22, 163, 74, 0.3)',
                  boxShadow: '0 2px 10px rgba(22, 163, 74, 0.15)',
                }}
              >
                <CheckCircle2 size={28} />
              </div>
            ) : myAnswer ? (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#fef2f2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(220, 38, 38, 0.3)',
                  boxShadow: '0 2px 10px rgba(220, 38, 38, 0.15)',
                }}
              >
                <XCircle size={28} />
              </div>
            ) : (
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  background: '#f8f7f4',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1.5px solid rgba(0, 0, 0, 0.08)',
                }}
              >
                <Clock size={26} />
              </div>
            )}
          </div>

          {/* Outcome Title & Animated Score */}
          <div
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: isMyCorrect ? '#15803d' : myAnswer ? '#dc2626' : '#64748b',
              marginBottom: 4,
            }}
          >
            {isMyCorrect ? 'CHÍNH XÁC!' : myAnswer ? 'CHƯA CHÍNH XÁC' : 'HẾT THỜI GIAN'}
          </div>

          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 22,
              fontWeight: 800,
              color: isMyCorrect ? '#15803d' : '#64748b',
              marginBottom: 10,
              letterSpacing: '-0.3px',
            }}
          >
            {isMyCorrect ? `+${rollScore.toLocaleString()} điểm` : '+0 điểm'}
          </div>

          <div style={{ fontSize: 13, color: '#141414', marginBottom: 12 }}>
            Đáp án đúng là: <strong style={{ color: '#b45309', fontSize: 15 }}>[{correctOption}]</strong>
          </div>

          {/* Explanation Snippet */}
          {explanation && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                background: '#f8f7f4',
                border: '1px solid rgba(0, 0, 0, 0.06)',
                padding: '10px 12px',
                borderRadius: 6,
                fontSize: 12,
                color: '#666666',
                textAlign: 'left',
                marginBottom: 12,
                lineHeight: 1.45,
              }}
            >
              <Lightbulb size={14} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
              <span>{explanation}</span>
            </div>
          )}

          {/* Footer countdown note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              color: '#b45309',
              paddingTop: 8,
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <Sparkles size={12} />
            <span>Xem bảng xếp hạng câu này...</span>
          </div>
        </div>
      ) : (
        /* ── STAGE 2: ROUND MINI LEADERBOARD ── */
        <div style={{ animation: 'tab-enter 0.26s cubic-bezier(0.16, 1, 0.3, 1)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              marginBottom: 12,
              fontSize: 14,
              fontWeight: 700,
              color: '#141414',
              textTransform: 'uppercase',
              letterSpacing: '0.3px',
            }}
          >
            <Trophy size={16} color="#b45309" />
            <span>Điểm Số Vòng Này</span>
          </div>

          {/* Player Standings List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 220,
              overflowY: 'auto',
              marginBottom: 14,
              textAlign: 'left',
            }}
          >
            {sortedPlayers.slice(0, 6).map((player, idx) => {
              const isMe = Number(player.userId) === Number(currentUserId);
              const rank = idx + 1;
              const isFastest = Number(player.userId) === Number(fastestCorrectUserId);
              const roundScore = Number(player.roundScore || 0);

              return (
                <div
                  key={player.userId || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    borderRadius: 6,
                    background: isMe ? '#fffbeb' : '#f8f7f4',
                    border: isMe ? '1px solid rgba(180, 83, 9, 0.3)' : '1px solid rgba(0, 0, 0, 0.05)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontWeight: 700,
                        fontSize: 12,
                        color: rank === 1 ? '#b45309' : '#64748b',
                        width: 20,
                        textAlign: 'center',
                        flexShrink: 0,
                      }}
                    >
                      #{rank}
                    </span>

                    <QuizAvatar user={player.user || { id: player.userId }} size="xs" />

                    <div style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isMe ? 700 : 600,
                          color: isMe ? '#b45309' : '#141414',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {player.user?.name || `User ${player.userId}`}
                        {isMe && ' (Bạn)'}
                      </span>

                      {/* ⚡ Fastest Correct Badge */}
                      {isFastest && (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 2,
                            padding: '1px 5px',
                            borderRadius: 3,
                            background: '#fef3c7',
                            color: '#92400e',
                            border: '1px solid rgba(180, 83, 9, 0.25)',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'JetBrains Mono, monospace',
                            flexShrink: 0,
                          }}
                        >
                          <Zap size={9} fill="#b45309" color="#b45309" />
                          <span>Nhanh nhất</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score Delta + Total */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {roundScore > 0 && (
                      <span
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: 11,
                          fontWeight: 700,
                          color: '#15803d',
                        }}
                      >
                        +{roundScore}
                      </span>
                    )}

                    <span
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: 12,
                        fontWeight: 700,
                        color: '#141414',
                      }}
                    >
                      {Number(player.score || 0).toLocaleString()}đ
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Next Question Countdown Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 5,
              fontSize: 11,
              fontWeight: 600,
              color: '#b45309',
              paddingTop: 8,
              borderTop: '1px solid rgba(0, 0, 0, 0.06)',
            }}
          >
            <Sparkles size={12} />
            <span>{isLastQuestion ? 'Chuyển sang Bảng Tổng Kết...' : 'Chuẩn bị câu tiếp theo...'}</span>
          </div>
        </div>
      )}
    </div>
  );
}
