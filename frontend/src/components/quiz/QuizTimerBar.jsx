import React, { useEffect, useRef, useState } from 'react';
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
  const [isUrgent, setIsUrgent] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const pointPotRef = useRef(null);
  const secondsRef = useRef(null);
  const progressRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickSecondRef = useRef(null);
  const lastSecondTextRef = useRef('');
  const lastPointPotRef = useRef(null);
  const progressRatioRef = useRef(1);
  const urgentRef = useRef(false);
  const hasExpiredFiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  const lockedRef = useRef(isLocked);

  onExpireRef.current = onExpire;
  lockedRef.current = isLocked;

  useEffect(() => {
    hasExpiredFiredRef.current = false;
    lastTickSecondRef.current = null;
    lastSecondTextRef.current = '';
    lastPointPotRef.current = null;
    progressRatioRef.current = 1;
    urgentRef.current = false;
    setIsUrgent(false);
    setIsExpired(false);

    const start = Number(startTimeMs) || Date.now();
    const duration = Number(durationMs) || 10000;
    const deadline = start + duration;
    const maxPts = Number(maxPoints) || 1000;

    const updateFrame = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, deadline - now);
      const ratio = Math.max(0, Math.min(1, remainingMs / duration));
      progressRatioRef.current = ratio;

      const calculatedPot = Math.round(maxPts * ratio);
      const secs = (remainingMs / 1000).toFixed(1);
      const wholeSecs = Math.ceil(remainingMs / 1000);

      // Keep the 60Hz clock on the DOM. React state on every RAF frame made
      // the whole quiz surface render roughly 180 times per second.
      if (!lockedRef.current && pointPotRef.current && calculatedPot !== lastPointPotRef.current) {
        pointPotRef.current.textContent = `${calculatedPot.toLocaleString()}đ`;
        lastPointPotRef.current = calculatedPot;
      }
      if (secondsRef.current && secs !== lastSecondTextRef.current) {
        secondsRef.current.textContent = `${secs}s`;
        lastSecondTextRef.current = secs;
      }
      if (progressRef.current) {
        progressRef.current.style.transform = `scaleX(${ratio})`;
      }

      const urgent = remainingMs <= 3200 && remainingMs > 0;
      if (urgent !== urgentRef.current) {
        urgentRef.current = urgent;
        setIsUrgent(urgent);
      }

      // Sound tick on integer boundaries in urgent zone
      if (urgent && wholeSecs !== lastTickSecondRef.current && wholeSecs > 0) {
        quizSound.playTick(true);
        lastTickSecondRef.current = wholeSecs;
      }

      if (remainingMs <= 0) {
        setIsExpired(true);
        if (pointPotRef.current && !lockedRef.current) pointPotRef.current.textContent = '0đ';
        if (secondsRef.current) secondsRef.current.textContent = '0.0s';
        if (progressRef.current) progressRef.current.style.transform = 'scaleX(0)';

        if (!hasExpiredFiredRef.current) {
          hasExpiredFiredRef.current = true;
          if (typeof onExpireRef.current === 'function') onExpireRef.current();
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
  }, [startTimeMs, durationMs, maxPoints]);

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
            <span ref={pointPotRef}>
              {isExpired
                ? '0'
                : isLocked && lockedPoints !== null
                  ? Number(lockedPoints).toLocaleString()
                  : Number(lastPointPotRef.current ?? maxPoints).toLocaleString()}đ
            </span>
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
          <span ref={secondsRef}>{isExpired ? '0.0s' : (lastSecondTextRef.current || `${(Number(durationMs) / 1000).toFixed(1)}s`)}</span>
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
            width: '100%',
            transform: `scaleX(${isExpired ? 0 : progressRatioRef.current})`,
            transformOrigin: 'left center',
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
          ref={progressRef}
        />
      </div>
    </div>
  );
}
