import React, { useState, useEffect, useRef } from 'react';
import { Clock, Zap, Lock } from 'lucide-react';
import quizSound from './quizSound';

/**
 * QuizTimerBar - Speed-Based Live Point Pot & Countdown Timer (Continuous RAF interpolation)
 *
 * Continuously computes exact elapsed time & remaining points strictly from server timestamps:
 * remainingRatio = max(0, 1 - (Date.now() - startTime) / durationMs)
 * currentPot = round(maxPoints * remainingRatio)
 */
export default function QuizTimerBar({
  startTimeMs,
  durationMs = 10000,
  maxPoints = 1000,
  isLocked = false,
  lockedPoints = null,
  onExpire = null,
}) {
  const [pointPot, setPointPot] = useState(maxPoints);
  const [secondsRemaining, setSecondsRemaining] = useState((durationMs / 1000).toFixed(1));
  const [progressPercent, setProgressPercent] = useState(100);
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const rafRef = useRef(null);
  const lastTickSecondRef = useRef(null);
  const hasExpiredFiredRef = useRef(false);

  useEffect(() => {
    hasExpiredFiredRef.current = false;
    lastTickSecondRef.current = null;

    const start = Number(startTimeMs) || Date.now();
    const duration = Number(durationMs) || 10000;
    const deadline = start + duration;
    const maxPts = Number(maxPoints) || 1000;

    const updateFrame = () => {
      const now = Date.now();
      const elapsed = Math.max(0, now - start);
      const remainingMs = Math.max(0, deadline - now);
      const ratio = Math.max(0, Math.min(1, remainingMs / duration));

      const calculatedPot = Math.round(maxPts * ratio);
      const secs = (remainingMs / 1000).toFixed(1);
      const wholeSecs = Math.ceil(remainingMs / 1000);
      const percent = ratio * 100;

      // Update Point Pot (if user locked, display their locked point or local pot)
      setPointPot(calculatedPot);
      setSecondsRemaining(secs);
      setProgressPercent(percent);

      const urgent = remainingMs <= 3200 && remainingMs > 0;
      setIsUrgent(urgent);

      // Sound tick on integer boundaries in urgent zone
      if (urgent && wholeSecs !== lastTickSecondRef.current && wholeSecs > 0) {
        quizSound.playTick(true);
        lastTickSecondRef.current = wholeSecs;
      }

      if (remainingMs <= 0) {
        setIsExpired(true);
        setPointPot(0);
        setSecondsRemaining('0.0');
        setProgressPercent(0);

        if (!hasExpiredFiredRef.current) {
          hasExpiredFiredRef.current = true;
          if (typeof onExpire === 'function') onExpire();
        }
        return; // stop RAF loop
      }

      rafRef.current = requestAnimationFrame(updateFrame);
    };

    rafRef.current = requestAnimationFrame(updateFrame);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [startTimeMs, durationMs, maxPoints, onExpire]);

  // If user has submitted answer, display their locked score value while game continues
  const displayPot = isLocked && lockedPoints !== null ? lockedPoints : pointPot;

  return (
    <div
      style={{
        width: '100%',
        marginTop: 12,
        padding: '12px 16px',
        background: isUrgent ? '#fef2f2' : '#ffffff',
        border: isUrgent ? '1.5px solid rgba(220, 38, 38, 0.4)' : '1px solid rgba(0, 0, 0, 0.08)',
        borderRadius: 8,
        boxShadow: isUrgent
          ? '0 2px 10px rgba(220, 38, 38, 0.12)'
          : '0 1px 3px rgba(0, 0, 0, 0.03)',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
        boxSizing: 'border-box',
        userSelect: 'none',
      }}
    >
      {/* Top Meta Line: Continuous Point Pot + Time */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        {/* Left: POINT POT (Flowing Down Continuous Counter) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 8px',
              borderRadius: 4,
              background: isLocked ? '#fffbeb' : isUrgent ? '#fee2e2' : '#f8f7f4',
              color: isLocked ? '#b45309' : isUrgent ? '#dc2626' : '#141414',
              border: isLocked
                ? '1px solid rgba(180, 83, 9, 0.3)'
                : isUrgent
                ? '1px solid rgba(220, 38, 38, 0.25)'
                : '1px solid rgba(0, 0, 0, 0.08)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.3px',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
            }}
          >
            {isLocked ? <Lock size={12} /> : <Zap size={12} color={isUrgent ? '#dc2626' : '#b45309'} />}
            <span>{isLocked ? 'ĐIỂM ĐÃ KHÓA' : 'POINT POT'}</span>
          </div>

          <span
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 18,
              fontWeight: 800,
              color: isExpired
                ? '#94a3b8'
                : isLocked
                ? '#b45309'
                : isUrgent
                ? '#dc2626'
                : '#b45309',
              letterSpacing: '-0.3px',
            }}
          >
            {displayPot.toLocaleString()}đ
          </span>
        </div>

        {/* Right: Time Countdown */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 16,
            fontWeight: 700,
            color: isExpired ? '#94a3b8' : isUrgent ? '#dc2626' : '#141414',
          }}
        >
          <Clock size={15} style={{ opacity: 0.7 }} />
          <span>{secondsRemaining}s</span>
        </div>
      </div>

      {/* Bottom Progress Bar: Smooth continuous width */}
      <div
        style={{
          width: '100%',
          height: 7,
          borderRadius: 4,
          background: '#dedad0',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${progressPercent}%`,
            borderRadius: 4,
            background: isExpired
              ? '#94a3b8'
              : isUrgent
              ? '#dc2626'
              : isLocked
              ? '#16a34a'
              : '#b45309',
            transition: 'background-color 0.2s ease',
          }}
        />
      </div>
    </div>
  );
}
