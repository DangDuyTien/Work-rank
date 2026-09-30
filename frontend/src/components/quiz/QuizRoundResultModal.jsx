import React from 'react';
import { CheckCircle2, XCircle, Sparkles, Trophy, Clock, Lightbulb, ArrowRight } from 'lucide-react';
import { getUserAvatar } from '../../utils/avatar';

export default function QuizRoundResultModal({
  correctOption,
  explanation,
  myAnswer,
  answers = [],
  leaderboard = [],
  isLastQuestion = false,
}) {
  const isMyCorrect = myAnswer?.isCorrect;
  const myScore = myAnswer?.score || 0;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 900,
        margin: '16px auto 0',
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 8px 30px rgba(15,23,42,0.08)',
        animation: 'fadeIn 0.3s ease',
      }}
    >
      {/* Top Banner: Correct/Wrong Outcome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderRadius: 12,
          background: isMyCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: isMyCorrect ? '1.5px solid #10b981' : '1.5px solid #ef4444',
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isMyCorrect ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#10b981',
                color: '#ffffff',
              }}
            >
              <CheckCircle2 size={24} />
            </div>
          ) : myAnswer ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
              }}
            >
              <XCircle size={24} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: '#64748b',
                color: '#ffffff',
              }}
            >
              <Clock size={24} />
            </div>
          )}

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 17,
                fontWeight: 900,
                color: isMyCorrect ? '#065f46' : myAnswer ? '#991b1b' : '#334155',
              }}
            >
              <span>{isMyCorrect ? 'CHÍNH XÁC!' : myAnswer ? 'CHƯA CHÍNH XÁC' : 'HẾT THỜI GIAN'}</span>
              {isMyCorrect && <Sparkles size={16} color="#10b981" />}
            </div>
            <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
              Đáp án đúng: <strong style={{ color: '#0f172a', fontSize: 14 }}>{correctOption}</strong>
            </div>
          </div>
        </div>

        {/* My Score Badge */}
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 18,
            fontWeight: 900,
            color: isMyCorrect ? '#10b981' : '#94a3b8',
            background: '#ffffff',
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid rgba(15,23,42,0.1)',
            boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          }}
        >
          {isMyCorrect ? `+${myScore} điểm` : '+0 điểm'}
        </div>
      </div>

      {/* Explanation text */}
      {explanation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: 'rgba(15,23,42,0.03)',
            padding: '12px 16px',
            borderRadius: 8,
            fontSize: 13,
            color: '#334155',
            lineHeight: 1.45,
            marginBottom: 16,
            borderLeft: '3px solid #0284c7',
          }}
        >
          <Lightbulb size={16} color="#0284c7" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Giải thích:</strong> {explanation}
          </div>
        </div>
      )}

      {/* Players Round Breakdown Grid */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
          Kết quả câu này của các người chơi
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
          {answers.map((ans, idx) => {
            const avatarUrl = ans.user?.avatarUrl || getUserAvatar(ans.user?.id);
            return (
              <div
                key={ans.id || idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: ans.isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(15,23,42,0.02)',
                  border: ans.isCorrect ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(15,23,42,0.06)',
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <img
                    src={avatarUrl}
                    alt={ans.user?.name}
                    style={{ width: 22, height: 22, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {ans.user?.name || `Người chơi ${ans.userId}`}
                  </span>
                </div>

                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: 'JetBrains Mono, monospace',
                    color: ans.isCorrect ? '#10b981' : '#94a3b8',
                  }}
                >
                  {ans.isCorrect ? `+${ans.score}` : '0'}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Question Countdown Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 18,
          fontSize: 13,
          fontWeight: 700,
          color: '#0284c7',
        }}
      >
        <Sparkles size={16} />
        <span>{isLastQuestion ? 'Đang chuyển đến Bảng Kết Quả...' : 'Đang chuyển sang câu tiếp theo...'}</span>
      </div>
    </div>
  );
}
