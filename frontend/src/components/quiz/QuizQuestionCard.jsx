import React from 'react';
import { Image as ImageIcon, Music, Clock } from 'lucide-react';
import QuizAudioPlayer from './QuizAudioPlayer';

export default function QuizQuestionCard({
  question,
  questionIndex = 0,
  totalQuestions = 10,
  timeRemaining = 10,
  timeTotal = 10,
  isLocked = false,
}) {
  if (!question) return null;

  const isMusic = question.type === 'MUSIC';
  const progressPercent = Math.max(0, Math.min(100, (timeRemaining / timeTotal) * 100));
  const isUrgent = timeRemaining <= 3;

  return (
    <div
      style={{
        width: '100%',
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 14,
        boxShadow: '0 2px 12px rgba(15,23,42,0.04)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Meta Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          background: 'rgba(15,23,42,0.02)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              background: isMusic ? 'rgba(147,51,234,0.08)' : 'rgba(2,132,199,0.08)',
              color: isMusic ? '#7e22ce' : '#0284c7',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.3px',
            }}
          >
            {isMusic ? <Music size={13} /> : <ImageIcon size={13} />}
            <span>{isMusic ? 'ĐOÁN NHẠC' : 'ĐOÁN HÌNH'}</span>
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              background: '#ffffff',
              padding: '3px 8px',
              borderRadius: 4,
              border: '1px solid rgba(15,23,42,0.06)',
            }}
          >
            {question.category || 'Tổng hợp'}
          </span>
        </div>

        {/* Question Counter & Compact Timer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '3px 10px',
              borderRadius: 6,
              background: isUrgent ? 'rgba(239,68,68,0.1)' : 'rgba(15,23,42,0.05)',
              color: isUrgent ? '#dc2626' : '#0f172a',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 13,
              fontWeight: 800,
              border: isUrgent ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(15,23,42,0.08)',
            }}
          >
            <Clock size={13} color={isUrgent ? '#dc2626' : '#64748b'} />
            <span>{timeRemaining}s</span>
          </div>

          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#475569',
            }}
          >
            Câu <strong style={{ color: '#0f172a', fontSize: 13 }}>{questionIndex + 1}</strong> / {totalQuestions}
          </div>
        </div>
      </div>

      {/* Linear Countdown Progress */}
      <div style={{ width: '100%', height: 3, background: 'rgba(15,23,42,0.06)' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: isUrgent ? '#ef4444' : '#0284c7',
            transition: 'width 0.2s linear, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Main Question Body */}
      <div style={{ padding: '20px 24px 16px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.45,
            textAlign: 'left',
          }}
        >
          {question.question}
        </h2>
      </div>

      {/* Media Centerpiece */}
      <div
        style={{
          padding: '0 24px 20px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isMusic ? (
          <div style={{ width: '100%' }}>
            <QuizAudioPlayer
              audioUrl={question.audioUrl || question.audio_url}
              disabled={isLocked}
            />
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: 640,
              aspectRatio: '16 / 9',
              maxHeight: 320,
              borderRadius: 12,
              overflow: 'hidden',
              background: '#f8fafc',
              border: '1px solid rgba(15,23,42,0.1)',
              boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {question.imageUrl || question.image_url ? (
              <img
                src={question.imageUrl || question.image_url}
                alt="Câu hỏi hình ảnh"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  background: '#f1f5f9',
                  display: 'block',
                }}
                loading="eager"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: 6 }}>
                <ImageIcon size={36} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Hình ảnh câu hỏi</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
