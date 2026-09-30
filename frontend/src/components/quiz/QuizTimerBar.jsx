import React from 'react';

export default function QuizTimerBar({
  timeRemaining = 10,
  timeTotal = 10,
}) {
  const percent = Math.max(0, Math.min(100, (timeRemaining / timeTotal) * 100));
  // Score potential (scaled to e.g. 1000 max, decaying with time)
  const scorePotential = Math.round((timeRemaining / Math.max(1, timeTotal)) * 1000);
  const isUrgent = timeRemaining <= 3;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        marginTop: 6,
      }}
    >
      {/* Colorful Gradient Progress Bar */}
      <div
        style={{
          flex: 1,
          height: 16,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.4)',
          border: '2px solid #000000',
          overflow: 'hidden',
          padding: 1,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 8,
            background: isUrgent
              ? '#ef4444'
              : 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 25%, #3b82f6 50%, #10b981 75%, #f59e0b 100%)',
            transition: 'width 0.2s linear',
            boxShadow: '0 0 10px rgba(255,255,255,0.4)',
          }}
        />
      </div>

      {/* Bold Score/Timer Numeric Counter (e.g. 987) */}
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 26,
          fontWeight: 900,
          color: isUrgent ? '#ef4444' : '#ffffff',
          letterSpacing: '-1px',
          textShadow: `
            -2px -2px 0 #000,
             2px -2px 0 #000,
            -2px  2px 0 #000,
             2px  2px 0 #000,
             0 3px 6px rgba(0,0,0,0.8)
          `,
          minWidth: 54,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {scorePotential}
      </div>
    </div>
  );
}
