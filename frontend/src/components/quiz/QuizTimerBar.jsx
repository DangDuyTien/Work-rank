import React from 'react';
import { Clock } from 'lucide-react';

/**
 * QuizTimerBar - Server Authoritative Real Countdown Bar
 * 
 * Displays:
 * - Real seconds remaining (10 → 9 → ... → 0) in bold prominent typography
 * - Smooth progress bar reflecting fraction of timeRemaining / timeTotal
 * - Urgent state styling when timeRemaining <= 3
 */
export default function QuizTimerBar({
  timeRemaining = 10,
  timeTotal = 10,
}) {
  const safeTotal = Math.max(1, timeTotal);
  const clampedRemaining = Math.max(0, Math.min(safeTotal, timeRemaining));
  const percent = Math.max(0, Math.min(100, (clampedRemaining / safeTotal) * 100));
  const isUrgent = clampedRemaining <= 3 && clampedRemaining > 0;
  const isExpired = clampedRemaining <= 0;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        marginTop: 8,
      }}
    >
      {/* Progress Bar Container */}
      <div
        style={{
          flex: 1,
          height: 18,
          borderRadius: 10,
          background: 'rgba(0,0,0,0.5)',
          border: '2px solid rgba(0,0,0,0.8)',
          overflow: 'hidden',
          padding: 2,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.4)',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 6,
            background: isExpired
              ? '#64748b'
              : isUrgent
              ? '#ef4444'
              : 'linear-gradient(90deg, #ec4899 0%, #8b5cf6 25%, #3b82f6 50%, #10b981 75%, #f59e0b 100%)',
            transition: 'width 0.2s linear, background 0.3s ease',
            boxShadow: isUrgent
              ? '0 0 14px rgba(239,68,68,0.8)'
              : '0 0 10px rgba(56,189,248,0.4)',
          }}
        />
      </div>

      {/* Large Bold Countdown Number (e.g. 10s, 9s, 8s... 0s) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 28,
          fontWeight: 900,
          color: isExpired ? '#94a3b8' : isUrgent ? '#ef4444' : '#ffffff',
          letterSpacing: '-1px',
          textShadow: `
            -2px -2px 0 #000,
             2px -2px 0 #000,
            -2px  2px 0 #000,
             2px  2px 0 #000,
             0 3px 8px rgba(0,0,0,0.9)
          `,
          minWidth: 58,
          textAlign: 'right',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
        title={`Thời gian còn lại: ${clampedRemaining}s`}
      >
        <Clock size={16} strokeWidth={2.5} style={{ opacity: 0.8, marginRight: 2 }} />
        <span>{clampedRemaining}s</span>
      </div>
    </div>
  );
}
