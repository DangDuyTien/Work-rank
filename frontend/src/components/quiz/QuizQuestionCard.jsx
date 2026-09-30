import React from 'react';
import { Image as ImageIcon, Music, Clock, Sparkles, Timer } from 'lucide-react';
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
        maxWidth: 900,
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid rgba(15,23,42,0.1)',
        borderRadius: 20,
        boxShadow: '0 8px 32px rgba(15,23,42,0.08)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 22px',
          borderBottom: '1px solid rgba(15,23,42,0.08)',
          background: 'rgba(15,23,42,0.02)',
        }}
      >
        {/* Mode & Category Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 12px',
              borderRadius: 8,
              background: isMusic ? 'rgba(168,85,247,0.12)' : 'rgba(56,189,248,0.12)',
              color: isMusic ? '#7e22ce' : '#0284c7',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.4px',
            }}
          >
            {isMusic ? <Music size={15} /> : <ImageIcon size={15} />}
            <span>{isMusic ? 'ĐOÁN NHẠC' : 'ĐOÁN HÌNH'}</span>
          </span>

          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#64748b',
              background: 'rgba(15,23,42,0.04)',
              padding: '4px 10px',
              borderRadius: 6,
            }}
          >
            {question.category || 'Tổng hợp'}
          </span>
        </div>

        {/* Question Counter */}
        <div
          style={{
            fontSize: 14,
            fontWeight: 800,
            color: '#0f172a',
            background: 'rgba(15,23,42,0.05)',
            padding: '4px 12px',
            borderRadius: 8,
          }}
        >
          Câu <strong style={{ color: '#0284c7', fontSize: 16 }}>{questionIndex + 1}</strong> / {totalQuestions}
        </div>
      </div>

      {/* Countdown Progress Line */}
      <div style={{ width: '100%', height: 5, background: 'rgba(15,23,42,0.06)' }}>
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            background: isUrgent ? '#ef4444' : '#0284c7',
            transition: 'width 0.2s linear, background-color 0.3s ease',
          }}
        />
      </div>

      {/* Central Question & Timer Arena */}
      <div
        style={{
          padding: '24px 28px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Prominent Circular Countdown Badge (Kahoot style) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: isUrgent ? '#fee2e2' : 'rgba(2,132,199,0.1)',
            border: isUrgent ? '3px solid #ef4444' : '3px solid #0284c7',
            color: isUrgent ? '#dc2626' : '#0284c7',
            fontFamily: 'JetBrains Mono, monospace',
            fontWeight: 900,
            fontSize: 22,
            boxShadow: isUrgent
              ? '0 0 20px rgba(239,68,68,0.4)'
              : '0 0 14px rgba(2,132,199,0.2)',
            transition: 'all 0.2s ease',
            animation: isUrgent ? 'pulse 0.5s infinite alternate' : 'none',
          }}
        >
          {timeRemaining}
        </div>

        {/* Question Title */}
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.4,
            textAlign: 'center',
            maxWidth: 760,
          }}
        >
          {question.question}
        </h2>
      </div>

      {/* Media Centerpiece Stage */}
      <div
        style={{
          padding: '0 28px 24px',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        {isMusic ? (
          <QuizAudioPlayer
            audioUrl={question.audioUrl || question.audio_url}
            disabled={isLocked}
          />
        ) : (
          <div
            style={{
              width: '100%',
              maxWidth: 520,
              height: 260,
              borderRadius: 16,
              overflow: 'hidden',
              background: '#f8fafc',
              border: '1.5px solid rgba(15,23,42,0.1)',
              boxShadow: '0 6px 24px rgba(15,23,42,0.08)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {question.imageUrl || question.image_url ? (
              <img
                src={question.imageUrl || question.image_url}
                alt="Quiz Prompt"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
                loading="eager"
              />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#94a3b8', gap: 8 }}>
                <ImageIcon size={44} />
                <span style={{ fontSize: 13, fontWeight: 600 }}>Hình ảnh câu hỏi</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
