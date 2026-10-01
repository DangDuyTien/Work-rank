import React from 'react';
import { Clock } from 'lucide-react';

/**
 * QuizTimerBar - Server Authoritative Real Countdown Bar (WorkRank Warm Editorial)
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
        gap: 12,
        width: '100%',
        marginTop: 10,
        boxSizing: 'border-box',
      }}
    >
      {/* Progress Bar Container */}
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          background: '#dedad0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            borderRadius: 4,
            background: isExpired
              ? '#94a3b8'
              : isUrgent
              ? '#dc2626'
              : '#b45309',
            transition: 'width 0.15s linear, background-color 0.2s ease',
          }}
        />
      </div>

      {/* Countdown Number (e.g. 10s, 9s... 0s) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 16,
          fontWeight: 700,
          color: isExpired ? '#94a3b8' : isUrgent ? '#dc2626' : '#141414',
          minWidth: 48,
          textAlign: 'right',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}
        title={`Thời gian còn lại: ${clampedRemaining}s`}
      >
        <Clock size={13} style={{ opacity: 0.7 }} />
        <span>{clampedRemaining}s</span>
      </div>
    </div>
  );
}
