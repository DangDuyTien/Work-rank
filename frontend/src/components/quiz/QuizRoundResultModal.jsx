import React from 'react';
import { CheckCircle2, XCircle, Clock, Lightbulb, Sparkles } from 'lucide-react';
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
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 14,
        padding: '16px 20px',
        boxShadow: '0 4px 20px rgba(15,23,42,0.06)',
        animation: 'fadeIn 0.25s ease',
      }}
    >
      {/* Result Status Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 10,
          background: isMyCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
          border: isMyCorrect ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isMyCorrect ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#10b981',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={20} />
            </div>
          ) : myAnswer ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#ef4444',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <XCircle size={20} />
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#64748b',
                color: '#ffffff',
                flexShrink: 0,
              }}
            >
              <Clock size={20} />
            </div>
          )}

          <div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 800,
                color: isMyCorrect ? '#065f46' : myAnswer ? '#991b1b' : '#334155',
              }}
            >
              {isMyCorrect ? 'CHÍNH XÁC!' : myAnswer ? 'CHƯA CHÍNH XÁC' : 'HẾT THỜI GIAN TRẢ LỜI'}
            </div>
            <div style={{ fontSize: 12, color: '#475569', marginTop: 1 }}>
              Đáp án đúng: <strong style={{ color: '#0f172a' }}>[{correctOption}]</strong>
            </div>
          </div>
        </div>

        {/* Earned Score Badge */}
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 16,
            fontWeight: 900,
            color: isMyCorrect ? '#10b981' : '#94a3b8',
            background: '#ffffff',
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid rgba(15,23,42,0.08)',
          }}
        >
          {isMyCorrect ? `+${myScore} pts` : '+0 pts'}
        </div>
      </div>

      {/* Explanation (if provided) */}
      {explanation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: 'rgba(15,23,42,0.02)',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 12,
            color: '#334155',
            lineHeight: 1.45,
            marginBottom: 12,
            borderLeft: '3px solid #0284c7',
          }}
        >
          <Lightbulb size={14} color="#0284c7" style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Ghi chú:</strong> {explanation}
          </div>
        </div>
      )}

      {/* Mini Players Round Answer Summary */}
      {answers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 6 }}>
            Kết quả các người chơi
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 6 }}>
            {answers.map((ans, idx) => {
              const avatarUrl = ans.user?.avatarUrl || getUserAvatar(ans.user?.id || ans.userId);
              return (
                <div
                  key={ans.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 10px',
                    background: ans.isCorrect ? 'rgba(16,185,129,0.06)' : 'rgba(15,23,42,0.02)',
                    border: ans.isCorrect ? '1px solid rgba(16,185,129,0.2)' : '1px solid rgba(15,23,42,0.06)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <img
                      src={avatarUrl}
                      alt={ans.user?.name}
                      style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ans.user?.name || `User ${ans.userId}`}
                    </span>
                  </div>

                  <div
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontWeight: 800,
                      color: ans.isCorrect ? '#10b981' : '#94a3b8',
                      marginLeft: 4,
                    }}
                  >
                    {ans.isCorrect ? `+${ans.score}` : '0'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transition indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          marginTop: 12,
          paddingTop: 8,
          borderTop: '1px solid rgba(15,23,42,0.06)',
          fontSize: 12,
          fontWeight: 700,
          color: '#0284c7',
        }}
      >
        <Sparkles size={14} />
        <span>{isLastQuestion ? 'Chuẩn bị hiển thị Bảng Tổng Kết...' : 'Chuẩn bị chuyển sang câu tiếp theo...'}</span>
      </div>
    </div>
  );
}
