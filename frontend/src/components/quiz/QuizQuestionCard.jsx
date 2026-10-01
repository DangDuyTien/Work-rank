import React from 'react';
import { HelpCircle, Image, Music, Zap } from 'lucide-react';

export default function QuizQuestionCard({
  question,
}) {
  if (!question) return null;

  const isMusic = question.type === 'MUSIC';
  const isImage = question.type === 'IMAGE';
  const maxPts = question.points || 1000;

  return (
    <div
      style={{
        width: '100%',
        marginBottom: 14,
        background: '#ffffff',
        border: '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 8,
        padding: '16px 20px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
        boxSizing: 'border-box',
        animation: 'fadeIn 0.25s ease-out',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '2px 8px',
            borderRadius: 9999,
            background: isMusic ? 'rgba(124,58,237,0.08)' : isImage ? 'rgba(2,132,199,0.08)' : 'rgba(180,83,9,0.08)',
            border: `1px solid ${isMusic ? 'rgba(124,58,237,0.2)' : isImage ? 'rgba(2,132,199,0.2)' : 'rgba(180,83,9,0.2)'}`,
            color: isMusic ? '#7c3aed' : isImage ? '#0284c7' : '#b45309',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.2px',
            textTransform: 'uppercase',
          }}
        >
          {isMusic ? <Music size={11} /> : isImage ? <Image size={11} /> : <HelpCircle size={11} />}
          <span>{question.category || (isMusic ? 'Đoán Bài Hát' : isImage ? 'Đoán Hình Ảnh' : 'Câu Hỏi')}</span>
        </span>

        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 3,
            fontSize: 11,
            color: '#b45309',
            fontWeight: 700,
            fontFamily: 'JetBrains Mono, monospace',
            background: 'rgba(180, 83, 9, 0.08)',
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          <Zap size={10} />
          <span>Tối đa {maxPts.toLocaleString()}đ</span>
        </span>
      </div>

      <h2
        style={{
          margin: 0,
          fontSize: 'clamp(16px, 2vw, 20px)',
          fontWeight: 700,
          color: '#141414',
          lineHeight: 1.4,
          letterSpacing: '-0.2px',
        }}
      >
        {question.question}
      </h2>
    </div>
  );
}
