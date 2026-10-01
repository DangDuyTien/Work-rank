import React from 'react';
import { CheckCircle2, XCircle, Clock, Lightbulb, Sparkles } from 'lucide-react';

export default function QuizRoundResultModal({
  correctOption,
  explanation,
  myAnswer,
  answers = [],
  isLastQuestion = false,
}) {
  const isMyCorrect = myAnswer?.isCorrect;
  const myScore = myAnswer?.score || 0;

  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.12)',
        borderRadius: 8,
        padding: '18px 22px',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
        color: '#141414',
        width: '90%',
        maxWidth: 420,
        zIndex: 100,
        textAlign: 'center',
        animation: 'fadeIn 0.2s ease',
        boxSizing: 'border-box',
      }}
    >
      {/* Result Status Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
        {isMyCorrect ? (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#f0fdf4',
              color: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(22, 163, 74, 0.25)',
            }}
          >
            <CheckCircle2 size={26} />
          </div>
        ) : myAnswer ? (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#fef2f2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(220, 38, 38, 0.25)',
            }}
          >
            <XCircle size={26} />
          </div>
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: '#f8f7f4',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(0, 0, 0, 0.08)',
            }}
          >
            <Clock size={24} />
          </div>
        )}
      </div>

      {/* Outcome Title & Score */}
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: isMyCorrect ? '#15803d' : myAnswer ? '#dc2626' : '#64748b',
          marginBottom: 2,
        }}
      >
        {isMyCorrect ? 'CHÍNH XÁC!' : myAnswer ? 'CHƯA CHÍNH XÁC' : 'HẾT THỜI GIAN'}
      </div>

      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 18,
          fontWeight: 700,
          color: isMyCorrect ? '#15803d' : '#64748b',
          marginBottom: 10,
        }}
      >
        {isMyCorrect ? `+${myScore} điểm` : '+0 điểm'}
      </div>

      <div style={{ fontSize: 13, color: '#141414', marginBottom: 10 }}>
        Đáp án đúng là: <strong style={{ color: '#b45309', fontSize: 14 }}>[{correctOption}]</strong>
      </div>

      {/* Explanation snippet */}
      {explanation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 6,
            background: '#f8f7f4',
            border: '1px solid rgba(0, 0, 0, 0.06)',
            padding: '8px 10px',
            borderRadius: 6,
            fontSize: 12,
            color: '#666666',
            textAlign: 'left',
            marginBottom: 10,
          }}
        >
          <Lightbulb size={13} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{explanation}</span>
        </div>
      )}

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
  );
}
