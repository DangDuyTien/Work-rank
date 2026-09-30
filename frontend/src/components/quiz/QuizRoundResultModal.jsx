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
        background: 'rgba(15,23,42,0.92)',
        backdropFilter: 'blur(12px)',
        border: '3px solid #000000',
        borderRadius: 16,
        padding: '20px 24px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: '#ffffff',
        width: '90%',
        maxWidth: 460,
        zIndex: 100,
        textAlign: 'center',
        animation: 'fadeIn 0.2s ease',
      }}
    >
      {/* Result Status Icon */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
        {isMyCorrect ? (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(16,185,129,0.5)',
            }}
          >
            <CheckCircle2 size={32} />
          </div>
        ) : myAnswer ? (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#ef4444',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(239,68,68,0.5)',
            }}
          >
            <XCircle size={32} />
          </div>
        ) : (
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '50%',
              background: '#64748b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={32} />
          </div>
        )}
      </div>

      {/* Outcome Title & Score */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 900,
          color: isMyCorrect ? '#34d399' : myAnswer ? '#f87171' : '#cbd5e1',
          marginBottom: 4,
        }}
      >
        {isMyCorrect ? 'CHÍNH XÁC!' : myAnswer ? 'CHƯA CHÍNH XÁC' : 'HẾT THỜI GIAN'}
      </div>

      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 24,
          fontWeight: 900,
          color: isMyCorrect ? '#34d399' : '#94a3b8',
          marginBottom: 12,
        }}
      >
        {isMyCorrect ? `+${myScore} pts` : '+0 pts'}
      </div>

      <div style={{ fontSize: 13, color: '#e2e8f0', marginBottom: 12 }}>
        Đáp án đúng là: <strong style={{ color: '#38bdf8', fontSize: 14 }}>[{correctOption}]</strong>
      </div>

      {/* Explanation snippet */}
      {explanation && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: 'rgba(255,255,255,0.06)',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 12,
            color: '#cbd5e1',
            textAlign: 'left',
            marginBottom: 12,
          }}
        >
          <Lightbulb size={14} color="#38bdf8" style={{ marginTop: 2, flexShrink: 0 }} />
          <span>{explanation}</span>
        </div>
      )}

      {/* Next Question Countdown Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 700,
          color: '#38bdf8',
          paddingTop: 8,
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <Sparkles size={14} />
        <span>{isLastQuestion ? 'Chuyển sang Bảng Tổng Kết...' : 'Chuẩn bị câu tiếp theo...'}</span>
      </div>
    </div>
  );
}
